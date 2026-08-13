import { CheckCircle2, Clock3, XCircle } from "lucide-react";

type Status = "confirmed" | "pending" | "failed";

const config = {
  confirmed: {
    label: "Confirmed",
    icon: CheckCircle2,
    className: "border-emerald-400/15 bg-emerald-400/10 text-emerald-300",
  },
  pending: {
    label: "Pending",
    icon: Clock3,
    className: "border-amber-400/15 bg-amber-400/10 text-amber-300",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    className: "border-red-400/15 bg-red-400/10 text-red-300",
  },
};

export function StatusBadge({ status }: { status: Status }) {
  const item = config[status];
  const Icon = item.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${item.className}`}
    >
      <Icon size={13} />
      {item.label}
    </span>
  );
}