import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { BarChart3, TrendingUp, Flag, Target, Plus } from "lucide-react-native";
import { statsApi } from "@/lib/api";

export default function StatsTab() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: () => statsApi.overview(),
  });

  const stats = data?.data;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color="#4ade80" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (!stats || stats.totalRounds === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.empty}>
          <BarChart3 color="#3f3c35" size={56} />
          <Text style={styles.emptyTitle}>No stats yet</Text>
          <Text style={styles.emptySub}>Play rounds to see your performance stats</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push("/round/new")}>
            <Plus color="#fff" size={18} />
            <Text style={styles.emptyBtnText}>Start a Round</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const dist = stats.scoringDistribution;
  const totalHoles = Object.values(dist).reduce((a: any, b: any) => a + b, 0) as number;
  const distItems = [
    { label: "Eagles", value: dist.eagles, color: "#fbbf24" },
    { label: "Birdies", value: dist.birdies, color: "#16a34a" },
    { label: "Pars", value: dist.pars, color: "#6b7280" },
    { label: "Bogeys", value: dist.bogeys, color: "#b45309" },
    { label: "Double+", value: dist.doubleBogeys + dist.worse, color: "#b91c1c" },
  ];

  const parPerf = [
    { par: 3, avg: stats.parPerformance.par3Average },
    { par: 4, avg: stats.parPerformance.par4Average },
    { par: 5, avg: stats.parPerformance.par5Average },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Performance</Text>

        {/* Key stats */}
        <View style={styles.grid}>
          {[
            { label: "Rounds", value: stats.totalRounds, icon: Flag },
            { label: "Average", value: stats.averageScore.toFixed(1), icon: TrendingUp },
            { label: "Best Round", value: stats.bestRound ?? "—", icon: Target },
            { label: "Avg Putts", value: stats.averagePutts.toFixed(1), icon: BarChart3 },
          ].map(({ label, value, icon: Icon }) => (
            <View key={label} style={styles.statCard}>
              <Icon color="#4ade80" size={20} />
              <Text style={styles.statValue}>{value}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Accuracy */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Accuracy</Text>
          <View style={styles.accuracyRow}>
            {[
              { label: "Fairways", value: `${stats.fairwayPercentage}%` },
              { label: "GIR", value: `${stats.girPercentage}%` },
            ].map((a) => (
              <View key={a.label} style={styles.accuracyItem}>
                <Text style={styles.accuracyValue}>{a.value}</Text>
                <Text style={styles.accuracySub}>{a.label}</Text>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: `${parseInt(a.value)}%` }]} />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Scoring distribution */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Scoring Distribution</Text>
          {distItems.map((item) => (
            <View key={item.label} style={styles.distRow}>
              <Text style={styles.distLabel}>{item.label}</Text>
              <View style={styles.distBarBg}>
                <View style={[styles.distBarFill, {
                  width: totalHoles > 0 ? `${(item.value / totalHoles) * 100}%` : "0%",
                  backgroundColor: item.color,
                }]} />
              </View>
              <Text style={[styles.distCount, { color: item.color }]}>{item.value}</Text>
            </View>
          ))}
        </View>

        {/* Par performance */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Par Performance</Text>
          <View style={styles.parRow}>
            {parPerf.map(({ par, avg }) => {
              const diff = avg - par;
              return (
                <View key={par} style={styles.parItem}>
                  <View style={styles.parCircle}>
                    <Text style={styles.parNum}>{par}</Text>
                  </View>
                  <Text style={styles.parAvg}>{avg.toFixed(2)}</Text>
                  <Text style={[styles.parDiff, { color: diff <= 0 ? "#16a34a" : "#b45309" }]}>
                    {diff > 0 ? "+" : ""}{diff.toFixed(2)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Recent scores */}
        {stats.recentScores?.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent Scores</Text>
            {stats.recentScores.slice(0, 6).map((r: any, i: number) => {
              const diff = r.score - r.par;
              return (
                <View key={i} style={styles.recentRow}>
                  <Text style={styles.recentCourse} numberOfLines={1}>{r.courseName}</Text>
                  <Text style={[styles.recentScore, { color: diff <= 0 ? "#4ade80" : "#f59e0b" }]}>
                    {r.score}
                  </Text>
                  <Text style={[styles.recentDiff, { color: diff <= 0 ? "#4ade80" : "#f59e0b" }]}>
                    {diff === 0 ? "E" : diff > 0 ? `+${diff}` : `${diff}`}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1c1a15" },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: "700", color: "#fff", marginBottom: 20 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  statCard: { width: "47.5%", backgroundColor: "#2a2822", borderRadius: 14, padding: 16, gap: 6 },
  statValue: { fontSize: 28, fontWeight: "700", color: "#fff" },
  statLabel: { fontSize: 12, color: "#9ca3af" },
  card: { backgroundColor: "#2a2822", borderRadius: 14, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#d1d5db", marginBottom: 14 },
  accuracyRow: { flexDirection: "row", gap: 20 },
  accuracyItem: { flex: 1 },
  accuracyValue: { fontSize: 28, fontWeight: "700", color: "#fff" },
  accuracySub: { fontSize: 12, color: "#9ca3af", marginBottom: 8 },
  barBg: { height: 6, backgroundColor: "#3f3c35", borderRadius: 3 },
  barFill: { height: 6, backgroundColor: "#4ade80", borderRadius: 3 },
  distRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  distLabel: { width: 60, fontSize: 13, color: "#9ca3af" },
  distBarBg: { flex: 1, height: 8, backgroundColor: "#3f3c35", borderRadius: 4, overflow: "hidden" },
  distBarFill: { height: 8, borderRadius: 4 },
  distCount: { width: 32, textAlign: "right", fontSize: 13, fontWeight: "600" },
  parRow: { flexDirection: "row", justifyContent: "space-around" },
  parItem: { alignItems: "center", gap: 4 },
  parCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#1d5a3c", alignItems: "center", justifyContent: "center" },
  parNum: { fontSize: 22, fontWeight: "700", color: "#4ade80" },
  parAvg: { fontSize: 20, fontWeight: "700", color: "#fff" },
  parDiff: { fontSize: 13, fontWeight: "600" },
  recentRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#3f3c35" },
  recentCourse: { flex: 1, fontSize: 13, color: "#d1d5db" },
  recentScore: { fontSize: 16, fontWeight: "700", marginRight: 8 },
  recentDiff: { width: 32, textAlign: "right", fontSize: 13, fontWeight: "600" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingTop: 80 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#6b7280" },
  emptySub: { fontSize: 14, color: "#4b5563" },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, backgroundColor: "#1d5a3c", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  emptyBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
