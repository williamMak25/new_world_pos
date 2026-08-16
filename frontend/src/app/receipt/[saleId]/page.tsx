"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Sale } from "@/lib/types";

function money(value: string, currency = "USD") {
  const n = Number(value);
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number.isFinite(n) ? n : 0);
}

// Deliberately not wrapped in <AppShell>: nothing here should print except
// the receipt itself, so there's no sidebar/nav to hide with print CSS.
export default function ReceiptPage() {
  const { saleId } = useParams<{ saleId: string }>();
  const { storeId, stores } = useAuth();
  const [sale, setSale] = useState<Sale | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!storeId || !saleId) return;
    api
      .get<Sale>(`/api/stores/${storeId}/sales/${saleId}`)
      .then(setSale)
      .catch((err) => setError(err instanceof ApiError ? err.detail : "Unable to load receipt."));
  }, [storeId, saleId]);

  const store = stores.find((s) => s.id === storeId);
  const currency = store?.currency ?? "USD";

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-gray-500">Loading receipt…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm p-6 print:max-w-none print:p-0">
      <div className="mb-4 flex justify-end print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Print
        </button>
      </div>

      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-6 text-sm print:border-0 print:p-0">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900">{store?.name ?? "Receipt"}</p>
          <p className="text-xs text-gray-500">{sale.saleNumber}</p>
          <p className="text-xs text-gray-500">{new Date(sale.createdAt).toLocaleString()}</p>
        </div>

        <ul className="divide-y divide-gray-100 border-y border-gray-100 py-2">
          {sale.items.map((item) => (
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
            <span>{money(sale.subtotal, currency)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Discount</span>
            <span>-{money(sale.discountAmount, currency)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Tax</span>
            <span>{money(sale.taxAmount, currency)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-100 pt-1 font-semibold text-gray-900">
            <span>Total</span>
            <span>{money(sale.total, currency)}</span>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-2 text-xs text-gray-500">
          {sale.payments.map((p) => (
            <div key={p.id} className="flex justify-between">
              <span>{p.method}</span>
              <span>{money(p.amount, currency)}</span>
            </div>
          ))}
        </div>

        <p className="pt-2 text-center text-xs text-gray-400">Thank you!</p>
      </div>
    </div>
  );
}
