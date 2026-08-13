import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CreditCard,
  DollarSign,
  ExternalLink,
  Plus,
  TrendingUp,
} from "lucide-react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";

const payments = [
  {
    customer: "Customer #1042",
    amount: "125.00 QUAI",
    date: "Today, 14:32",
    status: "confirmed" as const,
  },
  {
    customer: "Customer #1041",
    amount: "48.50 QUAI",
    date: "Today, 12:08",
    status: "confirmed" as const,
  },
  {
    customer: "Customer #1040",
    amount: "210.00 QUAI",
    date: "Yesterday, 18:44",
    status: "pending" as const,
  },
  {
    customer: "Customer #1039",
    amount: "32.00 QUAI",
    date: "Yesterday, 15:21",
    status: "confirmed" as const,
  },
];

export default function DashboardPage() {
  return (
    <DashboardShell>
      <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-sm text-[#38bdf8]">Good afternoon</p>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Merchant overview
            </h1>
            <p className="mt-2 text-sm text-[#667085]">
              Track your Quai payment activity and settlement.
            </p>
          </div>

          <Link
            href="/checkout/demo"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#38bdf8] px-4 py-2.5 text-sm font-semibold text-[#061018] transition hover:bg-[#67d8ff]"
          >
            <Plus size={16} />
            Create payment
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total received"
            value="2,485.50"
            description="QUAI this month"
            icon={DollarSign}
          />

          <StatCard
            label="Transactions"
            value="184"
            description="+12.4% from last month"
            icon={CreditCard}
          />

          <StatCard
            label="Success rate"
            value="98.4%"
            description="Across all payments"
            icon={TrendingUp}
          />

          <StatCard
            label="Settlement"
            value="~2.4s"
            description="Average confirmation"
            icon={ArrowUpRight}
          />
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_340px]">
          <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0c1017]">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-5">
              <div>
                <h2 className="font-semibold text-white">Recent payments</h2>
                <p className="mt-1 text-xs text-[#667085]">
                  Your latest transactions
                </p>
              </div>

              <Link
                href="/dashboard/payments"
                className="flex items-center gap-1 text-xs font-medium text-[#38bdf8] hover:text-[#67d8ff]"
              >
                View all
                <ArrowRight size={13} />
              </Link>
            </div>

            <div className="divide-y divide-white/[0.05]">
              {payments.map((payment) => (
                <div
                  key={`${payment.customer}-${payment.date}`}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-white">
                      {payment.customer}
                    </p>
                    <p className="mt-1 text-xs text-[#667085]">
                      {payment.date}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-5 sm:justify-end">
                    <p className="text-sm font-medium text-white">
                      {payment.amount}
                    </p>
                    <StatusBadge status={payment.status} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.07] bg-[#0c1017] p-5">
            <div className="mb-6">
              <h2 className="font-semibold text-white">Payment checkout</h2>
              <p className="mt-1 text-xs leading-5 text-[#667085]">
                Preview the checkout experience your customers will see.
              </p>
            </div>

            <div className="rounded-xl border border-white/[0.07] bg-[#080b10] p-4">
              <p className="text-xs text-[#667085]">Demo payment</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                25.00 <span className="text-sm text-[#38bdf8]">QUAI</span>
              </p>

              <div className="mt-5 h-px bg-white/[0.06]" />

              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="text-[#667085]">Network</span>
                <span className="text-white">Quai</span>
              </div>
            </div>

            <Link
              href="/checkout/demo"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/[0.04]"
            >
              Open checkout
              <ExternalLink size={14} />
            </Link>
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}