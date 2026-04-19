import { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, UserPlus, Search, ChevronRight, Check, X } from "lucide-react-native";
import { friendsApi } from "@/lib/api";

export default function FriendsTab() {
  const qc = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [findQuery, setFindQuery] = useState("");
  const [findDebounced, setFindDebounced] = useState("");
  const [showFind, setShowFind] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { data: friendsData, isLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: () => friendsApi.list(),
  });

  const { data: requestsData } = useQuery({
    queryKey: ["friend-requests"],
    queryFn: () => friendsApi.requests(),
    refetchInterval: 15_000,
  });

  const { data: searchResults } = useQuery({
    queryKey: ["user-search", findDebounced],
    queryFn: () => friendsApi.search(findDebounced),
    enabled: findDebounced.length >= 2,
  });

  const friends = friendsData?.items ?? friendsData ?? [];
  const requests = requestsData?.items ?? requestsData ?? [];

  const filtered = useMemo(() => {
    if (!searchQuery) return friends;
    const q = searchQuery.toLowerCase();
    return friends.filter((f: any) =>
      f.name?.toLowerCase().includes(q) || f.username?.toLowerCase().includes(q)
    );
  }, [friends, searchQuery]);

  const handleFind = (text: string) => {
    setFindQuery(text);
    clearTimeout((handleFind as any)._t);
    (handleFind as any)._t = setTimeout(() => setFindDebounced(text), 400);
  };

  const handleRespond = async (requestId: string, action: "accept" | "decline") => {
    setActionLoading(requestId);
    try {
      await friendsApi.respond(requestId, action);
      qc.invalidateQueries({ queryKey: ["friends"] });
      qc.invalidateQueries({ queryKey: ["friend-requests"] });
    } catch {
      Alert.alert("Error", "Failed to respond to request");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendRequest = async (userId: string) => {
    try {
      await friendsApi.sendRequest(userId);
      Alert.alert("Sent!", "Friend request sent.");
    } catch {
      Alert.alert("Error", "Failed to send request");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Friends</Text>
        <TouchableOpacity
          style={[styles.findBtn, showFind && styles.findBtnActive]}
          onPress={() => setShowFind((v) => !v)}
        >
          <UserPlus color={showFind ? "#fff" : "#4ade80"} size={20} />
        </TouchableOpacity>
      </View>

      {/* Find friends panel */}
      {showFind && (
        <View style={styles.findPanel}>
          <View style={styles.searchBox}>
            <Search color="#9ca3af" size={16} />
            <TextInput
              style={styles.searchInput}
              value={findQuery}
              onChangeText={handleFind}
              placeholder="Search by username or email..."
              placeholderTextColor="#6b7280"
              autoFocus
            />
          </View>
          {findDebounced.length >= 2 && (
            <View style={styles.findResults}>
              {(searchResults?.users ?? []).map((user: any) => (
                <View key={user.id} style={styles.findRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{(user.name || user.username)?.[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.findName}>{user.name || user.username}</Text>
                    <Text style={styles.findUser}>@{user.username}</Text>
                  </View>
                  <TouchableOpacity style={styles.addBtn} onPress={() => handleSendRequest(user.id)}>
                    <Text style={styles.addBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {findDebounced.length >= 2 && (!searchResults?.users?.length) && (
                <Text style={styles.noResults}>No users found</Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* Pending requests */}
      {requests.length > 0 && (
        <View style={styles.requestsSection}>
          <Text style={styles.sectionTitle}>Requests ({requests.length})</Text>
          {requests.map((req: any) => (
            <View key={req.id} style={styles.requestRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{req.sender?.name?.[0]?.toUpperCase() ?? "?"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.reqName}>{req.sender?.name ?? "Unknown"}</Text>
                <Text style={styles.reqUser}>@{req.sender?.username}</Text>
              </View>
              <View style={styles.reqBtns}>
                <TouchableOpacity
                  style={styles.acceptBtn}
                  onPress={() => handleRespond(req.id, "accept")}
                  disabled={actionLoading === req.id}
                >
                  {actionLoading === req.id
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Check color="#fff" size={16} />
                  }
                </TouchableOpacity>
                <TouchableOpacity style={styles.declineBtn} onPress={() => handleRespond(req.id, "decline")}>
                  <X color="#fff" size={16} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Friends search */}
      <View style={styles.searchBox2}>
        <Search color="#9ca3af" size={16} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search friends..."
          placeholderTextColor="#6b7280"
        />
      </View>

      {isLoading
        ? <ActivityIndicator color="#4ade80" style={{ marginTop: 40 }} />
        : (
          <FlatList
            data={filtered}
            keyExtractor={(f) => f.id}
            contentContainerStyle={styles.list}
            renderItem={({ item: friend }) => (
              <View style={styles.friendRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(friend.name || friend.username)?.[0]?.toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.friendName}>{friend.name}</Text>
                  <Text style={styles.friendUser}>@{friend.username}</Text>
                </View>
                {friend.handicap != null && (
                  <View style={styles.hcpBadge}>
                    <Text style={styles.hcpText}>{friend.handicap.toFixed(1)}</Text>
                    <Text style={styles.hcpLabel}>HCP</Text>
                  </View>
                )}
              </View>
            )}
            ListEmptyComponent={
              !searchQuery ? (
                <View style={styles.empty}>
                  <Users color="#3f3c35" size={48} />
                  <Text style={styles.emptyTitle}>No friends yet</Text>
                  <Text style={styles.emptySub}>Find golfers to compete with</Text>
                  <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowFind(true)}>
                    <UserPlus color="#fff" size={18} />
                    <Text style={styles.emptyBtnText}>Find Friends</Text>
                  </TouchableOpacity>
                </View>
              ) : <Text style={styles.noResults}>No friends match "{searchQuery}"</Text>
            }
          />
        )
      }
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1c1a15" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: "700", color: "#fff" },
  findBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1.5, borderColor: "#1d5a3c", alignItems: "center", justifyContent: "center" },
  findBtnActive: { backgroundColor: "#1d5a3c", borderColor: "#1d5a3c" },
  findPanel: { marginHorizontal: 20, marginBottom: 12, backgroundColor: "#2a2822", borderRadius: 14, padding: 12 },
  findResults: { marginTop: 8 },
  findRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  findName: { fontSize: 14, fontWeight: "600", color: "#fff" },
  findUser: { fontSize: 12, color: "#9ca3af" },
  addBtn: { backgroundColor: "#1d5a3c", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  noResults: { color: "#6b7280", fontSize: 13, textAlign: "center", paddingVertical: 8 },
  requestsSection: { marginHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: "#9ca3af", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  requestRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#2a2210", borderRadius: 12, padding: 12, marginBottom: 6, gap: 10 },
  reqName: { fontSize: 14, fontWeight: "600", color: "#fff" },
  reqUser: { fontSize: 12, color: "#9ca3af" },
  reqBtns: { flexDirection: "row", gap: 6 },
  acceptBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: "#1d5a3c", alignItems: "center", justifyContent: "center" },
  declineBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: "#3f1515", alignItems: "center", justifyContent: "center" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#1c1a15", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  searchBox2: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 20, marginBottom: 8, backgroundColor: "#2a2822", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14, color: "#fff" },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#1d5a3c", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontWeight: "700", color: "#4ade80" },
  friendRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#2a2822", borderRadius: 14, padding: 14, marginBottom: 8, gap: 12 },
  friendName: { fontSize: 14, fontWeight: "600", color: "#fff" },
  friendUser: { fontSize: 12, color: "#9ca3af", marginTop: 1 },
  hcpBadge: { alignItems: "center" },
  hcpText: { fontSize: 16, fontWeight: "700", color: "#4ade80" },
  hcpLabel: { fontSize: 10, color: "#9ca3af" },
  empty: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#6b7280", marginTop: 8 },
  emptySub: { fontSize: 14, color: "#4b5563" },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, backgroundColor: "#1d5a3c", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  emptyBtnText: { color: "#fff", fontWeight: "600" },
});
