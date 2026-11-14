import * as SecureStore from "expo-secure-store";

// ─────────────────────────────────────────────
// Config — the golfnme API (apps/api, port 4000) or the web app, which
// proxies /api/* to it
// ─────────────────────────────────────────────
export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ||
  (__DEV__ ? "http://localhost:3000" : "https://app.golfnme.com");

// The web app's origin. Only the browser-based Google sign-in needs it (it
// opens the web /login page); everything else talks to API_BASE. Defaults
// to API_BASE for setups where the app points at the web host's proxy.
export const WEB_BASE = process.env.EXPO_PUBLIC_WEB_URL || API_BASE;

// Uploaded avatars come back as API-relative paths (/api/avatars/...);
// Google profile pictures are already absolute.
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith("/") ? `${API_BASE}${url}` : url;
}

const TOKEN_KEY = "golfnme_token";

// ─────────────────────────────────────────────
// Token management
// ─────────────────────────────────────────────
export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function removeToken(): Promise<void> {
  return SecureStore.deleteItemAsync(TOKEN_KEY);
}

// ─────────────────────────────────────────────
// Base fetch wrapper
// ─────────────────────────────────────────────
interface ApiOptions extends RequestInit {
  auth?: boolean;
}

// Called when the API rejects our token. The auth store registers itself
// here (it imports this file, so we can't import it back).
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

export async function apiRequest<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const { auth = true, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    // fetch sets the multipart boundary itself for FormData bodies
    ...(fetchOptions.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (auth) {
    const token = await getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers,
  });

  // A 401 on an authenticated call means the token expired or was revoked:
  // drop it and send the user back to login. (A 401 from the login call
  // itself is just wrong credentials.)
  if (response.status === 401 && auth) {
    await removeToken();
    onUnauthorized?.();
    throw new ApiError("Unauthorized", 401);
  }

  // Error pages from a proxy or a down server are not JSON.
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof data?.error === "string" ? data.error : "Request failed";
    throw new ApiError(message, response.status);
  }

  return data as T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─────────────────────────────────────────────
// Typed API methods
// ─────────────────────────────────────────────

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    apiRequest<{ token: string; user: any }>("/api/auth/mobile/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      auth: false,
    }),

  // Exchange a Google ID token (native Google sign-in) for our own token
  google: (idToken: string) =>
    apiRequest<{ token: string; user: any }>("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken }),
      auth: false,
    }),

  me: () => apiRequest<{ user: any }>("/api/auth/mobile/me"),

  logout: () => apiRequest("/api/auth/mobile/logout", { method: "POST" }),
};

