import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { getAddress } from 'quais';
import { z } from 'zod';
import type { Store } from '../store/index.js';
import type { QuaiClient } from '../chain/client.js';
import type { Config } from '../config.js';
import type { Merchant } from '../types.js';
import { newMerchantId, newWebhookSecret } from '../util/ids.js';
import { assertSafeWebhookUrl, UnsafeWebhookUrlError } from '../webhooks/urlGuard.js';
import { rateLimit } from './rateLimit.js';
import { cors } from './cors.js';
import { cursorScope } from '../indexer/indexer.js';
import { log } from '../logger.js';

const logger = log('api');

/**
 * Builds the HTTP API:
 *   GET  /health                          liveness + indexer cursor
 *   GET  /v1/orders/:merchant/:orderId    order + settlement status (on-chain + local)
 *   GET  /v1/merchants                     (admin) list merchants
 *   POST /v1/merchants                     (admin) onboard a merchant -> returns webhook secret ONCE
 *   PATCH /v1/merchants/:address           (admin) update name/webhookUrl/active without rotating secret
 *   GET  /v1/deliveries                    (admin) recent webhook deliveries (debugging)
 *   POST /v1/deliveries/:id/retry          (admin) re-queue a failed/skipped delivery
 * Admin routes require `Authorization: Bearer <ADMIN_API_KEY>`.
 */
