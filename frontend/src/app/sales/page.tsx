"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, ApiError } from "@/lib/api";
import { currentRole, useAuth } from "@/lib/auth-context";
import type { Paginated, Sale } from "@/lib/types";
import { Badge, Button, Card, CardHeader, SearchInput, Select, Table, TBody, TD, TEmpty, TH, THead, TR } from "@/components/ui";

function money(value: string, currency = "USD") {
  const n = Number(value);
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number.isFinite(n) ? n : 0);
}

const STATUS_TONE: Record<Sale["status"], "success" | "warning" | "default"> = {
  COMPLETED: "success",
  REFUNDED: "warning",
  VOIDED: "default",
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
        <Select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="w-auto min-w-[8.5rem]">
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto min-w-[9rem]">
          <option value="">All statuses</option>
          <option value="COMPLETED">Completed</option>
          <option value="VOIDED">Voided</option>
          <option value="REFUNDED">Refunded</option>
        </Select>
        <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-auto min-w-[10rem]">
          <option value="">All payment methods</option>
          <option value="CASH">Cash</option>
          <option value="CARD">Card</option>
          <option value="MOBILE">Mobile</option>
          <option value="OTHER">Other</option>
        </Select>
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch("")}
          placeholder="Search sale #…"
          className="w-48"
        />
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <Table>
            <THead>
              <TH>Sale #</TH>
              <TH>Date</TH>
              <TH>Total</TH>
              <TH>Status</TH>
            </THead>
            <TBody>
              {sales.map((s) => (
                <TR key={s.id} onClick={() => setSelected(s)}>
                  <TD className="font-medium text-gray-800">{s.saleNumber}</TD>
                  <TD className="text-gray-500">{new Date(s.createdAt).toLocaleString()}</TD>
                  <TD className="text-gray-700">{money(s.total, currency)}</TD>
                  <TD>
                    <Badge tone={STATUS_TONE[s.status]}>{s.status}</Badge>
                  </TD>
                </TR>
              ))}
              {sales.length === 0 && <TEmpty colSpan={4}>No sales yet.</TEmpty>}
            </TBody>
          </Table>
        </Card>

        <Card className="h-fit p-4">
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
              <div className="flex gap-2 pt-2">
                <a
                  href={`/receipt/${selected.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-center text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Print
                </a>
                {canManage && selected.status === "COMPLETED" && (
                  <>
                    <Button variant="outline" size="sm" fullWidth onClick={() => void voidSale(selected.id)}>
                      Void
                    </Button>
                    <Button variant="danger" size="sm" fullWidth onClick={() => void refundSale(selected.id)}>
                      Refund
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
