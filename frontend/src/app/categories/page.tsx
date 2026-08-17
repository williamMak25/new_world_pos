"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, ApiError } from "@/lib/api";
import { currentRole, useAuth } from "@/lib/auth-context";
import type { Category, Paginated } from "@/lib/types";
import { Badge, Button, Card, CardHeader, Input } from "@/components/ui";

const emptyForm = { name: "", description: "" };

export default function CategoriesPage() {
  const { teamId, user } = useAuth();
  const role = currentRole(user, teamId);
  const canManage = role === "ADMIN" || role === "MANAGER";

  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadCategories() {
    if (!teamId) return;
    const res = await api.get<Paginated<Category>>(`/api/teams/${teamId}/categories?limit=200`);
    setCategories(res.items);
  }

  useEffect(() => {
    void loadCategories();
  }, [teamId]);

  const activeCount = useMemo(() => categories.filter((c) => c.isActive).length, [categories]);

  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!teamId) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/api/teams/${teamId}/categories`, {
        name: form.name,
        description: form.description || undefined,
      });
      setForm(emptyForm);
      await loadCategories();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Unable to create category.");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteCategory(id: string) {
    if (!teamId || !confirm("Delete this category?")) return;
    setDeleteError(null);
    setDeletingId(id);
    try {
      await api.delete(`/api/teams/${teamId}/categories/${id}`);
      await loadCategories();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.detail : "Unable to delete category.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-col justify-between gap-4 rounded-2xl bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 p-5 text-white sm:flex-row sm:items-center sm:p-6">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Categories</h1>
          <p className="mt-1 text-sm text-brand-100">Organize your products into groups customers can browse.</p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-xl bg-white/15 px-4 py-2 text-center backdrop-blur">
            <p className="text-lg font-bold leading-tight">{categories.length}</p>
            <p className="text-[11px] uppercase tracking-wide text-brand-100">Total</p>
          </div>
          <div className="rounded-xl bg-white/15 px-4 py-2 text-center backdrop-blur">
            <p className="text-lg font-bold leading-tight">{activeCount}</p>
            <p className="text-[11px] uppercase tracking-wide text-brand-100">Active</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader title="All categories" subtitle={`${categories.length} total`} />
          {deleteError && <p className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-sm text-rose-600">{deleteError}</p>}

          {/* Desktop / tablet table */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Description</th>
                  <th className="px-4 py-2">Status</th>
                  {canManage && <th className="px-4 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {categories.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-brand-50/40">
                    <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                    <td className="px-4 py-3 text-gray-500">{c.description || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge tone={c.isActive ? "success" : "default"}>{c.isActive ? "Active" : "Inactive"}</Badge>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={deletingId === c.id}
                          className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          onClick={() => void deleteCategory(c.id)}
                        >
                          Delete
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
                {categories.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                      No categories yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="divide-y divide-gray-100 sm:hidden">
            {categories.map((c) => (
              <div key={c.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-800">{c.name}</p>
                  <p className="truncate text-xs text-gray-500">{c.description || "No description"}</p>
                  <div className="mt-1.5">
                    <Badge tone={c.isActive ? "success" : "default"}>{c.isActive ? "Active" : "Inactive"}</Badge>
                  </div>
                </div>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={deletingId === c.id}
                    className="shrink-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    onClick={() => void deleteCategory(c.id)}
                  >
                    Delete
                  </Button>
                )}
              </div>
            ))}
            {categories.length === 0 && <p className="px-4 py-8 text-center text-sm text-gray-500">No categories yet.</p>}
          </div>
        </Card>

        {canManage && (
          <Card className="h-fit p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Add category</h2>
            <form onSubmit={createCategory} className="space-y-3">
              <Input
                label="Name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <Input
                label="Description (optional)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              {error && <p className="text-sm text-rose-600">{error}</p>}
              <Button type="submit" fullWidth loading={submitting}>
                {submitting ? "Adding…" : "Add category"}
              </Button>
            </form>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
