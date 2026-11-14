import { friendsApi, resolveMediaUrl, statsApi } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Swords, UserMinus } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// A friend's page: head-to-head record from shared group rounds.
export default function FriendScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [removing, setRemoving] = useState(false);

  // Same query the Friends tab uses, so this is normally already cached
  const { data: friendsData, isLoading: loadingFriend } = useQuery({
    queryKey: ["friends"],
    queryFn: () => friendsApi.list(),
  });
  const friend = (Array.isArray(friendsData) ? friendsData : []).find(
    (f: any) => f.id === id,
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["stats", "headtohead", id],
    queryFn: () => statsApi.headToHead(id),
    enabled: !!friend,
  });
  const h2h = data?.data;
  const played = h2h ? h2h.wins + h2h.losses + h2h.ties : 0;
  const firstName = friend?.name?.split(" ")[0] || friend?.username || "them";
  const avatar = resolveMediaUrl(friend?.avatarUrl);

  const handleRemove = () => {
    Alert.alert(
      "Remove friend?",
      `${friend?.name || friend?.username} will be removed from your friends. You can send a new request later.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setRemoving(true);
            try {
              await friendsApi.remove(id);
              qc.invalidateQueries({ queryKey: ["friends"] });
              router.back();
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to remove friend");
              setRemoving(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <ArrowLeft color="#fff" size={22} />
        </TouchableOpacity>
        <Text style={styles.title}>Friend</Text>
        <View style={{ width: 38 }} />
      </View>

      {loadingFriend ? (
        <ActivityIndicator color="#4ade80" style={{ marginTop: 60 }} />
      ) : !friend ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>You're not friends with this player.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.profile}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarText}>
                  {(friend.name || friend.username || "?")[0].toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.name}>{friend.name || friend.username}</Text>
            <Text style={styles.username}>@{friend.username}</Text>
            {friend.handicap != null && (
              <View style={styles.hcpBadge}>
                <Text style={styles.hcpText}>Handicap {friend.handicap.toFixed(1)}</Text>
              </View>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Swords color="#c9a227" size={18} />
              <Text style={styles.cardTitle}>Head to head</Text>
            </View>

            {isLoading ? (
              <ActivityIndicator color="#4ade80" style={{ marginVertical: 24 }} />
            ) : isError ? (
              <TouchableOpacity onPress={() => refetch()} style={{ paddingVertical: 16 }}>
                <Text style={styles.link}>Couldn't load — tap to retry</Text>
              </TouchableOpacity>
            ) : played === 0 ? (
              <Text style={styles.noMatches}>
                No shared rounds yet. Finish a group session together to start the record.
              </Text>
            ) : (
              <>
                <View style={styles.recordRow}>
                  <View style={styles.recordItem}>
                    <Text style={[styles.recordValue, { color: "#4ade80" }]}>{h2h.wins}</Text>
                    <Text style={styles.recordLabel}>You</Text>
                  </View>
                  <View style={styles.recordItem}>
                    <Text style={styles.recordValue}>{h2h.ties}</Text>
                    <Text style={styles.recordLabel}>Ties</Text>
                  </View>
                  <View style={styles.recordItem}>
                    <Text style={[styles.recordValue, { color: "#f59e0b" }]}>{h2h.losses}</Text>
                    <Text style={styles.recordLabel} numberOfLines={1}>{firstName}</Text>
                  </View>
                </View>
                <Text style={styles.margin}>
                  Average margin {Math.abs(h2h.averageMargin).toFixed(1)} strokes
                  {h2h.lastMatchup
                    ? ` · last played ${format(new Date(h2h.lastMatchup), "MMM d, yyyy")}`
                    : ""}
                </Text>

                {(h2h.sharedRounds ?? []).map((r: any, i: number) => (
                  <View key={i} style={styles.matchRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.matchCourse} numberOfLines={1}>{r.courseName}</Text>
                      <Text style={styles.matchDate}>{format(new Date(r.date), "MMM d, yyyy")}</Text>
                    </View>
                    <Text style={[styles.matchScore, r.winner === "you" && styles.matchWin]}>
                      {r.yourScore}
                    </Text>
                    <Text style={styles.matchDash}>–</Text>
                    <Text style={[styles.matchScore, r.winner === "them" && styles.matchWin]}>
                      {r.theirScore}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </View>

          <TouchableOpacity style={styles.removeBtn} onPress={handleRemove} disabled={removing}>
            {removing ? (
              <ActivityIndicator color="#ef4444" size="small" />
            ) : (
              <>
                <UserMinus color="#ef4444" size={18} />
                <Text style={styles.removeText}>Remove Friend</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1c1a15" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 },
  iconBtn: { padding: 8 },
  title: { fontSize: 18, fontWeight: "700", color: "#fff" },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  profile: { alignItems: "center", gap: 4, paddingVertical: 8 },
  avatar: { width: 84, height: 84, borderRadius: 42, marginBottom: 8 },
  avatarFallback: { backgroundColor: "#1d5a3c", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 34, fontWeight: "700", color: "#4ade80" },
  name: { fontSize: 22, fontWeight: "700", color: "#fff" },
  username: { fontSize: 14, color: "#9ca3af" },
  hcpBadge: { backgroundColor: "#0d2e1a", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5, marginTop: 8 },
  hcpText: { color: "#4ade80", fontSize: 13, fontWeight: "600" },
  card: { backgroundColor: "#2a2822", borderRadius: 16, padding: 16 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#fff" },
  noMatches: { color: "#9ca3af", fontSize: 14, lineHeight: 20, paddingVertical: 8 },
  recordRow: { flexDirection: "row" },
  recordItem: { flex: 1, alignItems: "center" },
  recordValue: { fontSize: 34, fontWeight: "800", color: "#d1d5db" },
  recordLabel: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  margin: { fontSize: 12, color: "#9ca3af", textAlign: "center", marginTop: 12, marginBottom: 6 },
  matchRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#3f3c35", gap: 8 },
  matchCourse: { fontSize: 14, fontWeight: "600", color: "#fff" },
  matchDate: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  matchScore: { fontSize: 16, fontWeight: "600", color: "#9ca3af", width: 34, textAlign: "center" },
  matchWin: { color: "#4ade80", fontWeight: "800" },
  matchDash: { color: "#6b7280" },
  removeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14 },
  removeText: { color: "#ef4444", fontWeight: "600", fontSize: 15 },
  link: { color: "#4ade80", fontSize: 14, fontWeight: "600", textAlign: "center" },
  empty: { alignItems: "center", marginTop: 80, paddingHorizontal: 24 },
  emptyText: { color: "#9ca3af", fontSize: 15, textAlign: "center" },
});
