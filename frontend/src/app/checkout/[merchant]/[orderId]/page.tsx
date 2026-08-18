"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Clock,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { formatQuai, formatUnits } from "quais";
import { Logo } from "@/components/logo";
import { WalletSelector } from "@/components/ui/wallet-selector";
import {
  ZERO_ADDRESS,
  fetchOrderStatus,
  getOrderOnChain,
  payOrder,
  payOrderNative,
  waitForConfirmation,
  type OnChainOrder,
} from "@/lib/payment";
import { getActiveWallet } from "@/lib/wallets";

type Params = Promise<{ merchant: string; orderId: string }>;

type Stage =
  | { name: "loading" }
  | { name: "notfound" }
  | { name: "expired" }
  | { name: "settled" }
  | { name: "ready" }
  | { name: "paying"; step: string }
  | { name: "awaiting"; webhook: string | null }
  | { name: "done"; txHash: string; net: string; symbol: string }
  | { name: "error"; message: string };

function isExpired(expiry: bigint): boolean {
  return expiry > 0n && Math.floor(Date.now() / 1000) > Number(expiry);
}

export default function CheckoutPage({ params }: { params: Params }) {
  const [stage, setStage] = useState<Stage>({ name: "loading" });
  const [merchant, setMerchant] = useState("");
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<OnChainOrder | null>(null);
  const [payTab, setPayTab] = useState<"blip" | "wallet">("blip");
  const [connected, setConnected] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { merchant: m, orderId: id } = await params;
      if (cancelled) return;
      setMerchant(m);
      setOrderId(id);
      try {
        let o = await getOrderOnChain(m, id);
        if (!o?.exists) {
          const status = await fetchOrderStatus(m, id);
          if (!status) {
            setStage({ name: "notfound" });
            return;
          }
          o = {
            merchant: m,
            settled: status.settled,
            exists: true,
            feeBps: status.feeBps,
            token: status.token,
            amount: BigInt(status.amount),
            expiry: BigInt(status.expiry),
            feeRecipient: ZERO_ADDRESS,
            settledAt: 0n,
            expectedPayer: ZERO_ADDRESS,
            nonce: 0n,
          };
        }
        if (!o) {
          setStage({ name: "notfound" });
          return;
        }
        setOrder(o);
        if (!o.exists) {
          setStage({ name: "notfound" });
        } else if (o.settled) {
          setStage({ name: "settled" });
        } else if (isExpired(o.expiry)) {
          setStage({ name: "expired" });
        } else {
          setStage({ name: "ready" });
        }
      } catch {
        setStage({ name: "error", message: "Could not load this order — try again." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  const isNative = (o: OnChainOrder) =>
    o.token.toLowerCase() === ZERO_ADDRESS.toLowerCase();

  const symbol = (o: OnChainOrder) => (isNative(o) ? "QUAI" : "mUSDQ");

  const formatAmount = (o: OnChainOrder, amount: bigint) =>
    isNative(o) ? formatQuai(amount) : formatUnits(amount, 6);

  const netAmount = (o: OnChainOrder) =>
    o.amount - (o.amount * BigInt(o.feeBps)) / 10000n;

  const blipDeepLink = (o: OnChainOrder) => {
    const amount = isNative(o)
      ? formatQuai(o.amount)
      : formatUnits(o.amount, 6);
    return `blip://pay?to=${o.merchant}&amount=${amount}&label=QuaiMerchant`;
  };

  const payerAllowed = (o: OnChainOrder) => {
    if (o.expectedPayer === ZERO_ADDRESS) return true;
    return (
      connected !== null &&
      o.expectedPayer.toLowerCase() === connected.toLowerCase()
    );
  };

  const connectAndPay = async () => {
    if (!order) return;
    const wallet = getActiveWallet();
    if (!wallet) {
      setStage({
        name: "error",
        message: "No wallet connected — pick a wallet above.",
      });
      return;
    }
    if (!payerAllowed(order)) {
      setStage({
        name: "error",
        message: `This order is reserved for ${order.expectedPayer} — your wallet cannot settle it.`,
      });
      return;
    }
    try {
      setStage({ name: "paying", step: "Awaiting wallet approval…" });
      const txHash = isNative(order)
        ? await payOrderNative(order.merchant, orderId, formatQuai(order.amount))
        : await payOrder(order.merchant, orderId, order.token, order.amount);
      setStage({ name: "awaiting", webhook: null });
      await waitForConfirmation(order.merchant, orderId, (webhook) =>
        setStage({ name: "awaiting", webhook }),
      );
      setStage({
        name: "done",
        txHash,
        net: formatAmount(order, netAmount(order)),
        symbol: symbol(order),
      });
    } catch (err: unknown) {
      setStage({
        name: "error",
        message: (err as Error).message || "Payment failed",
      });
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
            {stage.net} {stage.symbol} sent
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#8b93a7]">
            The merchant receives the payment directly — their wallet is also
            getting a signed <code>payment.confirmed</code> webhook from the
            relayer.
          </p>
          <div className="mt-6 space-y-2 rounded-2xl border border-white/7 bg-[#171717] p-4 text-left font-mono text-xs text-[#8b93a7]">
            <p className="break-all">
              tx: <span className="text-white">{stage.txHash}</span>
            </p>
            <p className="break-all">
              order: <span className="text-white">{orderId.slice(0, 20)}…</span>
            </p>
          </div>
          <div className="mt-5 flex flex-col items-center gap-3">
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
              <p className="text-sm font-semibold">Secure checkout</p>
              <p className="mt-1 text-xs text-[#8b93a7]">
                Pay with Quai — non-custodial
              </p>
            </div>
            <Logo className="h-10 w-10" />
          </div>

          <div className="my-7 h-px bg-[#171717]/4" />

          {stage.name === "loading" && (
            <div className="flex flex-col items-center gap-3 py-12 text-sm text-[#8b93a7]">
              <Loader2 size={18} className="animate-spin text-[#38bdf8]" />
              Loading order…
            </div>
          )}

          {stage.name === "notfound" && (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-white">Order not found</p>
              <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[#8b93a7]">
                No order matches this link — it may not have been registered
                yet, or the address is wrong. Ask the merchant for a fresh
                payment link.
              </p>
            </div>
          )}

          {stage.name === "expired" && (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-white">Order expired</p>
              <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[#8b93a7]">
                This payment link has passed its expiry. Ask the merchant to
                issue a new one.
              </p>
            </div>
          )}

          {stage.name === "settled" && (
            <div className="py-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                <Check size={24} />
              </div>
              <p className="mt-4 text-sm font-medium text-white">Already paid</p>
              <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[#8b93a7]">
                This order was settled. The merchant has been notified via
                webhook.
              </p>
            </div>
          )}

          {["ready", "paying", "awaiting"].includes(stage.name) && order && (
            <>
              <div className="text-center">
                <p className="text-sm text-[#8b93a7]">Total to pay</p>
                <p className="mt-2 text-5xl font-semibold tracking-tight">
                  {formatAmount(order, order.amount)}
                </p>
                <p className="mt-1 text-sm text-[#38bdf8]">{symbol(order)}</p>
                {order.feeBps > 0 && (
                  <p className="mt-2 text-xs text-[#8b93a7]">
                    includes {(order.feeBps / 100).toFixed(1)}% platform fee ·
                    merchant receives{" "}
                    <span className="text-white">
                      {formatAmount(order, netAmount(order))} {symbol(order)}
                    </span>
                  </p>
                )}
                {order.expiry > 0n && (
                  <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-[#8b93a7]">
                    <Clock size={12} />
                    expires{" "}
                    {new Date(Number(order.expiry) * 1000).toLocaleString()}
                  </p>
                )}
              </div>

              <div className="mt-5 rounded-xl border border-white/7 bg-[#171717] px-4 py-3">
                <p className="text-xs text-[#8b93a7]">Pay to merchant</p>
                <p className="mt-1 break-all font-mono text-xs text-white">
                  {order.merchant}
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

              {stage.name === "ready" && (
                <>
                  <div className="mt-6 overflow-hidden rounded-2xl border border-white/7 bg-[#171717]">
                    <div className="flex border-b border-white/7">
                      {isNative(order) && (
                        <button
                          onClick={() => setPayTab("blip")}
                          className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition ${
                            payTab === "blip"
                              ? "border-b-2 border-[#C1ED00] text-white"
                              : "text-[#8b93a7] hover:text-white"
                          }`}
                        >
                          <Smartphone size={15} />
                          Pay with Blip
                        </button>
                      )}
                      <button
                        onClick={() => setPayTab("wallet")}
                        className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition ${
                          payTab === "wallet" || !isNative(order)
                            ? "border-b-2 border-[#38bdf8] text-white"
                            : "text-[#8b93a7] hover:text-white"
                        }`}
                      >
                        <Wallet size={15} />
                        Browser Wallet
                      </button>
                    </div>

                    {payTab === "blip" && isNative(order) && (
                      <div className="flex flex-col items-center p-6">
                        <div className="mb-4 rounded-2xl bg-white p-3 shadow-md ring-4 ring-[#C1ED00]/20">
                          <QRCode
                            value={blipDeepLink(order)}
                            size={160}
                            level="M"
                            fgColor="#0F1116"
                          />
                        </div>
                        <p className="mb-1 text-sm font-medium text-white">
                          Scan with Blip
                        </p>
                        <p className="mb-5 text-center text-xs text-[#8b93a7]">
                          Open the Blip app → tap{" "}
                          <span className="font-medium text-white">Scan</span>{" "}
                          → payment pre-fills automatically.
                        </p>
                        <a
                          href={blipDeepLink(order)}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C1ED00] py-3 text-sm font-semibold text-[#0F1116] transition hover:bg-[#d4ff00]"
                        >
                          <Smartphone size={15} />
                          Open in Blip app
                        </a>
                        <p className="mt-3 text-center text-xs text-[#4f5868]">
                          Don&apos;t have Blip?{" "}
                          <a
                            href="https://blippay.me"
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#C1ED00] hover:underline"
                          >
                            Download Blip (iOS & Android)
                          </a>
                        </p>
                      </div>
                    )}

                    {payTab === "wallet" && (
                      <div className="p-6">
                        <p className="mb-4 text-center text-xs text-[#8b93a7]">
                          Connect any Quai-compatible browser wallet (Pelagus,
                          Blip or MetaMask).
                        </p>
                        {connected ? (
                          <div className="space-y-3">
                            <div className="rounded-xl border border-white/7 bg-[#171717] px-4 py-3 text-center">
                              <p className="text-xs text-[#8b93a7]">
                                Paying as
                              </p>
                              <p className="mt-1 break-all font-mono text-xs text-white">
                                {connected}
                              </p>
                            </div>
                            {!payerAllowed(order) && (
                              <p className="rounded-xl border border-amber-400/20 bg-amber-400/6 px-4 py-3 text-center text-xs text-amber-300">
                                This order is reserved for another wallet —
                                you can&apos;t settle it.
                              </p>
                            )}
                            <button
                              onClick={() => void connectAndPay()}
                              disabled={!payerAllowed(order)}
                              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#38bdf8] py-3.5 text-sm font-semibold text-[#061018] transition hover:bg-[#67d8ff] disabled:opacity-50"
                            >
                              Pay {formatAmount(order, order.amount)}{" "}
                              {symbol(order)}
                            </button>
                          </div>
                        ) : (
                          <WalletSelector
                            connectedAddress={null}
                            onConnected={setConnected}
                            label="Connect wallet to pay"
                          />
                        )}
                      </div>
                    )}
                  </div>

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
                </>
              )}

              {stage.name === "paying" && (
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
                      : "waiting for the relayer to pick up PaymentSettled"}
                  </span>
                </div>
              )}
            </>
          )}

          {stage.name === "error" && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {stage.message}
              <button
                onClick={() => {
                  setStage({ name: "loading" });
                  void (async () => {
                    try {
                      const o = await getOrderOnChain(merchant, orderId);
                      setOrder(o);
                      setStage({ name: "ready" });
                    } catch {
                      setStage({ name: "error", message: "Could not load this order." });
                    }
                  })();
                }}
                className="mt-2 block text-xs text-[#38bdf8] hover:underline"
              >
                Try again
              </button>
            </div>
          )}
        </div>

        <p className="mt-5 text-center text-xs text-[#4f5868]">
          Checkout powered by PayWithQuai — the merchant registered this order
          on-chain; your payment goes directly to their wallet.
        </p>
      </div>
    </main>
  );
}
