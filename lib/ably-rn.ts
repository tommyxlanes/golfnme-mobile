import Ably from "ably";
import { API_BASE } from "./api";

let client: Ably.Realtime | null = null;

export function getAblyClient(): Ably.Realtime {
  if (!client) {
    client = new Ably.Realtime({
      authUrl: `${API_BASE}/api/ably-token`,
      authMethod: "GET",
    });
  }
  return client;
}
