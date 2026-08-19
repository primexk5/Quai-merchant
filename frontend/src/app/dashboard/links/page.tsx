"use client";

import { Check, Copy, ExternalLink, Link2, Loader2, Plus } from "lucide-react";
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
  registerOrderWithPayer,
} from "@/lib/payment";

const STORAGE_PREFIX = "quaimerchant:links:";

interface SavedLink {
  merchant: string;
  orderId: string;
  amount: string;
  symbol: string;
  createdAt: number;
}

/** Exact decimal-string → smallest-unit conversion (no float math). */
function toUnits(decimal: string, decimals: number): bigint {
  const [whole, frac = ""] = decimal.trim().split(".");
  const padded = `${whole}${frac.padEnd(decimals, "0").slice(0, decimals)}`;
  const value = BigInt(padded === "" ? "0" : padded);
  return value;
}

function isValidAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

function loadLinks(address: string): SavedLink[] {
  try {
    return JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}${address}`) ?? "[]");
  } catch {
    return [];
  }
}

export default function LinksPage() {
  const [address, setAddress] = useState<string | null>(null);
  const [token, setToken] = useState<"quai" | "musdq">("quai");
  const [amount, setAmount] = useState("");
  const [payer, setPayer] = useState("");
  const [expiryHours, setExpiryHours] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<SavedLink[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const selectAddress = (addr: string) => {
    setAddress(addr);
    setLinks(loadLinks(addr));
  };

  const tokenAddress = token === "quai" ? ZERO_ADDRESS : MUSDQ_ADDRESS;
  const symbol = token === "quai" ? "QUAI" : "mUSDQ";

  const create = async () => {
    if (!address) {
      setError("Connect your payout wallet first — it signs the order on-chain.");
      return;
    }
    let units: bigint;
    try {
      units =
        token === "quai" ? parseQuai(amount) : toUnits(amount, 6);
    } catch {
      setError("Enter a valid amount, e.g. 25.0");
      return;
    }
    if (units <= 0n) {
      setError("Amount must be greater than zero.");
      return;
    }
    if (payer && !isValidAddress(payer)) {
      setError("Expected payer must be a valid 0x address (or leave empty for an open link).");
      return;
    }
    let expiry = 0n;
    if (expiryHours.trim() !== "") {
      const hours = Number(expiryHours);
      if (!Number.isFinite(hours) || hours <= 0) {
        setError("Expiry must be a positive number of hours.");
        return;
      }
      expiry = BigInt(Math.floor(Date.now() / 1000) + hours * 3600);
    }

    const orderId = newOrderId();
    setBusy(true);
    setError(null);
    setLink(null);
    try {
      if (payer) {
        await registerOrderWithPayer(address, orderId, tokenAddress, units, expiry, payer);
      } else {
        await registerOrder(address, orderId, tokenAddress, units, expiry);
      }
      const url = `${window.location.origin}/checkout/${address}/${orderId}`;
      setLink(url);
      const saved: SavedLink = {
        merchant: address,
        orderId,
        amount,
        symbol,
        createdAt: Date.now(),
      };
      const next = [saved, ...loadLinks(address)].slice(0, 20);
      localStorage.setItem(`${STORAGE_PREFIX}${address}`, JSON.stringify(next));
      setLinks(next);
      setAmount("");
      setPayer("");
      setExpiryHours("");
    } catch (err) {
      setError(parseError(err) || "Order registration failed.");
    } finally {
      setBusy(false);
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
            Create a link your customer can open and pay with any wallet or
            Blip — no checkout code needed on your site. Sign the order with
            your payout wallet, then share the link.
          </p>
        </div>

        <div className="space-y-5">
          <section className="rounded-2xl border border-white/7 bg-[#171717] p-6">
            {address ? (
              <div className="space-y-5">
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
                      <option value="0.08333333333333333">5 mins</option>
                      <option value="0.16666666666666666">10 mins</option>
                      <option value="0.25">15 mins</option>
                      <option value="0.3333333333333333">20 mins</option>
                      <option value="0.5">30 mins</option>
                      <option value="1">1 hour</option>
                      <option value="2">2 hours</option>
                      <option value="3">3 hours</option>
                      <option value="6">6 hours</option>
                      <option value="12">12 hours</option>
                      <option value="24">24 hours</option>
                      <option value="48">48 hours</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <p className="mb-2 text-sm text-[#8b93a7]">
                      Expected payer (optional)
                    </p>
                    <input
                      type="text"
                      value={payer}
                      onChange={(e) => setPayer(e.target.value)}
                      placeholder="0x00… — only this wallet can pay; empty = anyone"
                      className="h-11 w-full rounded-xl border border-white/7 bg-[#171717] px-3 font-mono text-xs text-white outline-none transition placeholder:text-[#4f5868] focus:border-[#38bdf8]/40"
                    />
                  </div>
                </div>

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
                  {busy ? "Signing order on-chain…" : `Create ${symbol} payment link`}
                </button>

                {link && (
                  <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/6 p-4">
                    <p className="mb-2 text-xs text-emerald-300">
                      Link created — share it with your customer:
                    </p>
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
                  the order registration.
                </p>
                <WalletSelector
                  connectedAddress={null}
                  onConnected={selectAddress}
                  label="Connect payout wallet"
                />
              </div>
            )}
          </section>

          {address && links.length > 0 && (
            <section className="rounded-2xl border border-white/7 bg-[#171717] p-6">
              <h2 className="font-semibold">Recent links</h2>
              <p className="mt-1 text-xs text-[#8b93a7]">
                Stored locally in this browser — copy one to reuse it.
              </p>
              <div className="mt-4 divide-y divide-white/6">
                {links.map((l) => {
                  const url = `${window.location.origin}/checkout/${l.merchant}/${l.orderId}`;
                  return (
                    <div
                      key={l.orderId}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {l.amount} {l.symbol}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-xs text-[#8b93a7]">
                          {l.orderId.slice(0, 18)}… ·{" "}
                          {new Date(l.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          onClick={() => void copy(url)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/7 px-3 py-2 text-xs font-medium text-[#c9d4e0] transition hover:bg-white/6"
                        >
                          {copied === url ? <Check size={13} /> : <Copy size={13} />}
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
