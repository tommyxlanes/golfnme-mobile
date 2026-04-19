import { useState, useMemo } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Flag, Calendar, ChevronRight, Plus, Users, User } from "lucide-react-native";
import { roundsApi } from "@/lib/api";
import { format } from "date-fns";

export default function RoundsTab() {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "solo" | "group">("all");

  const { data: completed, isLoading } = useQuery({
    queryKey: ["rounds", "completed"],
    queryFn: () => roundsApi.list({ status: "COMPLETED", limit: 100 }),
  });

  const { data: inProgress } = useQuery({
    queryKey: ["rounds", "in-progress"],
    queryFn: () => roundsApi.list({ status: "IN_PROGRESS", limit: 5 }),
    refetchInterval: 15_000,
  });

  const allRounds = useMemo(() => {
    const ip = inProgress?.items ?? [];
    const done = completed?.items ?? [];
    return [...ip, ...done];
  }, [inProgress, completed]);

  const filtered = useMemo(() => {
    if (filter === "solo") return allRounds.filter((r: any) => !r.sessionId);
    if (filter === "group") return allRounds.filter((r: any) => !!r.sessionId);
    return allRounds;
  }, [allRounds, filter]);

  // Stats
  const completedRounds = allRounds.filter((r: any) => r.status === "COMPLETED" && r.totalScore);
  const scores = completedRounds.map((r: any) => r.totalScore!);
  const best = scores.length ? Math.min(...scores) : null;
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  function scoreToPar(round: any) {
    const par = round.course?.par ?? 72;
    return round.totalScore ? round.totalScore - par : null;
  }

  function scoreColor(diff: number | null) {
    if (diff === null) return "#6b7280";
    if (diff <= -1) return "#16a34a";
    if (diff === 0) return "#9ca3af";
    if (diff <= 5) return "#b45309";
    return "#b91c1c";
  }

  const renderRound = ({ item: round }: { item: any }) => {
    const diff = scoreToPar(round);
    const par = round.course?.par ?? 72;
    const isGroup = !!round.sessionId;
    const inProg = round.status === "IN_PROGRESS";

    return (
      <TouchableOpacity
        style={styles.roundRow}
        onPress={() => router.push(inProg ? `/round/${round.id}` : `/round/${round.id}/summary` as any)}
        activeOpacity={0.8}
      >
        <View style={[styles.scoreBubble, { backgroundColor: diff !== null && diff <= 0 ? "#0d2e1a" : "#2a2210" }]}>
          <Text style={[styles.scoreNum, { color: scoreColor(diff) }]}>
            {round.totalScore ?? "—"}
          </Text>
          {diff !== null && (
            <Text style={[styles.scoreDiff, { color: scoreColor(diff) }]}>
              {diff === 0 ? "E" : diff > 0 ? `+${diff}` : `${diff}`}
            </Text>
          )}
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.roundTitleRow}>
            <Text style={styles.roundCourse} numberOfLines={1}>{round.course?.name ?? "Unknown"}</Text>
            {isGroup && <View style={styles.groupBadge}><Text style={styles.groupBadgeText}>Group</Text></View>}
            {inProg && <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>Live</Text></View>}
          </View>
          <View style={styles.roundMeta}>
            <Calendar color="#6b7280" size={12} />
            <Text style={styles.roundMetaText}>
              {format(new Date(round.playedAt), "MMM d, yyyy")}
            </Text>
            <Text style={styles.roundMetaText}>· Par {par}</Text>
            {round.scores?.length > 0 && round.course?.numHoles && round.scores.length < round.course.numHoles && (
              <Text style={styles.roundMetaText}>· {round.scores.length}/{round.course.numHoles} holes</Text>
            )}
          </View>
        </View>

        <ChevronRight color="#3f3c35" size={18} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Round History</Text>
        <TouchableOpacity style={styles.newBtn} onPress={() => router.push("/round/new")}>
          <Plus color="#fff" size={18} />
        </TouchableOpacity>
      </View>

      {/* Stats strip */}
      {completedRounds.length > 0 && (
        <View style={styles.statsRow}>
          {[
            { label: "Rounds", value: completedRounds.length.toString() },
            { label: "Best", value: best?.toString() ?? "—" },
            { label: "Average", value: avg?.toString() ?? "—" },
          ].map((s) => (
            <View key={s.label} style={styles.statItem}>
              <Text style={styles.statNum}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Filters */}
      <View style={styles.filters}>
        {[
          { id: "all", label: "All", icon: Flag },
          { id: "solo", label: "Solo", icon: User },
          { id: "group", label: "Group", icon: Users },
        ].map(({ id, label, icon: Icon }) => (
          <TouchableOpacity
            key={id}
            onPress={() => setFilter(id as any)}
            style={[styles.filterBtn, filter === id && styles.filterBtnActive]}
          >
            <Icon color={filter === id ? "#fff" : "#9ca3af"} size={14} />
            <Text style={[styles.filterText, filter === id && { color: "#fff" }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading
        ? <ActivityIndicator color="#4ade80" style={{ marginTop: 40 }} />
        : (
          <FlatList
            data={filtered}
            keyExtractor={(r) => r.id}
            renderItem={renderRound}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Flag color="#3f3c35" size={48} />
                <Text style={styles.emptyTitle}>No rounds yet</Text>
                <Text style={styles.emptySub}>Start playing to track your history</Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push("/round/new")}>
                  <Text style={styles.emptyBtnText}>Start First Round</Text>
                </TouchableOpacity>
              </View>
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
  newBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: "#1d5a3c", alignItems: "center", justifyContent: "center" },
  statsRow: { flexDirection: "row", marginHorizontal: 20, marginBottom: 16, backgroundColor: "#2a2822", borderRadius: 14, padding: 16 },
  statItem: { flex: 1, alignItems: "center" },
  statNum: { fontSize: 22, fontWeight: "700", color: "#4ade80" },
  statLabel: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  filters: { flexDirection: "row", gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  filterBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: "#2a2822" },
  filterBtnActive: { backgroundColor: "#1d5a3c" },
  filterText: { fontSize: 13, color: "#9ca3af", fontWeight: "500" },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  roundRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#2a2822", borderRadius: 14, padding: 14, marginBottom: 8, gap: 12 },
  scoreBubble: { width: 56, height: 56, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  scoreNum: { fontSize: 20, fontWeight: "700" },
  scoreDiff: { fontSize: 11, fontWeight: "600", marginTop: -2 },
  roundTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  roundCourse: { fontSize: 14, fontWeight: "600", color: "#fff", flex: 1 },
  groupBadge: { backgroundColor: "#2a2210", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  groupBadgeText: { fontSize: 10, color: "#f59e0b", fontWeight: "600" },
  activeBadge: { backgroundColor: "#0d2e1a", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  activeBadgeText: { fontSize: 10, color: "#4ade80", fontWeight: "600" },
  roundMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  roundMetaText: { fontSize: 12, color: "#6b7280" },
  empty: { alignItems: "center", marginTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#6b7280", marginTop: 8 },
  emptySub: { fontSize: 14, color: "#4b5563" },
  emptyBtn: { marginTop: 16, backgroundColor: "#1d5a3c", borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: "#fff", fontWeight: "600" },
});
