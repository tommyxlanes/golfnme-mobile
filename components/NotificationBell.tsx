import { getAblyClient } from "@/lib/ably-rn";
import { notificationsApi } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Bell } from "lucide-react-native";
import { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

// Bell with an unread count. New notifications arrive on the user's own
// Ably channel (user:<id>); a slow poll covers the case where Ably is down.
export function NotificationBell() {
  const router = useRouter();
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list(),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!userId) return;
    try {
      const channel = getAblyClient().channels.get(`user:${userId}`);
      channel.subscribe("notification", () => {
        qc.invalidateQueries({ queryKey: ["notifications"] });
        // A friend request or acceptance changes these lists too
        qc.invalidateQueries({ queryKey: ["friends"] });
        qc.invalidateQueries({ queryKey: ["friend-requests"] });
      });
      return () => { channel.unsubscribe(); };
    } catch { /* Ably optional — the poll still runs */ }
  }, [userId]);

  const unread = (data?.notifications ?? []).filter((n: any) => !n.read).length;

  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={() => router.push("/notifications" as any)}
      accessibilityLabel={unread ? `Notifications, ${unread} unread` : "Notifications"}
    >
      <Bell color="#d1d5db" size={22} />
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#2a2822", alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: 4, right: 4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: "#ef4444", alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
});
