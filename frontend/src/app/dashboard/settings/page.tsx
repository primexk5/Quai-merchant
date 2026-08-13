import { Save, ShieldCheck, Wallet } from "lucide-react";

import { DashboardShell } from "@/components/layout/dashboard-shell";

export default function SettingsPage() {
  return (
    <DashboardShell>
      <div className="mx-auto max-w-4xl px-5 py-8 lg:px-8 lg:py-10">
        <div className="mb-8">
          <p className="mb-2 text-sm text-[#38bdf8]">Configuration</p>
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-2 text-sm text-[#667085]">
            Manage your merchant profile and payment configuration.
          </p>
        </div>

        <div className="space-y-5">
          <section className="rounded-2xl border border-white/[0.07] bg-[#0c1017] p-6">
            <div className="mb-6 flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#38bdf8]/15 bg-[#38bdf8]/[0.06] text-[#38bdf8]">
                <Wallet size={18} />
              </div>
              <div>
                <h2 className="font-semibold">Merchant profile</h2>
                <p className="mt-1 text-xs text-[#667085]">
                  Basic information displayed across your payment experience.
                </p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-2 block text-[#8b93a7]">Business name</span>
                <input
                  defaultValue="Quai Store"
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#080b10] px-3 text-white outline-none focus:border-[#38bdf8]/40"
                />
              </label>

              <label className="text-sm">
                <span className="mb-2 block text-[#8b93a7]">
                  Contact email
                </span>
                <input
                  defaultValue="merchant@example.com"
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#080b10] px-3 text-white outline-none focus:border-[#38bdf8]/40"
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.07] bg-[#0c1017] p-6">
            <div className="mb-6 flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-300">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h2 className="font-semibold">Settlement wallet</h2>
                <p className="mt-1 text-xs text-[#667085]">
                  The wallet that receives your settled payments.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.07] bg-[#080b10] p-4">
              <p className="text-xs text-[#667085]">Connected address</p>
              <p className="mt-2 break-all font-mono text-sm text-white">
                0x7A91...4C29...91C4
              </p>
              <p className="mt-2 text-xs text-emerald-300">
                Connected to Quai network
              </p>
            </div>
          </section>

          <div className="flex justify-end">
            <button className="inline-flex items-center gap-2 rounded-xl bg-[#38bdf8] px-5 py-2.5 text-sm font-semibold text-[#061018] hover:bg-[#67d8ff]">
              <Save size={16} />
              Save changes
            </button>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}