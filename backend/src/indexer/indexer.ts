import type { QuaiClient } from '../chain/client.js';
import type { Store } from '../store/index.js';
import type { Config } from '../config.js';
import { paymentId, type PaymentEvent, type WebhookDelivery, type WebhookPayload } from '../types.js';
import { sleep } from '../util/sleep.js';
import { log } from '../logger.js';

const logger = log('indexer');

/** Basis-points denominator — must match PayWithQuai.BPS_DENOMINATOR so the off-chain fee/net
 *  figures reported to merchants equal the on-chain split exactly. */
const BPS_DENOMINATOR = 10_000n;

/** Scope key for the persisted indexer cursor — binds it to one (chainId, contract address) so a
 *  stale store file from a previous deployment can never silently skip events for a new one. */
export function cursorScope(chainId: number, contractAddress: string): string {
  return `${chainId}:${contractAddress.toLowerCase()}`;
}

/**
 * Watches the PayWithQuai proxy for `PaymentReceived` events and turns each confirmed settlement
 * into a queued webhook delivery.
 *
 * Finality: only blocks at or below `head - CONFIRMATIONS` are processed, so shallow reorgs never
 * produce a false "paid". As a second guard, every event is re-verified against the on-chain order
 * (`getOrder().settled`) before it is accepted — the same read also yields the fee rate locked at
 * registration, so the webhook can report the exact fee/net split. The cursor (last fully-processed
 * block) is persisted, so a restart resumes exactly where it left off; enqueue is idempotent on
 * (txHash, logIndex), so a replayed block cannot double-deliver.
 */
export class Indexer {
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private stopped = false;

  constructor(
    private readonly client: QuaiClient,
    private readonly store: Store,
    private readonly cfg: Config,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** The store key this indexer owns; scoped so a store file is never reused across a different
   *  chain or contract address. */
  private get scope(): string {
    return cursorScope(this.cfg.CHAIN_ID, this.cfg.PAYWITHQUAI_ADDRESS);
  }

  async start(): Promise<void> {
    await this.initCursor();
    this.timer = setInterval(() => void this.tick(), this.cfg.POLL_INTERVAL_MS);
    this.timer.unref?.();
    logger.info({ pollMs: this.cfg.POLL_INTERVAL_MS }, 'indexer started');
    void this.tick(); // don't wait a full interval for the first pass
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    while (this.running) await sleep(20);
  }

  /** On first ever boot for this (chain, contract), seed the cursor so we don't rescan the whole
   *  chain from block 0. */
  private async initCursor(): Promise<void> {
    if (await this.store.getCursor(this.scope) !== undefined) return;
    let start: number;
    if (this.cfg.START_BLOCK !== undefined) {
      start = Math.max(0, this.cfg.START_BLOCK - 1); // so the first processed block == START_BLOCK
    } else {
      const head = await this.client.getBlockNumber();
      start = Math.max(0, head - this.cfg.CONFIRMATIONS);
      logger.warn({ start }, 'no START_BLOCK set — indexing only new events from current head');
    }
    await this.store.setCursor(this.scope, start);
  }

  private async tick(): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      const cursor = (await this.store.getCursor(this.scope)) ?? 0;
      const head = await this.client.getBlockNumber();
      const safeHead = head - this.cfg.CONFIRMATIONS; // finality boundary
      if (safeHead <= cursor) return; // nothing newly final

      // Chunk large catch-up ranges so a single getLogs call never spans too many blocks.
      const to = Math.min(safeHead, cursor + this.cfg.MAX_BLOCK_RANGE);
      const from = cursor + 1;

      const events = await this.client.getPaymentEvents(from, to);
      for (const e of events) await this.processEvent(e);

      await this.store.setCursor(this.scope, to);
      if (events.length > 0 || to < safeHead) {
        logger.info({ from, to, head, processed: events.length }, 'indexed block range');
      }
    } catch (err) {
      logger.error({ err }, 'indexer tick failed — will retry next interval');
    } finally {
      this.running = false;
    }
  }

  /** Verify a settlement is real, then enqueue exactly one webhook for it. */
  private async processEvent(e: PaymentEvent): Promise<void> {
    const id = paymentId(e);

    // Idempotency: if we already recorded this settlement, do nothing.
    if (await this.store.getDelivery(id)) return;

    // Finality guard #2: the event must correspond to on-chain settled state. We read the full
    // order (not just isSettled) in the same round-trip so the webhook can report the exact fee
    // split — feeBps is locked at registration and isn't carried in the event — and the order
    // nonce (an order id becomes reusable after a purge; the nonce keeps events unambiguous).
    const order = await this.client.getOrder(e.merchant, e.orderId);
    if (!order.exists || !order.settled) {
      logger.warn({ id, merchant: e.merchant, orderId: e.orderId }, 'event not settled on-chain — skipping');
      return;
    }

    const merchant = await this.store.getMerchantByAddress(e.merchant);
    const nowMs = this.now();
    const payload = this.buildPayload(id, e, merchant?.merchantId ?? unknownMerchantId(e.merchant), order.feeBps, order.nonce);

    // No merchant registered for this payout address: record the payment but don't attempt delivery.
    if (!merchant) {
      const skipped: WebhookDelivery = {
        id,
        merchantId: payload.data.merchantId,
        url: '',
        payload,
        status: 'skipped',
        attempts: 0,
        nextAttemptAt: nowMs,
        lastError: 'no merchant registered for payout address',
        createdAt: nowMs,
        updatedAt: nowMs,
      };
      await this.store.insertDeliveryIfAbsent(skipped);
      logger.warn({ id, merchant: e.merchant }, 'payment for unregistered merchant — webhook skipped');
      return;
    }

    const delivery: WebhookDelivery = {
      id,
      merchantId: merchant.merchantId,
      url: merchant.webhookUrl,
      payload,
      status: 'pending',
      attempts: 0,
      nextAttemptAt: nowMs, // eligible immediately; the dispatcher picks it up on its next sweep
      lastError: null,
      createdAt: nowMs,
      updatedAt: nowMs,
    };
    const inserted = await this.store.insertDeliveryIfAbsent(delivery);
    if (inserted) {
      logger.info({ id, merchantId: merchant.merchantId, orderId: e.orderId }, 'payment confirmed — webhook queued');
    }
  }

  private buildPayload(id: string, e: PaymentEvent, merchantId: string, feeBps: number, orderNonce: bigint): WebhookPayload {
    // Mirror the contract's split exactly (PayWithQuai: fee = amount * feeBps / BPS_DENOMINATOR,
    // BPS_DENOMINATOR = 10000, integer division). The merchant nets the remainder.
    const fee = (e.amount * BigInt(feeBps)) / BPS_DENOMINATOR;
    const net = e.amount - fee;
    return {
      id,
      type: 'payment.confirmed',
      created: Math.floor(this.now() / 1000),
      data: {
        merchantId,
        merchant: e.merchant,
        orderId: e.orderId,
        payer: e.payer,
        token: e.token,
        amount: e.amount.toString(),
        feeBps,
        fee: fee.toString(),
        net: net.toString(),
        txHash: e.txHash,
        blockNumber: e.blockNumber,
        timestamp: e.eventTimestamp,
        nonce: Number(orderNonce),
      },
    };
  }
}

/** Placeholder merchant id for payments to addresses we don't have registered yet. */
function unknownMerchantId(address: string): string {
  return `unregistered:${address.toLowerCase()}`;
}
