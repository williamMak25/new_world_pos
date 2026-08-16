"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { currentRole, useAuth } from "@/lib/auth-context";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pos", label: "Checkout" },
  { href: "/products", label: "Products" },
  { href: "/categories", label: "Categories" },
  { href: "/inventory", label: "Inventory" },
  { href: "/customers", label: "Customers" },
  { href: "/sales", label: "Sales" },
  { href: "/reports", label: "Reports" },
  { href: "/stores", label: "Stores" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, teamId, setTeamId, storeId, setStoreId, stores } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (user.teams.length === 0 && pathname !== "/onboarding") {
      router.replace("/onboarding");
    }
  }, [loading, user, router, pathname]);

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-sm text-gray-500">Loading…</div>;
  }
  if (!user || user.teams.length === 0) return null;

  const role = currentRole(user, teamId);

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-4">
          <span className="text-lg font-semibold text-brand-700">POS</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-md px-3 py-2 text-sm font-medium ${
                pathname === item.href
                  ? "bg-brand-50 text-brand-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-gray-200 p-3 text-sm">
          <p className="truncate font-medium text-gray-900">{user.name || user.email}</p>
          <p className="truncate text-xs text-gray-500">{role ?? "No role"}</p>
          <button
            onClick={() => void logout()}
            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
          <div className="flex items-center gap-3">
            {user.teams.length > 1 && (
              <select
                className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                value={teamId ?? ""}
                onChange={(e) => setTeamId(e.target.value || null)}
              >
                {user.teams.map((t) => (
                  <option key={t.teamId} value={t.teamId}>
                    {t.teamName}
                  </option>
                ))}
              </select>
            )}
            {stores.length > 0 && (
              <select
                className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                value={storeId ?? ""}
                onChange={(e) => setStoreId(e.target.value || null)}
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
