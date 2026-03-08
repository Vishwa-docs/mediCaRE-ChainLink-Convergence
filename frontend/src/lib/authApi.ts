import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const authApi = axios.create({
  baseURL: API_BASE,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT to all requests when available
authApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("medicare_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export interface AuthUser {
  id: number;
  wallet_address: string;
  display_name: string;
  role: string;
  email: string | null;
  worldid_nullifier: string | null;
  worldid_verified: number;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoginResponse {
  success: boolean;
  data: {
    token: string;
    user: AuthUser;
  };
}

export const authApiClient = {
  login: (email: string, password: string) =>
    authApi.post<LoginResponse>("/api/auth/login", { email, password }),

  walletLogin: (address: string) =>
    authApi.post<LoginResponse>("/api/auth/wallet-login", { address }),

  register: (data: { email: string; password: string; displayName: string; role?: string; walletAddress?: string }) =>
    authApi.post<LoginResponse>("/api/auth/register", data),

  me: () => authApi.get<{ success: boolean; data: AuthUser }>("/api/auth/me"),

  verifyWorldID: (proof: { merkle_root: string; nullifier_hash: string; proof: string; signal?: string }) =>
    authApi.post("/api/auth/worldid/verify", proof),

  simulateWorldID: () =>
    authApi.post("/api/auth/worldid/simulate"),

  getUsers: () =>
    authApi.get<{ success: boolean; data: { users: AuthUser[]; total: number } }>("/api/auth/users"),

  updateRole: (userId: number, role: string) =>
    authApi.patch(`/api/auth/users/${userId}/role`, { role }),
};
