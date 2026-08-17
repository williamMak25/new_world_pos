import { ReactNode } from "react";

type Tone = "brand" | "success" | "warning" | "danger" | "default";

const toneClass: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/20",
  success: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  warning: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  danger: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20",
  default: "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-500/10",
};

export function Badge({ tone = "default", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClass[tone]}`}>
      {children}
    </span>
  );
}
