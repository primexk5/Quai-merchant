import { forwardRef } from "react";
import { Check } from "lucide-react";
import { Logo } from "@/components/logo";

export interface ReceiptProps {
  amount: string;
  symbol: string;
  merchantAddress: string;
  orderId: string;
  txHash: string;
  date: string;
}

export const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(
  ({ amount, symbol, merchantAddress, orderId, txHash, date }, ref) => {
    return (
      <div
        ref={ref}
        className="w-105 shrink-0 overflow-hidden rounded-3xl border border-white/10 bg-[#0f1115] p-8 text-white shadow-2xl"
        style={{
          background: "linear-gradient(180deg, #1a1c23 0%, #0f1115 100%)",
          fontFamily: "sans-serif", // Ensure basic font rendering for html-to-image
        }}
      >
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10 text-emerald-400">
            <Check size={32} />
          </div>
          
          <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-[0.2em]">
            Payment Confirmed
          </h2>
          
          <div className="mt-6 flex items-baseline justify-center gap-2">
            <span className="text-[2.75rem] font-bold leading-none tracking-tight">{amount}</span>
            <span className="text-xl font-semibold text-[#8b93a7]">{symbol}</span>
          </div>
          
          <p className="mt-3 text-sm text-[#4f5868]">{date}</p>
        </div>

        <div className="my-8 relative">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-dashed border-white/15" />
          </div>
          <div className="absolute -left-10 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[#171717]" />
          <div className="absolute -right-10 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[#171717]" />
        </div>

        <div className="space-y-5 rounded-2xl bg-white/5 p-5 border border-white/5">
          <div>
            <p className="text-xs font-medium text-[#8b93a7] uppercase tracking-wider mb-1">Merchant Address</p>
            <p className="break-all font-mono text-sm text-white/90">{merchantAddress}</p>
          </div>
          
          <div>
            <p className="text-xs font-medium text-[#8b93a7] uppercase tracking-wider mb-1">Order ID</p>
            <p className="break-all font-mono text-sm text-white/90">{orderId}</p>
          </div>
          
          <div>
            <p className="text-xs font-medium text-[#8b93a7] uppercase tracking-wider mb-1">Transaction Hash</p>
            <p className="break-all font-mono text-sm text-[#38bdf8]">{txHash}</p>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 opacity-60">
          <Logo className="h-6 w-6 grayscale" />
          <span className="text-[10px] font-bold tracking-[0.25em] text-[#8b93a7]">QUAI MERCHANT</span>
        </div>
      </div>
    );
  }
);

Receipt.displayName = "Receipt";
