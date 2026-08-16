"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, ApiError } from "@/lib/api";
import { currentRole, useAuth } from "@/lib/auth-context";

const emptyForm = { name: "", address: "", phone: "", taxRate: "0" };

export default function StoresPage() {
  const { teamId, stores, refreshStores, user } = useAuth();
  const role = currentRole(user, teamId);
  const canCreate = role === "ADMIN";

  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function createStore(e: React.FormEvent) {
    e.preventDefault();
    if (!teamId) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/api/teams/${teamId}/stores`, {
        name: form.name,
        address: form.address || undefined,
        phone: form.phone || undefined,
        taxRate: Number(form.taxRate) / 100,
      });
      setForm(emptyForm);
      await refreshStores();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Unable to create store.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Stores</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          {stores.map((s) => (
            <div key={s.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="font-medium text-gray-900">{s.name}</p>
              <p className="text-sm text-gray-500">{s.address || "No address on file"}</p>
              <p className="mt-1 text-xs text-gray-400">
                Currency {s.currency} · Tax rate {(Number(s.taxRate) * 100).toFixed(2)}%
              </p>
            </div>
          ))}
          {stores.length === 0 && <p className="text-sm text-gray-500">No stores yet.</p>}
        </div>

        {canCreate && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Add store</h2>
            <form onSubmit={createStore} className="space-y-3">
              <input
                required
                placeholder="Store name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Address (optional)"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Phone (optional)"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Sales tax rate (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={form.taxRate}
                  onChange={(e) => setForm({ ...form, taxRate: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {submitting ? "Adding…" : "Add store"}
              </button>
            </form>
          </div>
        )}
      </div>
    </AppShell>
  );
}
