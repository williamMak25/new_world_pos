"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { api, ApiError } from "@/lib/api";
import { currentRole, useAuth } from "@/lib/auth-context";
import type { Category, Paginated, Product } from "@/lib/types";

const emptyForm = { sku: "", name: "", price: "", cost: "0", categoryId: "", barcode: "", description: "" };

export default function ProductsPage() {
  const { teamId, user } = useAuth();
  const role = currentRole(user, teamId);
  const canManage = role === "ADMIN" || role === "MANAGER";

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categorySubmitting, setCategorySubmitting] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  async function loadAll() {
    if (!teamId) return;
    const [productsRes, categoriesRes] = await Promise.all([
      api.get<Paginated<Product>>(`/api/teams/${teamId}/products?limit=200`),
      api.get<Paginated<Category>>(`/api/teams/${teamId}/categories?limit=200`),
    ]);
    setProducts(productsRes.items);
    setCategories(categoriesRes.items);
  }

  useEffect(() => {
    void loadAll();
  }, [teamId]);

  async function createProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!teamId) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/api/teams/${teamId}/products`, {
        sku: form.sku,
        name: form.name,
        price: Number(form.price),
        cost: Number(form.cost || 0),
        categoryId: form.categoryId || undefined,
        barcode: form.barcode || undefined,
        description: form.description || undefined,
      });
      setForm(emptyForm);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Unable to create product.");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteProduct(id: string) {
    if (!teamId || !confirm("Delete this product?")) return;
    await api.delete(`/api/teams/${teamId}/products/${id}`);
    await loadAll();
  }

  async function addCategory() {
    if (!teamId || !newCategoryName.trim()) return;
    setCategoryError(null);
    setCategorySubmitting(true);
    try {
      const category = await api.post<Category>(`/api/teams/${teamId}/categories`, {
        name: newCategoryName.trim(),
      });
      setCategories((prev) => [...prev, category]);
      setForm((f) => ({ ...f, categoryId: category.id }));
      setNewCategoryName("");
      setAddingCategory(false);
    } catch (err) {
      setCategoryError(err instanceof ApiError ? err.detail : "Unable to create category.");
    } finally {
      setCategorySubmitting(false);
    }
  }

  function categoryName(id: string | null) {
    return categories.find((c) => c.id === id)?.name ?? "—";
  }

  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Products</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">SKU</th>
                <th className="px-4 py-2">Barcode</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Price</th>
                {canManage && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 font-medium text-gray-800">
                    {p.name}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{p.sku}</td>
                  <td className="px-4 py-2 text-gray-500">{p.barcode}</td>
                  <td className="px-4 py-2 text-gray-500">
                    {categoryName(p.categoryId)}
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    ${Number(p.price).toFixed(2)}
                  </td>
                  {canManage && (
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => void deleteProduct(p.id)}
                        className="text-xs font-medium text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-sm text-gray-500"
                  >
                    No products yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {canManage && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">
              Add product
            </h2>
            <form onSubmit={createProduct} className="space-y-3">
              <Field label="Name">
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="SKU">
                <input
                  required
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Barcode (optional)">
                <div className="flex gap-2">
                  <input
                    value={form.barcode}
                    onChange={(e) =>
                      setForm({ ...form, barcode: e.target.value })
                    }
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setScanning(true)}
                    className="shrink-0 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Scan
                  </button>
                </div>
              </Field>
              <Field label="Category">
                <div className="flex gap-2">
                  <select
                    value={form.categoryId}
                    onChange={(e) =>
                      setForm({ ...form, categoryId: e.target.value })
                    }
                    className={inputClass}
                  >
                    <option value="">None</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryError(null);
                      setAddingCategory((v) => !v);
                    }}
                    className="shrink-0 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {addingCategory ? "Cancel" : "+ New"}
                  </button>
                </div>
                {addingCategory && (
                  <div className="mt-2 flex gap-2">
                    <input
                      autoFocus
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void addCategory();
                        }
                      }}
                      placeholder="New category name"
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => void addCategory()}
                      disabled={categorySubmitting || !newCategoryName.trim()}
                      className="shrink-0 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                    >
                      {categorySubmitting ? "Adding…" : "Add"}
                    </button>
                  </div>
                )}
                {categoryError && <p className="mt-1 text-xs text-red-600">{categoryError}</p>}
              </Field>
              <Field label="Price">
                <input
                  required
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Cost (optional)">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: e.target.value })}
                  className={inputClass}
                />
              </Field>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {submitting ? "Adding…" : "Add product"}
              </button>
            </form>
          </div>
        )}
      </div>

      {scanning && (
        <BarcodeScanner
          onDetected={(value) => {
            setForm((f) => ({ ...f, barcode: value }));
            setScanning(false);
          }}
          onClose={() => setScanning(false)}
        />
      )}
    </AppShell>
  );
}

const inputClass = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
      {children}
    </div>
  );
}
