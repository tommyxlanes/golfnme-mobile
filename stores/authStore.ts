import { closeAblyClient } from "@/lib/ably-rn";
import {
  authApi,
  getToken,
  removeToken,
  setToken,
  setUnauthorizedHandler,
} from "@/lib/api";
import { create } from "zustand";

export interface User {
  id: string;
  name: string | null;
  username: string | null;
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
  // Store a token + user we already have (signup, Google deep link)
  // (user is null when only the token is known yet — follow with setUser)
  setSession: (token: string, user: User | null) => Promise<void>;
  setUser: (user: User) => void;
}

const signedOut = { user: null, token: null, isAuthenticated: false };

export const useAuthStore = create<AuthState>((set) => ({
  ...signedOut,
  isLoading: true,

  // ── Load existing session on app start ───────────────────────────────
  loadSession: async () => {
    try {
      const token = await getToken();
      if (!token) {
        set({ ...signedOut, isLoading: false });
        return;
      }

      // Verify the token is still valid. A 401 clears it (see
      // setUnauthorizedHandler below); a network error leaves it in place
      // so the next launch can try again.
      const { user } = await authApi.me();
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch {
      set({ ...signedOut, isLoading: false });
    }
  },

  // ── Email/password login ──────────────────────────────────────────────
  login: async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    await setToken(data.token);
    set({ user: data.user, token: data.token, isAuthenticated: true });
  },

  setSession: async (token: string, user: User | null) => {
    await setToken(token);
    set({ user, token, isAuthenticated: !!user });
  },

  // ── Logout ────────────────────────────────────────────────────────────
  logout: async () => {
    await removeToken();
    closeAblyClient();
    set(signedOut);
  },

  setUser: (user: User) =>
    set((state) => ({
      user,
      isAuthenticated: true,
      token: state.token,
    })),
}));

// The API rejected our token mid-session: sign out so AuthGuard in
// app/_layout.tsx sends the user to login. (api.ts already deleted the token.)
setUnauthorizedHandler(() => {
  closeAblyClient();
  useAuthStore.setState(signedOut);
});
