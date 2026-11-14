import { statsApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";

const PERIODS = [
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "1 year" },
];

const CHART_H = 140;
const PAD = 14;

// Minimal line chart: values left-to-right, oldest first.
function LineChart({ values, color, zeroLine }: { values: number[]; color: string; zeroLine?: boolean }) {
  const [width, setWidth] = useState(0);

  const min = Math.min(...values, zeroLine ? 0 : Infinity);
  const max = Math.max(...values, zeroLine ? 0 : -Infinity);
  const span = max - min || 1;
  const x = (i: number) =>
    values.length === 1 ? width / 2 : PAD + (i * (width - PAD * 2)) / (values.length - 1);
  const y = (v: number) => PAD + ((max - v) * (CHART_H - PAD * 2)) / span;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: CHART_H }}>
      {width > 0 && (
        <Svg width={width} height={CHART_H}>
          {zeroLine && (
            <Line x1={PAD} x2={width - PAD} y1={y(0)} y2={y(0)} stroke="#3f3c35" strokeDasharray="4 4" />
          )}
          {values.length > 1 && (
            <Polyline
              points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
              fill="none"
              stroke={color}
              strokeWidth={2}
            />
          )}
          {values.map((v, i) => (
            <Circle key={i} cx={x(i)} cy={y(v)} r={3.5} fill={color} />
          ))}
        </Svg>
      )}
    </View>
  );
}

function toPar(diff: number) {
  return diff === 0 ? "E" : diff > 0 ? `+${diff}` : `${diff}`;
}

export function TrendsView() {
  const [period, setPeriod] = useState(90);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["stats", "trends", period],
    queryFn: () => statsApi.trends(period),
  });

  const trends = data?.data;
  // Oldest first for the charts, whatever order the API used
  const rounds = [...(trends?.scoreTrend ?? [])].sort(
    (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const handicaps = [...(trends?.handicapHistory ?? [])].sort(
    (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const avgToPar = rounds.length
    ? rounds.reduce((sum: number, r: any) => sum + r.scoreToPar, 0) / rounds.length
    : 0;
  // Improving = the later half of the period averages lower than the earlier half
  const half = Math.floor(rounds.length / 2);
  const avgOf = (list: any[]) => list.reduce((s, r) => s + r.scoreToPar, 0) / list.length;
  const change = half >= 1 ? avgOf(rounds.slice(-half)) - avgOf(rounds.slice(0, half)) : null;

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.periodRow}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.days}
            onPress={() => setPeriod(p.days)}
            style={[styles.periodBtn, period === p.days && styles.periodBtnActive]}
          >
            <Text style={[styles.periodText, period === p.days && styles.periodTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color="#4ade80" style={{ marginTop: 60 }} />
      ) : isError ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Couldn't load trends</Text>
          <TouchableOpacity onPress={() => refetch()}>
            <Text style={styles.link}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : rounds.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No completed rounds in this period</Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{rounds.length}</Text>
              <Text style={styles.summaryLabel}>Rounds</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>
                {avgToPar > 0 ? "+" : ""}{avgToPar.toFixed(1)}
              </Text>
              <Text style={styles.summaryLabel}>Avg to par</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text
                style={[
                  styles.summaryValue,
                  change !== null && { color: change <= 0 ? "#4ade80" : "#f59e0b" },
                ]}
              >
                {change === null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(1)}`}
              </Text>
              <Text style={styles.summaryLabel}>Change</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Score to par</Text>
            <LineChart values={rounds.map((r: any) => r.scoreToPar)} color="#4ade80" zeroLine />
            <View style={styles.axisRow}>
              <Text style={styles.axisText}>{format(new Date(rounds[0].date), "MMM d")}</Text>
              <Text style={styles.axisText}>
                {format(new Date(rounds[rounds.length - 1].date), "MMM d")}
              </Text>
            </View>
          </View>

          {handicaps.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Handicap index</Text>
              <LineChart values={handicaps.map((h: any) => h.handicap)} color="#c9a227" />
              <View style={styles.axisRow}>
                <Text style={styles.axisText}>{handicaps[0].handicap.toFixed(1)}</Text>
                <Text style={styles.axisText}>
                  {handicaps[handicaps.length - 1].handicap.toFixed(1)}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Rounds</Text>
            {[...rounds].reverse().map((r: any, i: number) => (
              <View key={i} style={styles.roundRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roundCourse} numberOfLines={1}>{r.courseName}</Text>
                  <Text style={styles.roundDate}>{format(new Date(r.date), "MMM d, yyyy")}</Text>
                </View>
                <Text style={styles.roundScore}>{r.score}</Text>
                <Text style={[styles.roundDiff, { color: r.scoreToPar <= 0 ? "#4ade80" : "#f59e0b" }]}>
                  {toPar(r.scoreToPar)}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  periodRow: { flexDirection: "row", gap: 8 },
  periodBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: "#3f3c35", alignItems: "center" },
  periodBtnActive: { backgroundColor: "#0d2e1a", borderColor: "#1d5a3c" },
  periodText: { color: "#9ca3af", fontSize: 13, fontWeight: "500" },
  periodTextActive: { color: "#4ade80" },
  summaryRow: { flexDirection: "row", gap: 10 },
  summaryCard: { flex: 1, backgroundColor: "#2a2822", borderRadius: 14, padding: 14, alignItems: "center" },
  summaryValue: { fontSize: 22, fontWeight: "700", color: "#fff" },
  summaryLabel: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  card: { backgroundColor: "#2a2822", borderRadius: 16, padding: 16 },
  cardTitle: { fontSize: 14, fontWeight: "600", color: "#9ca3af", marginBottom: 8 },
  axisRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  axisText: { fontSize: 11, color: "#6b7280" },
  roundRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#3f3c35", gap: 12 },
  roundCourse: { fontSize: 14, fontWeight: "600", color: "#fff" },
  roundDate: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  roundScore: { fontSize: 17, fontWeight: "700", color: "#fff", width: 36, textAlign: "right" },
  roundDiff: { fontSize: 14, fontWeight: "600", width: 36, textAlign: "right" },
  empty: { alignItems: "center", gap: 10, marginTop: 60 },
  emptyText: { color: "#9ca3af", fontSize: 15 },
  link: { color: "#4ade80", fontSize: 14, fontWeight: "600" },
});
