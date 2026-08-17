"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Customer, Paginated } from "@/lib/types";
import { Button, Card, CardHeader, Input, Table, TBody, TD, TEmpty, TH, THead, TR } from "@/components/ui";

const emptyForm = { name: "", email: "", phone: "" };

export default function CustomersPage() {
  const { teamId } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    if (!teamId) return;
    const res = await api.get<Paginated<Customer>>(`/api/teams/${teamId}/customers?limit=200`);
    setCustomers(res.items);
  }

  useEffect(() => {
    void load();
  }, [teamId]);

  async function createCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!teamId) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/api/teams/${teamId}/customers`, {
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
      });
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Unable to add customer.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Customers</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <Table>
            <THead>
              <TH>Name</TH>
              <TH>Email</TH>
              <TH>Phone</TH>
              <TH>Loyalty points</TH>
            </THead>
            <TBody>
              {customers.map((c) => (
                <TR key={c.id}>
                  <TD className="font-medium text-gray-800">{c.name}</TD>
                  <TD className="text-gray-500">{c.email ?? "—"}</TD>
                  <TD className="text-gray-500">{c.phone ?? "—"}</TD>
                  <TD className="text-gray-700">{c.loyaltyPoints}</TD>
                </TR>
              ))}
              {customers.length === 0 && <TEmpty colSpan={4}>No customers yet.</TEmpty>}
            </TBody>
          </Table>
        </Card>

        <Card className="h-fit">
          <CardHeader title="Add customer" />
          <form onSubmit={createCustomer} className="space-y-3 p-4">
            <Input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input
              type="email"
              placeholder="Email (optional)"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Input placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <Button type="submit" fullWidth loading={submitting}>
              {submitting ? "Adding…" : "Add customer"}
            </Button>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
