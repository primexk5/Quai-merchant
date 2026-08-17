import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Info,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { CodeBlock } from "@/components/docs/code-block";
import { DocsSideNav } from "@/components/docs/side-nav";

export const metadata: Metadata = {
  title: "Documentation — QuaiMerchant",
  description:
    "Accept crypto payments on Quai in 3 steps. Merchant integration guide for QuaiMerchant.",
};

const sections = [
  { id: "overview", label: "Overview" },
  { id: "before-you-start", label: "Before you start" },
  { id: "register-order", label: "Step 1 — Register the order" },
  { id: "customer-pays", label: "Step 2 — Customer pays" },
  { id: "webhook", label: "Step 3 — Verify the webhook" },
  { id: "quick-reference", label: "Quick reference" },
  { id: "testing", label: "Testing on testnet" },
];

const received = `const provider = new JsonRpcProvider('https://orchard.rpc.quai.network', undefined, { usePathing: true });
const wallet   = new Wallet(BACKEND_PRIVATE_KEY, provider);   // your payout wallet
const pay      = new Contract(PAYWITHQUAI_ADDRESS, PAYWITHQUAI_ABI, wallet);

const orderId = keccak(\`ord_\${yourInternalRef}_\${Date.now()}\`); // unique bytes32
const amount  = 25000000n;                                      // $25.00, smallest unit

// registerOrder(orderId, token, amount, expiry)   expiry 0 = never expires
const tx = await pay.registerOrder(orderId, TOKEN_ADDRESS, amount, 0n);
await tx.wait();`;

const erc20Pay = `await token.approve(PAYWITHQUAI_ADDRESS, amount);   // customer approves exact amount
await pay.payOrder(MERCHANT_ADDRESS, orderId);       // customer pays`;

const nativePay = `await pay.payOrderNative(MERCHANT_ADDRESS, orderId, { value: amount });`;

const webhookJson = `{
  "id":   "0xabc...:3",
  "type": "payment.confirmed",
  "data": {
    "merchantId": "mch_ab12...",
    "orderId":    "0x...",
    "payer":      "0x...",
    "token":      "0x0000000000000000000000000000000000000000",
    "amount":     "25000000",   // gross the payer sent
    "fee":        "250000",     // platform fee
    "net":        "24750000",   // what you actually received
    "txHash":     "0x...",
    "blockNumber": 1234567
  }
}`;

const webhookVerify = `import express from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';

const app = express();
// IMPORTANT: hash the raw body — not parsed-then-restringified JSON.
app.post('/webhooks/paywithquai', express.raw({ type: 'application/json' }), (req, res) => {
  const header = req.header('X-PayWithQuai-Signature') ?? '';        // "t=...,v1=..."
  const raw    = req.body.toString('utf8');
  const { t, v1 } = Object.fromEntries(header.split(',').map((p) => p.split('=')));

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(t)) > 300) return res.sendStatus(400);   // reject stale (>5 min)

  const expected = createHmac('sha256', WEBHOOK_SECRET).update(\`\${t}.\${raw}\`).digest();
  const received = Buffer.from(v1, 'hex');
  const ok = received.length === expected.length && timingSafeEqual(received, expected);
  if (!ok) return res.sendStatus(401);

  const { data } = JSON.parse(raw);
  // Idempotent: if you've already fulfilled this orderId/txHash, just ack and return.
  fulfillOrder(data.orderId, data.net);

  res.sendStatus(200);   // 2xx within 10s = success. Anything else is retried.
});`;

const testnet = `npx hardhat run scripts/deploy.js --network cyprus1   # deploys contract + mock stablecoin
npx hardhat run scripts/payDemo.js --network cyprus1  # mints, registers, approves, pays`;

function SectionHeading({
  id,
  kicker,
  title,
}: {
  id: string;
  kicker?: string;
  title: string;
}) {
  return (
    <div id={id} className="scroll-mt-24">
      {kicker && (
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#38bdf8]">
          {kicker}
        </p>
      )}
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
        {title}
      </h2>
    </div>
  );
}

