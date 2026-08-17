"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CodeBlock({
  code,
  label,
}: {
  code: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard unavailable — ignore
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0a0e15]">
      <div className="flex items-center justify-between border-b border-white/[0.05] bg-white/[0.03] px-4 py-2.5">
        <span className="text-xs font-medium text-[#8b93a7]">
          {label ?? "Code"}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy code"
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[#8b93a7] transition hover:bg-white/[0.06] hover:text-white"
        >
          {copied ? (
            <Check size={13} className="text-emerald-300" />
          ) : (
            <Copy size={13} />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-6">
        <code className="font-mono text-slate-100">{code}</code>
      </pre>
    </div>
  );
}