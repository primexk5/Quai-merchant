"use client";

import Link from "next/link";
import { ArrowLeft, Check, LockKeyhole, ShieldCheck } from "lucide-react";
import { useState } from "react";

export default function CheckoutDemoPage() {
  const [paid, setPaid] = useState(false);

  if (paid) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07090d] px-5 text-white">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
            <Check size={28} />
          </div>

          <p className="mt-6 text-sm text-emerald-300">Payment confirmed</p>
          <h1 className="mt-2 text-3xl font-semibold">25.00 QUAI received</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#667085]">
            Your transaction has been successfully confirmed on the Quai
            network.
          </p>

          <Link
            href="/"
            className="mt-8 inline-flex items-center gap-2 text-sm text-[#38bdf8]"
          >
            <ArrowLeft size={15} />
            Return to Pay with Quai
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07090d] px-5 py-10 text-white">
      <div className="mx-auto max-w-lg">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[#8b93a7] hover:text-white"
        >
          <ArrowLeft size={15} />
          Pay with Quai
        </Link>

        <div className="mt-10 rounded-3xl border border-white/[0.08] bg-[#0c1017] p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Quai Store</p>
              <p className="mt-1 text-xs text-[#667085]">Secure checkout</p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#38bdf8] text-[#061018]">
              Q
            </div>
          </div>

          <div className="my-7 h-px bg-white/[0.07]" />

          <div className="text-center">
            <p className="text-sm text-[#667085]">Total to pay</p>
            <p className="mt-2 text-5xl font-semibold tracking-tight">
              25.00
            </p>
            <p className="mt-1 text-sm text-[#38bdf8]">QUAI</p>
            <p className="mt-2 text-xs text-[#667085]">≈ $20.00 USD</p>
          </div>

          <div className="mt-8 rounded-2xl border border-white/[0.07] bg-[#080b10] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Quai Network</p>
                <p className="mt-1 text-xs text-[#667085]">
                  Settlement network
                </p>
              </div>

              <Check size={17} className="text-emerald-300" />
            </div>
          </div>

          <button
            onClick={() => setPaid(true)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#38bdf8] py-3.5 text-sm font-semibold text-[#061018] transition hover:bg-[#67d8ff]"
          >
            Confirm payment
            <ArrowLeft size={15} className="rotate-180" />
          </button>

          <div className="mt-5 flex items-center justify-center gap-5 text-xs text-[#667085]">
            <span className="flex items-center gap-1.5">
              <LockKeyhole size={13} />
              Secure
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={13} />
              Non-custodial
            </span>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-[#4f5868]">
          This is a frontend demonstration. Payment processing will be
          connected to the Quai backend.
        </p>
      </div>
    </main>
  );
}