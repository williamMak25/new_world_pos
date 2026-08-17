"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { SalesSummary } from "@/lib/types";
import { Card, CardHeader, Select, StatCard, Table, TBody, TD, TEmpty, TH, THead, TR } from "@/components/ui";

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
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
        <Select value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-auto min-w-[9rem]">
          {PERIODS.map((p) => (
            <option key={p.days} value={p.days}>
              {p.label}
            </option>
          ))}
        </Select>
      </div>

      {!storeId && <p className="text-sm text-gray-500">Select a store to see its report.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-gray-500">Loading…</p>}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Sell"
              value={String(data.saleCount)}
              tone="brand"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
            />
            <StatCard
              label="Total Revenue"
              value={money(data.netSales, currency)}
              tone="success"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 12v-2m0-10a9 9 0 100 18 9 9 0 000-18z" />
                </svg>
              }
            />
            <StatCard
              label="Total Capital (sold)"
              value={money(data.totalCost, currency)}
              tone="purple"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              }
            />
            <StatCard
              label="Gross Profit"
              value={money(data.grossProfit, currency)}
              tone="warning"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a2 2 0 012-2h2a2 2 0 012 2v2m-9 0h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              }
            />
          </div>

          {/* Separate from the period grid above: this is stock on hand right
              now, not affected by the period selector — there's no history
              of past inventory levels to compute it for a prior date. */}
          <div className="max-w-xs">
            <StatCard
              label="Capital in Stock (current)"
              value={money(data.capitalInStock, currency)}
              hint="Cost of unsold inventory on hand, as of now"
              tone="brand"
            />
          </div>

          <Card className="overflow-hidden">
            <CardHeader title={`${GRANULARITY_LABEL[data.breakdownGranularity]} breakdown`} />
            <Table>
              <THead>
                <TH>Period</TH>
                <TH align="right">Sell</TH>
                <TH align="right">Revenue</TH>
                <TH align="right">Capital</TH>
                <TH align="right">Profit</TH>
              </THead>
              <TBody>
                {data.breakdown.map((row) => (
                  <TR key={row.periodStart}>
                    <TD className="font-medium text-gray-800">{formatPeriod(row.periodStart, data.breakdownGranularity)}</TD>
                    <TD align="right" className="text-gray-500">{row.saleCount}</TD>
                    <TD align="right" className="text-gray-700">{money(row.netSales, currency)}</TD>
                    <TD align="right" className="text-gray-700">{money(row.totalCost, currency)}</TD>
                    <TD align="right" className="font-medium text-gray-900">{money(row.grossProfit, currency)}</TD>
                  </TR>
                ))}
                {data.breakdown.length === 0 && <TEmpty colSpan={5}>No sales in this period.</TEmpty>}
              </TBody>
            </Table>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
