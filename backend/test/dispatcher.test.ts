import { describe, it, expect, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, mkdtempSync } from 'node:fs';
import { JsonStore } from '../src/store/json.js';
import { WebhookDispatcher } from '../src/webhooks/dispatcher.js';
import type { Config } from '../src/config.js';
import type { Merchant, WebhookDelivery } from '../src/types.js';

const dirs: string[] = [];
function freshStore(): JsonStore {
  const dir = mkdtempSync(join(tmpdir(), 'pwq-disp-'));
  dirs.push(dir);
  return new JsonStore(join(dir, 'relayer.db'));
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  globalThis.fetch = originalFetch;
});

const originalFetch = globalThis.fetch;

const cfg = {
  WEBHOOK_MAX_ATTEMPTS: 3,
  WEBHOOK_BASE_BACKOFF_MS: 1000,
  WEBHOOK_MAX_BACKOFF_MS: 60_000,
  WEBHOOK_TIMEOUT_MS: 1000,
  // These tests exercise the delivery state machine against example.test / mocked fetch, not the
  // SSRF guard — allow insecure URLs so no real DNS lookup happens. The guard has its own tests
  // below (private-IP reject) and in urlGuard.test.ts.
  WEBHOOK_ALLOW_INSECURE_URLS: true,
} as unknown as Config;

const merchant: Merchant = {
  merchantId: 'mch_1',
  address: '0x00000000000000000000000000000000000000a1',
  name: 'Acme',
  webhookUrl: 'https://example.test/webhook',
  webhookSecret: 'whsec_x',
  active: true,
  createdAt: 1,
};