function Callout({
  tone,
  title,
  children,
}: {
  tone: "info" | "warning" | "success";
  title: string;
  children: React.ReactNode;
}) {
  const styles = {
    info: "border-[#38bdf8]/25 bg-[#38bdf8]/[0.06] text-[#8b93a7]",
    warning: "border-amber-400/25 bg-amber-400/[0.06] text-[#8b93a7]",
    success: "border-[#34d399]/25 bg-[#34d399]/[0.06] text-[#8b93a7]",
  }[tone];

  const Icon = tone === "info" ? Info : tone === "warning" ? AlertTriangle : Check;

  return (
    <div className={`rounded-2xl border p-4 ${styles}`}>
      <p className="flex items-center gap-2 text-sm font-medium text-white">
        <Icon size={15} className={tone === "info" ? "text-[#38bdf8]" : tone === "warning" ? "text-amber-400" : "text-[#34d399]"} />
        {title}
      </p>
      <div className="mt-2 text-sm leading-6">{children}</div>
    </div>
  );
}

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-[#0c1017] text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#0c1017]/80 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo />
            <span className="text-sm font-semibold tracking-tight">
              QUAI<span className="text-[#38bdf8]">Merchant</span>
              <span className="ml-2 rounded-md border border-[#38bdf8]/25 bg-[#38bdf8]/[0.08] px-1.5 py-0.5 text-[10px] font-medium text-[#38bdf8]">
                Docs
              </span>
            </span>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-[#8b93a7] transition hover:text-white"
          >
            <ArrowLeft size={15} />
            Back to site
          </Link>
        </nav>
      </header>

      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-14 lg:grid-cols-[220px_1fr] lg:px-8">
        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b93a7]">
              On this page
            </p>

            <nav className="space-y-1">
              <DocsSideNav sections={sections} />
            </nav>
          </div>
        </aside>

        {/* Content */}
        <article className="min-w-0 max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#38bdf8]">
            Merchant Integration
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Accept crypto payments on Quai in 3 steps.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-[#8b93a7]">
            Funds go straight to your wallet (the contract holds nothing), and
            you get a signed webhook when a payment confirms.
          </p>

          {/* Overview */}
          <section className="mt-12">
            <SectionHeading id="overview" kicker="Overview" title="The flow at a glance" />

            <div className="mt-6 space-y-3">
              {[
                {
                  n: "1",
                  t: "Register an order",
                  d: "Your backend registers the expected payment on-chain.",
                },
                {
                  n: "2",
                  t: "Customer pays",
                  d: "One contract call — ERC-20 or native QUAI.",
                },
                {
                  n: "3",
                  t: "We POST a webhook",
                  d: "Signed webhook confirms the payment; you fulfill.",
                },
              ].map((s) => (
                <div
                  key={s.n}
                  className="flex items-start gap-4 rounded-2xl border border-white/[0.07] bg-[#0c1017] p-5"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#38bdf8]/10 text-sm font-bold text-[#38bdf8]">
                    {s.n}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{s.t}</p>
                    <p className="mt-1 text-sm leading-6 text-[#8b93a7]">
                      {s.d}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Before you start */}
          <section className="mt-16">
            <SectionHeading id="before-you-start" kicker="Setup" title="Before you start" />

            <p className="mt-5 text-[15px] leading-7 text-[#8b93a7]">
              Your platform operator gives you three things at onboarding:
            </p>

            <div className="mt-5 overflow-hidden rounded-2xl border border-white/[0.07]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.07] bg-white/[0.02]">
                    <th className="px-4 py-3 font-medium text-[#8b93a7]">
                      You receive
                    </th>
                    <th className="px-4 py-3 font-medium text-[#8b93a7]">
                      What it&apos;s for
                    </th>
                  </tr>
                </thead>
                <tbody className="text-[#c9d4e0]">
                  <tr className="border-b border-white/[0.07]">
                    <td className="px-4 py-3 font-mono text-[13px]">
                      PAYWITHQUAI_ADDRESS
                    </td>
                    <td className="px-4 py-3 text-[#8b93a7]">
                      The contract address you register orders on
                    </td>
                  </tr>
                  <tr className="border-b border-white/[0.07]">
                    <td className="px-4 py-3 font-mono text-[13px]">
                      webhookSecret
                    </td>
                    <td className="px-4 py-3 text-[#8b93a7]">
                      Secret key to verify webhooks are really from us
                      <span className="ml-1 text-[#e0a95e]">
                        (shown once — store it safely)
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-[13px]">
                      merchantId
                    </td>
                    <td className="px-4 py-3 text-[#8b93a7]">
                      Your platform id, e.g. <span className="font-mono">mch_ab12...</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-5 space-y-4">
              <Callout tone="info" title="Same zone — this matters">
                Quai is sharded. Your payout wallet, your customers, and the
                contract must all be in the same zone (the contract address
                prefix tells you which, e.g. <span className="font-mono text-[#c9d4e0]">0x00…</span> =
                Cyprus-1). Value can&apos;t move between zones.
              </Callout>

              <Callout tone="info" title="Amounts are in the token's smallest unit">
                Always use strings/bigint — never floats. For a 6-decimal
                stablecoin, <span className="font-mono text-[#c9d4e0]">$25.00</span> ={" "}
                <span className="font-mono text-[#c9d4e0]">25000000</span>. QUAI is{" "}
                <span className="font-mono text-[#c9d4e0]">token = address(0)</span>.
              </Callout>
            </div>
          </section>

          {/* Step 1 */}
          <section className="mt-16">
            <SectionHeading
              id="register-order"
              kicker="Step 1"
              title="Register the order (from your backend)"
            />

            <p className="mt-5 text-[15px] leading-7 text-[#8b93a7]">
              Register every expected payment before the customer pays.
              Broadcast <span className="text-white">from your payout wallet</span> — that
              wallet becomes both your merchant identity and where the money
              lands.
            </p>

            <div className="mt-5">
              <CodeBlock label="registerOrder.ts" code={received} />
            </div>

            <ul className="mt-4 space-y-2 text-sm leading-6 text-[#8b93a7]">
              <li className="flex gap-2.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#38bdf8]/[0.06]" />
                <span>
                  <span className="font-mono text-[13px] text-[#c9d4e0]">token</span>: an
                  allowlisted ERC-20 address, or{" "}
                  <span className="font-mono text-[13px] text-[#c9d4e0]">address(0)</span>{" "}
                  for native QUAI.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#38bdf8]/[0.06]" />
                <span>
                  The platform fee is locked into the order automatically here —
                  you don&apos;t pass it.
                </span>
              </li>
            </ul>
          </section>

          {/* Step 2 */}
          <section className="mt-16">
            <SectionHeading
              id="customer-pays"
              kicker="Step 2"
              title="Customer pays"
            />

            <p className="mt-5 text-[15px] leading-7 text-[#8b93a7]">
              Point the customer at any checkout you own. Payment is always a
              single contract call.
            </p>

            <p className="mt-5 text-sm font-medium text-white">ERC-20 — approve, then pay:</p>
            <div className="mt-3">
              <CodeBlock label="pay.ts" code={erc20Pay} />
            </div>

            <p className="mt-5 text-sm font-medium text-white">Native QUAI — send exact value:</p>
            <div className="mt-3">
              <CodeBlock label="pay.ts" code={nativePay} />
            </div>

            <Callout tone="success" title="One transaction, zero double-fulfillment">
              The contract splits off the fee, forwards the rest to your wallet,
              and marks the order settled — all in one transaction. A second
              payment reverts, so double-fulfillment is impossible.
            </Callout>
          </section>

          {/* Step 3 */}
          <section className="mt-16">
            <SectionHeading
              id="webhook"
              kicker="Step 3"
              title="Receive & verify the webhook"
            />

            <p className="mt-5 text-[15px] leading-7 text-[#8b93a7]">
              When the payment is final, we POST one webhook to your endpoint:
            </p>

            <div className="mt-5">
              <CodeBlock label="POST payload" code={webhookJson} />
            </div>

            <p className="mt-5 text-[15px] leading-7 text-[#8b93a7]">
              <span className="font-medium text-white">Always verify the signature</span>{" "}
              before trusting a webhook, then credit{" "}
              <span className="font-mono text-[13px] text-[#c9d4e0]">net</span> to the
              order.
            </p>

            <div className="mt-5">
              <CodeBlock label="verify.ts" code={webhookVerify} />
            </div>

            <Callout tone="warning" title="Endpoint requirements">
              Your endpoint must be <span className="text-white">https</span>, publicly
              reachable, respond <span className="text-white">2xx within 10s</span>, and be{" "}
              <span className="text-white">idempotent</span> — the same payment can arrive
              more than once.
            </Callout>
          </section>

          {/* Quick reference */}
          <section className="mt-16">
            <SectionHeading
              id="quick-reference"
              kicker="Reference"
              title="Quick reference"
            />

            <p className="mt-5 text-sm font-medium text-white">
              Check an order&apos;s status yourself (fallback if you miss a webhook):
            </p>
            <div className="mt-3">
              <CodeBlock
                label="GET"
                code={`GET /v1/orders/0x<merchant>/0x<orderId>
→ { merchant, orderId, token, amount, feeBps, expiry, settled, webhook }`}
              />
            </div>

            <p className="mt-5 text-sm font-medium text-white">Common reverts to surface to customers:</p>
            <div className="mt-3 overflow-hidden rounded-2xl border border-white/[0.07]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.07] bg-white/[0.02]">
                    <th className="px-4 py-3 font-medium text-[#8b93a7]">Revert</th>
                    <th className="px-4 py-3 font-medium text-[#8b93a7]">Meaning</th>
                  </tr>
                </thead>
                <tbody className="text-[#c9d4e0]">
                  {[
                    ["OrderAlreadySettled", "already paid"],
                    ["OrderExpired", "past the expiry timestamp"],
                    [
                      "IncorrectNativeValue",
                      "msg.value ≠ the order amount (native path)",
                    ],
                    [
                      "WrongPaymentPath",
                      "used the ERC-20 call on a native order, or vice-versa",
                    ],
                    ["OrderNotFound", "no such order for that merchant"],
                  ].map(([revert, meaning]) => (
                    <tr key={revert} className="border-b border-white/[0.07] last:border-0">
                      <td className="px-4 py-3 font-mono text-[13px] text-[#e0a95e]">
                        {revert}
                      </td>
                      <td className="px-4 py-3 text-[#8b93a7]">{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-6 text-sm font-medium text-white">
              Managing orders (all from your payout wallet):
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-[#8b93a7]">
              <li className="flex gap-2.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#38bdf8]/[0.06]" />
                <span>
                  <span className="font-mono text-[13px] text-[#c9d4e0]">cancelOrder(orderId)</span>{" "}
                  — cancel an unpaid order and free the id.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#38bdf8]/[0.06]" />
                <span>
                  <span className="font-mono text-[13px] text-[#c9d4e0]">purgeSettledOrder(orderId)</span>{" "}
                  — reclaim storage 1 day after settlement.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#38bdf8]/[0.06]" />
                <span>
                  Use a fresh <span className="font-mono text-[13px] text-[#c9d4e0]">orderId</span>{" "}
                  per payment; reusing ids makes status lookups ambiguous.
                </span>
              </li>
            </ul>
          </section>

          {/* Testing */}
          <section className="mt-16">
            <SectionHeading
              id="testing"
              kicker="Testnet"
              title="Testing on testnet"
            />

            <div className="mt-5">
              <CodeBlock label="Terminal" code={testnet} />
            </div>

            <Callout tone="info" title="Running locally">
              Run a relayer locally against the same RPC. For local endpoints
              only, set{" "}
              <span className="font-mono text-[13px] text-[#c9d4e0]">
                WEBHOOK_ALLOW_INSECURE_URLS=true
              </span>{" "}
              to allow <span className="font-mono text-[13px] text-[#c9d4e0]">http://localhost</span>{" "}
              webhook targets.
            </Callout>
          </section>

          {/* Bottom CTA */}
          <section className="mt-16 rounded-3xl border border-[#38bdf8]/25 bg-[#38bdf8]/[0.06] p-8">
            <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
              <div>
                <p className="text-lg font-semibold">Ready to accept payments?</p>
                <p className="mt-1 text-sm text-[#8b93a7]">
                  Set up your merchant profile and connect a settlement wallet.
                </p>
              </div>
              <Link
                href="/onboarding"
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#38bdf8] px-5 text-sm font-medium text-[#061018] transition hover:bg-[#67d8ff]"
              >
                Get started
                <ArrowRight size={15} />
              </Link>
            </div>
          </section>

          {/* Footer */}
          <footer className="mt-16 flex flex-col gap-4 border-t border-white/[0.07] py-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <Logo className="h-6 w-6" />
              <span className="text-sm font-medium text-[#8b93a7]">
                QuaiMerchant
              </span>
            </div>
            <p className="text-xs text-[#4f5868]">
              Built on Quai Network · Non-custodial payments
            </p>
          </footer>
        </article>
      </div>
    </main>
  );
}