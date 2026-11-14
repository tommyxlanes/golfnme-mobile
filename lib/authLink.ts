import { authApi } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

// Finishes the browser-based Google sign-in: the web app sends the user back
// to this app's /login link with ?token=… (or ?error=…).
//
// The same link can reach us twice — once through the router (app/(auth)/login.tsx)
// and once as the result of the browser session (the login button) — so a
// link that was just handled is ignored.
let lastKey: string | null = null;
let lastAt = 0;

export async function completeBrowserSignIn(params: {
  token?: string;
  error?: string;
}): Promise<"signed-in" | "ignored"> {
  const key = params.token ?? (params.error ? `error:${params.error}` : null);
  if (!key) return "ignored";
  if (key === lastKey && Date.now() - lastAt < 10_000) return "ignored";
  lastKey = key;
  lastAt = Date.now();

  if (params.error) {
    throw new Error(
      params.error === "not_authenticated"
        ? "Google sign in didn't complete. Please try again."
        : "Sign in failed. Please try again.",
    );
  }

  const store = useAuthStore.getState();
  try {
    // Store the token first so the API client sends it, then load the user.
    await store.setSession(params.token!, null);
    const { user } = await authApi.me();
    store.setUser(user);
    return "signed-in";
  } catch (err) {
    await store.logout();
    throw err;
  }
}
