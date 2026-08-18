"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Loader2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { WalletSelector } from "@/components/ui/wallet-selector";
import QRCode from "react-qr-code";
import {
  newOrderId,
  parseQuai,
  payOrderNative,
  registerOrder,
  waitForConfirmation,
  ZERO_ADDRESS,
} from "@/lib/payment";

const AMOUNT_QUAI = "25.0";
const ORDER_EXPIRY = 60n * 60n; // 1h

type Stage =
  | { name: "connect" }
  | { name: "ready"; merchant: string }
  | { name: "signing"; step: string }
  | { name: "awaiting"; merchant: string; orderId: string; webhook: string | null }
  | { name: "done"; merchant: string; orderId: string; txHash: string }
  | { name: "error"; message: string };

export default function CheckoutDemoPage() {
  const [stage, setStage] = useState<Stage>({ name: "connect" });

  const pay = async () => {
    if (stage.name !== "ready") return;
    const merchant = stage.merchant;
    const orderId = newOrderId();
    try {
      setStage({ name: "signing", step: "Registering order on-chain…" });
      await registerOrder(
        merchant,
        orderId,
        ZERO_ADDRESS,
        parseQuai(AMOUNT_QUAI),
        ORDER_EXPIRY,
      );
      setStage({ name: "signing", step: "Awaiting wallet approval…" });
      const txHash = await payOrderNative(merchant, orderId, AMOUNT_QUAI);
      setStage({
        name: "awaiting",
        merchant,
        orderId,
        webhook: null,
      });
      const result = await waitForConfirmation(merchant, orderId, (webhook) => {
        setStage((s) => (s.name === "awaiting" ? { ...s, webhook } : s));
      });
      if (result.settledOnChain) {
        setStage({ name: "done", merchant, orderId, txHash });
      } else {
        setStage({
          name: "error",
          message:
            "Timed out waiting for relayer confirmation — the payment may still settle. Check the order on Quaiscan.",
        });
      }
    } catch (err) {
      setStage({ name: "error", message: (err as Error).message });
    }
  };

  if (stage.name === "done") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#171717] px-5 text-white">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
            <Check size={28} />
          </div>

          <p className="mt-6 text-sm text-emerald-300">Payment confirmed</p>
          <h1 className="mt-2 text-3xl font-semibold">
            {AMOUNT_QUAI} QUAI received
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#8b93a7]">
            Your transaction was confirmed on the Quai network and the relayer
            delivered the payment webhook to the merchant.
          </p>

          <div className="mt-6 space-y-2 rounded-2xl border border-white/7 bg-[#171717] p-4 text-left font-mono text-xs text-[#8b93a7]">
            <p className="break-all">
              tx: <span className="text-white">{stage.txHash}</span>
            </p>
            <p className="break-all">
              order:{" "}
              <span className="text-white">{stage.orderId.slice(0, 20)}…</span>
            </p>
          </div>

          <div className="mt-5 flex flex-col items-center gap-3">
            <a
              href={`https://orchard.quaiscan.io/tx/${stage.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm text-[#38bdf8]"
            >
              View transaction on Quaiscan
              <ExternalLink size={14} />
            </a>

            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-[#8b93a7]"
            >
              <ArrowLeft size={15} />
              Return to QuaiMerchant
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#171717] px-5 py-10 text-white">
      <div className="mx-auto max-w-lg">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[#8b93a7] hover:text-[#061018]"
        >
          <ArrowLeft size={15} />
          QuaiMerchant
        </Link>

        <div className="mt-10 rounded-3xl border border-white/7 bg-[#171717] p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Quai Store</p>
              <p className="mt-1 text-xs text-[#8b93a7]">Secure checkout</p>
            </div>

            <Logo className="h-10 w-10" />
          </div>

          <div className="my-7 h-px bg-[#171717]/4" />

          <div className="text-center">
            <p className="text-sm text-[#8b93a7]">Total to pay</p>
            <p className="mt-2 text-5xl font-semibold tracking-tight">
              {AMOUNT_QUAI}
            </p>
            <p className="mt-1 text-sm text-[#38bdf8]">QUAI</p>
            <p className="mt-2 text-xs text-[#8b93a7]">
              ≈ $20.00 USD · Quai Orchard testnet
            </p>
          </div>

          <div className="mt-8 rounded-2xl border border-white/7 bg-[#171717] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Quai Network</p>
                <p className="mt-1 text-xs text-[#8b93a7]">
                  Settlement network
                </p>
              </div>

              <Check size={17} className="text-emerald-300" />
            </div>
          </div>

          {stage.name === "connect" && (
            <div className="mt-6 flex flex-col items-center rounded-2xl border border-white/7 bg-[#171717] p-6">
              <div className="mb-5 rounded-2xl bg-white p-3 shadow-md">
                <QRCode
                  value={`quai:0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7?amount=${AMOUNT_QUAI}`}
                  size={160}
                  level="M"
                />
              </div>
              <p className="mb-5 text-center text-sm text-[#8b93a7]">
                Scan with your mobile wallet, or connect extension below.
              </p>
              <div className="w-full">
                <WalletSelector
                  connectedAddress={null}
                  onConnected={(address) =>
                    setStage({ name: "ready", merchant: address })
                  }
                  label="Connect wallet to pay"
                />
              </div>
            </div>
          )}

          {stage.name === "ready" && (
            <>
              <div className="mt-4 rounded-xl border border-white/7 bg-[#171717] px-4 py-3">
                <p className="text-xs text-[#8b93a7]">
                  Connected (merchant + payer)
                </p>
                <p className="mt-1 break-all font-mono text-xs text-white">
                  {stage.merchant}
                </p>
              </div>

              <div className="mt-3">
                <WalletSelector
                  connectedAddress={stage.merchant}
                  onConnected={(address) =>
                    setStage({ name: "ready", merchant: address })
                  }
                />
              </div>

              <button
                onClick={pay}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#38bdf8] py-3.5 text-sm font-semibold text-[#061018] transition hover:bg-[#67d8ff]"
              >
                Pay {AMOUNT_QUAI} QUAI
                <ArrowLeft size={15} className="rotate-180" />
              </button>
            </>
          )}

          {stage.name === "signing" && (
            <div className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/7 bg-[#171717] py-3.5 text-sm text-[#8b93a7]">
              <Loader2 size={16} className="animate-spin text-[#38bdf8]" />
              {stage.step}
            </div>
          )}

          {stage.name === "awaiting" && (
            <div className="mt-4 flex w-full flex-col items-center gap-2 rounded-xl border border-white/7 bg-[#171717] py-3.5 text-sm text-[#8b93a7]">
              <Loader2 size={16} className="animate-spin text-[#38bdf8]" />
              Payment sent — waiting for relayer confirmation…
              <span className="text-xs">
                {stage.webhook
                  ? `webhook status: ${stage.webhook}`
                  : "waiting for the relayer to pick up PaymentReceived"}
              </span>
            </div>
          )}

          {stage.name === "error" && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {stage.message}
              <button
                onClick={() => setStage({ name: "connect" })}
                className="mt-2 block text-xs text-[#38bdf8] hover:underline"
              >
                Try again
              </button>
            </div>
          )}

          <div className="mt-5 flex items-center justify-center gap-5 text-xs text-[#8b93a7]">
            <span className="flex items-center gap-1.5">
              <LockKeyhole size={13} />
              Secure
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={13} />
              Non-custodial
            </span>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-[#4f5868]">
          Live demo against the PayWithQuai router on Quai Orchard testnet —
          payments settle on-chain and are confirmed by the relayer.
        </p>
      </div>
    </main>
  );
}