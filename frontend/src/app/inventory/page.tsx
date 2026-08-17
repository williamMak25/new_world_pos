"use client";

import { Fragment, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { api, ApiError } from "@/lib/api";
import { currentRole, useAuth } from "@/lib/auth-context";
import type { InventoryAdjustmentRecord, InventoryRecord, Paginated, Product } from "@/lib/types";
import { Button, Card, CardHeader, Input, SearchInput, Select, Table, TBody, TD, TEmpty, TH, THead, TR } from "@/components/ui";

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
        <SearchInput
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setScanMessage(null);
          }}
          onClear={() => setSearch("")}
          placeholder="Search product or SKU…"
          className="w-56"
        />
        <Button type="button" variant="outline" size="sm" onClick={() => setScanning(true)}>
          Scan
        </Button>
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
          Low stock only
        </label>
      </div>
      {scanMessage && <p className="mb-3 text-sm text-red-600">{scanMessage}</p>}
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <TH>Product</TH>
            <TH>SKU</TH>
            <TH>On hand</TH>
            <TH>Low stock at</TH>
            {canManage && <TH />}
          </THead>
          <TBody>
            {filtered.map((r) => (
              <Fragment key={r.id}>
                <TR>
                  <TD className="font-medium text-gray-800">{r.productName}</TD>
                  <TD className="text-gray-500">{r.sku}</TD>
                  <TD className={`font-medium ${r.quantity <= r.lowStockThreshold ? "text-amber-600" : "text-gray-700"}`}>
                    {r.quantity}
                  </TD>
                  <TD className="text-gray-500">
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
                        className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                      />
                    ) : (
                      r.lowStockThreshold
                    )}
                  </TD>
                  {canManage && (
                    <TD align="right" className="whitespace-nowrap">
                      <Button variant="outline" size="sm" className="mr-2 px-2 py-0.5" onClick={() => void adjust(r.productId, 1)}>
                        +1
                      </Button>
                      <Button variant="outline" size="sm" className="mr-2 px-2 py-0.5" onClick={() => void adjust(r.productId, -1)}>
                        -1
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="px-2 py-0.5"
                        onClick={() => {
                          setAdjustingProductId(adjustingProductId === r.productId ? null : r.productId);
                          setAdjustDelta("0");
                        }}
                      >
                        Adjust…
                      </Button>
                    </TD>
                  )}
                </TR>
                {adjustingProductId === r.productId && (
                  <tr key={`${r.id}-adjust`} className="bg-brand-50/40">
                    <td colSpan={5} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          value={adjustDelta}
                          onChange={(e) => setAdjustDelta(e.target.value)}
                          placeholder="+/- amount"
                          className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                        />
                        <Select value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} className="w-auto min-w-[9rem]">
                          {REASONS.map((reason) => (
                            <option key={reason} value={reason}>
                              {reason}
                            </option>
                          ))}
                        </Select>
                        <Button size="sm" onClick={() => void applyCustomAdjust(r.productId)}>
                          Apply
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setAdjustingProductId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {filtered.length === 0 && (
              <TEmpty colSpan={5}>
                {records.length === 0 ? "No stock tracked yet for this store." : "No products match your filters."}
              </TEmpty>
            )}
          </TBody>
        </Table>
      </Card>

      {canManage && untracked.length > 0 && (
        <Card className="mt-6 max-w-sm p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Start tracking a product</h2>
          <form onSubmit={setInitial} className="space-y-3">
            <Select required value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}>
              <option value="">Select a product…</option>
              {untracked.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              min={0}
              value={initialQty}
              onChange={(e) => setInitialQty(e.target.value)}
              placeholder="Starting quantity"
            />
            <Button type="submit" fullWidth>
              Set stock
            </Button>
          </form>
        </Card>
      )}

      {canManage && (
        <Card className="mt-6 overflow-hidden">
          <CardHeader title="Recent stock adjustments" />
          <Table>
            <THead>
              <TH>Product</TH>
              <TH align="right">Δ</TH>
              <TH align="right">Qty after</TH>
              <TH>Reason</TH>
              <TH>By</TH>
              <TH>When</TH>
            </THead>
            <TBody>
              {adjustments.map((a) => (
                <TR key={a.id}>
                  <TD className="font-medium text-gray-800">{a.productName}</TD>
                  <TD align="right" className={a.delta > 0 ? "text-emerald-600" : "text-rose-600"}>
                    {a.delta > 0 ? `+${a.delta}` : a.delta}
                  </TD>
                  <TD align="right" className="text-gray-500">{a.quantityAfter}</TD>
                  <TD className="text-gray-500">{a.reason}</TD>
                  <TD className="text-gray-500">{a.userLabel ?? "—"}</TD>
                  <TD className="text-gray-500">{new Date(a.createdAt).toLocaleString()}</TD>
                </TR>
              ))}
              {adjustments.length === 0 && <TEmpty colSpan={6}>No adjustments recorded yet.</TEmpty>}
            </TBody>
          </Table>
        </Card>
      )}

      {scanning && <BarcodeScanner onDetected={onBarcodeDetected} onClose={() => setScanning(false)} />}
    </AppShell>
  );
}
