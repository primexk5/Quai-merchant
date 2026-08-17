"use client";

import Link from "next/link";
import { ArrowRight, Check, Copy, Loader2, Wallet } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { WalletSelector } from "@/components/ui/wallet-selector";
import { ADMIN_API_KEY, BACKEND_URL } from "@/lib/payment";

const steps = ["Business", "Wallet", "Complete"];

interface OnboardedMerchant {
  merchantId: string;
  address: string;
  name: string;
  webhookUrl: string;
  webhookSecret: string;
}

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [address, setAddress] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [merchant, setMerchant] = useState<OnboardedMerchant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const complete = async () => {
    if (!address) return;
    if (!name.trim()) {
      setError("Enter a business name — it shows on your checkout page.");
      return;
    }
    const url = webhookUrl.trim();
    if (!url) {
      setError("Enter a webhook URL — the relayer uses it to POST payment events.");
      return;
    }
    try {
      new URL(url);
    } catch {
      setError("That webhook URL doesn't look valid. Use a full URL like http://localhost:9000/webhook.");
      return;
    }
    setRegistering(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/v1/merchants`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${ADMIN_API_KEY}`,
        },
        body: JSON.stringify({ address, name, webhookUrl: url }),
      });
      if (!res.ok) throw new Error(`registration failed (${res.status})`);
      setMerchant((await res.json()) as OnboardedMerchant);
      setStep(2);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRegistering(false);
    }
  };

  const copySecret = async () => {
    if (!merchant) return;
    try {
      await navigator.clipboard.writeText(merchant.webhookSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard unavailable — ignore
    }
  };

  return (
    <main className="min-h-screen bg-[#0c1017] px-5 py-8 text-white">
      <div className="mx-auto max-w-2xl">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo />
            <span className="text-sm font-semibold tracking-tight">
              QUAI<span className="text-[#38bdf8]">Merchant</span>
            </span>
          </Link>

          <p className="text-sm text-[#38bdf8]">Merchant onboarding</p>
        </header>

        <div className="mx-auto mt-10 flex max-w-md items-center">
          {steps.map((label, index) => (
            <div key={label} className="flex flex-1 items-center last:flex-none">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                    index < step
                      ? "bg-[#38bdf8] text-[#061018]"
                      : index === step
                        ? "border border-[#38bdf8]/40 text-white"
                        : "border border-white/[0.07] text-[#8b93a7]"
                  }`}
                >
                  {index < step ? <Check size={13} /> : index + 1}
                </div>
                <span className="hidden text-xs text-[#8b93a7] sm:block">
                  {label}
                </span>
              </div>

              {index < steps.length - 1 && (
                <div className="mx-3 h-px flex-1 bg-[#0c1017]/[0.04]" />
              )}
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-white/[0.07] bg-[#0c1017] p-6 sm:p-8">
          {step === 0 && (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#38bdf8]/15 bg-[#38bdf8]/[0.06] text-[#38bdf8]">
                <Wallet size={21} />
              </div>

              <h2 className="mt-5 text-xl font-semibold">
                Tell us about your business
              </h2>
              <p className="mt-1 text-sm leading-6 text-[#8b93a7]">
                Used on the checkout and in the merchant dashboard.
              </p>

              <div className="mt-7 space-y-5">
                <div>
                  <label className="mb-2 block text-sm text-[#8b93a7]">
                    Business name
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Quai Store"
                    name="qm-merchant-name"
                    autoComplete="off"
                    className="h-11 w-full rounded-xl border border-white/[0.07] bg-[#0c1017] px-3 text-white outline-none placeholder:text-[#4f5868] focus:border-[#38bdf8]/40"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-[#8b93a7]">
                    Webhook URL
                  </label>
                  <input
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://api.example.com/webhooks/quai"
                    name="qm-webhook-url"
                    autoComplete="off"
                    className="h-11 w-full rounded-xl border border-white/[0.07] bg-[#0c1017] px-3 text-white outline-none placeholder:text-[#4f5868] focus:border-[#38bdf8]/40"
                  />
                  <span className="mt-2 block text-xs text-[#4f5868]">
                    The relayer POSTs signed <code>payment.confirmed</code>{" "}
                    events here. For local testing use{" "}
                    <code>http://localhost:9000/webhook</code>.
                  </span>
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#38bdf8]/15 bg-[#38bdf8]/[0.06] text-[#38bdf8]">
                <Wallet size={21} />
              </div>

              <h2 className="mt-5 text-xl font-semibold">
                Connect your settlement wallet
              </h2>
              <p className="mt-1 text-sm leading-6 text-[#8b93a7]">
                Your wallet receives payments after they settle on the Quai
                network.
              </p>

              {address ? (
                <div className="mt-7 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] px-4 py-3">
                  <p className="text-xs text-[#8b93a7]">Connected (Cyprus-1)</p>
                  <p className="mt-1 break-all font-mono text-xs text-emerald-300">
                    {address}
                  </p>
                </div>
              ) : (
                <div className="mt-7">
                  <WalletSelector
                    connectedAddress={null}
                    onConnected={(addr) => {
                      setError(null);
                      setAddress(addr);
                    }}
                    label="Connect settlement wallet"
                  />
                </div>
              )}
            </>
          )}

          {step === 2 && merchant && (
            <div className="py-2 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300">
                <Check size={24} />
              </div>

              <h2 className="mt-5 text-xl font-semibold">You&apos;re ready.</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#8b93a7]">
                {merchant.name} is registered and will receive{" "}
                <code>payment.confirmed</code> webhooks at{" "}
                <span className="break-all text-[#8b93a7]">
                  {merchant.webhookUrl}
                </span>
                .
              </p>

              <div className="mx-auto mt-6 max-w-md rounded-2xl border border-white/[0.07] bg-[#0c1017] p-4 text-left">
                <p className="text-xs text-[#8b93a7]">Merchant ID</p>
                <p className="mt-1 break-all font-mono text-xs text-white">
                  {merchant.merchantId}
                </p>

                <p className="mt-4 text-xs text-[#8b93a7]">
                  Webhook secret (shown once — store it)
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="flex-1 break-all font-mono text-xs text-[#e0a95e]">
                    {merchant.webhookSecret}
                  </p>
                  <button
                    onClick={copySecret}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/[0.07] px-2 py-1 text-xs text-[#8b93a7] hover:text-white"
                  >
                    <Copy size={12} />
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

              <Link
                href="/login"
                className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#38bdf8] px-5 py-3 text-sm font-semibold text-[#061018] transition hover:bg-[#67d8ff]"
              >
                Log in to dashboard
                <ArrowRight size={15} />
              </Link>
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {step < 2 && (
            <div className="mt-8 flex justify-end">
              {step === 0 ? (
                <button
                  onClick={() => {
                    if (!name.trim()) {
                      setError("Enter your business name before continuing.");
                      return;
                    }
                    setError(null);
                    setStep(1);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#38bdf8] px-5 py-2.5 text-sm font-semibold text-[#061018] hover:bg-[#67d8ff]"
                >
                  Continue
                  <ArrowRight size={15} />
                </button>
              ) : (
                <button
                  onClick={complete}
                  disabled={!address || registering}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#38bdf8] px-5 py-2.5 text-sm font-semibold text-[#061018] hover:bg-[#67d8ff] disabled:opacity-60"
                >
                  {registering ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Check size={15} />
                  )}
                  {registering ? "Registering…" : "Complete setup"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}