export function createServer(store: Store, client: QuaiClient, cfg: Config): Express {
  const app = express();
  app.use(cors(cfg.CORS_ORIGINS));
  app.use(express.json({ limit: '256kb' }));

  app.get('/health', (_req, res) => {
    const scope = cursorScope(cfg.CHAIN_ID, cfg.PAYWITHQUAI_ADDRESS);
    res.json({
      status: 'ok',
      contract: client.address,
      chainId: cfg.CHAIN_ID,
      cursor: store.getCursor(scope) ?? null,
    });
  });

  // The only unauthenticated route that performs an upstream RPC call — rate-limit per IP so it
  // can't be used to amplify traffic against the Quai node.
  const ordersLimiter = rateLimit({
    windowMs: cfg.PUBLIC_RATE_LIMIT_WINDOW_MS ?? 60_000,
    max: cfg.PUBLIC_RATE_LIMIT_MAX ?? 60,
  });

  app.get('/v1/orders/:merchant/:orderId', ordersLimiter, asyncHandler(async (req, res) => {
    const merchantParam = req.params.merchant ?? '';
    const orderId = req.params.orderId ?? '';
    let merchant: string;
    try {
      merchant = getAddress(merchantParam);
    } catch {
      return res.status(400).json({ error: 'invalid merchant address' });
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(orderId)) {
      return res.status(400).json({ error: 'orderId must be a 32-byte hex string' });
    }

    const order = await client.getOrder(merchant, orderId);
    if (!order.exists) return res.status(404).json({ error: 'order not found' });

    const delivery = store.getDeliveryByOrder(merchant, orderId);
    res.json({
      merchant,
      orderId,
      token: order.token,
      amount: order.amount.toString(),
      feeBps: order.feeBps,
      expiry: order.expiry.toString(),
      settled: order.settled,
      webhook: delivery ? { status: delivery.status, attempts: delivery.attempts } : null,
    });
  }));

  // --- admin ---
  const admin = express.Router();
  admin.use(requireAdmin(cfg));

  admin.get('/merchants', (_req, res) => {
    res.json({ merchants: store.listMerchants().map(publicMerchant) });
  });

  const OnboardSchema = z.object({
    address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'address must be a 20-byte hex address'),
    name: z.string().min(1).max(200),
    webhookUrl: z.string().url(),
  });

  admin.post('/merchants', (req, res) => {
    const parsed = OnboardSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid body', issues: parsed.error.issues });
    }
    // SSRF guard: reject non-https / internal webhook targets up front (see webhooks/urlGuard).
    try {
      assertSafeWebhookUrl(parsed.data.webhookUrl, cfg.WEBHOOK_ALLOW_INSECURE_URLS);
    } catch (e) {
      if (e instanceof UnsafeWebhookUrlError) return res.status(400).json({ error: e.message });
      throw e;
    }
    let address: string;
    try {
      address = getAddress(parsed.data.address);
    } catch {
      // Mixed-case input passes the regex but fails checksum validation — a client error, not
      // a server fault (must not bubble into the 500 handler).
      return res.status(400).json({ error: 'address fails checksum validation' });
    }
    const existing = store.getMerchantByAddress(address);
    if (existing) {
      // Onboarding must not silently rotate the merchant's webhook secret — that would break its
      // signature verification with no warning. Profile updates go through PATCH.
      return res.status(409).json({ error: 'merchant already exists — use PATCH /v1/merchants/:address to update it' });
    }
    const merchant: Merchant = {
      merchantId: newMerchantId(),
      address: address.toLowerCase(),
      name: parsed.data.name,
      webhookUrl: parsed.data.webhookUrl,
      webhookSecret: newWebhookSecret(), // shown exactly once — the merchant must store it
      active: true,
      createdAt: Date.now(),
    };
    store.upsertMerchant(merchant);
    // Payments that arrived before this address was registered were recorded as `skipped`, not
    // lost — re-queue them now so the merchant catches up on anything it missed.
    const requeued = store.requeueSkippedForMerchant(merchant);
    logger.info({ merchantId: merchant.merchantId, address, requeued }, 'merchant onboarded');
    // The secret is returned exactly once — the merchant must store it to verify signatures.
    res.status(201).json({ ...publicMerchant(merchant), webhookSecret: merchant.webhookSecret });
  });

  const PatchMerchantSchema = z
    .object({
      name: z.string().min(1).max(200).optional(),
      webhookUrl: z.string().url().optional(),
      active: z.boolean().optional(),
    })
    .refine((v) => v.name !== undefined || v.webhookUrl !== undefined || v.active !== undefined, {
      message: 'at least one of name, webhookUrl or active is required',
    });

  admin.patch('/merchants/:address', (req, res) => {
    let address: string;
    try {
      address = getAddress(req.params.address ?? '');
    } catch {
      return res.status(400).json({ error: 'invalid merchant address' });
    }
    const existing = store.getMerchantByAddress(address);
    if (!existing) return res.status(404).json({ error: 'merchant not found' });

    const parsed = PatchMerchantSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid body', issues: parsed.error.issues });
    }
    // SSRF guard: if the webhook URL is being changed, hold it to the same policy as onboarding.
    if (parsed.data.webhookUrl !== undefined) {
      try {
        assertSafeWebhookUrl(parsed.data.webhookUrl, cfg.WEBHOOK_ALLOW_INSECURE_URLS);
      } catch (e) {
        if (e instanceof UnsafeWebhookUrlError) return res.status(400).json({ error: e.message });
        throw e;
      }
    }
    // Deliberately NOT rotating the webhook secret here — PATCH updates profile fields (name /
    // url / active); rotating would break the merchant's signature verification out of the blue.
    const { name, webhookUrl, active } = parsed.data;
    const updated: Merchant = {
      ...existing,
      name: name ?? existing.name,
      webhookUrl: webhookUrl ?? existing.webhookUrl,
      active: active ?? existing.active,
    };
    store.upsertMerchant(updated);
    logger.info({ merchantId: updated.merchantId, address, active: updated.active }, 'merchant updated');
    res.json(publicMerchant(updated));
  });

  admin.get('/deliveries', (_req, res) => {
    res.json({ deliveries: store.listDeliveries(100) });
  });

  admin.post('/deliveries/:id/retry', (req, res) => {
    const id = req.params.id ?? '';
    const d = store.getDelivery(id);
    if (!d) return res.status(404).json({ error: 'delivery not found' });
    if (d.status === 'delivered') {
      return res.status(409).json({ error: 'delivery already delivered' });
    }
    if (d.status === 'skipped') {
      // A skipped delivery has no merchant URL to retry — re-queueing it would only make the
      // dispatcher permanently fail it. Onboarding the payout address re-queues it properly.
      return res.status(409).json({ error: 'delivery was skipped (merchant not registered) — onboard the payout address to re-queue it' });
    }
    const nowMs = Date.now();
    store.updateDelivery({
      ...d,
      status: 'pending',
      attempts: 0,
      nextAttemptAt: nowMs,
      lastError: null,
      updatedAt: nowMs,
    });
    logger.info({ id, previous: d.status }, 'delivery re-queued for retry');
    res.json({ id, previously: d.status, status: 'pending', attempts: 0 });
  });

  app.use('/v1', admin);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const e = err as { status?: number; type?: string };
    // Malformed JSON bodies surface as body-parser 4xx errors — a client fault, not a 500.
    if (e.type === 'entity.parse.failed' || (typeof e.status === 'number' && e.status >= 400 && e.status < 500)) {
      return res.status(e.status ?? 400).json({ error: 'invalid request body' });
    }
    logger.error({ err }, 'unhandled API error');
    res.status(500).json({ error: 'internal error' });
  });

  return app;
}

/** Merchant view without the signing secret. */
function publicMerchant(m: Merchant) {
  return {
    merchantId: m.merchantId,
    address: getAddress(m.address),
    name: m.name,
    webhookUrl: m.webhookUrl,
    active: m.active,
    createdAt: m.createdAt,
  };
}

function requireAdmin(cfg: Config) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const given = Buffer.from(token, 'utf8');
    const expected = Buffer.from(cfg.ADMIN_API_KEY, 'utf8');
    // Constant-time comparison — never plain `!==` on a bearer secret.
    const ok = given.length === expected.length && timingSafeEqual(given, expected);
    if (!ok) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    next();
  };
}

function asyncHandler(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}
