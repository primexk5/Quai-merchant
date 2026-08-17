import type { Store } from '../store/index.js';
import type { Config } from '../config.js';
import type { WebhookDelivery } from '../types.js';
import { signPayload, SIGNATURE_HEADER } from './signer.js';
import { assertResolvesPublic, UnsafeWebhookUrlError } from './urlGuard.js';
import { backoffMs } from './backoff.js';
import { sleep } from '../util/sleep.js';
import { log } from '../logger.js';

const logger = log('dispatcher');

/** How long a delivery for a deactivated merchant stays parked before it is re-checked, so a
 *  re-activated merchant is picked up again without the sweep hot-looping every second. */
const DEACTIVATED_RECHECK_MS = 3_600_000;

/**
 * Delivers queued webhooks to merchant endpoints with signed bodies, at-least-once semantics, and
 * exponential-backoff retries. State lives in the {@link Store}, so deliveries survive restarts:
 * on boot, any `pending` delivery whose time has come is retried. A delivery is `delivered` on a
 * 2xx response, retried on any other outcome, and `failed` once it exhausts WEBHOOK_MAX_ATTEMPTS.
 */
export class WebhookDispatcher {
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private stopped = false;

  constructor(
    private readonly store: Store,
    private readonly cfg: Config,
    private readonly now: () => number = () => Date.now(),
  ) {}

  start(): void {
    if (this.timer) return;
    // Sweep frequently; each sweep only touches deliveries whose nextAttemptAt has elapsed.
    this.timer = setInterval(() => void this.tick(), 1000);
    this.timer.unref?.();
    logger.info('webhook dispatcher started');
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    // Let an in-flight sweep settle.
    while (this.running) await sleep(20);
  }

  private async tick(): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      const due = this.store.getDueDeliveries(this.now(), 20);
      // Deliver the batch in parallel so a slow or hanging merchant endpoint (up to
      // WEBHOOK_TIMEOUT_MS each) can't stall deliveries to everyone else. Each delivery is
      // isolated — one unexpected failure cannot starve the rest of the queue.
      await Promise.allSettled(due.map((d) => this.safeAttempt(d)));
    } catch (err) {
      logger.error({ err }, 'dispatcher tick failed');
    } finally {
      this.running = false;
    }
  }

  /** Wrapper so a single delivery hitting an unexpected error (e.g. a store bug) cannot abort
   *  the whole sweep: the delivery just stays pending and is retried on the next sweep. */
  private async safeAttempt(d: WebhookDelivery): Promise<void> {
    try {
      await this.attempt(d);
    } catch (err) {
      logger.error({ err, id: d.id }, 'delivery attempt failed unexpectedly — will retry next sweep');
    }
  }

  /** Deliver one webhook once, updating its persisted state based on the outcome. */
  async attempt(d: WebhookDelivery): Promise<void> {
    const merchant = this.store.getMerchantById(d.merchantId);
    if (!merchant) {
      // Merchant record gone (deleted/moved off this store): nothing valid to deliver to.
      this.store.updateDelivery({
        ...d,
        status: 'failed',
        lastError: 'merchant no longer registered',
        updatedAt: this.now(),
      });
      logger.error({ id: d.id, merchantId: d.merchantId }, 'merchant row missing — delivery permanently failed');
      return;
    }
    if (!merchant.active) {
      // Deactivated merchant: park the delivery by pushing nextAttemptAt into the future (no
      // attempt spent, no tight retry loop — the sweep only re-picks it up once per re-check
      // interval), so it resumes automatically if the merchant is re-activated.
      const nextCheck = this.now() + DEACTIVATED_RECHECK_MS;
      this.store.updateDelivery({ ...d, nextAttemptAt: nextCheck, updatedAt: this.now() });
      logger.warn(
        { id: d.id, merchantId: merchant.merchantId },
        'merchant deactivated — delivery held until next re-check',
      );
      return;
    }

    const rawBody = JSON.stringify(d.payload);
    const tsSec = Math.floor(this.now() / 1000);
    const signature = signPayload(merchant.webhookSecret, rawBody, tsSec);

    let ok = false;
    let errText: string | null = null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.cfg.WEBHOOK_TIMEOUT_MS);
    try {
      // SSRF guard: re-resolve the host right before dialing and refuse private/reserved targets.
      // Runs every attempt, so a hostname that later re-points at an internal address (DNS
      // rebinding) is blocked even though it passed the check at onboarding.
      await assertResolvesPublic(new URL(d.url).hostname, this.cfg.WEBHOOK_ALLOW_INSECURE_URLS);
      const res = await fetch(d.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [SIGNATURE_HEADER]: signature,
          'x-paywithquai-event': d.payload.type,
          'x-paywithquai-delivery': d.id,
        },
        body: rawBody,
        signal: controller.signal,
        redirect: 'manual', // never follow a 3xx — its Location could point at an internal host
      });
      // With redirect:'manual', a 3xx is surfaced (as an opaqueredirect, or a real 3xx status on
      // some runtimes) rather than followed. Treat any redirect as a delivery failure.
      if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) {
        errText = 'unexpected redirect (not followed)';
      } else {
        ok = res.ok;
        if (!ok) errText = `HTTP ${res.status}`;
      }
    } catch (err) {
      if (err instanceof UnsafeWebhookUrlError) errText = err.message;
      else errText = (err as Error).name === 'AbortError' ? 'timeout' : (err as Error).message;
    } finally {
      clearTimeout(timeout);
    }

    const attempts = d.attempts + 1;
    const nowMs = this.now();
    if (ok) {
      this.store.updateDelivery({
        ...d,
        status: 'delivered',
        attempts,
        lastError: null,
        updatedAt: nowMs,
      });
      logger.info({ id: d.id, merchantId: d.merchantId, attempts }, 'webhook delivered');
      return;
    }

    if (attempts >= this.cfg.WEBHOOK_MAX_ATTEMPTS) {
      this.store.updateDelivery({
        ...d,
        status: 'failed',
        attempts,
        lastError: errText,
        updatedAt: nowMs,
      });
      logger.error({ id: d.id, merchantId: d.merchantId, attempts, errText }, 'webhook permanently failed');
      return;
    }

    const delay = backoffMs(attempts, this.cfg.WEBHOOK_BASE_BACKOFF_MS, this.cfg.WEBHOOK_MAX_BACKOFF_MS);
    this.store.updateDelivery({
      ...d,
      status: 'pending',
      attempts,
      lastError: errText,
      nextAttemptAt: nowMs + delay,
      updatedAt: nowMs,
    });
    logger.warn({ id: d.id, attempts, errText, retryInMs: delay }, 'webhook failed, will retry');
  }
}
