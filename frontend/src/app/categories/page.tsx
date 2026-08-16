"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, ApiError } from "@/lib/api";
import { currentRole, useAuth } from "@/lib/auth-context";
import type { Category, Paginated } from "@/lib/types";

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

  async function loadCategories() {
    if (!teamId) return;
    const res = await api.get<Paginated<Category>>(`/api/teams/${teamId}/categories?limit=200`);
    setCategories(res.items);
  }

  useEffect(() => {
    void loadCategories();
  }, [teamId]);

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
    try {
      await api.delete(`/api/teams/${teamId}/categories/${id}`);
      await loadCategories();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.detail : "Unable to delete category.");
    }
  }

  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Categories</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 overflow-hidden rounded-lg border border-gray-200 bg-white">
          {deleteError && <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">{deleteError}</p>}
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
                <tr key={c.id}>
                  <td className="px-4 py-2 font-medium text-gray-800">{c.name}</td>
                  <td className="px-4 py-2 text-gray-500">{c.description || "—"}</td>
                  <td className="px-4 py-2 text-gray-500">{c.isActive ? "Active" : "Inactive"}</td>
                  {canManage && (
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => void deleteCategory(c.id)}
                        className="text-xs font-medium text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">
                    No categories yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {canManage && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Add category</h2>
            <form onSubmit={createCategory} className="space-y-3">
              <Field label="Name">
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
              </Field>
              <Field label="Description (optional)">
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} />
              </Field>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {submitting ? "Adding…" : "Add category"}
              </button>
            </form>
          </div>
        )}
      </div>
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
