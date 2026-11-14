import { statsApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Flag } from "lucide-react-native";
import {
  ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";

function toPar(diff: number) {
  const rounded = Math.round(diff * 10) / 10;
  return rounded === 0 ? "E" : rounded > 0 ? `+${rounded}` : `${rounded}`;
}

export function CoursesView() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["stats", "courses"],
    queryFn: () => statsApi.courses(),
  });

  if (isLoading) {
    return <ActivityIndicator color="#4ade80" style={{ marginTop: 60 }} />;
  }

  const courses = [...(data?.data ?? [])].sort(
    (a: any, b: any) => b.roundsPlayed - a.roundsPlayed,
  );

  return (
    <FlatList
      data={courses}
      keyExtractor={(c: any) => c.courseId}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      renderItem={({ item: c }) => {
        // Recent scores as bars: shorter = lower score
        const trend: number[] = (c.scoreTrend ?? []).slice(-8);
        const lo = Math.min(...trend);
        const hi = Math.max(...trend);
        return (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{c.courseName}</Text>
                <Text style={styles.sub}>
                  Par {c.par} · {c.roundsPlayed} round{c.roundsPlayed === 1 ? "" : "s"} · last{" "}
                  {format(new Date(c.lastPlayed), "MMM d, yyyy")}
                </Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{c.bestScore}</Text>
                <Text style={styles.statLabel}>Best ({toPar(c.bestScore - c.par)})</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{Number(c.averageScore).toFixed(1)}</Text>
                <Text style={styles.statLabel}>Average ({toPar(c.averageScore - c.par)})</Text>
              </View>
              {trend.length > 1 && (
                <View style={styles.bars}>
                  {trend.map((score, i) => (
                    <View
                      key={i}
                      style={[
                        styles.bar,
                        {
                          height: hi === lo ? 18 : 8 + ((score - lo) / (hi - lo)) * 24,
                          backgroundColor: score <= c.par ? "#4ade80" : "#6b7280",
                        },
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>
          </View>
        );
      }}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Flag color="#3f3c35" size={44} />
          <Text style={styles.emptyText}>
            {isError ? "Couldn't load course stats" : "No completed rounds yet"}
          </Text>
          {isError && (
            <TouchableOpacity onPress={() => refetch()}>
              <Text style={styles.link}>Try again</Text>
            </TouchableOpacity>
          )}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12, paddingBottom: 32, flexGrow: 1 },
  card: { backgroundColor: "#2a2822", borderRadius: 16, padding: 16, gap: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center" },
  name: { fontSize: 16, fontWeight: "700", color: "#fff" },
  sub: { fontSize: 12, color: "#9ca3af", marginTop: 3 },
  statsRow: { flexDirection: "row", alignItems: "flex-end", gap: 20 },
  stat: {},
  statValue: { fontSize: 22, fontWeight: "700", color: "#fff" },
  statLabel: { fontSize: 11, color: "#9ca3af", marginTop: 1 },
  bars: { flex: 1, flexDirection: "row", alignItems: "flex-end", justifyContent: "flex-end", gap: 4, height: 34 },
  bar: { width: 8, borderRadius: 3 },
  empty: { alignItems: "center", gap: 12, marginTop: 60 },
  emptyText: { color: "#9ca3af", fontSize: 15 },
  link: { color: "#4ade80", fontSize: 14, fontWeight: "600" },
});
