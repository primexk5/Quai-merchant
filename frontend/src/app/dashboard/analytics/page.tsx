"use client";

import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Download,
  TrendingUp,
  XCircle,
} from "lucide-react";

import { DashboardShell } from "@/components/layout/dashboard-shell";

const volumeData = [
  { day: "Mon", value: 58 },
  { day: "Tue", value: 72 },
  { day: "Wed", value: 48 },
  { day: "Thu", value: 86 },
  { day: "Fri", value: 68 },
  { day: "Sat", value: 94 },
  { day: "Sun", value: 78 },
];

const payments = [
  { label: "Confirmed", value: "184", percentage: "98.4%" },
  { label: "Pending", value: "1", percentage: "0.5%" },
  { label: "Failed", value: "2", percentage: "1.1%" },
];

function MetricCard({
  icon,
  label,
  value,
  detail,
  change,
  positive,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  change: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0c1017] p-5">
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] text-sky-400">
          {icon}
        </div>

        <span
          className={`text-xs font-medium ${
            positive ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {change}
        </span>
      </div>

      <p className="mt-5 text-xs text-slate-500">{label}</p>

      <p className="mt-1 text-2xl font-semibold tracking-tight text-white">
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-600">{detail}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <DashboardShell>
      <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
        {/* Header */}
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-sm text-[#38bdf8]">Performance</p>

            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Analytics
            </h1>

            <p className="mt-2 text-sm text-[#667085]">
              Understand your payment activity and settlement performance.
            </p>
          </div>

          <button className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/10 bg-[#0c1017] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-[#111722]">
            <Download size={16} />
            Export report
          </button>
        </div>

        {/* Period selector */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center rounded-lg border border-white/10 bg-[#0c1017] p-1">
            {["7 days", "30 days", "90 days"].map((period, index) => (
              <button
                key={period}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  index === 1
                    ? "bg-white/10 text-white"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {period}
              </button>
            ))}
          </div>

          <span className="hidden text-xs text-slate-600 sm:block">
            Aug 1 – Aug 30, 2026
          </span>
        </div>

        {/* KPI cards */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<BarChart3 size={18} />}
            label="Total volume"
            value="2,485.50"
            detail="QUAI this month"
            change="+12.4%"
            positive
          />

          <MetricCard
            icon={<TrendingUp size={18} />}
            label="Transactions"
            value="184"
            detail="Total payments"
            change="+8.2%"
            positive
          />

          <MetricCard
            icon={<CheckCircle2 size={18} />}
            label="Success rate"
            value="98.4%"
            detail="Across all payments"
            change="+1.6%"
            positive
          />

          <MetricCard
            icon={<Clock3 size={18} />}
            label="Avg. settlement"
            value="~2.4s"
            detail="Average confirmation"
            change="-0.3s"
            positive
          />
        </section>

        {/* Main chart */}
        <section className="mt-6 rounded-xl border border-white/10 bg-[#0c1017]">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Payment volume
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Daily payment volume in QUAI
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <ArrowUpRight size={14} />
              12.4% vs previous period
            </div>
          </div>

          <div className="px-5 pb-6 pt-8">
            <div className="relative h-64">
              {/* Grid */}
              <div className="absolute inset-0 flex flex-col justify-between">
                {[100, 75, 50, 25, 0].map((value) => (
                  <div
                    key={value}
                    className="flex items-center gap-3 border-t border-white/[0.05]"
                  >
                    <span className="w-7 text-right text-[10px] text-slate-600">
                      {value}
                    </span>

                    <div className="h-px flex-1" />
                  </div>
                ))}
              </div>

              {/* Bars */}
              <div className="absolute inset-x-12 bottom-0 top-2 flex items-end justify-between gap-3">
                {volumeData.map((item, index) => (
                  <div
                    key={item.day}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                  >
                    <div
                      className="w-full max-w-12 rounded-t-md bg-sky-400/80 transition hover:bg-sky-300"
                      style={{
                        height: `${item.value}%`,
                        opacity: index === 5 ? 1 : 0.72,
                      }}
                    />

                    <span className="text-[10px] text-slate-600">
                      {item.day}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Bottom analytics */}
        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Payment status */}
          <div className="rounded-xl border border-white/10 bg-[#0c1017]">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-sm font-semibold text-white">
                Payment status
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Breakdown of your recent transactions.
              </p>
            </div>

            <div className="space-y-5 p-5">
              {payments.map((payment) => {
                const confirmed = payment.label === "Confirmed";
                const pending = payment.label === "Pending";

                return (
                  <div key={payment.label}>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {confirmed ? (
                          <CheckCircle2
                            size={15}
                            className="text-emerald-400"
                          />
                        ) : pending ? (
                          <Clock3 size={15} className="text-amber-400" />
                        ) : (
                          <XCircle size={15} className="text-red-400" />
                        )}

                        <span className="text-sm text-slate-300">
                          {payment.label}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-medium text-white">
                          {payment.value}
                        </span>

                        <span className="ml-2 text-xs text-slate-600">
                          {payment.percentage}
                        </span>
                      </div>
                    </div>

                    <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div
                        className={`h-full rounded-full ${
                          confirmed
                            ? "w-[98%] bg-emerald-400"
                            : pending
                              ? "w-[8%] bg-amber-400"
                              : "w-[3%] bg-red-400"
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Settlement performance */}
          <div className="rounded-xl border border-white/10 bg-[#0c1017]">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-sm font-semibold text-white">
                Settlement performance
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Network confirmation and settlement metrics.
              </p>
            </div>

            <div className="space-y-6 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-300">
                    Average settlement
                  </p>

                  <p className="mt-1 text-xs text-slate-600">
                    Time from payment to confirmation
                  </p>
                </div>

                <p className="text-lg font-semibold text-white">~2.4s</p>
              </div>

              <div className="flex items-center justify-between border-t border-white/[0.06] pt-5">
                <div>
                  <p className="text-sm text-slate-300">
                    Successful settlements
                  </p>

                  <p className="mt-1 text-xs text-slate-600">
                    Confirmed transactions
                  </p>
                </div>

                <p className="text-lg font-semibold text-emerald-400">
                  98.4%
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-white/[0.06] pt-5">
                <div>
                  <p className="text-sm text-slate-300">Network status</p>

                  <p className="mt-1 text-xs text-slate-600">
                    Quai payment network
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Operational
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}