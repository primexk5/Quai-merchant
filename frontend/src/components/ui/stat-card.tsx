import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
};

export function StatCard({
  label,
  value,
  description,
  icon: Icon,
}: StatCardProps) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0c1017] p-5">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-[#8b93a7]">{label}</p>

        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#38bdf8]/15 bg-[#38bdf8]/[0.06] text-[#38bdf8]">
          <Icon size={17} />
        </div>
      </div>

      <p className="text-2xl font-semibold tracking-tight text-white">
        {value}
      </p>

      <p className="mt-1 text-xs text-[#667085]">{description}</p>
    </div>
  );
}