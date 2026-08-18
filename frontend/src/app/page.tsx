"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
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
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <Navbar />

      <div className="overflow-hidden">

      {/* Hero */}
      <section className="relative">
        <div className="grid-background pointer-events-none absolute inset-0 h-180" />

        <div className="relative mx-auto flex max-w-7xl flex-col items-center text-center gap-16 px-6 pb-24 pt-20 lg:px-8 lg:pb-32 lg:pt-28">
          <div className="flex flex-col items-center">
            <motion.div
              initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ type: "spring", stiffness: 90, damping: 20, mass: 0.5 }}
              className="relative mb-7 inline-flex items-center justify-center overflow-hidden rounded-full p-px"
            >
              <div className="absolute inset-[-1000%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,transparent_50%,#38bdf8_100%)]" />
              <div className="relative inline-flex items-center gap-2 rounded-full bg-[#0a0a0a] px-3.5 py-2 text-sm text-sky-200">
                <div className="absolute inset-0 rounded-full bg-sky-400/6" />
                <span className="relative z-10 flex items-center gap-2">
                  Built for the Quai ecosystem
                  <ChevronRight className="h-3.5 w-3.5 text-sky-400" />
                </span>
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30, filter: "blur(8px)", scale: 0.98 }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)", scale: 1 }}
              transition={{ type: "spring", stiffness: 80, damping: 20, delay: 0.1 }}
              className="max-w-4xl text-5xl font-semibold leading-[1.02] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl"
            >
              Payments built for
              <span className="block text-sky-400">
                the speed of Quai.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 80, damping: 20, delay: 0.2 }}
              className="mt-7 max-w-xl text-lg leading-8 text-slate-400 mx-auto"
            >
              Accept stablecoin payments through a simple, non-custodial
              checkout. Give customers a familiar payment experience while
              settling on Quai.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 80, damping: 20, delay: 0.3 }}
              className="mt-9 flex flex-col justify-center gap-3 sm:flex-row"
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
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/4 px-5 font-medium text-white transition hover:border-white/20 hover:bg-white/7"
              >
                Try the checkout
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 80, damping: 20, delay: 0.4 }}
              className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-slate-500"
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

          {/* Dashboard Image */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 70, damping: 20, delay: 0.4, mass: 1 }}
            className="relative mx-auto w-full max-w-5xl rounded-3xl border border-white/8 bg-gray-800 p-2 shadow-2xl"
          >
            <div className="overflow-hidden rounded-[18px] border border-white/4">
              <Image 
                src="/dashboard.png" 
                alt="Dashboard Screenshot" 
                width={1200} 
                height={675} 
                className="w-full h-auto"
                priority
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="relative border-y border-white/6 bg-white/1.5">
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
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-400/10 bg-sky-400/6 text-sky-400">
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
                <div className="absolute left-[calc(100%+1rem)] top-5 hidden h-px w-8 bg-white/10 md:block" />
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
        <div className="relative overflow-hidden rounded-[28px] border border-white/7 bg-white/2 p-8 sm:p-12">
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
                <div className="flex items-center gap-2 rounded-lg border border-white/7 bg-black/20 px-3 py-2 text-xs text-slate-400">
                  <Code2 className="h-3.5 w-3.5 text-sky-400" />
                  Simple integration
                </div>

                <div className="flex items-center gap-2 rounded-lg border border-white/7 bg-black/20 px-3 py-2 text-xs text-slate-400">
                  <QrCode className="h-3.5 w-3.5 text-sky-400" />
                  QR payments
                </div>
              </div>
            </div>

            <div className="mx-auto w-full max-w-xs">
              <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-4 shadow-2xl">
                <div className="rounded-xl border border-white/6 bg-white/2 p-5">
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
                          className={`rounded-xs ${
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
      <section className="relative border-t border-white/6">
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-18 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="text-sm font-semibold tracking-tight text-white">
            PAY WITH <span className="text-sky-400">QUAI</span>
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <a href="#how-it-works" className="text-sm text-slate-500 transition hover:text-white">How it works</a>
          <Link href="/checkout/demo" className="text-sm text-slate-500 transition hover:text-white">Checkout</Link>
          <a href="#developers" className="text-sm text-slate-500 transition hover:text-white">Developers</a>
          <Link href="/docs" className="text-sm text-slate-500 transition hover:text-white">Docs</Link>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login" className="rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:text-white">Merchant login</Link>
          <Link href="/onboarding" className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-slate-200">Get started</Link>
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Open menu"
          className="rounded-lg border border-white/10 p-2 text-slate-300 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      </nav>

      {mobileMenuOpen && (
        <div className="absolute left-0 top-18 w-full border-b border-white/5 bg-[#0a0a0a] shadow-xl md:hidden">
          <div className="flex flex-col gap-4 p-6">
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="text-sm text-slate-400 hover:text-white">How it works</a>
            <Link href="/checkout/demo" onClick={() => setMobileMenuOpen(false)} className="text-sm text-slate-400 hover:text-white">Checkout</Link>
            <a href="#developers" onClick={() => setMobileMenuOpen(false)} className="text-sm text-slate-400 hover:text-white">Developers</a>
            <Link href="/docs" onClick={() => setMobileMenuOpen(false)} className="text-sm text-slate-400 hover:text-white">Docs</Link>
            
            <div className="my-2 h-px bg-white/5" />
            
            <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="text-sm text-slate-400 hover:text-white">Merchant login</Link>
            <Link href="/onboarding" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium text-sky-400 hover:text-sky-300">Get started</Link>
          </div>
        </div>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/6">
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