import { ReactNode } from "react";

type Tone = "brand" | "success" | "warning" | "danger" | "purple";

const iconToneClass: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-600",
  success: "bg-emerald-50 text-emerald-600",
  warning: "bg-amber-50 text-amber-600",
  danger: "bg-rose-50 text-rose-600",
  purple: "bg-purple-50 text-purple-600",
};

const barToneClass: Record<Tone, string> = {
  brand: "from-brand-500 to-indigo-500",
  success: "from-emerald-500 to-teal-500",
  warning: "from-amber-500 to-orange-500",
  danger: "from-rose-500 to-red-500",
  purple: "from-purple-500 to-fuchsia-500",
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "brand",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${barToneClass[tone]}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
          {hint && <p className="mt-1 truncate text-xs text-gray-400">{hint}</p>}
        </div>
        {icon && (
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconToneClass[tone]}`}>{icon}</div>
        )}
      </div>
    </div>
  );
}
