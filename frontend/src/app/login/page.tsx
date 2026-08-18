"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, LogIn, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { WalletSelector } from "@/components/ui/wallet-selector";
import { isLoggedIn, loginWithWallet } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [address, setAddress] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onboardHint, setOnboardHint] = useState(false);

  useEffect(() => {
    if (isLoggedIn()) router.replace("/dashboard");
  }, [router]);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    setOnboardHint(false);
    try {
      await loginWithWallet();
      router.replace("/dashboard");
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      if (/no merchant registered/i.test(msg)) setOnboardHint(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#171717] px-5 py-8 text-white">
      <div className="mx-auto max-w-md">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo />
            <span className="text-sm font-semibold tracking-tight">
              QUAI<span className="text-[#38bdf8]">Merchant</span>
            </span>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-[#8b93a7] transition hover:text-white"
          >
            <ArrowLeft size={15} />
            Back to site
          </Link>
        </header>

        <div className="mt-12 rounded-3xl border border-white/7 bg-[#171717] p-6 sm:p-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#38bdf8]/20 bg-[#38bdf8]/8 text-[#38bdf8]">
            <LogIn size={20} />
          </div>

          <h1 className="mt-5 text-2xl font-semibold tracking-tight">
            Merchant login
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#8b93a7]">
            Sign in with the wallet that&apos;s registered as your payout
            address. Signing a message proves ownership — no password needed.
          </p>

          <div className="mt-6">
            <WalletSelector
              connectedAddress={address}
              onConnected={setAddress}
              label="Connect wallet"
            />
          </div>

          {address && (
            <div className="mt-4 rounded-xl border border-white/7 bg-[#171717] px-4 py-3">
              <p className="text-xs text-[#8b93a7]">Signing in as</p>
              <p className="mt-1 break-all font-mono text-xs text-white">
                {address}
              </p>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
              {onboardHint && (
                <Link
                  href="/onboarding"
                  className="mt-2 block font-medium text-[#38bdf8] hover:underline"
                >
                  Complete merchant onboarding →
                </Link>
              )}
            </div>
          )}

          <button
            onClick={() => void signIn()}
            disabled={!address || busy}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#38bdf8] font-semibold text-[#061018] transition hover:bg-[#67d8ff] disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 size={17} className="animate-spin" />
                Signing message…
              </>
            ) : (
              <>
                Sign in
                <ArrowRight size={17} />
              </>
            )}
          </button>

          <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-[#4f5868]">
            <ShieldCheck size={13} />
            Your signature is never stored — only the session token is kept.
          </p>
        </div>

        <p className="mt-5 text-center text-xs text-[#4f5868]">
          New here?{" "}
          <Link href="/onboarding" className="text-[#38bdf8] hover:underline">
            Create a merchant account
          </Link>
        </p>
      </div>
    </main>
  );
}