"use client";

import Link from "next/link";
import { ArrowRight, Check, Wallet } from "lucide-react";
import { useState } from "react";

const steps = ["Business", "Wallet", "Complete"];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);

  return (
    <main className="min-h-screen bg-[#07090d] px-5 py-8 text-white">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="flex w-fit items-center gap-2 text-sm font-semibold"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#38bdf8] text-[#061018]">
            Q
          </span>
          PAY WITH <span className="text-[#38bdf8]">QUAI</span>
        </Link>

        <div className="mt-14">
          <p className="text-sm text-[#38bdf8]">Merchant onboarding</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Start accepting Quai payments.
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#667085]">
            Set up your merchant profile and connect a settlement wallet.
          </p>
        </div>

        <div className="mt-8 flex items-center">
          {steps.map((item, index) => (
            <div key={item} className="flex flex-1 items-center">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  index <= step
                    ? "bg-[#38bdf8] text-[#061018]"
                    : "border border-white/10 text-[#667085]"
                }`}
              >
                {index < step ? <Check size={14} /> : index + 1}
              </div>

              <span className="ml-2 hidden text-xs text-[#8b93a7] sm:block">
                {item}
              </span>

              {index < steps.length - 1 && (
                <div className="mx-3 h-px flex-1 bg-white/[0.08]" />
              )}
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-white/[0.07] bg-[#0c1017] p-6 sm:p-8">
          {step === 0 && (
            <>
              <h2 className="text-xl font-semibold">Tell us about your business</h2>
              <p className="mt-1 text-sm text-[#667085]">
                This information will appear on your checkout.
              </p>

              <div className="mt-7 space-y-5">
                <label className="block text-sm">
                  <span className="mb-2 block text-[#8b93a7]">
                    Business name
                  </span>
                  <input
                    placeholder="e.g. Acme Store"
                    className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#080b10] px-3 text-white outline-none placeholder:text-[#4f5868] focus:border-[#38bdf8]/40"
                  />
                </label>

                <label className="block text-sm">
                  <span className="mb-2 block text-[#8b93a7]">Website</span>
                  <input
                    placeholder="https://example.com"
                    className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#080b10] px-3 text-white outline-none placeholder:text-[#4f5868] focus:border-[#38bdf8]/40"
                  />
                </label>
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
              <p className="mt-1 text-sm leading-6 text-[#667085]">
                Your wallet receives payments after they settle on the Quai
                network.
              </p>

              <button className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-3 text-sm font-medium hover:bg-white/[0.05]">
                Connect wallet
                <ArrowRight size={15} />
              </button>
            </>
          )}

          {step === 2 && (
            <div className="py-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300">
                <Check size={24} />
              </div>

              <h2 className="mt-5 text-xl font-semibold">You&apos;re ready.</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#667085]">
                Your merchant account is ready to accept payments through Quai.
              </p>

              <Link
                href="/dashboard"
                className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#38bdf8] px-5 py-3 text-sm font-semibold text-[#061018]"
              >
                Open dashboard
                <ArrowRight size={15} />
              </Link>
            </div>
          )}

          {step < 2 && (
            <div className="mt-8 flex justify-end">
              <button
                onClick={() => setStep((current) => current + 1)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#38bdf8] px-5 py-2.5 text-sm font-semibold text-[#061018] hover:bg-[#67d8ff]"
              >
                Continue
                <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}