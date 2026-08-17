"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { currentRole, useAuth } from "@/lib/auth-context";
import { Button, Select } from "@/components/ui";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10M9 21h6" },
  { href: "/pos", label: "Checkout", icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" },
  { href: "/products", label: "Products", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
  { href: "/categories", label: "Categories", icon: "M19 11H5m14-4H5m14 8H5m14 4H5" },
  { href: "/inventory", label: "Inventory", icon: "M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0l-1.4 6.3a2 2 0 01-1.95 1.7H7.35a2 2 0 01-1.95-1.7L4 13m16 0H4" },
  { href: "/customers", label: "Customers", icon: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-4a4 4 0 10-8 0 4 4 0 008 0zm6 0a4 4 0 10-8 0 4 4 0 008 0z" },
  { href: "/sales", label: "Sales", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { href: "/reports", label: "Reports", icon: "M9 17v-2a2 2 0 012-2h2a2 2 0 012 2v2m-9 0h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v8a2 2 0 002 2z" },
  { href: "/stores", label: "Stores", icon: "M3 21h18M4 21V9l8-6 8 6v12M9 21v-6h6v6" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, teamId, setTeamId, storeId, setStoreId, stores } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (user.teams.length === 0 && pathname !== "/onboarding") {
      router.replace("/onboarding");
    }
  }, [loading, user, router, pathname]);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-gray-500">
        <svg className="mr-2 h-4 w-4 animate-spin text-brand-600" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        Loading…
      </div>
    );
  }
  if (!user || user.teams.length === 0) return null;

  const role = currentRole(user, teamId);

  return (
    <div className="flex min-h-screen bg-gray-50 lg:overflow-hidden">
      {navOpen && (
        <div
          className="fixed inset-0 z-30 bg-gray-900/50 lg:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 -translate-x-full flex-col bg-gradient-to-b from-brand-700 via-brand-700 to-indigo-800 text-white transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          navOpen ? "translate-x-0" : ""
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <span className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-white">🛒</span>
            POS
          </span>
          <button
            onClick={() => setNavOpen(false)}
            className="rounded-md p-1 text-white/80 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-white/15 text-white shadow-sm" : "text-brand-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                <svg className="shrink-0" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item.icon} />
                </svg>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-3 text-sm">
          <p className="truncate font-medium text-white">{user.name || user.email}</p>
          <p className="truncate text-xs text-brand-200">{role ?? "No role"}</p>
          <Button variant="outline" size="sm" fullWidth className="mt-2 border-white/20 bg-white/5 text-white hover:bg-white/15" onClick={() => void logout()}>
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:overflow-y-auto">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
          <button
            onClick={() => setNavOpen(true)}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 lg:hidden"
            aria-label="Open navigation"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex flex-1 flex-wrap items-center gap-2 sm:gap-3">
            {user.teams.length > 1 && (
              <Select className="w-auto min-w-[9rem]" value={teamId ?? ""} onChange={(e) => setTeamId(e.target.value || null)}>
                {user.teams.map((t) => (
                  <option key={t.teamId} value={t.teamId}>
                    {t.teamName}
                  </option>
                ))}
              </Select>
            )}
            {stores.length > 0 && (
              <Select className="w-auto min-w-[9rem]" value={storeId ?? ""} onChange={(e) => setStoreId(e.target.value || null)}>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
