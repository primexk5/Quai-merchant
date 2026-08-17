"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Logo } from "@/components/logo";
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleDollarSign,
  Code2,
  Copy,
  Globe2,
  Menu,
  Network,
  QrCode,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

const capabilities = [
  {
    icon: Zap,
    title: "Fast settlement",
    description: "Payments settle on Quai without unnecessary waiting.",
  },
  {
    icon: CircleDollarSign,
    title: "Stablecoin native",
    description: "Accept stablecoin payments with a familiar checkout flow.",
  },
  {
    icon: ShieldCheck,
    title: "Non-custodial",
    description:
      "Your payments stay in your control from checkout to settlement.",
  },
];

const steps = [
  {
    number: "01",
    title: "Create your checkout",
    description:
      "Set up your payment experience and give customers a simple way to pay.",
  },
  {
    number: "02",
    title: "Customer pays",
    description:
      "Customers connect their wallet, review the amount and confirm the payment.",
  },
  {
    number: "03",
    title: "Settle on Quai",
    description:
      "The payment is confirmed and the merchant receives the settlement.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <Navbar />

      <div className="overflow-hidden">

      {/* Hero */}
      <section className="relative">
        <div className="grid-background pointer-events-none absolute inset-0 h-[720px]" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-6 pb-24 pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pb-32 lg:pt-28">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-7 inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/[0.06] px-3.5 py-2 text-sm text-sky-200"
            >
              Built for the Quai ecosystem
              <ChevronRight className="h-3.5 w-3.5 text-sky-400" />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="max-w-4xl text-5xl font-semibold leading-[1.02] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl"
            >
              Payments built for
              <span className="block bg-gradient-to-r from-white via-sky-200 to-sky-400 bg-clip-text text-transparent">
                the speed of Quai.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.12 }}
              className="mt-7 max-w-xl text-lg leading-8 text-slate-400"
            >
              Accept stablecoin payments through a simple, non-custodial
              checkout. Give customers a familiar payment experience while
              settling on Quai.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.18 }}
              className="mt-9 flex flex-col gap-3 sm:flex-row"
            >
              <Link
                href="/onboarding"
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-sky-400 px-5 font-medium text-slate-950 transition hover:bg-sky-300"
              >
                Start accepting payments
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>

              <Link
                href="/checkout/demo"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 font-medium text-white transition hover:border-white/20 hover:bg-white/[0.07]"
              >
                Try the checkout
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-500"
            >
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-400" />
                Non-custodial
              </span>

              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-400" />
                Stablecoin ready
              </span>

              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-400" />
                Quai native
              </span>
            </motion.div>
          </div>

          {/* Payment preview */}
          <motion.div
            initial={{ opacity: 0, x: 30, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="relative mx-auto w-full max-w-[510px]"
          >
            <div className="relative">
              <div className="rounded-[28px] border border-white/[0.08] bg-[#0d121b] p-3">
                <div className="rounded-[22px] border border-white/[0.06] bg-[#0a0e15] p-6">
                  <div className="flex items-center justify-between border-b border-white/[0.07] pb-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-400/10 text-sky-400">
                        <Sparkles className="h-5 w-5" />
                      </div>

                      <div>
                        <p className="text-sm font-medium text-white">
                          Pay with Quai
                        </p>
                        <p className="text-xs text-slate-500">
                          Secure checkout
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Live
                    </div>
                  </div>

                  <div className="py-8 text-center">
                    <p className="text-sm text-slate-500">Total to pay</p>

                    <div className="mt-2 flex items-baseline justify-center gap-2">
                      <span className="text-5xl font-semibold tracking-tight text-white">
                        25.00
                      </span>

                      <span className="text-lg font-medium text-sky-400">
                        QUAI
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-500">
                      ≈ $20.00 USD
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.05]">
                          <Network className="h-4 w-4 text-sky-300" />
                        </div>

                        <div>
                          <p className="text-sm text-slate-300">
                            Quai Network
                          </p>

                          <p className="text-xs text-slate-600">
                            Settlement network
                          </p>
                        </div>
                      </div>

                      <Check className="h-4 w-4 text-emerald-400" />
                    </div>

                    <button
                      type="button"
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-sky-400 font-medium text-slate-950 transition hover:bg-sky-300"
                    >
                      Continue to payment
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-600">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Non-custodial payment
                  </div>
                </div>
              </div>

              {/* Floating confirmation */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute -bottom-7 -left-5 hidden w-56 rounded-2xl border border-white/[0.08] bg-[#0d121b] p-4 shadow-2xl sm:block"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400/10">
                    <Check className="h-4 w-4 text-emerald-400" />
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      Payment received
                    </p>

                    <p className="mt-0.5 text-sm font-medium text-white">
                      +25.00 QUAI
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Floating transaction */}
              <motion.div
                animate={{ y: [0, 7, 0] }}
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute -right-5 -top-6 hidden w-48 rounded-2xl border border-white/[0.08] bg-[#0d121b] p-4 shadow-2xl sm:block"
              >
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Globe2 className="h-3.5 w-3.5 text-sky-400" />
                  Quai settlement
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Status</span>

                  <span className="text-xs font-medium text-emerald-400">
                    Confirmed
                  </span>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="relative border-y border-white/[0.06] bg-white/[0.015]">
        <div className="mx-auto grid max-w-7xl gap-px px-6 sm:grid-cols-3 lg:px-8">
          {capabilities.map((item, index) => {
            const Icon = item.icon;

            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                className="px-1 py-8 sm:px-8 sm:py-10"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-400/10 bg-sky-400/[0.06] text-sky-400">
                  <Icon className="h-5 w-5" />
                </div>

                <h3 className="mt-5 text-base font-medium text-white">
                  {item.title}
                </h3>

                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  {item.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="mx-auto max-w-7xl px-6 py-24 lg:px-8 lg:py-32"
      >
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-sky-400">HOW IT WORKS</p>

          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            From checkout to settlement,
            <span className="text-slate-500">
              {" "}
              without the complexity.
            </span>
          </h2>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group relative"
            >
              {index < steps.length - 1 && (
                <div className="absolute left-[calc(100%+1rem)] top-5 hidden h-px w-8 bg-gradient-to-r from-white/10 to-transparent md:block" />
              )}

              <div className="text-sm font-medium text-sky-400">
                {step.number}
              </div>

              <h3 className="mt-6 text-xl font-medium text-white">
                {step.title}
              </h3>

              <p className="mt-3 max-w-sm text-sm leading-7 text-slate-500">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Developer / QR section */}
      <section
        id="developers"
        className="mx-auto max-w-7xl px-6 pb-24 lg:px-8 lg:pb-32"
      >
        <div className="relative overflow-hidden rounded-[28px] border border-white/[0.07] bg-gradient-to-br from-sky-400/[0.08] via-white/[0.025] to-transparent p-8 sm:p-12">
          <div className="relative grid gap-12 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/10 text-sky-400">
                <QrCode className="h-5 w-5" />
              </div>

              <h2 className="mt-6 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                A checkout your customers already understand.
              </h2>

              <p className="mt-4 max-w-xl leading-7 text-slate-500">
                Connect a wallet, review the payment, confirm and settle.
                Merchants can also generate QR-based payment requests for
                physical or mobile commerce.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <div className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2 text-xs text-slate-400">
                  <Code2 className="h-3.5 w-3.5 text-sky-400" />
                  Simple integration
                </div>

                <div className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2 text-xs text-slate-400">
                  <QrCode className="h-3.5 w-3.5 text-sky-400" />
                  QR payments
                </div>
              </div>
            </div>

            <div className="mx-auto w-full max-w-xs">
              <div className="rounded-2xl border border-white/10 bg-[#080b10] p-4 shadow-2xl">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Payment request
                    </span>

                    <Copy className="h-3.5 w-3.5 text-slate-600" />
                  </div>

                  <div className="mt-5 flex aspect-square items-center justify-center rounded-xl bg-white p-5">
                    <div className="grid h-full w-full grid-cols-7 gap-1 opacity-90">
                      {Array.from({ length: 49 }).map((_, index) => (
                        <div
                          key={index}
                          className={`rounded-[2px] ${
                            [
                              0, 1, 2, 4, 5, 6, 7, 9, 10, 12, 14, 15, 16, 18,
                              20, 22, 24, 25, 26, 28, 30, 32, 34, 36, 37, 39,
                              40, 42, 44, 45, 47, 48,
                            ].includes(index)
                              ? "bg-slate-950"
                              : "bg-white"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 text-center">
                    <p className="text-sm font-medium text-white">
                      25.00 QUAI
                    </p>

                    <p className="mt-1 text-xs text-slate-600">
                      Scan to pay
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative border-t border-white/[0.06]">
        <div className="relative mx-auto max-w-4xl px-6 py-24 text-center lg:py-32">
          <p className="text-sm font-medium text-sky-400">READY TO BUILD?</p>

          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">
            Start accepting payments on Quai.
          </h2>

          <p className="mx-auto mt-5 max-w-xl leading-7 text-slate-500">
            Give your customers a simple way to pay and give your business a
            settlement experience built for the next generation of commerce.
          </p>

          <Link
            href="/onboarding"
            className="group mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-sky-400 px-6 font-medium text-slate-950 transition hover:bg-sky-300"
          >
            Get started
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>

      <Footer />
      </div>
    </main>
  );
}

function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.05] bg-[#07090d]/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-18 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />

          <span className="text-sm font-semibold tracking-tight text-white">
            PAY WITH <span className="text-sky-400">QUAI</span>
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <a
            href="#how-it-works"
            className="text-sm text-slate-500 transition hover:text-white"
          >
            How it works
          </a>

          <Link
            href="/checkout/demo"
            className="text-sm text-slate-500 transition hover:text-white"
          >
            Checkout
          </Link>

          <a
            href="#developers"
            className="text-sm text-slate-500 transition hover:text-white"
          >
            Developers
          </a>

          <Link
            href="/docs"
            className="text-sm text-slate-500 transition hover:text-white"
          >
            Docs
          </Link>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/dashboard"
            className="rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:text-white"
          >
            Merchant login
          </Link>

          <Link
            href="/onboarding"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-slate-200"
          >
            Get started
          </Link>
        </div>

        <button
          type="button"
          aria-label="Open menu"
          className="rounded-lg border border-white/10 p-2 text-slate-300 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/[0.06]">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-8 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <div className="flex items-center gap-2.5">
          <Logo />

          <span className="text-sm font-medium text-slate-400">
            Pay with Quai
          </span>
        </div>

        <div className="flex items-center gap-5 text-xs text-slate-600">
          <Link href="/docs" className="transition hover:text-slate-400">
            Docs
          </Link>
          <span>•</span>
          <span>Built on Quai Network</span>
          <span>•</span>
          <span>MVP Demo</span>
        </div>
      </div>
    </footer>
  );
}