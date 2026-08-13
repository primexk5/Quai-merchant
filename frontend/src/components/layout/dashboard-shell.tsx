"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  X,
} from "lucide-react";
import { useState } from "react";

const navigation = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Payments",
    href: "/dashboard/payments",
    icon: CreditCard,
  },
  {
    label: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart3,
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
];

export function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#07090d] text-white">
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/[0.07] bg-[#090c11] transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 items-center justify-between border-b border-white/[0.07] px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#38bdf8] text-[#071018]">
              <span className="text-lg font-bold">Q</span>
            </div>

            <div>
              <p className="text-sm font-bold tracking-tight">PAY WITH</p>
              <p className="-mt-1 text-sm font-bold text-[#38bdf8]">QUAI</p>
            </div>
          </Link>

          <button
            onClick={() => setMobileOpen(false)}
            className="text-[#667085] lg:hidden"
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 px-3 py-6">
          <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#667085]">
            Merchant
          </p>

          <nav className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href ||
                (item.href === "/dashboard" && pathname === "/dashboard");

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                    active
                      ? "bg-white/[0.06] text-white"
                      : "text-[#8b93a7] hover:bg-white/[0.035] hover:text-white"
                  }`}
                >
                  <Icon size={17} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-white/[0.07] p-4">
          <div className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-xs text-[#667085]">Connected wallet</p>
            <p className="mt-1 truncate text-sm font-medium text-white">
              0x7A...91C4
            </p>
          </div>

          <Link
            href="/"
            className="flex items-center gap-3 px-2 text-sm text-[#8b93a7] hover:text-white"
          >
            <LogOut size={16} />
            Back to website
          </Link>
        </div>
      </aside>

      {mobileOpen && (
        <button
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation overlay"
        />
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-white/[0.07] bg-[#07090d]/95 px-5 backdrop-blur-md lg:px-8">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-[#8b93a7] lg:hidden"
            aria-label="Open navigation"
          >
            <Menu size={22} />
          </button>

          <div className="hidden lg:block">
            <p className="text-sm text-[#667085]">Merchant portal</p>
            <p className="text-sm font-medium text-white">Quai Store</p>
          </div>

          <div className="ml-auto flex items-center gap-4">
            <div className="hidden items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-1.5 text-xs text-emerald-300 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Quai network connected
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1b2633] text-xs font-semibold">
              QS
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-5rem)]">{children}</main>
      </div>
    </div>
  );
}