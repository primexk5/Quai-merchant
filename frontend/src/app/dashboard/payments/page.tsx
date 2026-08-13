import { Download, Search } from "lucide-react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatusBadge } from "@/components/ui/status-badge";

const payments = [
  ["PAY-1042", "Customer #1042", "125.00 QUAI", "Aug 13, 14:32", "confirmed"],
  ["PAY-1041", "Customer #1041", "48.50 QUAI", "Aug 13, 12:08", "confirmed"],
  ["PAY-1040", "Customer #1040", "210.00 QUAI", "Aug 12, 18:44", "pending"],
  ["PAY-1039", "Customer #1039", "32.00 QUAI", "Aug 12, 15:21", "confirmed"],
  ["PAY-1038", "Customer #1038", "87.25 QUAI", "Aug 12, 11:02", "confirmed"],
  ["PAY-1037", "Customer #1037", "19.00 QUAI", "Aug 11, 19:35", "failed"],
];

export default function PaymentsPage() {
  return (
    <DashboardShell>
      <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-sm text-[#38bdf8]">Transactions</p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Payments
            </h1>
            <p className="mt-2 text-sm text-[#667085]">
              View and manage all payment activity.
            </p>
          </div>

          <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/[0.04]">
            <Download size={16} />
            Export
          </button>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#0c1017]">
          <div className="flex flex-col gap-3 border-b border-white/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#667085]"
              />
              <input
                placeholder="Search payments..."
                className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#080b10] pl-9 pr-3 text-sm text-white outline-none placeholder:text-[#667085] focus:border-[#38bdf8]/40"
              />
            </div>

            <select className="h-10 rounded-xl border border-white/[0.08] bg-[#080b10] px-3 text-sm text-[#8b93a7] outline-none">
              <option>All statuses</option>
              <option>Confirmed</option>
              <option>Pending</option>
              <option>Failed</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left">
              <thead className="border-b border-white/[0.06]">
                <tr className="text-xs text-[#667085]">
                  <th className="px-5 py-4 font-medium">Payment</th>
                  <th className="px-5 py-4 font-medium">Customer</th>
                  <th className="px-5 py-4 font-medium">Amount</th>
                  <th className="px-5 py-4 font-medium">Date</th>
                  <th className="px-5 py-4 font-medium">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/[0.05]">
                {payments.map(
                  ([id, customer, amount, date, status]) => (
                    <tr
                      key={id}
                      className="text-sm transition hover:bg-white/[0.015]"
                    >
                      <td className="px-5 py-4 font-medium text-white">
                        {id}
                      </td>
                      <td className="px-5 py-4 text-[#8b93a7]">
                        {customer}
                      </td>
                      <td className="px-5 py-4 font-medium text-white">
                        {amount}
                      </td>
                      <td className="px-5 py-4 text-[#667085]">{date}</td>
                      <td className="px-5 py-4">
                        <StatusBadge
                          status={
                            status as "confirmed" | "pending" | "failed"
                          }
                        />
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}