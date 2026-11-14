import Ably from "ably";
import { apiRequest } from "./api";

let client: Ably.Realtime | null = null;

export function getAblyClient(): Ably.Realtime {
  if (!client) {
    client = new Ably.Realtime({
      // /api/ably-token needs our Bearer token, which a plain authUrl
      // can't send — fetch the token request through the API client.
      authCallback: async (_params, callback) => {
        try {
          const tokenRequest = await apiRequest<Ably.TokenRequest>(
            "/api/ably-token",
          );
          callback(null, tokenRequest);
        } catch (err: any) {
          callback(err?.message ?? "Ably auth failed", null);
        }
      },
    });
  }
  return client;
}

// The connection is tied to the signed-in user (it is their clientId),
// so drop it on sign-out.
export function closeAblyClient() {
  client?.close();
  client = null;
}
