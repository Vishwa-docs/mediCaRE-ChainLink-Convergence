"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { authApiClient, type AuthUser } from "@/lib/authApi";

/* ─── Types ───────────────────────────────────── */
export type UserRole = "patient" | "doctor" | "insurer" | "admin" | "paramedic" | "researcher";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  role: UserRole;
  loading: boolean;
  isAuthenticated: boolean;
  isWorldIDVerified: boolean;
  login: (email: string, password: string) => Promise<void>;
  walletLogin: (address: string) => Promise<void>;
  register: (data: { email: string; password: string; displayName: string; role?: string }) => Promise<void>;
  logout: () => void;
  simulateWorldID: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/* ─── Provider ────────────────────────────────── */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /* Hydrate from localStorage on mount */
  useEffect(() => {
    const savedToken = localStorage.getItem("medicare_token");
    const savedUser = localStorage.getItem("medicare_user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("medicare_user");
      }
    }
    setLoading(false);
  }, []);

  /* Persist changes */
  const persist = useCallback((tok: string, usr: AuthUser) => {
    setToken(tok);
    setUser(usr);
    localStorage.setItem("medicare_token", tok);
    localStorage.setItem("medicare_user", JSON.stringify(usr));
  }, []);

  /* Login */
  const login = useCallback(async (email: string, password: string) => {
    const res = await authApiClient.login(email, password);
    persist(res.data.data.token, res.data.data.user);
  }, [persist]);

  /* Wallet Login */
  const walletLogin = useCallback(async (address: string) => {
    const res = await authApiClient.walletLogin(address);
    persist(res.data.data.token, res.data.data.user);
  }, [persist]);

  /* Register */
  const register = useCallback(async (data: { email: string; password: string; displayName: string; role?: string }) => {
    const res = await authApiClient.register(data);
    persist(res.data.data.token, res.data.data.user);
  }, [persist]);

  /* Logout */
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("medicare_token");
    localStorage.removeItem("medicare_user");
  }, []);

  /* Simulate WorldID */
  const simulateWorldID = useCallback(async () => {
    await authApiClient.simulateWorldID();
    await refreshUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /* Refresh user data */
  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const res = await authApiClient.me();
      setUser(res.data.data);
      localStorage.setItem("medicare_user", JSON.stringify(res.data.data));
    } catch {
      /* token expired */
      logout();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const role = (user?.role ?? "patient") as UserRole;

  const value: AuthContextValue = {
    user,
    token,
    role,
    loading,
    isAuthenticated: !!user && !!token,
    isWorldIDVerified: user?.worldid_verified === 1,
    login,
    walletLogin,
    register,
    logout,
    simulateWorldID,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ─── Hook ────────────────────────────────────── */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
