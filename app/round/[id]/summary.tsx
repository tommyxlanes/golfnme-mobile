import { roundsApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Flag, Play, Users } from "lucide-react-native";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Hole = { id: string; holeNumber: number; par: number };
type Score = {
  holeId: string;
  strokes: number;
  putts: number | null;
  fairwayHit: boolean | null;
  greenInReg: boolean | null;
};

function formatToPar(diff: number) {
  if (diff === 0) return "E";
  return diff > 0 ? `+${diff}` : `${diff}`;
}

// Colour for one hole's score relative to par
function scoreStyle(diff: number) {
  if (diff <= -1) return { backgroundColor: "#16a34a" };
  if (diff === 0) return null;
  if (diff === 1) return { backgroundColor: "#b45309" };
  return { backgroundColor: "#b91c1c" };
}

export default function RoundSummaryScreen() {
  const { id: roundId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["round", roundId],
    queryFn: () => roundsApi.get(roundId),
  });

  const round = data?.data;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#4ade80" size="large" />
      </View>
    );
  }

  if (isError || !round) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Couldn't load this round.</Text>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => refetch()}>
          <Text style={styles.secondaryBtnText}>Try again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace("/(tabs)")}>
          <Text style={styles.linkText}>Back to home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const holes: Hole[] = [...(round.course?.holes ?? [])].sort(
    (a: Hole, b: Hole) => a.holeNumber - b.holeNumber,
  );
  const scoreByHole = new Map<string, Score>(
    (round.scores ?? []).map((s: Score) => [s.holeId, s]),
  );
  const played = holes.filter((h) => scoreByHole.has(h.id));

  const total = played.reduce((sum, h) => sum + scoreByHole.get(h.id)!.strokes, 0);
  const parPlayed = played.reduce((sum, h) => sum + h.par, 0);
  const toPar = total - parPlayed;
  const isPartial = played.length < holes.length;
  const inProgress = round.status === "IN_PROGRESS";

  // Putts / fairways / greens are optional per hole — only count holes
  // where the player recorded them.
  const scores = played.map((h) => ({ hole: h, score: scoreByHole.get(h.id)! }));
  const withPutts = scores.filter((s) => s.score.putts != null);
  const totalPutts = withPutts.reduce((sum, s) => sum + (s.score.putts ?? 0), 0);
  const fairways = scores.filter((s) => s.hole.par > 3 && s.score.fairwayHit != null);
  const fairwaysHit = fairways.filter((s) => s.score.fairwayHit).length;
  const greens = scores.filter((s) => s.score.greenInReg != null);
  const greensHit = greens.filter((s) => s.score.greenInReg).length;

  const diffs = scores.map((s) => s.score.strokes - s.hole.par);
  const breakdown = [
    { label: "Birdies+", count: diffs.filter((d) => d <= -1).length, color: "#4ade80" },
    { label: "Pars", count: diffs.filter((d) => d === 0).length, color: "#d1d5db" },
    { label: "Bogeys", count: diffs.filter((d) => d === 1).length, color: "#f59e0b" },
    { label: "Double+", count: diffs.filter((d) => d >= 2).length, color: "#ef4444" },
  ];

  // Front nine / back nine
  const nines = [holes.slice(0, 9), holes.slice(9, 18)].filter((n) => n.length > 0);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroBadges}>
            {round.sessionId && (
              <View style={styles.badge}>
                <Users color="#c9a227" size={12} />
                <Text style={styles.badgeText}>Group round</Text>
              </View>
            )}
            {inProgress && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>In progress</Text>
              </View>
            )}
            {round.status === "ABANDONED" && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Abandoned</Text>
              </View>
            )}
          </View>
          <Text style={styles.courseName} numberOfLines={2}>
            {round.course?.name ?? "Round"}
          </Text>
          <Text style={styles.date}>
            {format(new Date(round.playedAt), "EEEE, MMM d, yyyy")}
          </Text>

          {played.length > 0 ? (
            <>
              <Text style={styles.total}>{total}</Text>
              <Text style={[styles.toPar, { color: toPar <= 0 ? "#4ade80" : "#f59e0b" }]}>
                {formatToPar(toPar)}
                {isPartial ? ` thru ${played.length}` : ""}
              </Text>
            </>
          ) : (
            <Text style={styles.noScores}>No holes scored</Text>
          )}
        </View>

        {played.length > 0 && (
          <>
            {/* Score breakdown */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Scoring</Text>
              <View style={styles.breakdownRow}>
                {breakdown.map((b) => (
                  <View key={b.label} style={styles.breakdownItem}>
                    <Text style={[styles.breakdownCount, { color: b.color }]}>{b.count}</Text>
                    <Text style={styles.breakdownLabel}>{b.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {withPutts.length ? totalPutts : "—"}
                </Text>
                <Text style={styles.statLabel}>Putts</Text>
                {withPutts.length > 0 && (
                  <Text style={styles.statSub}>
                    {(totalPutts / withPutts.length).toFixed(1)} per hole
                  </Text>
                )}
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {fairways.length ? `${fairwaysHit}/${fairways.length}` : "—"}
                </Text>
                <Text style={styles.statLabel}>Fairways</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {greens.length ? `${greensHit}/${greens.length}` : "—"}
                </Text>
                <Text style={styles.statLabel}>Greens</Text>
              </View>
            </View>

            {/* Scorecard */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Scorecard</Text>
              {nines.map((nine, i) => {
                const ninePar = nine.reduce((sum, h) => sum + h.par, 0);
                const nineScored = nine.filter((h) => scoreByHole.has(h.id));
                const nineTotal = nineScored.reduce(
                  (sum, h) => sum + scoreByHole.get(h.id)!.strokes,
                  0,
                );
                return (
                  <View key={i} style={styles.nine}>
                    <View style={styles.cardRow}>
                      <Text style={[styles.rowLabel, styles.muted]}>Hole</Text>
                      {nine.map((h) => (
                        <Text key={h.id} style={[styles.cell, styles.muted]}>{h.holeNumber}</Text>
                      ))}
                      <Text style={[styles.cellTotal, styles.muted]}>{i === 0 ? "Out" : "In"}</Text>
                    </View>
                    <View style={styles.cardRow}>
                      <Text style={[styles.rowLabel, styles.muted]}>Par</Text>
                      {nine.map((h) => (
                        <Text key={h.id} style={[styles.cell, styles.muted]}>{h.par}</Text>
                      ))}
                      <Text style={[styles.cellTotal, styles.muted]}>{ninePar}</Text>
                    </View>
                    <View style={styles.cardRow}>
                      <Text style={styles.rowLabel}>Score</Text>
                      {nine.map((h) => {
                        const s = scoreByHole.get(h.id);
                        return (
                          <View key={h.id} style={styles.cellBox}>
                            <View style={[styles.scoreDot, s ? scoreStyle(s.strokes - h.par) : null]}>
                              <Text style={styles.scoreText}>{s ? s.strokes : "·"}</Text>
                            </View>
                          </View>
                        );
                      })}
                      <Text style={[styles.cellTotal, styles.totalText]}>
                        {nineScored.length ? nineTotal : "—"}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Actions */}
        {inProgress && (
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.replace(`/round/${roundId}`)}
          >
            <Play color="#4ade80" size={18} />
            <Text style={styles.secondaryBtnText}>Resume round</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace("/(tabs)")}>
          <Flag color="#1c1a15" size={18} />
          <Text style={styles.primaryBtnText}>Done</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1c1a15" },
  center: { flex: 1, backgroundColor: "#1c1a15", alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  errorText: { color: "#d1d5db", fontSize: 15 },
  linkText: { color: "#9ca3af", fontSize: 14 },

  hero: { backgroundColor: "#155c37", borderRadius: 20, padding: 24, alignItems: "center" },
  heroBadges: { flexDirection: "row", gap: 8, marginBottom: 10 },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: "#c9a227", fontSize: 11, fontWeight: "600" },
  courseName: { fontSize: 20, fontWeight: "700", color: "#fff", textAlign: "center" },
  date: { fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 4 },
  total: { fontSize: 72, fontWeight: "800", color: "#fff", marginTop: 12, lineHeight: 80 },
  toPar: { fontSize: 20, fontWeight: "700" },
  noScores: { fontSize: 15, color: "rgba(255,255,255,0.7)", marginTop: 16 },

  card: { backgroundColor: "#2a2822", borderRadius: 16, padding: 16 },
  cardTitle: { fontSize: 14, fontWeight: "600", color: "#9ca3af", marginBottom: 12 },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between" },
  breakdownItem: { flex: 1, alignItems: "center" },
  breakdownCount: { fontSize: 26, fontWeight: "800" },
  breakdownLabel: { fontSize: 11, color: "#9ca3af", marginTop: 2 },

  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, backgroundColor: "#2a2822", borderRadius: 16, padding: 14, alignItems: "center" },
  statValue: { fontSize: 22, fontWeight: "700", color: "#fff" },
  statLabel: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  statSub: { fontSize: 10, color: "#6b7280", marginTop: 2 },

  nine: { marginBottom: 12 },
  cardRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  rowLabel: { width: 42, fontSize: 11, fontWeight: "600", color: "#fff" },
  cell: { flex: 1, textAlign: "center", fontSize: 12 },
  cellBox: { flex: 1, alignItems: "center" },
  cellTotal: { width: 34, textAlign: "center", fontSize: 12 },
  muted: { color: "#9ca3af" },
  totalText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  scoreDot: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  scoreText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  primaryBtn: { backgroundColor: "#c9a227", borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryBtnText: { color: "#1c1a15", fontWeight: "700", fontSize: 16 },
  secondaryBtn: { backgroundColor: "#2a2822", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderColor: "#1d5a3c" },
  secondaryBtnText: { color: "#4ade80", fontWeight: "600", fontSize: 15 },
});
