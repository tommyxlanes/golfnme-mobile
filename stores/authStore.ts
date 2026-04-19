import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { apiRequest, setToken, removeToken, API_BASE } from "@/lib/api";

interface User {
  id: string;
  name: string | null;
  username: string;
  email: string;
  avatarUrl: string | null;
  handicap: number | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  // ── Load existing session on app start ───────────────────────────────
  loadSession: async () => {
    try {
      const token = await SecureStore.getItemAsync("golfnme_token");
      if (!token) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      // Verify token is still valid
      const res = await fetch(`${API_BASE}/api/user/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Cookie: `next-auth.session-token=${token}`,
        },
        credentials: "include",
      });

      if (!res.ok) {
        await removeToken();
        set({ isLoading: false, isAuthenticated: false, token: null, user: null });
        return;
      }

      const data = await res.json();
      set({
        user: data.user ?? data.data,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false, isAuthenticated: false });
    }
  },

  // ── Email/password login ──────────────────────────────────────────────
  login: async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/api/auth/mobile/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Login failed");
    }

    await setToken(data.token);
    set({ user: data.user, token: data.token, isAuthenticated: true });
  },

  // ── Logout ────────────────────────────────────────────────────────────
  logout: async () => {
    await removeToken();
    set({ user: null, token: null, isAuthenticated: false });
  },

  setUser: (user: User) => set({ user }),
}));
