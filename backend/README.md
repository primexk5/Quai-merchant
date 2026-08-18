# Pay with Quai — Backend (Relayer + API)

The off-chain half of the **Pay with Quai** checkout system. It watches the `PayWithQuai` proxy on
a Quai zone for `PaymentReceived` events, waits for finality, and delivers **signed webhooks** to
merchants — turning an on-chain settlement into a `payment.confirmed` callback your app can act on.

```
Quai zone                         this backend                         merchant
──────────                        ────────────                         ────────
PaymentReceived  ──poll getLogs──▶  Indexer
(on proxy)                            │  wait CONFIRMATIONS blocks
                                      │  re-check getOrder().settled on-chain
                                      ▼
                                   Store (queue, idempotent by tx:logIndex)
                                      │
                                      ▼
                                   Dispatcher ──POST signed JSON──▶  webhook URL
                                         (HMAC-SHA256, retries w/ backoff)
```

Everything is keyed to the **proxy** address from `contracts/deployments/<network>.json`
(`payWithQuai`), so contract upgrades never require a backend change.

## Components

| Module | Responsibility |
| --- | --- |
| `src/chain/client.ts` | Read-only quais client: block height (zone-scoped), fetch+decode `PaymentReceived`, `isSettled`/`getOrder`. |
| `src/indexer/indexer.ts` | Poll loop `cursor → head − CONFIRMATIONS`; verify settlement; enqueue one webhook per payment; advance the persisted cursor. |
| `src/webhooks/dispatcher.ts` | At-least-once delivery with exponential-backoff+jitter retries; survives restarts. |
| `src/webhooks/signer.ts` | Stripe-style HMAC signing + verification (also used by the dev receiver). |
| `src/store/json.ts` | Dependency-free, atomically-written JSON persistence behind the `Store` interface. |
| `src/api/server.ts` | HTTP API: health, order status, admin merchant onboarding, delivery inspection. |

## Quickstart

```bash
cd backend
npm install
cp .env.example .env      # fill in PAYWITHQUAI_ADDRESS + ADMIN_API_KEY (see below)
npm run build && npm start # or: npm run dev  (watch mode)
```

Required env (full list with defaults in `.env.example`):

- `RPC_URL`, `CHAIN_ID` — the Quai zone RPC (must be the **same zone** the proxy was deployed to).
- `PAYWITHQUAI_ADDRESS` — the proxy address from the contracts deployment file.
- `ADMIN_API_KEY` — bearer token for the admin endpoints (generate a long random value).
- `START_BLOCK` — set to the proxy's deploy block to index from launch; otherwise the relayer
  starts from the current head on first boot (and remembers its cursor thereafter).

## API

| Method & path | Auth | Purpose |
| --- | --- | --- |
| `GET /health` | — | Liveness + current indexer cursor (scoped to this chain + contract). |
| `GET /v1/orders/:merchant/:orderId` | — | On-chain order + settlement status, plus local webhook status. |
| `GET /v1/merchants` | admin | List onboarded merchants (no secrets). |
| `POST /v1/merchants` | admin | Onboard/update a merchant; returns the webhook secret **once**. |
| `PATCH /v1/merchants/:address` | admin | Update `name` / `webhookUrl` / `active` **without** rotating the secret. |
| `GET /v1/deliveries` | admin | Recent webhook deliveries (debugging). |
| `POST /v1/deliveries/:id/retry` | admin | Re-queue a `failed`/`skipped` delivery as `pending` (manual reconciliation). |

Admin calls need `Authorization: Bearer $ADMIN_API_KEY`.

Onboard a merchant (maps an on-chain payout address → your `merchantId` + webhook URL):

```bash
curl -sX POST localhost:8080/v1/merchants \
  -H "authorization: Bearer $ADMIN_API_KEY" -H 'content-type: application/json' \
  -d '{"address":"0x00..payout","name":"Acme","webhookUrl":"https://acme.test/quai/webhook"}'
# → { "merchantId":"mch_...", "webhookSecret":"whsec_...", ... }   # store the secret!
```

Onboarding an address that received payments *before* it was registered automatically re-queues
those `skipped` payments as `pending` — nothing is lost.

## The webhook

On a confirmed payment the relayer POSTs this body to the merchant's `webhookUrl`:

```json
{
  "id": "0x<txHash>:<logIndex>",
  "type": "payment.confirmed",
  "created": 1786480000,
  "data": {
    "merchantId": "mch_ab12...",
    "merchant": "0x00…",
    "orderId": "0x…(bytes32)",
    "payer": "0x00…",
    "token": "0x0000000000000000000000000000000000000000",
    "amount": "25000000",
    "feeBps": 30,
    "fee": "75000",
    "net": "24925000",
    "txHash": "0x…",
    "blockNumber": 12345,
    "timestamp": 1786479990,
    "nonce": 1
  }
}
```

- `id` is the idempotency key — one per `(txHash, logIndex)`. Deduplicate on it; deliveries are
  at-least-once.
