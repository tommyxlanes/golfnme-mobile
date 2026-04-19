import { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Modal,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, ChevronRight, Minus, Plus,
  ArrowLeft, Menu, X, BarChart3, Pencil, Loader2,
} from "lucide-react-native";
import { roundsApi, scoresApi, coursesApi } from "@/lib/api";

export default function ActiveRoundScreen() {
  const { id: roundId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [currentHole, setCurrentHole] = useState(1);
  const [strokes, setStrokes] = useState(4);
  const [putts, setPutts] = useState<number | undefined>(undefined);
  const [fairwayHit, setFairwayHit] = useState<boolean | undefined>(undefined);
  const [greenInReg, setGreenInReg] = useState<boolean | undefined>(undefined);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [showEditHole, setShowEditHole] = useState(false);
  const [editPar, setEditPar] = useState(4);
  const [editYardage, setEditYardage] = useState("");
  const [editHandicap, setEditHandicap] = useState("");
  const [savingHole, setSavingHole] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["round", roundId],
    queryFn: () => roundsApi.get(roundId),
  });

  const round = data?.data;
  const course = round?.course;
  const holes = course?.holes ?? [];
  const hole = holes.find((h: any) => h.holeNumber === currentHole);

  useEffect(() => {
    if (!round?.scores) return;
    const map: Record<string, number> = {};
    round.scores.forEach((s: any) => {
      map[s.hole.id] = s.strokes;
    });
    setScores(map);

    const played = new Set(round.scores.map((s: any) => s.hole.holeNumber));
    const next = holes.find((h: any) => !played.has(h.holeNumber));
    if (next) setCurrentHole(next.holeNumber);
  }, [round?.id]);

  useEffect(() => {
    if (!hole) return;
    setStrokes(scores[hole.id] || hole.par || 4);
    setPutts(undefined);
    setFairwayHit(undefined);
    setGreenInReg(undefined);
  }, [currentHole, hole?.id]);

  const { mutate: saveScore, isPending: saving } = useMutation({
    mutationFn: () =>
      scoresApi.save({
        roundId,
        holeId: hole!.id,
        strokes, putts, fairwayHit, greenInReg, penalties: 0,
      }),
    onSuccess: () => {
      setScores((prev) => ({ ...prev, [hole!.id]: strokes }));
      qc.invalidateQueries({ queryKey: ["round", roundId] });
      if (currentHole < holes.length) setCurrentHole((h) => h + 1);
    },
    onError: () => Alert.alert("Error", "Failed to save score"),
  });

  const { mutate: completeRound } = useMutation({
    mutationFn: () => roundsApi.update(roundId, { status: "COMPLETED" }),
    onSuccess: () => router.replace(`/round/${roundId}/summary` as any),
    onError: () => Alert.alert("Error", "Failed to complete round"),
  });

  const handleSaveHole = async () => {
    if (!hole || !course?.id) return;
    setSavingHole(true);
    try {
      await coursesApi.updateHole(course.id, {
        holeNumber: hole.holeNumber,
        par: editPar,
        yardage: editYardage ? parseInt(editYardage) : undefined,
        handicapRank: editHandicap ? parseInt(editHandicap) : undefined,
      });
      qc.invalidateQueries({ queryKey: ["round", roundId] });
      setShowEditHole(false);
    } finally {
      setSavingHole(false);
    }
  };

  const allPlayed = holes.length > 0 && holes.every((h: any) => scores[h.id]);
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const playedHoles = Object.keys(scores).length;
  const parThrough = holes
    .filter((h: any) => scores[h.id])
    .reduce((a: number, h: any) => a + h.par, 0);
  const scoreToPar = totalScore - parThrough;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#4ade80" size="large" />
      </View>
    );
  }

  if (!course || !hole) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Round not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push("/(tabs)")} style={styles.iconBtn}>
          <ArrowLeft color="#fff" size={22} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.courseName} numberOfLines={1}>{course.name}</Text>
          <Text style={styles.courseParText}>Par {course.par}</Text>
        </View>

        <TouchableOpacity
          onPress={() => { setEditPar(hole.par); setEditYardage(hole.yardage?.toString() ?? ""); setEditHandicap(hole.handicapRank?.toString() ?? ""); setShowEditHole(true); }}
          style={styles.iconBtn}
        >
          <Pencil color="#fff" size={20} />
        </TouchableOpacity>
      </View>

      {/* Score bar */}
      <View style={styles.scoreBar}>
        <View style={styles.scoreItem}>
          <Text style={styles.scoreLabel}>Thru</Text>
          <Text style={styles.scoreValue}>{playedHoles}</Text>
        </View>
        <View style={styles.scoreDivider} />
        <View style={styles.scoreItem}>
          <Text style={styles.scoreLabel}>Score</Text>
          <Text style={styles.scoreValue}>{totalScore || "—"}</Text>
        </View>
        <View style={styles.scoreDivider} />
        <Text style={[styles.scoreToPar, { color: scoreToPar <= 0 ? "#fbbf24" : "#fff" }]}>
          {playedHoles > 0
            ? scoreToPar === 0 ? "E" : scoreToPar > 0 ? `+${scoreToPar}` : `${scoreToPar}`
            : "E"
          }
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hole card */}
        <View style={styles.holeCard}>
          {/* Nav */}
          <View style={styles.holeNav}>
            <TouchableOpacity
              onPress={() => setCurrentHole((h) => Math.max(1, h - 1))}
              disabled={currentHole === 1}
              style={[styles.navBtn, currentHole === 1 && { opacity: 0.3 }]}
            >
              <ChevronLeft color="#fff" size={22} />
            </TouchableOpacity>
            <View style={styles.holeNumArea}>
              <Text style={styles.holeLabel}>Hole</Text>
              <Text style={styles.holeNum}>{currentHole}</Text>
            </View>
            <TouchableOpacity
              onPress={() => setCurrentHole((h) => Math.min(holes.length, h + 1))}
              disabled={currentHole === holes.length}
              style={[styles.navBtn, currentHole === holes.length && { opacity: 0.3 }]}
            >
              <ChevronRight color="#fff" size={22} />
            </TouchableOpacity>
          </View>

          {/* Hole stats */}
          <View style={styles.holeStats}>
            {[
              { label: "Par", value: hole.par },
              { label: "Yards", value: hole.yardage ?? "—" },
              { label: "HCP", value: hole.handicapRank ?? "—" },
            ].map((stat) => (
              <View key={stat.label} style={styles.holeStat}>
                <Text style={styles.holeStatLabel}>{stat.label}</Text>
                <Text style={styles.holeStatValue}>{stat.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Score input */}
        <View style={styles.scoreInput}>
          <Text style={styles.inputLabel}>Strokes</Text>
          <View style={styles.strokeRow}>
            <TouchableOpacity
              style={styles.strokeBtn}
              onPress={() => setStrokes((s) => Math.max(1, s - 1))}
            >
              <Minus color="#fff" size={22} />
            </TouchableOpacity>

            <View style={[styles.strokeBubble, getScoreBubbleStyle(strokes, hole.par)]}>
              <Text style={styles.strokeNum}>{strokes}</Text>
              <Text style={styles.strokeRelLabel}>{getRelLabel(strokes, hole.par)}</Text>
            </View>

            <TouchableOpacity
              style={styles.strokeBtn}
              onPress={() => setStrokes((s) => Math.min(15, s + 1))}
            >
              <Plus color="#fff" size={22} />
            </TouchableOpacity>
          </View>

          {/* Quick buttons */}
          <View style={styles.quickRow}>
            {[hole.par - 2, hole.par - 1, hole.par, hole.par + 1, hole.par + 2]
              .filter((s) => s > 0)
              .map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setStrokes(s)}
                  style={[styles.quickBtn, strokes === s && styles.quickBtnActive]}
                >
                  <Text style={[styles.quickBtnText, strokes === s && { color: "#fff" }]}>{s}</Text>
                </TouchableOpacity>
              ))}
          </View>

          {/* Putts */}
          <Text style={styles.inputLabel}>Putts</Text>
          <View style={styles.puttRow}>
            {[0, 1, 2, 3, 4].map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => setPutts(p)}
                style={[styles.puttBtn, putts === p && styles.puttBtnActive]}
              >
                <Text style={[styles.puttBtnText, putts === p && { color: "#fff" }]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
            onPress={() => saveScore()}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.saveBtnText}>Save & Continue</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Hole pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
          {holes.map((h: any) => {
            const s = scores[h.id];
            const rel = s ? s - h.par : null;
            return (
              <TouchableOpacity
                key={h.id}
                onPress={() => setCurrentHole(h.holeNumber)}
                style={[
                  styles.pill,
                  currentHole === h.holeNumber && styles.pillActive,
                  s && rel !== null && getPillStyle(rel),
                ]}
              >
                <Text style={styles.pillText}>{s || h.holeNumber}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Complete round */}
        {allPlayed && (
          <TouchableOpacity style={styles.completeBtn} onPress={() => completeRound()}>
            <Text style={styles.completeBtnText}>Finish Round — View Summary</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Edit hole modal */}
      <Modal visible={showEditHole} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowEditHole(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Hole {currentHole}</Text>
            <TouchableOpacity onPress={() => setShowEditHole(false)}>
              <X color="#9ca3af" size={22} />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalLabel}>Par</Text>
          <View style={styles.parBtns}>
            {[3, 4, 5, 6].map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => setEditPar(p)}
                style={[styles.parBtn, editPar === p && styles.parBtnActive]}
              >
                <Text style={[styles.parBtnText, editPar === p && { color: "#fff" }]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.modalLabel}>Yardage</Text>
          <TextInput
            style={styles.modalInput}
            value={editYardage}
            onChangeText={setEditYardage}
            placeholder="e.g. 452"
            placeholderTextColor="#6b7280"
            keyboardType="numeric"
          />

          <Text style={styles.modalLabel}>Handicap Rank (1–18)</Text>
          <TextInput
            style={styles.modalInput}
            value={editHandicap}
            onChangeText={setEditHandicap}
            placeholder="e.g. 8"
            placeholderTextColor="#6b7280"
            keyboardType="numeric"
          />

          <Text style={styles.modalNote}>Saved for all players on this course</Text>

          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowEditHole(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalSave, savingHole && { opacity: 0.7 }]} onPress={handleSaveHole} disabled={savingHole}>
              {savingHole
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.modalSaveText}>Save</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function getRelLabel(strokes: number, par: number) {
  const d = strokes - par;
  if (d === -2) return "Eagle";
  if (d === -1) return "Birdie";
  if (d === 0)  return "Par";
  if (d === 1)  return "Bogey";
  if (d === 2)  return "Double";
  return `+${d}`;
}

function getScoreBubbleStyle(strokes: number, par: number) {
  const d = strokes - par;
  if (d <= -2) return { backgroundColor: "#fbbf24" };
  if (d === -1) return { backgroundColor: "#16a34a" };
  if (d === 0)  return { backgroundColor: "#374151" };
  if (d === 1)  return { backgroundColor: "#b45309" };
  return { backgroundColor: "#b91c1c" };
}

function getPillStyle(rel: number) {
  if (rel <= -1) return { backgroundColor: "#16a34a" };
  if (rel === 0) return { backgroundColor: "#374151" };
  if (rel === 1) return { backgroundColor: "#b45309" };
  return { backgroundColor: "#b91c1c" };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1c1a15" },
  center: { flex: 1, backgroundColor: "#1c1a15", alignItems: "center", justifyContent: "center" },
  errorText: { color: "#fff", fontSize: 16, marginBottom: 12 },
  link: { color: "#4ade80", fontSize: 15 },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: "#1d5a3c", gap: 12,
  },
  iconBtn: { padding: 6 },
  headerCenter: { flex: 1, alignItems: "center" },
  courseName: { fontSize: 16, fontWeight: "600", color: "#fff" },
  courseParText: { fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 1 },

  scoreBar: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#1d5a3c", paddingHorizontal: 24,
    paddingBottom: 14, gap: 20,
  },
  scoreItem: { alignItems: "center" },
  scoreLabel: { fontSize: 11, color: "rgba(255,255,255,0.6)" },
  scoreValue: { fontSize: 20, fontWeight: "700", color: "#fff" },
  scoreDivider: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.2)" },
  scoreToPar: { fontSize: 32, fontWeight: "800", marginLeft: "auto" },

  holeCard: { backgroundColor: "#155c37", padding: 20 },
  holeNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  navBtn: { padding: 8, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 10 },
  holeNumArea: { alignItems: "center" },
  holeLabel: { fontSize: 13, color: "rgba(255,255,255,0.6)" },
  holeNum: { fontSize: 52, fontWeight: "800", color: "#fff", lineHeight: 60 },
  holeStats: { flexDirection: "row", justifyContent: "space-around" },
  holeStat: { alignItems: "center" },
  holeStatLabel: { fontSize: 12, color: "rgba(255,255,255,0.6)" },
  holeStatValue: { fontSize: 22, fontWeight: "700", color: "#fff", marginTop: 2 },

  scoreInput: { backgroundColor: "#2a2822", margin: 16, borderRadius: 16, padding: 20 },
  inputLabel: { fontSize: 13, color: "#9ca3af", textAlign: "center", marginBottom: 12 },
  strokeRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20, marginBottom: 16 },
  strokeBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "#3f3c35", alignItems: "center", justifyContent: "center",
  },
  strokeBubble: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: "center", justifyContent: "center",
  },
  strokeNum: { fontSize: 40, fontWeight: "800", color: "#fff" },
  strokeRelLabel: { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: -4 },
  quickRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  quickBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: "#3f3c35", alignItems: "center",
  },
  quickBtnActive: { backgroundColor: "#1d5a3c" },
  quickBtnText: { color: "#9ca3af", fontWeight: "600", fontSize: 15 },

  puttRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  puttBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: "#3f3c35", alignItems: "center",
  },
  puttBtnActive: { backgroundColor: "#1d5a3c" },
  puttBtnText: { color: "#9ca3af", fontWeight: "600", fontSize: 15 },

  saveBtn: {
    backgroundColor: "#1d5a3c", borderRadius: 14,
    paddingVertical: 16, alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  pillScroll: { paddingHorizontal: 16, paddingVertical: 8 },
  pill: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "#2a2822", alignItems: "center", justifyContent: "center",
    marginRight: 6,
  },
  pillActive: { borderWidth: 2, borderColor: "#4ade80" },
  pillText: { color: "#fff", fontSize: 13, fontWeight: "600" },

  completeBtn: {
    margin: 16, backgroundColor: "#92400e",
    borderRadius: 14, paddingVertical: 16, alignItems: "center",
  },
  completeBtnText: { color: "#fbbf24", fontSize: 15, fontWeight: "700" },

  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  modalSheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#1c1a15", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },
  modalLabel: { fontSize: 13, color: "#9ca3af", marginBottom: 8, marginTop: 12 },
  parBtns: { flexDirection: "row", gap: 10 },
  parBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#2a2822", alignItems: "center" },
  parBtnActive: { backgroundColor: "#1d5a3c" },
  parBtnText: { fontSize: 18, fontWeight: "700", color: "#9ca3af" },
  modalInput: {
    backgroundColor: "#2a2822", borderRadius: 12,
    padding: 14, fontSize: 16, color: "#fff",
    borderWidth: 1, borderColor: "#3f3c35",
  },
  modalNote: { fontSize: 12, color: "#6b7280", marginTop: 12 },
  modalBtns: { flexDirection: "row", gap: 12, marginTop: 20 },
  modalCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: "#3f3c35", alignItems: "center",
  },
  modalCancelText: { color: "#9ca3af", fontWeight: "600" },
  modalSave: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#1d5a3c", alignItems: "center" },
  modalSaveText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
