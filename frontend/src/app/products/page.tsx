"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { api, ApiError } from "@/lib/api";
import { currentRole, useAuth } from "@/lib/auth-context";
import type { Category, Paginated, Product } from "@/lib/types";
import { Badge, Button, Card, CardHeader, Input, Select, Table, TBody, TD, TEmpty, TH, THead, TR } from "@/components/ui";

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
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    setDeletingId(id);
    try {
      await api.delete(`/api/teams/${teamId}/products/${id}`);
      await loadAll();
    } finally {
      setDeletingId(null);
    }
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
        <Card className="overflow-hidden lg:col-span-2">
          <Table>
            <THead>
              <TH>Name</TH>
              <TH>SKU</TH>
              <TH>Barcode</TH>
              <TH>Category</TH>
              <TH>Price</TH>
              {canManage && <TH />}
            </THead>
            <TBody>
              {products.map((p) => (
                <TR key={p.id}>
                  <TD className="font-medium text-gray-800">{p.name}</TD>
                  <TD className="text-gray-500">{p.sku}</TD>
                  <TD className="text-gray-500">{p.barcode}</TD>
                  <TD>
                    {p.categoryId ? <Badge tone="brand">{categoryName(p.categoryId)}</Badge> : <span className="text-gray-400">—</span>}
                  </TD>
                  <TD className="text-gray-700">${Number(p.price).toFixed(2)}</TD>
                  {canManage && (
                    <TD align="right">
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={deletingId === p.id}
                        className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        onClick={() => void deleteProduct(p.id)}
                      >
                        Delete
                      </Button>
                    </TD>
                  )}
                </TR>
              ))}
              {products.length === 0 && <TEmpty colSpan={6}>No products yet.</TEmpty>}
            </TBody>
          </Table>
        </Card>

        {canManage && (
          <Card className="h-fit">
            <CardHeader title="Add product" />
            <form onSubmit={createProduct} className="space-y-3 p-4">
              <Input label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input label="SKU" required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Barcode (optional)</label>
                <div className="flex gap-2">
                  <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
                  <Button type="button" variant="outline" onClick={() => setScanning(true)} className="shrink-0">
                    Scan
                  </Button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Category</label>
                <div className="flex gap-2">
                  <Select
                    className="flex-1"
                    value={form.categoryId}
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  >
                    <option value="">None</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => {
                      setCategoryError(null);
                      setAddingCategory((v) => !v);
                    }}
                  >
                    {addingCategory ? "Cancel" : "+ New"}
                  </Button>
                </div>
                {addingCategory && (
                  <div className="mt-2 flex gap-2">
                    <Input
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
                    />
                    <Button
                      type="button"
                      className="shrink-0"
                      loading={categorySubmitting}
                      disabled={!newCategoryName.trim()}
                      onClick={() => void addCategory()}
                    >
                      {categorySubmitting ? "Adding…" : "Add"}
                    </Button>
                  </div>
                )}
                {categoryError && <p className="mt-1 text-xs text-rose-600">{categoryError}</p>}
              </div>
              <Input
                label="Price"
                required
                type="number"
                min={0}
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
              <Input
                label="Cost (optional)"
                type="number"
                min={0}
                step="0.01"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
              />
              {error && <p className="text-sm text-rose-600">{error}</p>}
              <Button type="submit" fullWidth loading={submitting}>
                {submitting ? "Adding…" : "Add product"}
              </Button>
            </form>
          </Card>
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