- `token` is `0x0…0` for native QUAI, else the ERC-20 address. `amount` is the **gross**
  smallest-unit value (decimal string); `fee` is the platform fee withheld
  (`floor(amount × feeBps / 10000)`, using the `feeBps` locked when the order was registered) and
  `net = amount − fee` is what the merchant actually received. Reconcile against `net`, not `amount`.

### Verifying the signature

Every request carries `X-PayWithQuai-Signature: t=<unix>,v1=<hmacHex>`, an HMAC-SHA256 over
`${t}.${rawBody}` using your `webhookSecret`. **Verify over the raw bytes**, before JSON parsing:

```ts
import { verifySignature } from './webhooks/signer.js';
const ok = verifySignature(secret, req.header('x-paywithquai-signature'), rawBody, Math.floor(Date.now() / 1000));
```

The check is constant-time and rejects timestamps older than 5 minutes (replay protection).

## Reliability model

- **Finality:** only blocks `≤ head − CONFIRMATIONS` are processed, and each event is re-verified
  against the on-chain order (`getOrder().settled`) — a shallow reorg can never trigger a false
  "paid". That same read yields the fee rate locked at registration, so the webhook's
  `fee`/`net` figures match the on-chain split without an extra RPC call.
- **Idempotency:** payments are keyed by `(txHash, logIndex)`; re-processing a block is a no-op.
- **Durability:** the block cursor and every delivery live in the store, so a restart resumes
  exactly where it left off and re-attempts pending webhooks. The cursor is keyed by
  `chainId:contractAddress`, so reusing a stale store file for a different deployment never
  silently skips events (the indexer simply re-scans).
- **Retries:** non-2xx / timeout → exponential backoff with jitter, up to `WEBHOOK_MAX_ATTEMPTS`,
  then marked `failed`. Batches are delivered concurrently so one slow merchant endpoint never
  stalls everyone else. Deactivated merchants (`PATCH .../merchants/:address` with
  `"active":false`) have their deliveries held (not failed, no attempts spent) and they resume
  automatically on re-activation.
- Payments to an address with **no registered merchant** are recorded as `skipped` (not lost) —
  onboarding that address re-queues them, and `POST /v1/deliveries/:id/retry` manually re-queues
  any `failed` delivery after the operator has fixed the cause.

## Local end-to-end

1. Deploy the contracts to a Quai zone and run the on-chain demo (`contracts/`):
   `npm run deploy:testnet` then `npm run demo:testnet`.
2. Point this backend at the same zone + proxy address in `.env`, set `START_BLOCK` to the deploy
   block, and `npm run dev`.
3. Run the sample merchant endpoint and onboard a merchant pointing at it:
   ```bash
   WEBHOOK_SECRET=whsec_... PORT=9000 npm run webhook-receiver
   ```
   Because the receiver is on `http://localhost`, set `WEBHOOK_ALLOW_INSECURE_URLS=true` in the
   relayer's `.env` for local dev — otherwise the SSRF guard rejects the non-https/loopback URL.
   Trigger a payment (or re-run the demo) → the receiver prints the verified `payment.confirmed`.

> A full on-chain e2e requires a real Quai RPC (testnet/mainnet or a local Quai node) — quais uses
> Quai's sharded RPC (`usePathing`, zone-scoped calls), which a vanilla Hardhat EVM node does not
> speak. The pure logic (signing, backoff, store, dispatcher) is covered by `npm test`.

## Tests

```bash
npm run typecheck   # tsc --noEmit over src + test
npm test            # vitest: signer, backoff, store idempotency, dispatcher delivery/retry/fail
```

## Production notes

- **Storage:** the JSON store is right for a single relayer process. For HA or high volume,
  implement the `Store` interface (`src/store/index.ts`) over SQLite/Postgres — nothing else changes.
- **Secrets:** `ADMIN_API_KEY` and per-merchant `webhookSecret`s are sensitive. Onboarding returns
  a secret once; store it encrypted. Re-onboarding the same address **rotates** the secret. The
  store file (`DATABASE_PATH`) holds secrets in plaintext and is written `0600` inside a `0700`
  directory — keep it off shared/backed-up paths.
- **Webhook URL safety (SSRF):** merchant webhook URLs must be `https` and must not resolve to a
  private/loopback/link-local/reserved address. This is enforced at onboarding **and** re-checked by
  DNS immediately before every delivery (blocking DNS-rebinding), and 3xx redirects are never
  followed. Set `WEBHOOK_ALLOW_INSECURE_URLS=true` **only** for local development.
- **Public endpoint:** `GET /v1/orders/:merchant/:orderId` is unauthenticated and hits the Quai RPC,
  so it is rate-limited per client IP (`PUBLIC_RATE_LIMIT_MAX` requests per
  `PUBLIC_RATE_LIMIT_WINDOW_MS`, default 60/min → `429` with `Retry-After`). Front it with a proxy
  and set `trust proxy` if you terminate TLS upstream.
- **Zone:** the relayer derives its Quai zone from the contract address; run one relayer per zone
  if you deploy the router to multiple zones.
