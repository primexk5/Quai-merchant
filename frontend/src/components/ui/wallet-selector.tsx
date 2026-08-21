"use client";

import { useEffect, useState } from "react";
import { parseError } from "@/lib/utils";
import { Check, Loader2, RefreshCw, Wallet, X } from "lucide-react";
import {
  connectWallet,
  detectWallets,
  ensureQuaiNetwork,
  getActiveWallet,
  storeWalletId,
  QUAI_MAINNET_CHAIN,
  type DetectedWallet,
  type WalletBrand,
} from "@/lib/wallets";

const brandStyles: Record<WalletBrand, { bg: string; text: string }> = {
  pelagus: { bg: "bg-[#38bdf8]", text: "text-[#061018]" },
  blip: { bg: "bg-[#C1ED00]", text: "text-[#0F1116]" },
  metamask: { bg: "bg-orange-500", text: "text-[#061018]" },
  rabby: { bg: "bg-violet-500", text: "text-[#061018]" },
  coinbase: { bg: "bg-blue-500", text: "text-[#061018]" },
  brave: { bg: "bg-orange-600", text: "text-[#061018]" },
  okx: { bg: "bg-slate-800", text: "text-[#061018]" },
  bitget: { bg: "bg-sky-600", text: "text-[#061018]" },
  trust: { bg: "bg-blue-700", text: "text-[#061018]" },
  frame: { bg: "bg-white/6", text: "text-white" },
  generic: { bg: "bg-slate-200", text: "text-[#061018]" },
};

const brandInitials: Record<WalletBrand, string> = {
  pelagus: "P",
  blip: "B",
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
  // Blip uses its own logo SVG
  if (brand === "blip") {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C1ED00]">
        <svg viewBox="0 0 100 100" className="h-6 w-6">
          <path fill="#0F1116" d="m98.3 24.4c0-7.2-6.9-13.9-18.2-13.9-7.1-0.1-15.7 2-19.8 8.6-2.6-1.8-6.3-3.9-12.6-3.9-6.8 0-13.4 2.5-16.8 8.2-3.2-1.9-6.5-3.2-12.1-3.2-8.9 0-16.8 4.4-16.8 11.7v19.9c2.4 9.2 14.2 26 47.5 34.9 3.9 0.9 9.1 1.9 12.6 2.4 7.3 0.7 17.8-1.5 19.7-9.6 0.4-1.8 0-8.5 0.2-8.5 2.6-0.6 7.9-3.7 8.6-9.3v-8.4c3.2-1.3 7.7-4.8 7.7-10.2v-18.7z"/>
          <path fill="#C1ED00" d="m58.4 26.6c-1.3-3.5-6.5-5.1-10.7-5-6.3 0-12.5 2.9-11.1 7 2.5 6.9 11.1 15.4 25.9 18.6 3.7 0.9 7.6 1.4 10.9 1.5 10.1 0 14-7 7.7-10.5-3.3-1.8-5.7-1.6-7.7-2-5.7-0.8-12.7-3.6-15-9.6zm-28.8 4.3c-1.5-2.7-6-4.6-10.8-4.6-6.7 0-12.5 3.2-10.9 7.3 3 8 13.7 20.3 35.6 26.9 4.9 1.6 11.1 2.9 16 3.7 12 2 19.6-3.7 15-8-2.9-2.4-5.9-2.7-7.8-3-13.2-1.6-32.1-8.6-37.1-22.3zm49.3-14.1c-7.8 0-13.7 3.6-13.7 7.4 0 2.9 3.9 7.2 13.2 7.3 8.2 0 14-3.3 14-7.1 0.1-3.2-4-7.4-13.5-7.6z"/>
        </svg>
      </span>
    );
  }
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
      const quaiNative = wallet.brand === "pelagus" || wallet.brand === "blip";
      let address: string;
      if (quaiNative) {
        address = await connectWallet(wallet);
        const net = await ensureQuaiNetwork(wallet.provider, QUAI_MAINNET_CHAIN, { quaiNative });
        if (net === "unsupported") {
          throw new Error(`Please ensure ${wallet.name} is set to Quai Mainnet (chain 9).`);
        }
      } else {
        const net = await ensureQuaiNetwork(wallet.provider, QUAI_MAINNET_CHAIN);
        if (net === "unsupported") {
          throw new Error(`Could not switch ${wallet.name} to Quai Mainnet.`);
        }
        address = await connectWallet(wallet);
      }
      
      storeWalletId(wallet.id);
      setOpen(false);
      onConnected(address);
    } catch (err) {
      setError(parseError(err));
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
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/7 bg-[#171717] px-4 py-2.5 text-sm font-medium text-[#c9d4e0] transition hover:bg-white/5"
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
            className="w-full max-w-md rounded-2xl border border-white/7 bg-[#171717] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Connect a wallet
                </h3>
                <p className="mt-1 text-sm text-[#8b93a7]">
                  Only Blip, Pelagus and MetaMask can sign for Quai.
                </p>
              </div>

              <button
                onClick={() => setOpen(false)}
                aria-label="Close wallet picker"
                className="rounded-lg p-1.5 text-[#4f5868] transition hover:bg-white/8 hover:text-[#c9d4e0]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-2">
              {wallets.length === 0 && (
                <div className="rounded-xl border border-white/7 bg-[#171717] p-4 text-sm text-[#8b93a7]">
                  No wallet extension detected. Install{" "}
                  <a
                    href="https://chromewebstore.google.com/detail/pelagus/nhccebmfjcbhghphpclcfdkkekheegop"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-[#38bdf8] hover:underline"
                  >
                    Pelagus
                  </a>{" "}
                  (Quai&apos;s official wallet) or MetaMask, then reload.
                </div>
              )}

              {wallets.map((wallet) => (
                <button
                  key={wallet.id}
                  onClick={() => void connect(wallet)}
                  disabled={busy !== null || !wallet.supportsQuai}
                  title={wallet.supportsQuai ? undefined : "Not Quai-compatible"}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/7 bg-[#171717] p-3 text-left transition hover:border-[#38bdf8]/15 hover:bg-[#38bdf8]/6/60 disabled:opacity-60 disabled:hover:border-white/7 disabled:hover:bg-[#171717]"
                >
                  <WalletMark brand={wallet.brand} />

                  <span className="flex-1">
                    <span className="block text-sm font-medium text-white">
                      {wallet.name}
                    </span>
                    <span className="block text-xs text-[#8b93a7]">
                      {wallet.supportsQuai
                        ? wallet.id === active?.id
                          ? "Previously connected"
                          : "Quai network ready"
                        : "Not Quai-compatible — install Pelagus or Blip"}
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