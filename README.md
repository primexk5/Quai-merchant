# QuaiMerchant — Non-custodial crypto payments for Quai

Accept payments on the Quai network with a plain wallet — no accounts, no KYC, no custody. A customer pays your checkout page, the `PayWithQuai` contract routes the funds straight to your wallet in the same transaction, and the relayer confirms it with a signed webhook your backend can verify.

```
customer                               PayWithQuai (on-chain)               your server
────────                               ──────────────────────               ──────────
checkout page ── payOrderNative ──────▶ verify amount
                                        split fee ─▶ feeRecipient
                                        forward rest ─▶ merchant wallet
                                        emit PaymentReceived
                                                   │
                                                   ▼
                                        relayer (indexer)
                                          wait CONFIRMATIONS
                                          re-check settlement
                                                   │
                                                   ▼
                                        signed POST ──────────────▶ webhook URL
                                        (HMAC-SHA256, retries)        (verify + credit order)
```

Funds never rest in the contract — every payment is routed through and out in one transaction. The relayer only observes; it can never touch funds.

## Repository layout

| Directory | What it is |
| --- | --- |
| [`contracts/`](contracts/) | Hardhat project: `PayWithQuai` UUPS-upgradeable router, governance timelock, mocks and test suite. |
| [`backend/`](backend/) | TypeScript relayer + API: indexer (poll `getLogs`, confirmations, settlement re-check), at-least-once webhook dispatcher with backoff, merchant API with wallet-signature sessions. |
| [`frontend/`](frontend/) | Next.js app: landing page, merchant onboarding, login, dashboard (payments, analytics, settings), checkout demo, docs. |
| [`docs/`](docs/) | Runbooks, integration guides, pitch deck and UI spec. |

## Quick start

### 1. Contracts (one-time, optional for local dev)

```bash
cd contracts
npm install
npx hardhat test          # unit + upgrade tests
npm run deploy:testnet    # deploys PayWithQuai proxy on Cyprus-1
```

The deployment writes `contracts/deployments/<network>.json` — the relayer keys off the `payWithQuai` proxy address.

### 2. Backend (relayer + API)

```bash
cd backend
npm install
cp .env.example .env      # fill in RPC_URL, PAYWITHQUAI_ADDRESS, ADMIN_API_KEY
npm run dev               # http://localhost:8080
npm test                  # vitest suite
```

- `PAYWITHQUAI_ADDRESS` must be the proxy from `contracts/deployments/cyprus1.json`.
- `ADMIN_API_KEY` is the bearer token for onboarding/demo admin routes — generate a long random value.
- Local testing against an `http://localhost` webhook receiver requires `WEBHOOK_ALLOW_INSECURE_URLS=true` (SSRF guard is on by default; production URLs must be HTTPS and resolve to public IPs).
- A throwaway webhook receiver is included: `npm run webhook-receiver`.

### 3. Frontend

```bash
cd frontend
pnpm install
cp .env.local.example .env.local   # backend URLs (comma-separated), admin key, contract addresses
pnpm dev                            # http://localhost:3001
```

The frontend builds the checkout, wraps order registration/payment in `src/lib/payment.ts`, and ships a `/checkout/demo` flow plus an interactive `/docs` page.

## Merchant flow

1. **Onboard** (`/onboarding`) — name, webhook URL, and the wallet that will receive payouts. The backend issues a per-merchant `webhookSecret`.
2. **Log in** (`/login`) — connect the registered wallet and sign a challenge (`quai-merchant-login:<address>:<unixSeconds>`). Sessions are opaque tokens, 24h TTL, verified with `verifyMessage` (5-minute replay window).
3. **Dashboard** — see your payments and webhook deliveries (`/v1/me`, `/v1/me/deliveries`), edit your webhook URL, and grab the checkout snippet.
4. **Receive webhooks** — the relayer POSTs signed `payment.confirmed` events; verify with the secret.

## API

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `GET /health` | — | Liveness |
| `GET /v1/orders/:merchant/:orderId` | public, rate-limited | Order status (RPC-backed) |
| `POST /v1/auth/login` | wallet signature | Create a session |
| `POST /v1/auth/logout` | session | Destroy the session |
| `GET /v1/me` · `PATCH /v1/me` | session | Read/update own merchant profile |
| `GET /v1/me/deliveries` | session | Webhook delivery history for own merchant |
| `GET /v1/merchants` · `POST /v1/merchants` · `PATCH /v1/merchants/:address` | admin (`ADMIN_API_KEY`) | Onboarding & merchant management |
| `GET /v1/deliveries` · `POST /v1/deliveries/:id/retry` | admin | Delivery monitoring & retries |

## Webhook delivery

When a payment reaches finality (default 12 confirmations, with a second on-chain settlement check), the relayer queues exactly one webhook per `tx:logIndex` (idempotent) and delivers it at-least-once with exponential backoff + jitter until success or `WEBHOOK_MAX_ATTEMPTS`.

```http
POST /your/webhook
X-PayWithQuai-Signature: t=<unixSeconds>,v1=<hmacSha256(secret, `${t}.${rawBody}`)>
Content-Type: application/json

{ "type": "payment.confirmed", "id": "<deliveryId>", ... order details, tx hash, amount ... }
```

Verify the signature over the **raw body** (constant-time), tolerate a few seconds of clock skew, and respond `2xx` to acknowledge. See `backend/src/webhooks/signer.ts`.

## Security model

- **Non-custodial**: funds go customer → merchant in one transaction; fee is locked at order registration.
- **Order integrity**: orders are keyed by `(merchant, orderId)` and only the merchant can register/cancel their own — no front-running, no double-settle.
- **Signed webhooks**: HMAC-SHA256 with a per-merchant secret and timestamp binding; replay window is bounded.
- **SSRF guard**: webhook URLs are re-checked before every delivery (no private/loopback, no redirects, HTTPS required in production).
- **Session auth**: message signing with a 5-minute replay window; secrets never leave the wallet.

## Testnet deployment (Cyprus-1)

```json
{
  "payWithQuai": "0x0078cd401e3CF4bE9Bc3b104783c611e35F11816",
  "mockStablecoin": "0x0068f42D5Bd511363f52a1ade1ecD41B4bdD8F8e"
}
```

Chain ID `15000` · RPC `https://orchard.rpc.quai.network`.

## Documentation

The full runbook, integration guides and UI spec live in [`docs/`](docs/) (markdown + rendered PDFs). An interactive copy is served at `/docs` in the frontend.