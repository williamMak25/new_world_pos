"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { SalesSummary } from "@/lib/types";

function money(value: string, currency = "USD") {
  const n = Number(value);
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number.isFinite(n) ? n : 0);
}

const GRANULARITY_LABEL: Record<SalesSummary["breakdownGranularity"], string> = {
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
};

function formatPeriod(periodStart: string, granularity: SalesSummary["breakdownGranularity"]) {
  const d = new Date(periodStart);
  if (granularity === "day") {
    return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(d);
  }
  if (granularity === "week") {
    return `Week of ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d)}`;
  }
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(d);
}

const PERIODS = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
  { days: 365, label: "Last 365 days" },
];

export default function ReportsPage() {
  const { storeId, stores } = useAuth();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<SalesSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    setError(null);
    api
      .get<SalesSummary>(`/api/stores/${storeId}/reports/sales-summary?days=${days}`)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.detail : "Unable to load report."))
      .finally(() => setLoading(false));
  }, [storeId, days]);

  const store = stores.find((s) => s.id === storeId);
  const currency = store?.currency ?? "USD";

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
        >
          {PERIODS.map((p) => (
            <option key={p.days} value={p.days}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {!storeId && <p className="text-sm text-gray-500">Select a store to see its report.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-gray-500">Loading…</p>}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Sell" value={String(data.saleCount)} />
            <StatCard label="Total Revenue" value={money(data.netSales, currency)} />
            <StatCard label="Total Capital (sold)" value={money(data.totalCost, currency)} />
            <StatCard label="Gross Profit" value={money(data.grossProfit, currency)} />
          </div>

          {/* Separate from the period grid above: this is stock on hand right
              now, not affected by the period selector — there's no history
              of past inventory levels to compute it for a prior date. */}
          <div className="max-w-xs rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Capital in Stock (current)</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{money(data.capitalInStock, currency)}</p>
            <p className="mt-1 text-xs text-gray-400">Cost of unsold inventory on hand, as of now</p>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <h2 className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900">
              {GRANULARITY_LABEL[data.breakdownGranularity]} breakdown
            </h2>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2">Period</th>
                  <th className="px-4 py-2 text-right">Sell</th>
                  <th className="px-4 py-2 text-right">Revenue</th>
                  <th className="px-4 py-2 text-right">Capital</th>
                  <th className="px-4 py-2 text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.breakdown.map((row) => (
                  <tr key={row.periodStart}>
                    <td className="px-4 py-2 font-medium text-gray-800">
                      {formatPeriod(row.periodStart, data.breakdownGranularity)}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-500">{row.saleCount}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{money(row.netSales, currency)}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{money(row.totalCost, currency)}</td>
                    <td className="px-4 py-2 text-right font-medium text-gray-900">{money(row.grossProfit, currency)}</td>
                  </tr>
                ))}
                {data.breakdown.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                      No sales in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}
