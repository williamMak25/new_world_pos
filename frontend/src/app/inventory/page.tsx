"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, ApiError } from "@/lib/api";
import { currentRole, useAuth } from "@/lib/auth-context";
import type { InventoryRecord, Paginated, Product } from "@/lib/types";

export default function InventoryPage() {
  const { teamId, storeId, user } = useAuth();
  const role = currentRole(user, teamId);
  const canManage = role === "ADMIN" || role === "MANAGER";

  const [records, setRecords] = useState<InventoryRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [initialQty, setInitialQty] = useState("0");

  async function load() {
    if (!storeId || !teamId) return;
    const [inv, prod] = await Promise.all([
      api.get<Paginated<InventoryRecord>>(`/api/stores/${storeId}/inventory?limit=200`),
      api.get<Paginated<Product>>(`/api/teams/${teamId}/products?limit=200`),
    ]);
    setRecords(inv.items);
    setProducts(prod.items);
  }

  useEffect(() => {
    void load();
  }, [storeId, teamId]);

  async function adjust(productId: string, delta: number) {
    if (!storeId) return;
    setError(null);
    try {
      await api.put(`/api/stores/${storeId}/inventory/${productId}/adjust`, { delta });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Unable to adjust stock.");
    }
  }

  async function setInitial(e: React.FormEvent) {
    e.preventDefault();
    if (!storeId || !selectedProduct) return;
    setError(null);
    try {
      await api.put(`/api/stores/${storeId}/inventory/${selectedProduct}`, { quantity: Number(initialQty) });
      setSelectedProduct("");
      setInitialQty("0");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Unable to set stock.");
    }
  }

  const trackedProductIds = new Set(records.map((r) => r.productId));
  const untracked = products.filter((p) => p.trackInventory && !trackedProductIds.has(p.id));

  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Inventory</h1>
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
            {records.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2 font-medium text-gray-800">{r.productName}</td>
                <td className="px-4 py-2 text-gray-500">{r.sku}</td>
                <td className={`px-4 py-2 font-medium ${r.quantity <= r.lowStockThreshold ? "text-amber-600" : "text-gray-700"}`}>
                  {r.quantity}
                </td>
                <td className="px-4 py-2 text-gray-500">{r.lowStockThreshold}</td>
                {canManage && (
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => void adjust(r.productId, 1)} className="mr-2 rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-50">
                      +1
                    </button>
                    <button onClick={() => void adjust(r.productId, -1)} className="rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-50">
                      -1
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                  No stock tracked yet for this store.
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
    </AppShell>
  );
}
