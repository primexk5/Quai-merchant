"use client";

import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  Plus,
  Users,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { parseError } from "@/lib/utils";
import { parseQuai } from "quais";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { WalletSelector } from "@/components/ui/wallet-selector";
import {
  MUSDQ_ADDRESS,
  ZERO_ADDRESS,
  newOrderId,
  registerOrder,
  createPaymentLink,
  fetchMyLinks,
  type LinkInfo,
} from "@/lib/payment";

/** Exact decimal-string → smallest-unit conversion (no float math). */
function toUnits(decimal: string, decimals: number): bigint {
  const [whole, frac = ""] = decimal.trim().split(".");
  const padded = `${whole}${frac.padEnd(decimals, "0").slice(0, decimals)}`;
  const value = BigInt(padded === "" ? "0" : padded);
  return value;
}

function shortUrl(slug: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/pay/${slug}`;
  }
  return `/pay/${slug}`;
}

const POOL_SIZE_OPTIONS = [5, 10, 20, 50];

export default function LinksPage() {
  const [address, setAddress] = useState<string | null>(null);
  const [token, setToken] = useState<"quai" | "musdq">("quai");
  const [amount, setAmount] = useState("");
  const [shopName, setShopName] = useState("");
  const [expiryHours, setExpiryHours] = useState("");
  const [multiPay, setMultiPay] = useState(false);
  const [poolTarget, setPoolTarget] = useState(10);
  const [busy, setBusy] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerProgress, setRegisterProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<LinkInfo[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [loadingLinks, setLoadingLinks] = useState(false);

  const tokenAddress = token === "quai" ? ZERO_ADDRESS : MUSDQ_ADDRESS;
  const symbol = token === "quai" ? "QUAI" : "mUSDQ";

  // Load existing links from backend when merchant connects
  const selectAddress = async (addr: string) => {
    setAddress(addr);
    setLoadingLinks(true);
    try {
      const myLinks = await fetchMyLinks();
      setLinks(myLinks);
    } catch {
      // Not critical — just show empty
    } finally {
      setLoadingLinks(false);
    }
  };

  const create = async () => {
    if (!address) {
      setError("Connect your payout wallet first.");
      return;
    }
    let units: bigint;
    try {
      units = token === "quai" ? parseQuai(amount) : toUnits(amount, 6);
    } catch {
      setError("Enter a valid amount, e.g. 25.0");
      return;
    }
    if (units <= 0n) {
      setError("Amount must be greater than zero.");
      return;
    }

    const poolSize = multiPay ? poolTarget : 1;
    setBusy(true);
    setRegistering(true);
    setError(null);
    setLink(null);
    setRegisterProgress({ done: 0, total: poolSize });

    let expiry = 0n;
    if (expiryHours.trim() !== "") {
      const hours = Number(expiryHours);
      if (!Number.isFinite(hours) || hours <= 0) {
        setError("Expiry must be a positive number of hours.");
        setBusy(false);
        setRegistering(false);
        return;
      }
      expiry = BigInt(Math.floor(Date.now() / 1000) + hours * 3600);
    }

    const orderIds: string[] = [];
    try {
      // Register all orders on-chain sequentially
      for (let i = 0; i < poolSize; i++) {
        const orderId = newOrderId();
        await registerOrder(address, orderId, tokenAddress, units, expiry);
        orderIds.push(orderId);
        setRegisterProgress({ done: i + 1, total: poolSize });
      }
      setRegistering(false);

      // Create the short link in the backend
      const created = await createPaymentLink({
        shopName: shopName.trim(),
        tokenAddress,
        amount: units.toString(),
        amountDisplay: amount,
        symbol,
        expiryDurationSecs: expiry > 0n ? Number(expiry) - Math.floor(Date.now() / 1000) : 0,
        multiPay,
        orderPool: orderIds,
      });

      const url = shortUrl(created.slug);
      setLink(url);

      // Refresh links list
      try {
        const myLinks = await fetchMyLinks();
        setLinks(myLinks);
      } catch {
        // best-effort
      }

      setAmount("");
      setShopName("");
      setExpiryHours("");
    } catch (err) {
      setError(parseError(err) || "Failed to create payment link.");
    } finally {
      setBusy(false);
      setRegistering(false);
      setRegisterProgress(null);
    }
  };

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <DashboardShell>
      <div className="mx-auto max-w-3xl px-5 py-8 lg:py-10">
        <div className="mb-8">
          <p className="mb-2 text-sm text-[#38bdf8]">Payments</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Payment links
          </h1>
          <p className="mt-2 text-sm text-[#8b93a7]">
            Create a short link your customers can open on any browser or
            phone. Single-pay links settle once; multi-pay links let many
            customers pay independently.
          </p>
        </div>

        <div className="space-y-5">
          <section className="rounded-2xl border border-white/7 bg-[#171717] p-6">
            {address ? (
              <div className="space-y-5">
                {/* Wallet display */}
                <div>
                  <p className="mb-2 text-sm text-[#8b93a7]">
                    Order from wallet
                  </p>
                  <div className="rounded-xl border border-white/7 bg-[#171717] px-4 py-3">
                    <p className="break-all font-mono text-xs text-white">
                      {address}
                    </p>
                    <p className="mt-1 text-xs text-[#8b93a7]">
                      Payments go to this wallet. A platform fee of 0.3% is
                      deducted at settlement.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Asset */}
                  <div className="sm:col-span-2">
                    <p className="mb-2 text-sm text-[#8b93a7]">Asset</p>
                    <div className="flex overflow-hidden rounded-xl border border-white/7">
                      {(["quai", "musdq"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setToken(t)}
                          className={`flex-1 px-4 py-2.5 text-sm font-medium transition ${
                            token === t
                              ? "bg-[#38bdf8] text-[#061018]"
                              : "bg-[#171717] text-[#8b93a7] hover:text-white"
                          }`}
                        >
                          {t === "quai" ? "QUAI" : "mUSDQ"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Amount */}
                  <div>
                    <p className="mb-2 text-sm text-[#8b93a7]">Amount</p>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="25.0"
                      className="h-11 w-full rounded-xl border border-white/7 bg-[#171717] px-3 font-mono text-sm text-white outline-none transition placeholder:text-[#4f5868] focus:border-[#38bdf8]/40"
                    />
                  </div>

                  {/* Expiry */}
                  <div>
                    <p className="mb-2 text-sm text-[#8b93a7]">
                      Expiry (optional)
                    </p>
                    <select
                      value={expiryHours}
                      onChange={(e) => setExpiryHours(e.target.value)}
                      className="h-11 w-full rounded-xl border border-white/7 bg-[#171717] px-3 font-mono text-sm text-white outline-none transition focus:border-[#38bdf8]/40 appearance-none"
                    >
                      <option value="">never expires</option>
                      <option value="0.25">15 mins</option>
                      <option value="0.5">30 mins</option>
                      <option value="1">1 hour</option>
                      <option value="2">2 hours</option>
                      <option value="6">6 hours</option>
                      <option value="12">12 hours</option>
                      <option value="24">24 hours</option>
                      <option value="48">48 hours</option>
                    </select>
                  </div>

                  {/* Shop name */}
                  <div className="sm:col-span-2">
                    <p className="mb-2 text-sm text-[#8b93a7]">
                      Shop / Display name (optional)
                    </p>
                    <input
                      type="text"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      placeholder="e.g. Alice's Coffee Shop"
                      maxLength={200}
                      className="h-11 w-full rounded-xl border border-white/7 bg-[#171717] px-3 text-sm text-white outline-none transition placeholder:text-[#4f5868] focus:border-[#38bdf8]/40"
                    />
                    <p className="mt-1 text-xs text-[#4f5868]">
                      Shown to customers on the checkout page and receipt.
                    </p>
                  </div>
                </div>

                {/* Multi-pay toggle */}
                <div className="rounded-xl border border-white/7 bg-[#171717] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#38bdf8]/10 text-[#38bdf8]">
                        <Users size={15} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          Multi-pay link
                        </p>
                        <p className="mt-1 text-xs text-[#8b93a7]">
                          Allow multiple customers to pay using the same link.
                          You pre-register a pool of orders on-chain; each
                          customer claims one slot with a single wallet popup.
                          Same wallet is blocked from re-paying within 5
                          minutes.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setMultiPay((v) => !v)}
                      className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${
                        multiPay ? "bg-[#38bdf8]" : "bg-white/10"
                      }`}
                    >
                      <span
                        className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                          multiPay ? "translate-x-5" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  {multiPay && (
                    <div className="mt-4 border-t border-white/7 pt-4">
                      <p className="mb-2 text-sm text-[#8b93a7]">
                        Pool size — number of orders to pre-register
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {POOL_SIZE_OPTIONS.map((n) => (
                          <button
                            key={n}
                            onClick={() => setPoolTarget(n)}
                            className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                              poolTarget === n
                                ? "border-[#38bdf8] bg-[#38bdf8]/10 text-[#38bdf8]"
                                : "border-white/7 text-[#8b93a7] hover:text-white"
                            }`}
                          >
                            {n} orders
                          </button>
                        ))}
                      </div>
                      <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/6 px-3 py-2.5">
                        <AlertCircle
                          size={13}
                          className="mt-0.5 shrink-0 text-amber-300"
                        />
                        <p className="text-xs text-amber-300">
                          Creating this link will open your wallet{" "}
                          <strong>{poolTarget}</strong> time
                          {poolTarget !== 1 ? "s" : ""} to sign on-chain
                          order registrations. You pay the gas; customers only
                          pay for their payment transaction.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Registration progress */}
                {registerProgress && (
                  <div className="rounded-xl border border-white/7 bg-[#171717] p-4">
                    <div className="flex items-center gap-3 text-sm">
                      <Loader2
                        size={15}
                        className="animate-spin text-[#38bdf8]"
                      />
                      <span className="text-[#8b93a7]">
                        Registering order{" "}
                        <span className="text-white font-medium">
                          {registerProgress.done}
                        </span>{" "}
                        of{" "}
                        <span className="text-white font-medium">
                          {registerProgress.total}
                        </span>
                        …
                      </span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[#38bdf8] transition-all"
                        style={{
                          width: `${
                            (registerProgress.done / registerProgress.total) *
                            100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {error && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                    {error}
                  </p>
                )}

                <button
                  onClick={() => void create()}
                  disabled={busy}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#38bdf8] px-5 py-3 text-sm font-semibold text-[#061018] transition hover:bg-[#67d8ff] disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Plus size={16} />
                  )}
                  {busy
                    ? registering
                      ? "Registering orders on-chain…"
                      : "Creating short link…"
                    : `Create ${symbol} payment link`}
                </button>

                {link && (
                  <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/6 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Zap size={13} className="text-emerald-300" />
                      <p className="text-xs text-emerald-300">
                        Short link created — share with{" "}
                        {multiPay ? "your customers" : "your customer"}:
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="min-w-0 flex-1 break-all font-mono text-xs text-white">
                        {link}
                      </code>
                      <button
                        onClick={() => void copy(link)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#38bdf8] px-3 py-2 text-xs font-semibold text-[#061018] transition hover:bg-[#67d8ff]"
                      >
                        {copied === link ? (
                          <Check size={13} />
                        ) : (
                          <Copy size={13} />
                        )}
                        {copied === link ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <p className="mb-4 text-sm text-[#8b93a7]">
                  Connect the wallet that will receive the payment — it signs
                  the order registrations.
                </p>
                <WalletSelector
                  connectedAddress={null}
                  onConnected={(addr) => void selectAddress(addr)}
                  label="Connect payout wallet"
                />
              </div>
            )}
          </section>

          {/* Existing links */}
          {address && (
            <section className="rounded-2xl border border-white/7 bg-[#171717] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">My payment links</h2>
                  <p className="mt-1 text-xs text-[#8b93a7]">
                    Links are stored on the backend — they work on any browser
                    and device.
                  </p>
                </div>
                {loadingLinks && (
                  <Loader2
                    size={15}
                    className="animate-spin text-[#8b93a7]"
                  />
                )}
              </div>

              {!loadingLinks && links.length === 0 && (
                <p className="mt-4 text-sm text-[#4f5868]">
                  No links yet — create one above.
                </p>
              )}

              {links.length > 0 && (
                <div className="mt-4 divide-y divide-white/6">
                  {links.map((l) => {
                    const url = shortUrl(l.slug);
                    return (
                      <div
                        key={l.slug}
                        className="flex items-center justify-between gap-3 py-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium">
                              {l.amountDisplay} {l.symbol}
                            </p>
                            {l.multiPay && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-[#38bdf8]/20 bg-[#38bdf8]/8 px-2 py-0.5 text-[10px] text-[#38bdf8]">
                                <Users size={9} />
                                Multi-pay
                              </span>
                            )}
                          </div>
                          {l.shopName && (
                            <p className="mt-0.5 truncate text-xs text-[#8b93a7]">
                              {l.shopName}
                            </p>
                          )}
                          <p className="mt-0.5 truncate font-mono text-xs text-[#4f5868]">
                            /pay/{l.slug} ·{" "}
                            {new Date(l.createdAt).toLocaleString()}
                            {l.multiPay && ` · ${l.poolSize} slot${l.poolSize !== 1 ? "s" : ""} left`}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            onClick={() => void copy(url)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/7 px-3 py-2 text-xs font-medium text-[#c9d4e0] transition hover:bg-white/6"
                          >
                            {copied === url ? (
                              <Check size={13} />
                            ) : (
                              <Copy size={13} />
                            )}
                            {copied === url ? "Copied" : "Copy"}
                          </button>
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/7 px-3 py-2 text-xs font-medium text-[#c9d4e0] transition hover:bg-white/6"
                          >
                            <ExternalLink size={13} />
                            Open
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>

        <p className="mt-6 flex items-center gap-2 text-xs text-[#4f5868]">
          <Link2 size={13} />
          Tip: for checkout pages you build yourself, use the integration guide
          in the docs — these links are the zero-code option.
        </p>
      </div>
    </DashboardShell>
  );
}