// Rounds
export const roundsApi = {
  list: (params?: { status?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.limit) q.set("limit", params.limit.toString());
    return apiRequest<any>(`/api/rounds?${q}`);
  },

  get: (id: string) => apiRequest<any>(`/api/rounds/${id}`),

  create: (body: {
    courseId: string;
    sessionId?: string;
    weather?: string;
    notes?: string;
  }) =>
    apiRequest<any>("/api/rounds", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (id: string, body: { status?: string; notes?: string }) =>
    apiRequest<any>(`/api/rounds/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};

// Scores
export const scoresApi = {
  save: (body: {
    roundId: string;
    holeId: string;
    strokes: number;
    putts?: number;
    fairwayHit?: boolean;
    greenInReg?: boolean;
    penalties?: number;
    // Lets the API label the leaderboard update for group rounds
    holeNumber?: number;
  }) =>
    apiRequest<any>("/api/scores", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

// Courses
export const coursesApi = {
  list: (search?: string) => {
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    q.set("limit", "100");
    return apiRequest<any>(`/api/courses?${q}`);
  },

  search: (q: string) =>
    apiRequest<any>(`/api/courses/search?q=${encodeURIComponent(q)}`),

  import: (golfApiId: number | string) =>
    apiRequest<any>("/api/courses/import", {
      method: "POST",
      body: JSON.stringify({ golfApiId }),
    }),

  create: (body: any) =>
    apiRequest<any>("/api/courses", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateHole: (
    courseId: string,
    body: {
      holeNumber: number;
      par: number;
      yardage?: number;
      handicapRank?: number;
    },
  ) =>
    apiRequest<any>(`/api/courses/${courseId}/holes`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};

// Sessions (group play)
export const sessionsApi = {
  list: (status?: string) => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    return apiRequest<any>(`/api/sessions?${q}`);
  },

  get: (inviteCode: string) =>
    apiRequest<any>(`/api/sessions?inviteCode=${inviteCode}`),

  create: (body: { courseId: string; maxPlayers?: number }) =>
    apiRequest<any>("/api/sessions", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  action: (body: { sessionId: string; action: string }) =>
    apiRequest<any>("/api/sessions", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  join: (inviteCode: string) =>
    apiRequest<any>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ inviteCode }),
    }),

  chat: (sessionId: string) =>
    apiRequest<any>(`/api/sessions/${sessionId}/chat`),

  sendChat: (sessionId: string, text: string) =>
    apiRequest<any>(`/api/sessions/${sessionId}/chat`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
};

// Stats
export const statsApi = {
  overview: () => apiRequest<any>("/api/stats?type=overview"),
  trends: (periodDays: number) =>
    apiRequest<any>(`/api/stats?type=trends&period=${periodDays}`),
  courses: () => apiRequest<any>("/api/stats?type=courses"),
  headToHead: (opponentId: string) =>
    apiRequest<any>(`/api/stats?type=headtohead&opponentId=${opponentId}`),
};

// Friends
export const friendsApi = {
  list: () => apiRequest<any>("/api/friends"),
  requests: () => apiRequest<any>("/api/friends?type=requests"),
  // Requests I sent that are still waiting
  sent: () => apiRequest<any>("/api/friends?type=pending"),
  search: (query: string) =>
    apiRequest<any>(`/api/friends/search?query=${encodeURIComponent(query)}`),
  // The API takes a username or a user id in the "username" field.
  sendRequest: (usernameOrId: string) =>
    apiRequest<any>("/api/friends", {
      method: "POST",
      body: JSON.stringify({ username: usernameOrId }),
    }),
  respond: (requestId: string, action: "accept" | "decline" | "cancel") =>
    apiRequest<any>("/api/friends", {
      method: "PATCH",
      body: JSON.stringify({ requestId, action }),
    }),
  remove: (friendId: string) =>
    apiRequest<any>(`/api/friends?friendId=${friendId}`, { method: "DELETE" }),
};

// Notifications
export const notificationsApi = {
  list: () => apiRequest<{ notifications: any[] }>("/api/notifications"),
  // No ids = mark everything read
  markRead: (ids?: string[]) =>
    apiRequest<any>("/api/notifications", {
      method: "PATCH",
      body: JSON.stringify(ids ? { ids } : {}),
    }),
  // No id = clear everything
  remove: (id?: string) =>
    apiRequest<any>(`/api/notifications${id ? `?id=${id}` : ""}`, {
      method: "DELETE",
    }),
};

// User
export const userApi = {
  update: (body: { name?: string; username?: string; handicap?: number | null }) =>
    apiRequest<any>("/api/user/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  // asset: what expo-image-picker returns
  uploadAvatar: (asset: { uri: string; mimeType?: string | null; fileName?: string | null }) => {
    const type = asset.mimeType ?? "image/jpeg";
    const form = new FormData();
    // React Native's FormData takes { uri, name, type } for files
    form.append("avatar", {
      uri: asset.uri,
      name: asset.fileName ?? `avatar.${type.split("/")[1] ?? "jpg"}`,
      type,
    } as any);
    return apiRequest<{ success: boolean; avatarUrl: string }>("/api/user/avatar", {
      method: "POST",
      body: form,
    });
  },

  removeAvatar: () =>
    apiRequest<{ success: boolean }>("/api/user/avatar", { method: "DELETE" }),
};
