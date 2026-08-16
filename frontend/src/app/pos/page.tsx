"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Paginated, Product, Sale } from "@/lib/types";

interface CartLine {
  product: Product;
  quantity: number;
}

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

export default function PosPage() {
  const { teamId, storeId, stores } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "MOBILE" | "OTHER">("CASH");
  const [discount, setDiscount] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const store = stores.find((s) => s.id === storeId);
  const currency = store?.currency ?? "USD";
  const taxRate = Number(store?.taxRate ?? 0);

  useEffect(() => {
    if (!teamId) return;
    api
      .get<Paginated<Product>>(`/api/teams/${teamId}/products?limit=200`)
      .then((res) => setProducts(res.items.filter((p) => p.isActive)))
      .catch(() => setProducts([]));
  }, [teamId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode?.toLowerCase() === q,
    );
  }, [products, search]);

  const subtotal = cart.reduce((sum, line) => sum + Number(line.product.price) * line.quantity, 0);
  const discountAmount = Math.min(Number(discount) || 0, subtotal);
  const taxAmount = Math.max(subtotal - discountAmount, 0) * taxRate;
  const total = Math.max(subtotal - discountAmount, 0) + taxAmount;

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  // Shared by the hardware/Bluetooth keyboard-wedge scanner (types into the
  // search box, terminated with Enter/Tab) and the camera scanner modal.
  function scanBarcode(value: string) {
    const q = value.trim().toLowerCase();
    if (!q) return;
    const match = products.find((p) => p.barcode?.toLowerCase() === q);
    if (match) {
      addToCart(match);
      setSearch("");
      setScanMessage({ type: "success", text: `Added ${match.name}` });
    } else {
      setScanMessage({ type: "error", text: `No product matches barcode "${value.trim()}"` });
    }
    searchRef.current?.focus();
  }

  function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    scanBarcode(search);
  }

  function updateQuantity(productId: string, quantity: number) {
    setCart((prev) =>
      quantity <= 0 ? prev.filter((l) => l.product.id !== productId) : prev.map((l) => (l.product.id === productId ? { ...l, quantity } : l)),
    );
  }

  async function checkout() {
    if (!storeId || cart.length === 0) return;
    setError(null);
    setSubmitting(true);
    try {
      const sale = await api.post<Sale>(`/api/stores/${storeId}/sales/checkout`, {
        items: cart.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
        payments: [{ method: paymentMethod, amount: Number(total.toFixed(2)) }],
        discountAmount: Number(discountAmount.toFixed(2)),
      });
      setLastSale(sale);
      setCart([]);
      setDiscount("0");
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Checkout failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h1 className="mb-4 text-2xl font-semibold text-gray-900">Checkout</h1>
          <form onSubmit={handleBarcodeSubmit} className="mb-1.5 flex gap-2">
            <input
              ref={searchRef}
              autoFocus
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setScanMessage(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Tab" && search.trim()) {
                  e.preventDefault();
                  scanBarcode(search);
                }
              }}
              placeholder="Search by name, SKU, or scan a barcode…"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <button
              type="button"
              onClick={() => setScanning(true)}
              className="shrink-0 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Scan
            </button>
          </form>
          <p className={`mb-4 min-h-[1rem] text-xs ${scanMessage?.type === "success" ? "text-green-600" : "text-red-600"}`}>
            {scanMessage?.text ?? ""}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {filtered.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className="rounded-lg border border-gray-200 bg-white p-3 text-left hover:border-brand-400 hover:shadow-sm"
              >
                <p className="truncate text-sm font-medium text-gray-900">{product.name}</p>
                <p className="text-xs text-gray-500">{product.sku}</p>
                <p className="mt-1 text-sm font-semibold text-brand-700">{money(Number(product.price), currency)}</p>
              </button>
            ))}
            {filtered.length === 0 && <p className="col-span-full text-sm text-gray-500">No products found.</p>}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Cart</h2>
          {cart.length === 0 ? (
            <p className="text-sm text-gray-500">Cart is empty.</p>
          ) : (
            <ul className="mb-4 space-y-2">
              {cart.map((line) => (
                <li key={line.product.id} className="flex items-center justify-between text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-800">{line.product.name}</p>
                    <p className="text-xs text-gray-500">{money(Number(line.product.price), currency)} each</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={line.quantity}
                      onChange={(e) => updateQuantity(line.product.id, Number(e.target.value))}
                      className="w-14 rounded-md border border-gray-300 px-2 py-1 text-right text-sm"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-1 border-t border-gray-100 pt-3 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{money(subtotal, currency)}</span>
            </div>
            <div className="flex items-center justify-between text-gray-600">
              <span>Discount</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-20 rounded-md border border-gray-300 px-2 py-1 text-right text-sm"
              />
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Tax ({(taxRate * 100).toFixed(2)}%)</span>
              <span>{money(taxAmount, currency)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-semibold text-gray-900">
              <span>Total</span>
              <span>{money(total, currency)}</span>
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-gray-500">Payment method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
              className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
            >
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="MOBILE">Mobile</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          <button
            onClick={() => void checkout()}
            disabled={submitting || cart.length === 0 || !storeId}
            className="mt-4 w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? "Processing…" : `Complete sale — ${money(total, currency)}`}
          </button>

          {lastSale && (
            <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              Sale {lastSale.saleNumber} completed — {money(Number(lastSale.total), currency)}.
            </div>
          )}
        </div>
      </div>

      {scanning && (
        <BarcodeScanner
          onDetected={(value) => {
            setScanning(false);
            scanBarcode(value);
          }}
          onClose={() => setScanning(false)}
        />
      )}
    </AppShell>
  );
}
