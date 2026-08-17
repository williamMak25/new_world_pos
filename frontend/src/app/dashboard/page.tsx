"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { StoreDashboard } from "@/lib/types";
import { Card, CardHeader, StatCard } from "@/components/ui";

function money(value: string, currency = "USD") {
  const n = Number(value);
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number.isFinite(n) ? n : 0);
}

export default function DashboardPage() {
  const { storeId, stores } = useAuth();
  const [data, setData] = useState<StoreDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    setError(null);
    api
      .get<StoreDashboard>(`/api/stores/${storeId}/reports/dashboard`)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.detail : "Unable to load dashboard."))
      .finally(() => setLoading(false));
  }, [storeId]);

  const store = stores.find((s) => s.id === storeId);
  const currency = store?.currency ?? "USD";

  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Dashboard</h1>

      {!storeId && <p className="text-sm text-gray-500">Select a store to see its dashboard.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-gray-500">Loading…</p>}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Today's sales"
              value={money(data.todaySales, currency)}
              tone="brand"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 12v-2m0-10a9 9 0 100 18 9 9 0 000-18z" />
                </svg>
              }
            />
            <StatCard
              label="Today's transactions"
              value={String(data.todaySaleCount)}
              tone="purple"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              }
            />
            <StatCard
              label="This week"
              value={money(data.weekSales, currency)}
              tone="success"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
            />
            <StatCard
              label="Low stock items"
              value={String(data.lowStockCount)}
              tone={data.lowStockCount > 0 ? "warning" : "success"}
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Top products" subtitle="Last 30 days" />
              <div className="p-4">
                {data.topProducts.length === 0 ? (
                  <p className="text-sm text-gray-500">No sales yet.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {data.topProducts.map((p) => (
                      <li key={p.productId ?? p.productName} className="flex items-center justify-between py-2 text-sm">
                        <span className="text-gray-700">{p.productName}</span>
                        <span className="text-gray-500">
                          {p.quantitySold} sold · {money(p.revenue, currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Low stock" />
              <div className="p-4">
                {data.lowStockItems.length === 0 ? (
                  <p className="text-sm text-gray-500">Everything is well stocked.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {data.lowStockItems.map((item) => (
                      <li key={item.productId} className="flex items-center justify-between py-2 text-sm">
                        <span className="text-gray-700">{item.productName}</span>
                        <span className="font-medium text-amber-600">
                          {item.quantity} left (threshold {item.lowStockThreshold})
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}
