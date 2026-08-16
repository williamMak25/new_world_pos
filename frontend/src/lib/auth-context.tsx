"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, getAccessToken, login as apiLogin, logout as apiLogout } from "@/lib/api";
import type { CurrentUser, Store } from "@/lib/types";

const TEAM_STORAGE_KEY = "pos.team_id";
const STORE_STORAGE_KEY = "pos.store_id";

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;

  teamId: string | null;
  setTeamId: (id: string | null) => void;
  storeId: string | null;
  setStoreId: (id: string | null) => void;
  stores: Store[];
  storesLoading: boolean;
  refreshStores: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamId, setTeamIdState] = useState<string | null>(null);
  const [storeId, setStoreIdState] = useState<string | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);

  const refreshUser = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<CurrentUser>("/api/me");
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setTeamIdState(typeof window !== "undefined" ? window.localStorage.getItem(TEAM_STORAGE_KEY) : null);
    setStoreIdState(typeof window !== "undefined" ? window.localStorage.getItem(STORE_STORAGE_KEY) : null);
    void refreshUser();
  }, [refreshUser]);

  // Default to the user's first team once loaded, if none selected yet.
  useEffect(() => {
    if (user && !teamId && user.teams.length > 0) {
      setTeamId(user.teams[0].teamId);
    }
  }, [user, teamId]);

  const refreshStores = useCallback(async () => {
    if (!teamId) {
      setStores([]);
      return;
    }
    setStoresLoading(true);
    try {
      const res = await api.get<{ items: Store[] }>(`/api/teams/${teamId}/stores`);
      setStores(res.items);
    } catch {
      setStores([]);
    } finally {
      setStoresLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    void refreshStores();
  }, [refreshStores]);

  // Default to the first store once the store list loads, if none selected yet.
  useEffect(() => {
    if (stores.length > 0 && (!storeId || !stores.some((s) => s.id === storeId))) {
      setStoreId(stores[0].id);
    }
  }, [stores, storeId]);

  function setTeamId(id: string | null) {
    setTeamIdState(id);
    setStoreIdState(null);
    if (typeof window !== "undefined") {
      if (id) window.localStorage.setItem(TEAM_STORAGE_KEY, id);
      else window.localStorage.removeItem(TEAM_STORAGE_KEY);
      window.localStorage.removeItem(STORE_STORAGE_KEY);
    }
  }

  function setStoreId(id: string | null) {
    setStoreIdState(id);
    if (typeof window !== "undefined") {
      if (id) window.localStorage.setItem(STORE_STORAGE_KEY, id);
      else window.localStorage.removeItem(STORE_STORAGE_KEY);
    }
  }

  const login = useCallback(
    async (email: string, password: string) => {
      await apiLogin(email, password);
      await refreshUser();
      router.push("/dashboard");
    },
    [refreshUser, router],
  );

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    setTeamIdState(null);
    setStoreIdState(null);
    router.push("/login");
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login,
      logout,
      refreshUser,
      teamId,
      setTeamId,
      storeId,
      setStoreId,
      stores,
      storesLoading,
      refreshStores,
    }),
    [user, loading, login, logout, refreshUser, teamId, storeId, stores, storesLoading, refreshStores],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export function currentRole(user: CurrentUser | null, teamId: string | null): string | null {
  if (!user || !teamId) return null;
  return user.teams.find((t) => t.teamId === teamId)?.role ?? null;
}

export { ApiError };
