"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, RefreshCw, Wallet, X } from "lucide-react";
import {
  connectWallet,
  detectWallets,
  ensureQuaiNetwork,
  getActiveWallet,
  storeWalletId,
  type DetectedWallet,
  type WalletBrand,
} from "@/lib/wallets";

const brandStyles: Record<WalletBrand, { bg: string; text: string }> = {
  pelagus: { bg: "bg-[#38bdf8]", text: "text-[#061018]" },
  metamask: { bg: "bg-orange-500", text: "text-[#061018]" },
  rabby: { bg: "bg-violet-500", text: "text-[#061018]" },
  coinbase: { bg: "bg-blue-500", text: "text-[#061018]" },
  brave: { bg: "bg-orange-600", text: "text-[#061018]" },
  okx: { bg: "bg-slate-800", text: "text-[#061018]" },
  bitget: { bg: "bg-sky-600", text: "text-[#061018]" },
  trust: { bg: "bg-blue-700", text: "text-[#061018]" },
  frame: { bg: "bg-white/[0.06]", text: "text-white" },
  generic: { bg: "bg-slate-200", text: "text-[#061018]" },
};

const brandInitials: Record<WalletBrand, string> = {
  pelagus: "P",
  metamask: "M",
  rabby: "R",
  coinbase: "C",
  brave: "B",
  okx: "O",
  bitget: "B",
  trust: "T",
  frame: "F",
  generic: "W",
};

function WalletMark({ brand }: { brand: WalletBrand }) {
  const style = brandStyles[brand];
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${style.bg} ${style.text}`}
    >
      {brandInitials[brand]}
    </span>
  );
}

type WalletSelectorProps = {
  connectedAddress: string | null;
  onConnected: (address: string) => void;
  onDisconnect?: () => void;
  label?: string;
};

export function WalletSelector({
  connectedAddress,
  onConnected,
  onDisconnect,
  label = "Connect wallet",
}: WalletSelectorProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wallets = detectWallets();
  const active = getActiveWallet();

  const connect = async (wallet: DetectedWallet) => {
    setBusy(wallet.id);
    setError(null);
    try {
      await ensureQuaiNetwork(wallet.provider);
      const address = await connectWallet(wallet);
      storeWalletId(wallet.id);
      setOpen(false);
      onConnected(address);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    if (!open) return;
    const provider = active?.provider;
    if (!provider?.on) return;
    const onAccountsChanged = () => {
      if (!connectedAddress) return;
      provider
        .request({ method: "eth_accounts" })
        .then((accounts) => {
          const list = accounts as string[];
          if (!list?.length) {
            onDisconnect?.();
          } else if (list[0] !== connectedAddress) {
            onConnected(list[0]);
          }
        })
        .catch(() => undefined);
    };
    provider.on("accountsChanged", onAccountsChanged);
    return () => provider.removeListener?.("accountsChanged", onAccountsChanged);
  }, [open, active, connectedAddress, onConnected, onDisconnect]);

  if (connectedAddress) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-[#0c1017] px-4 py-2.5 text-sm font-medium text-[#c9d4e0] transition hover:bg-[#0c1017]/[0.04]"
        title="Switch wallet"
      >
        <Wallet size={15} className="text-[#38bdf8]" />
        <span className="max-w-56 truncate font-mono text-xs">
          {connectedAddress}
        </span>
        <RefreshCw size={13} className="text-[#4f5868]" />
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#38bdf8] px-5 py-2.5 text-sm font-semibold text-[#061018] transition hover:bg-[#67d8ff]"
      >
        <Wallet size={15} />
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/[0.07] bg-[#0c1017] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Connect a wallet
                </h3>
                <p className="mt-1 text-sm text-[#8b93a7]">
                  Pick any Quai-compatible wallet in this browser.
                </p>
              </div>

              <button
                onClick={() => setOpen(false)}
                aria-label="Close wallet picker"
                className="rounded-lg p-1.5 text-[#4f5868] transition hover:bg-[#0c1017]/[0.05] hover:text-[#c9d4e0]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-2">
              {wallets.length === 0 && (
                <div className="rounded-xl border border-white/[0.07] bg-[#0c1017] p-4 text-sm text-[#8b93a7]">
                  No wallet extension detected. Install{" "}
                  <a
                    href="https://chromewebstore.google.com/detail/pelagus/nhccebmfjcbhghphpclcfdkkekheegop"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-[#38bdf8] hover:underline"
                  >
                    Pelagus
                  </a>{" "}
                  (Quai&apos;s official wallet) or use a wallet that supports
                  custom networks, then reload.
                </div>
              )}

              {wallets.map((wallet) => (
                <button
                  key={wallet.id}
                  onClick={() => void connect(wallet)}
                  disabled={busy !== null}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-[#0c1017] p-3 text-left transition hover:border-[#38bdf8]/15 hover:bg-[#38bdf8]/[0.06]/60 disabled:opacity-60"
                >
                  <WalletMark brand={wallet.brand} />

                  <span className="flex-1">
                    <span className="block text-sm font-medium text-white">
                      {wallet.name}
                    </span>
                    <span className="block text-xs text-[#8b93a7]">
                      {wallet.id === active?.id
                        ? "Previously connected"
                        : "Quai network ready"}
                    </span>
                  </span>

                  {busy === wallet.id ? (
                    <Loader2 size={16} className="animate-spin text-[#38bdf8]" />
                  ) : wallet.id === active?.id ? (
                    <Check size={16} className="text-emerald-400" />
                  ) : null}
                </button>
              ))}
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <p className="mt-5 text-center text-xs text-[#4f5868]">
              The dApp never touches your keys — transactions are signed in
              your wallet.
            </p>
          </div>
        </div>
      )}
    </>
  );
}