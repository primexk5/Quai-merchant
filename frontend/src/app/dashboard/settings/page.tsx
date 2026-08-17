"use client";

import { Check, Loader2, Save, ShieldCheck, Wallet } from "lucide-react";
import { useState } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { WalletSelector } from "@/components/ui/wallet-selector";
import { adminPatch, useRelayerData } from "@/lib/relayer";

export default function SettingsPage() {
  const { merchants, loading, error, refresh } = useRelayerData();
  const [address, setAddress] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const merchant = merchants[0] ?? null;

  const [prevWebhookUrl, setPrevWebhookUrl] = useState<string | null>(null);
  if (merchant && merchant.webhookUrl !== prevWebhookUrl) {
    setPrevWebhookUrl(merchant.webhookUrl);
    if (!dirty) setWebhookUrl(merchant.webhookUrl);
  }

  const save = async () => {
    if (!merchant) return;
    let parsed: URL;
    try {
      parsed = new URL(webhookUrl);
    } catch {
      setSaveError("Enter a valid URL, e.g. https://example.com/webhooks/paywithquai");
      return;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      setSaveError("Webhook URL must start with http(s)://");
      return;
    }
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      await adminPatch(`/v1/merchants/${merchant.address}`, { webhookUrl });
      setDirty(false);
      setSaved(true);
      void refresh();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardShell>
      <div className="mx-auto max-w-4xl px-5 py-8 lg:px-8 lg:py-10">
        <div className="mb-8">
          <p className="mb-2 text-sm text-[#38bdf8]">Configuration</p>
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-2 text-sm text-[#8b93a7]">
            Merchant profile and settlement wallet, synced with the relayer.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            Relayer unreachable: {error}
          </div>
        )}

        <div className="space-y-5">
          <section className="rounded-2xl border border-white/[0.07] bg-[#0c1017] p-6">
            <div className="mb-6 flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#38bdf8]/15 bg-[#38bdf8]/[0.06] text-[#38bdf8]">
                <Wallet size={18} />
              </div>
              <div>
                <h2 className="font-semibold">Merchant profile</h2>
                <p className="mt-1 text-xs text-[#8b93a7]">
                  Registered with the relayer — updates ship via PATCH
                  /v1/merchants.
                </p>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-[#8b93a7]">Loading…</p>
            ) : merchant ? (
              <div className="space-y-4">
                <div className="space-y-5">
                  <div className="text-sm">
                    <span className="mb-2 block text-[#8b93a7]">
                      Business name
                    </span>
                    <div className="h-11 w-full rounded-xl border border-white/[0.07] bg-[#0c1017] px-3 py-3 text-white">
                      {merchant.name}
                    </div>
                  </div>

                  <div className="text-sm">
                    <span className="mb-2 block text-[#8b93a7]">
                      Merchant ID
                    </span>
                    <div className="h-11 w-full rounded-xl border border-white/[0.07] bg-[#0c1017] px-3 py-3 font-mono text-xs text-white">
                      {merchant.merchantId}
                    </div>
                  </div>
                </div>

                <div className="text-sm">
                  <span className="mb-2 block text-[#8b93a7]">Webhook URL</span>
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => {
                      setWebhookUrl(e.target.value);
                      setDirty(true);
                      setSaved(false);
                      setSaveError(null);
                    }}
                    placeholder="https://example.com/webhooks/paywithquai"
                    className="h-11 w-full rounded-xl border border-white/[0.07] bg-[#0c1017] px-3 font-mono text-xs text-white outline-none transition placeholder:text-[#4f5868] focus:border-[#38bdf8]/40"
                  />
                  <p className="mt-2 text-xs text-[#4f5868]">
                    HTTPS is required by default — http://localhost is allowed
                    in local development.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#8b93a7]">
                No merchant registered yet — complete onboarding first.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-white/[0.07] bg-[#0c1017] p-6">
            <div className="mb-6 flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-300">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h2 className="font-semibold">Settlement wallet</h2>
                <p className="mt-1 text-xs text-[#8b93a7]">
                  The wallet that receives your settled payments.
                </p>
              </div>
            </div>

            {address ? (
              <div className="rounded-xl border border-white/[0.07] bg-[#0c1017] p-4">
                <p className="text-xs text-[#8b93a7]">Connected address</p>
                <p className="mt-2 break-all font-mono text-sm text-white">
                  {address}
                </p>
                <p className="mt-2 text-xs text-emerald-300">
                  Connected to Quai network · Cyprus-1
                </p>
              </div>
            ) : (
              <WalletSelector
                connectedAddress={null}
                onConnected={setAddress}
                label="Connect settlement wallet"
              />
            )}
          </section>

          <div className="flex items-center justify-end gap-3">
            {saveError && (
              <p className="text-sm text-red-400">{saveError}</p>
            )}
            {saved && !saveError && (
              <p className="flex items-center gap-1.5 text-sm text-emerald-300">
                <Check size={14} />
                Saved
              </p>
            )}
            <button
              onClick={() => void save()}
              disabled={!merchant || !dirty || saving}
              className="inline-flex items-center gap-2 rounded-xl bg-[#38bdf8] px-5 py-2.5 text-sm font-semibold text-[#061018] transition hover:bg-[#67d8ff] disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Save changes
            </button>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}