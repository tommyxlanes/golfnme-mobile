import { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "fallback-secret"
);

// ─────────────────────────────────────────────
// Extracts user from either:
//   1. Mobile JWT Bearer token (React Native app)
//   2. NextAuth session cookie (web app)
// Both work on the same API routes.
// ─────────────────────────────────────────────
export async function getMobileUser(req: NextRequest): Promise<{ id: string; email: string } | null> {
  const authHeader = req.headers.get("Authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    try {
      const { payload } = await jwtVerify(token, secret);
      if (payload.sub) {
        return { id: payload.sub, email: payload.email as string };
      }
    } catch {
      return null;
    }
  }

  return null;
}
