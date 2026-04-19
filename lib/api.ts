import * as SecureStore from "expo-secure-store";

// ─────────────────────────────────────────────
// Config — point at your Next.js backend
// ─────────────────────────────────────────────
export const API_BASE = __DEV__
  ? "http://localhost:3000"          // local dev
  : "https://app.golfnme.com";       // production (your Hetzner/Coolify server)

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

export async function apiRequest<T>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const { auth = true, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (auth) {
    const token = await getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
      // Also send as cookie for NextAuth compatibility
      headers["Cookie"] = `next-auth.session-token=${token}`;
    }
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers,
    credentials: "include",
  });

  if (response.status === 401) {
    await removeToken();
    throw new ApiError("Unauthorized", 401);
  }

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(data.error || "Request failed", response.status);
  }

  return data;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
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

  me: () => apiRequest<{ user: any }>("/api/auth/mobile/me"),

  logout: () => apiRequest("/api/auth/mobile/logout", { method: "POST" }),
};

// Rounds
export const roundsApi = {
  list: (params?: { status?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.limit) q.set("take", params.limit.toString());
    return apiRequest<any>(`/api/rounds?${q}`);
  },

  get: (id: string) => apiRequest<any>(`/api/rounds/${id}`),

  create: (body: { courseId: string; weather?: string; notes?: string }) =>
    apiRequest<any>("/api/rounds", { method: "POST", body: JSON.stringify(body) }),

  update: (id: string, body: { status?: string; notes?: string }) =>
    apiRequest<any>(`/api/rounds/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
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
  }) => apiRequest<any>("/api/scores", { method: "POST", body: JSON.stringify(body) }),
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

  import: (golfApiId: number) =>
    apiRequest<any>("/api/courses/import", {
      method: "POST",
      body: JSON.stringify({ golfApiId }),
    }),

  create: (body: any) =>
    apiRequest<any>("/api/courses", { method: "POST", body: JSON.stringify(body) }),

  updateHole: (courseId: string, body: { holeNumber: number; par: number; yardage?: number; handicapRank?: number }) =>
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
    apiRequest<any>("/api/sessions", { method: "POST", body: JSON.stringify(body) }),

  action: (body: { sessionId: string; action: string }) =>
    apiRequest<any>("/api/sessions", { method: "PATCH", body: JSON.stringify(body) }),

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
};

// Friends
export const friendsApi = {
  list: () => apiRequest<any>("/api/friends"),
  requests: () => apiRequest<any>("/api/friends?type=requests"),
  search: (query: string) =>
    apiRequest<any>(`/api/friends/search?q=${encodeURIComponent(query)}`),
  sendRequest: (userId: string) =>
    apiRequest<any>("/api/friends", {
      method: "POST",
      body: JSON.stringify({ userId }),
    }),
  respond: (requestId: string, action: "accept" | "decline") =>
    apiRequest<any>("/api/friends", {
      method: "PATCH",
      body: JSON.stringify({ requestId, action }),
    }),
};

// User
export const userApi = {
  update: (body: { name?: string; username?: string; handicap?: number }) =>
    apiRequest<any>("/api/user", { method: "PATCH", body: JSON.stringify(body) }),
};