function delivery(): WebhookDelivery {
  return {
    id: '0xabc:0',
    merchantId: 'mch_1',
    url: 'https://example.test/webhook',
    payload: {
      id: '0xabc:0',
      type: 'payment.confirmed',
      created: 1,
      data: {
        merchantId: 'mch_1',
        merchant: '0x00000000000000000000000000000000000000A1',
        orderId: '0x' + '11'.repeat(32),
        payer: '0x00000000000000000000000000000000000000B2',
        token: '0x0000000000000000000000000000000000000000',
        amount: '25000000',
        feeBps: 50,
        fee: '125000',
        net: '24875000',
        txHash: '0x' + 'ab'.repeat(32),
        blockNumber: 10,
        timestamp: 1,
      },
    },
    status: 'pending',
    attempts: 0,
    nextAttemptAt: 0,
    lastError: null,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('WebhookDispatcher.attempt', () => {
  it('marks delivered on a 2xx and signs the request', async () => {
    const store = freshStore();
    store.upsertMerchant(merchant);
    store.insertDeliveryIfAbsent(delivery());

    let sawSignature = false;
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      sawSignature = typeof headers['x-paywithquai-signature'] === 'string';
      return new Response('ok', { status: 200 });
    }) as typeof fetch;

    const d = new WebhookDispatcher(store, cfg, () => 1_700_000_000_000);
    await d.attempt(store.getDelivery('0xabc:0')!);

    expect(sawSignature).toBe(true);
    expect(store.getDelivery('0xabc:0')!.status).toBe('delivered');
    expect(store.getDelivery('0xabc:0')!.attempts).toBe(1);
  });

  it('keeps pending and schedules a retry on a 5xx', async () => {
    const store = freshStore();
    store.upsertMerchant(merchant);
    store.insertDeliveryIfAbsent(delivery());
    globalThis.fetch = (async () => new Response('boom', { status: 500 })) as typeof fetch;

    const now = 1_700_000_000_000;
    const d = new WebhookDispatcher(store, cfg, () => now);
    await d.attempt(store.getDelivery('0xabc:0')!);

    const after = store.getDelivery('0xabc:0')!;
    expect(after.status).toBe('pending');
    expect(after.attempts).toBe(1);
    expect(after.lastError).toBe('HTTP 500');
    expect(after.nextAttemptAt).toBeGreaterThanOrEqual(now); // scheduled into the future
  });

  it('marks failed after exhausting max attempts', async () => {
    const store = freshStore();
    store.upsertMerchant(merchant);
    store.insertDeliveryIfAbsent({ ...delivery(), attempts: cfg.WEBHOOK_MAX_ATTEMPTS - 1 });
    globalThis.fetch = (async () => new Response('nope', { status: 500 })) as typeof fetch;

    const d = new WebhookDispatcher(store, cfg, () => 1_700_000_000_000);
    await d.attempt(store.getDelivery('0xabc:0')!);

    expect(store.getDelivery('0xabc:0')!.status).toBe('failed');
    expect(store.getDelivery('0xabc:0')!.attempts).toBe(cfg.WEBHOOK_MAX_ATTEMPTS);
  });

  it('holds deliveries for a deactivated merchant without burning attempts', async () => {
    const store = freshStore();
    store.upsertMerchant({ ...merchant, active: false });
    store.insertDeliveryIfAbsent(delivery());
    let fetched = false;
    globalThis.fetch = (async () => {
      fetched = true;
      return new Response('ok', { status: 200 });
    }) as typeof fetch;

    const d = new WebhookDispatcher(store, cfg, () => 1_700_000_000_000);
    await d.attempt(store.getDelivery('0xabc:0')!);

    expect(fetched).toBe(false);
    const held = store.getDelivery('0xabc:0')!;
    expect(held.status).toBe('pending'); // resumes if the merchant is re-activated
    expect(held.attempts).toBe(0);
  });

  it('permanently fails a delivery whose merchant row disappeared', async () => {    const store = freshStore();
    store.insertDeliveryIfAbsent(delivery()); // no merchant row at all
    globalThis.fetch = (async () => {
      throw new Error('must not fetch');
    }) as typeof fetch;

    const d = new WebhookDispatcher(store, cfg, () => 1_700_000_000_000);
    await d.attempt(store.getDelivery('0xabc:0')!);

    const after = store.getDelivery('0xabc:0')!;
    expect(after.status).toBe('failed');
    expect(after.attempts).toBe(0);
    expect(after.lastError).toBe('merchant no longer registered');
  });

  it('refuses to deliver to a private-IP target and never fetches (SSRF guard)', async () => {
    const store = freshStore();
    store.upsertMerchant({ ...merchant, webhookUrl: 'https://127.0.0.1/webhook' });
    store.insertDeliveryIfAbsent({ ...delivery(), url: 'https://127.0.0.1/webhook' });
    let fetched = false;
    globalThis.fetch = (async () => {
      fetched = true;
      return new Response('ok', { status: 200 });
    }) as typeof fetch;

    // Guard active (allowInsecure false) — a loopback literal is blocked before any fetch.
    const strictCfg = { ...cfg, WEBHOOK_ALLOW_INSECURE_URLS: false } as unknown as Config;
    const d = new WebhookDispatcher(store, strictCfg, () => 1_700_000_000_000);
    await d.attempt(store.getDelivery('0xabc:0')!);

    expect(fetched).toBe(false);
    const after = store.getDelivery('0xabc:0')!;
    expect(after.status).toBe('pending'); // retried, not permanently failed (attempts < max)
    expect(after.attempts).toBe(1);
    expect(after.lastError).toMatch(/private\/reserved IP/);
  });

  it('does not follow a 3xx redirect (treats it as a failed delivery)', async () => {
    const store = freshStore();
    store.upsertMerchant(merchant);
    store.insertDeliveryIfAbsent(delivery());
    globalThis.fetch = (async () => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } })) as typeof fetch;

    const d = new WebhookDispatcher(store, cfg, () => 1_700_000_000_000);
    await d.attempt(store.getDelivery('0xabc:0')!);

    const after = store.getDelivery('0xabc:0')!;
    expect(after.status).toBe('pending');
    expect(after.attempts).toBe(1);
    expect(after.lastError).toMatch(/redirect/);
  });

  it('delivers a due batch concurrently — one slow endpoint does not stall the rest', async () => {
    const store = freshStore();
    store.upsertMerchant(merchant);
    // ids ordered oldest-first: the two slow ones would block the fast one if delivery were serial.
    store.insertDeliveryIfAbsent({ ...delivery(), id: 'slow:0' });
    store.insertDeliveryIfAbsent({ ...delivery(), id: 'slow:1' });
    store.insertDeliveryIfAbsent({ ...delivery(), id: 'fast:2' });

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const SLOW_MS = 300;
    globalThis.fetch = (async (_url, init) => {
      const headers = init!.headers as Record<string, string>;
      if (headers['x-paywithquai-delivery']?.startsWith('slow:')) await sleep(SLOW_MS);
      return new Response('ok', { status: 200 });
    }) as typeof fetch;

    const started = Date.now();
    const d = new WebhookDispatcher(store, cfg, () => 1_700_000_000_000);
    await (d as unknown as { tick(): Promise<void> }).tick();
    const elapsed = Date.now() - started;

    // Serial would take >= 2 × SLOW_MS; parallel takes ~SLOW_MS. Give CI generous slack.
    expect(elapsed).toBeLessThan(SLOW_MS * 1.5);
    expect(['slow:0', 'slow:1', 'fast:2'].map((id) => store.getDelivery(id)!.status)).toEqual([
      'delivered',
      'delivered',
      'delivered',
    ]);
  });
});
