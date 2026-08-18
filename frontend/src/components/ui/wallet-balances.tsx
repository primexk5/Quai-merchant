"use client";

import { useEffect, useState } from "react";
import { BrowserProvider, Contract } from "quais";
import { getActiveWallet } from "@/lib/wallets";
import { RefreshCw, Wallet as WalletIcon } from "lucide-react";

// The mock stablecoin address used on Orchard Testnet
const MUSDQ_ADDRESS = process.env.NEXT_PUBLIC_MUSDQ_ADDRESS || "0x0068f42D5Bd511363f52a1ade1ecD41B4bdD8F8e";

// Minimal ERC20 ABI for balance checking
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
];

export function WalletBalances() {
  const [quaiBalance, setQuaiBalance] = useState<string | null>(null);
  const [musdqBalance, setMusdqBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // loading starts true so the skeleton shows on first render without a setState
  const fetchBalances = async () => {
    // Yield to the event loop so state updates inside this function happen asynchronously
    // relative to the useEffect that calls it. This fixes the cascading render lint error.
    await Promise.resolve();

    const wallet = getActiveWallet();
    if (!wallet) {
      setError("No wallet connected");
      setLoading(false);
      return;
    }

    setError(null);
    try {
      const provider = new BrowserProvider(wallet.provider);
      const accounts = await provider.listAccounts();
      if (!accounts.length) throw new Error("Wallet locked");
      const address = accounts[0].address;

      // Fetch Native QUAI
      const balance = await provider.getBalance(address);
      setQuaiBalance((Number(balance) / 1e18).toFixed(2));

      // Fetch mUSDQ (6 decimals)
      const tokenContract = new Contract(MUSDQ_ADDRESS, ERC20_ABI, provider);
      const tokenBalance = await tokenContract.balanceOf(address);
      setMusdqBalance((Number(tokenBalance) / 1e6).toFixed(2));
    } catch (err) {
      console.error("Error fetching balances:", err);
      setError("Failed to load balances");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchBalances();
  }, []);

  return (
    <div className="rounded-2xl border border-white/7 bg-[#171717] p-5">
      <div className="mb-4 flex items-center justify-between border-b border-white/7 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#38bdf8]/10 text-[#38bdf8]">
            <WalletIcon size={16} />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Wallet Balances</h2>
            <p className="text-xs text-[#8b93a7]">Your current testnet holdings</p>
          </div>
        </div>
        <button
          onClick={fetchBalances}
          disabled={loading}
          className="rounded-lg border border-white/7 p-2 text-[#8b93a7] transition hover:bg-white/4 hover:text-white disabled:opacity-50"
          title="Refresh balances"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/4 bg-[#0a0a0a] p-4">
            <p className="text-xs text-[#8b93a7]">Native QUAI</p>
            <p className="mt-1 font-mono text-xl text-white">
              {loading ? "..." : quaiBalance}
            </p>
          </div>
          <div className="rounded-xl border border-white/4 bg-[#0a0a0a] p-4">
            <p className="text-xs text-[#8b93a7]">mUSDQ (Stablecoin)</p>
            <p className="mt-1 font-mono text-xl text-[#34d399]">
              {loading ? "..." : musdqBalance}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
