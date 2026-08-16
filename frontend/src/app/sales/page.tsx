"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, ApiError } from "@/lib/api";
import { currentRole, useAuth } from "@/lib/auth-context";
import type { Paginated, Sale } from "@/lib/types";

function money(value: string, currency = "USD") {
  const n = Number(value);
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number.isFinite(n) ? n : 0);
}

const STATUS_STYLES: Record<Sale["status"], string> = {
  COMPLETED: "bg-green-100 text-green-700",
  REFUNDED: "bg-amber-100 text-amber-700",
  VOIDED: "bg-gray-200 text-gray-600",
};

type Period = "all" | "today" | "week" | "month";

// Calendar-aligned start of the period, in local time — "This week" starts
// Monday, "This month" starts on the 1st. `null` means no date filter.
function periodStart(period: Period): Date | null {
  const now = new Date();
  if (period === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (period === "week") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const mondayOffset = (start.getDay() + 6) % 7; // Sun=0..Sat=6 -> days since Monday
    start.setDate(start.getDate() - mondayOffset);
    return start;
  }
  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return null;
}

export default function SalesPage() {
  const { teamId, storeId, stores, user } = useAuth();
  const role = currentRole(user, teamId);
  const canManage = role === "ADMIN" || role === "MANAGER";
  const currency = stores.find((s) => s.id === storeId)?.currency ?? "USD";

  const [sales, setSales] = useState<Sale[]>([]);
  const [selected, setSelected] = useState<Sale | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("all");
  const [status, setStatus] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    if (!storeId) return;
    const params = new URLSearchParams({ pageSize: "100" });
    const start = periodStart(period);
    if (start) params.set("createdAfter", start.toISOString());
    if (status) params.set("status", status);
    if (paymentMethod) params.set("paymentMethod", paymentMethod);
    if (search.trim()) params.set("searchString", search.trim());
    try {
      const res = await api.get<Paginated<Sale>>(`/api/stores/${storeId}/sales?${params.toString()}`);
      setSales(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Unable to load sales.");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, period, status, paymentMethod]);

  // Search is debounced separately so it doesn't refetch on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => void load(), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function voidSale(id: string) {
    if (!storeId || !confirm("Void this sale? Stock will be restored.")) return;
    setError(null);
    try {
      await api.post(`/api/stores/${storeId}/sales/${id}/void`);
      setSelected(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Unable to void sale.");
    }
  }

  async function refundSale(id: string) {
    if (!storeId || !confirm("Refund this sale? Stock will be restored.")) return;
    setError(null);
    try {
      await api.post(`/api/stores/${storeId}/sales/${id}/refund`);
      setSelected(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Unable to refund sale.");
    }
  }

  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Sales</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1 text-sm">
          <option value="">All statuses</option>
          <option value="COMPLETED">Completed</option>
          <option value="VOIDED">Voided</option>
          <option value="REFUNDED">Refunded</option>
        </select>
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">All payment methods</option>
          <option value="CASH">Cash</option>
          <option value="CARD">Card</option>
          <option value="MOBILE">Mobile</option>
          <option value="OTHER">Other</option>
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search sale #…"
          className="rounded-md border border-gray-300 px-3 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Sale #</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Total</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sales.map((s) => (
                <tr key={s.id} onClick={() => setSelected(s)} className="cursor-pointer hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-800">{s.saleNumber}</td>
                  <td className="px-4 py-2 text-gray-500">{new Date(s.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2 text-gray-700">{money(s.total, currency)}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[s.status]}`}>{s.status}</span>
                  </td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">
                    No sales yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Receipt</h2>
          {!selected ? (
            <p className="text-sm text-gray-500">Select a sale to view its receipt.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="font-medium text-gray-800">{selected.saleNumber}</p>
              <p className="text-xs text-gray-500">{new Date(selected.createdAt).toLocaleString()}</p>
              <ul className="divide-y divide-gray-100 border-y border-gray-100">
                {selected.items.map((item) => (
                  <li key={item.id} className="flex justify-between py-1.5">
                    <span>
                      {item.quantity} × {item.productName}
                    </span>
                    <span>{money(item.lineTotal, currency)}</span>
                  </li>
                ))}
              </ul>
              <div className="space-y-1">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{money(selected.subtotal, currency)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Discount</span>
                  <span>-{money(selected.discountAmount, currency)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Tax</span>
                  <span>{money(selected.taxAmount, currency)}</span>
                </div>
                <div className="flex justify-between font-semibold text-gray-900">
                  <span>Total</span>
                  <span>{money(selected.total, currency)}</span>
                </div>
              </div>
              {canManage && selected.status === "COMPLETED" && (
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => void voidSale(selected.id)}
                    className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Void
                  </button>
                  <button
                    onClick={() => void refundSale(selected.id)}
                    className="flex-1 rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Refund
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
