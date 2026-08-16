"use client";

import { Fragment, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { api, ApiError } from "@/lib/api";
import { currentRole, useAuth } from "@/lib/auth-context";
import type { InventoryAdjustmentRecord, InventoryRecord, Paginated, Product } from "@/lib/types";

const REASONS = ["Restock", "Damage/Loss", "Correction", "Other"];

export default function InventoryPage() {
  const { teamId, storeId, user } = useAuth();
  const role = currentRole(user, teamId);
  const canManage = role === "ADMIN" || role === "MANAGER";

  const [records, setRecords] = useState<InventoryRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [adjustments, setAdjustments] = useState<InventoryAdjustmentRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [initialQty, setInitialQty] = useState("0");

  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const [adjustingProductId, setAdjustingProductId] = useState<string | null>(null);
  const [adjustDelta, setAdjustDelta] = useState("0");
  const [adjustReason, setAdjustReason] = useState(REASONS[0]);

  async function load() {
    if (!storeId || !teamId) return;
    const [inv, prod, adj] = await Promise.all([
      api.get<Paginated<InventoryRecord>>(`/api/stores/${storeId}/inventory?limit=200`),
      api.get<Paginated<Product>>(`/api/teams/${teamId}/products?limit=200`),
      api.get<InventoryAdjustmentRecord[]>(`/api/stores/${storeId}/inventory/adjustments?limit=50`).catch(() => []),
    ]);
    setRecords(inv.items);
    setProducts(prod.items);
    setAdjustments(adj);
  }

  useEffect(() => {
    void load();
  }, [storeId, teamId]);

  async function adjust(productId: string, delta: number, reason?: string) {
    if (!storeId) return;
    setError(null);
    try {
      await api.put(`/api/stores/${storeId}/inventory/${productId}/adjust`, { delta, reason });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Unable to adjust stock.");
    }
  }

  async function applyCustomAdjust(productId: string) {
    const delta = Number(adjustDelta);
    if (!delta) return;
    await adjust(productId, delta, adjustReason);
    setAdjustingProductId(null);
    setAdjustDelta("0");
  }

  async function updateThreshold(productId: string, quantity: number, lowStockThreshold: number) {
    if (!storeId) return;
    setError(null);
    try {
      await api.put(`/api/stores/${storeId}/inventory/${productId}`, { quantity, lowStockThreshold });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Unable to update threshold.");
    }
  }

  async function setInitial(e: React.FormEvent) {
    e.preventDefault();
    if (!storeId || !selectedProduct) return;
    setError(null);
    try {
      await api.put(`/api/stores/${storeId}/inventory/${selectedProduct}`, {
        quantity: Number(initialQty),
        reason: "Initial stock",
      });
      setSelectedProduct("");
      setInitialQty("0");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Unable to set stock.");
    }
  }

  function onBarcodeDetected(value: string) {
    setScanning(false);
    const match = products.find((p) => p.barcode?.toLowerCase() === value.trim().toLowerCase());
    if (match) {
      setSearch(match.sku);
      setScanMessage(null);
    } else {
      setScanMessage(`No product matches barcode "${value.trim()}"`);
    }
  }

  const trackedProductIds = new Set(records.map((r) => r.productId));
  const untracked = products.filter((p) => p.trackInventory && !trackedProductIds.has(p.id));

  const q = search.trim().toLowerCase();
  const filtered = records
    .filter((r) => !q || (r.productName ?? "").toLowerCase().includes(q) || (r.sku ?? "").toLowerCase().includes(q))
    .filter((r) => !lowStockOnly || r.quantity <= r.lowStockThreshold);

  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Inventory</h1>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setScanMessage(null);
          }}
          placeholder="Search product or SKU…"
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="button"
          onClick={() => setScanning(true)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Scan
        </button>
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
          Low stock only
        </label>
      </div>
      {scanMessage && <p className="mb-3 text-sm text-red-600">{scanMessage}</p>}
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Product</th>
              <th className="px-4 py-2">SKU</th>
              <th className="px-4 py-2">On hand</th>
              <th className="px-4 py-2">Low stock at</th>
              {canManage && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((r) => (
              <Fragment key={r.id}>
                <tr>
                  <td className="px-4 py-2 font-medium text-gray-800">{r.productName}</td>
                  <td className="px-4 py-2 text-gray-500">{r.sku}</td>
                  <td className={`px-4 py-2 font-medium ${r.quantity <= r.lowStockThreshold ? "text-amber-600" : "text-gray-700"}`}>
                    {r.quantity}
                  </td>
                  <td className="px-4 py-2 text-gray-500">
                    {canManage ? (
                      <input
                        key={`${r.id}-${r.lowStockThreshold}`}
                        type="number"
                        min={0}
                        defaultValue={r.lowStockThreshold}
                        onBlur={(e) => {
                          const next = Number(e.target.value);
                          if (next !== r.lowStockThreshold) void updateThreshold(r.productId, r.quantity, next);
                        }}
                        className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm"
                      />
                    ) : (
                      r.lowStockThreshold
                    )}
                  </td>
                  {canManage && (
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button onClick={() => void adjust(r.productId, 1)} className="mr-2 rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-50">
                        +1
                      </button>
                      <button onClick={() => void adjust(r.productId, -1)} className="mr-2 rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-50">
                        -1
                      </button>
                      <button
                        onClick={() => {
                          setAdjustingProductId(adjustingProductId === r.productId ? null : r.productId);
                          setAdjustDelta("0");
                        }}
                        className="rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-50"
                      >
                        Adjust…
                      </button>
                    </td>
                  )}
                </tr>
                {adjustingProductId === r.productId && (
                  <tr key={`${r.id}-adjust`} className="bg-gray-50">
                    <td colSpan={5} className="px-4 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          value={adjustDelta}
                          onChange={(e) => setAdjustDelta(e.target.value)}
                          placeholder="+/- amount"
                          className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm"
                        />
                        <select
                          value={adjustReason}
                          onChange={(e) => setAdjustReason(e.target.value)}
                          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                        >
                          {REASONS.map((reason) => (
                            <option key={reason} value={reason}>
                              {reason}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => void applyCustomAdjust(r.productId)}
                          className="rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700"
                        >
                          Apply
                        </button>
                        <button onClick={() => setAdjustingProductId(null)} className="text-xs text-gray-500 hover:text-gray-700">
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                  {records.length === 0 ? "No stock tracked yet for this store." : "No products match your filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canManage && untracked.length > 0 && (
        <div className="mt-6 max-w-sm rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Start tracking a product</h2>
          <form onSubmit={setInitial} className="space-y-3">
            <select
              required
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Select a product…</option>
              {untracked.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              value={initialQty}
              onChange={(e) => setInitialQty(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Starting quantity"
            />
            <button type="submit" className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
              Set stock
            </button>
          </form>
        </div>
      )}

      {canManage && (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
          <h2 className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900">Recent stock adjustments</h2>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Product</th>
                <th className="px-4 py-2 text-right">Δ</th>
                <th className="px-4 py-2 text-right">Qty after</th>
                <th className="px-4 py-2">Reason</th>
                <th className="px-4 py-2">By</th>
                <th className="px-4 py-2">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {adjustments.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-2 font-medium text-gray-800">{a.productName}</td>
                  <td className={`px-4 py-2 text-right ${a.delta > 0 ? "text-green-600" : "text-red-600"}`}>
                    {a.delta > 0 ? `+${a.delta}` : a.delta}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-500">{a.quantityAfter}</td>
                  <td className="px-4 py-2 text-gray-500">{a.reason}</td>
                  <td className="px-4 py-2 text-gray-500">{a.userLabel ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-500">{new Date(a.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {adjustments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">
                    No adjustments recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {scanning && <BarcodeScanner onDetected={onBarcodeDetected} onClose={() => setScanning(false)} />}
    </AppShell>
  );
}
