"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { StoreDashboard } from "@/lib/types";

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
            <StatCard label="Today's sales" value={money(data.todaySales, currency)} />
            <StatCard label="Today's transactions" value={String(data.todaySaleCount)} />
            <StatCard label="This week" value={money(data.weekSales, currency)} />
            <StatCard label="Low stock items" value={String(data.lowStockCount)} tone={data.lowStockCount > 0 ? "warn" : "default"} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">Top products (30 days)</h2>
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

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">Low stock</h2>
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
          </div>
        </div>
      )}
    </AppShell>
  );
}

function StatCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warn" }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone === "warn" ? "text-amber-600" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}
