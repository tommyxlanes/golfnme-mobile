import { notificationsApi } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "expo-router";
import {
  ArrowLeft, Bell, Flag, MessageCircle, Trash2, UserPlus, Users,
} from "lucide-react-native";
import { useEffect } from "react";
import {
  ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text,
  TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ICONS: Record<string, any> = {
  friend_request: UserPlus,
  friend_accepted: Users,
  session_invite: Users,
  session_started: Flag,
  session_chat: MessageCircle,
  round_complete: Flag,
};

// The API's actionUrl values are web paths; map them to screens here.
function routeFor(actionUrl: string | null): string | null {
  if (!actionUrl || actionUrl === "/") return null;
  if (actionUrl === "/friends") return "/(tabs)/friends";
  if (actionUrl === "/session/join") return "/session/join";
  if (/^\/session\/[A-Za-z0-9]+$/.test(actionUrl)) return actionUrl;
  if (/^\/round\/[a-z0-9]+\/summary$/.test(actionUrl)) return actionUrl;
  return null;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list(),
  });

  const notifications = data?.notifications ?? [];
  const hasUnread = notifications.some((n: any) => !n.read);

  // Opening the list counts as reading it. The rows keep their unread dot
  // until the screen is left, so the user can see what was new.
  useEffect(() => {
    if (!hasUnread) return;
    notificationsApi.markRead().catch(() => {});
    return () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    };
  }, [hasUnread]);

  const handleClearAll = () => {
    Alert.alert("Clear notifications?", "This removes all of them.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear All",
        style: "destructive",
        onPress: async () => {
          try {
            await notificationsApi.remove();
            qc.setQueryData(["notifications"], { notifications: [] });
          } catch {
            Alert.alert("Error", "Failed to clear notifications");
          }
        },
      },
    ]);
  };

  const handleDelete = async (id: string) => {
    qc.setQueryData(["notifications"], {
      notifications: notifications.filter((n: any) => n.id !== id),
    });
    try {
      await notificationsApi.remove(id);
    } catch {
      refetch();
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <ArrowLeft color="#fff" size={22} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        {notifications.length > 0 ? (
          <TouchableOpacity onPress={handleClearAll} style={styles.iconBtn}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 50 }} />
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator color="#4ade80" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n: any) => n.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#4ade80" />
          }
          renderItem={({ item: n }) => {
            const Icon = ICONS[n.kind] ?? Bell;
            const route = routeFor(n.actionUrl);
            return (
              <TouchableOpacity
                style={[styles.row, !n.read && styles.rowUnread]}
                onPress={() => route && router.push(route as any)}
                activeOpacity={route ? 0.8 : 1}
              >
                <View style={styles.icon}>
                  <Icon color="#4ade80" size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{n.title}</Text>
                  {!!n.body && <Text style={styles.rowBody}>{n.body}</Text>}
                  <Text style={styles.rowTime}>
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </Text>
                </View>
                {!n.read && <View style={styles.dot} />}
                <TouchableOpacity
                  onPress={() => handleDelete(n.id)}
                  style={styles.deleteBtn}
                  accessibilityLabel="Delete notification"
                >
                  <Trash2 color="#6b7280" size={16} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Bell color="#3f3c35" size={48} />
              <Text style={styles.emptyText}>
                {isError ? "Couldn't load notifications" : "You're all caught up"}
              </Text>
              {isError && (
                <TouchableOpacity onPress={() => refetch()}>
                  <Text style={styles.link}>Try again</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1c1a15" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 },
  iconBtn: { padding: 8, minWidth: 50 },
  title: { fontSize: 18, fontWeight: "700", color: "#fff" },
  clearText: { color: "#ef4444", fontSize: 14, fontWeight: "600", textAlign: "right" },
  list: { padding: 16, gap: 8, flexGrow: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#2a2822", borderRadius: 14, padding: 14 },
  rowUnread: { backgroundColor: "#0d2e1a" },
  icon: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#1c1a15", alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 14, fontWeight: "600", color: "#fff" },
  rowBody: { fontSize: 13, color: "#d1d5db", marginTop: 2 },
  rowTime: { fontSize: 11, color: "#6b7280", marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#4ade80" },
  deleteBtn: { padding: 8 },
  empty: { alignItems: "center", gap: 12, marginTop: 80 },
  emptyText: { color: "#9ca3af", fontSize: 15 },
  link: { color: "#4ade80", fontSize: 14, fontWeight: "600" },
});
