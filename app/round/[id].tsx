import { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Modal,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, ChevronRight, ArrowLeft, Menu, X, Pencil, Flag,
  Map as MapIcon, Trash2,
} from "lucide-react-native";
import { roundsApi, scoresApi, coursesApi } from "@/lib/api";
import { LiveMap } from "@/components/LiveMap";
import { HoleScoreEntry, type HoleScore } from "@/components/HoleScoreEntry";
import { HolePills, nextUnscoredHole } from "@/components/HolePills";

export default function ActiveRoundScreen() {
  const { id: roundId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [currentHole, setCurrentHole] = useState(1);
  // Saved score per hole id
  const [scores, setScores] = useState<Record<string, HoleScore>>({});
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [notes, setNotes] = useState("");
  const [showEditHole, setShowEditHole] = useState(false);
  const [editPar, setEditPar] = useState(4);
  const [editYardage, setEditYardage] = useState("");
  const [editHandicap, setEditHandicap] = useState("");
  const [savingHole, setSavingHole] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["round", roundId],
    queryFn: () => roundsApi.get(roundId),
  });

  const round = data?.data;
  const course = round?.course;
  const holes: any[] = [...(course?.holes ?? [])].sort(
    (a: any, b: any) => a.holeNumber - b.holeNumber,
  );
  const hole = holes.find((h: any) => h.holeNumber === currentHole);

  // Load what's already been scored and pick up where the round left off
  useEffect(() => {
    if (!round) return;

    // A finished round has nothing left to enter
    if (round.status !== "IN_PROGRESS") {
      router.replace(`/round/${roundId}/summary` as any);
      return;
    }

    const loaded: Record<string, HoleScore> = {};
    (round.scores ?? []).forEach((s: any) => {
      loaded[s.holeId ?? s.hole?.id] = {
        strokes: s.strokes,
        putts: s.putts ?? null,
        fairwayHit: s.fairwayHit ?? null,
        greenInReg: s.greenInReg ?? null,
        penalties: s.penalties ?? 0,
      };
    });
    setScores(loaded);
    setNotes(round.notes ?? "");

    const firstUnscored = holes.find((h: any) => !loaded[h.id]);
    setCurrentHole(firstUnscored?.holeNumber ?? holes[holes.length - 1]?.holeNumber ?? 1);
  }, [round?.id, round?.status]);

  const handleSaveScore = async (score: HoleScore & { putts: number }) => {
    if (!hole) return;
    setSaving(true);
    try {
      await scoresApi.save({
        roundId,
        holeId: hole.id,
        holeNumber: hole.holeNumber,
        strokes: score.strokes,
        putts: score.putts,
        fairwayHit: score.fairwayHit ?? undefined,
        greenInReg: score.greenInReg ?? undefined,
        penalties: score.penalties,
      });
      const updated: Record<string, HoleScore> = { ...scores, [hole.id]: score };
      setScores(updated);
      qc.invalidateQueries({ queryKey: ["rounds"] });

      // Move on to the next hole that still needs a score
      const next = nextUnscoredHole(holes, hole.holeNumber, (id) => !!updated[id]);
      if (next !== null) setCurrentHole(next);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save score");
    } finally {
      setSaving(false);
    }
  };

  const finishRound = async () => {
    setBusy(true);
    try {
      await roundsApi.update(roundId, { status: "COMPLETED" });
      qc.invalidateQueries({ queryKey: ["rounds"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["round", roundId] });
      setShowMenu(false);
      router.replace(`/round/${roundId}/summary` as any);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to complete round");
    } finally {
      setBusy(false);
    }
  };

  const handleFinish = () => {
    const left = holes.length - playedHoles;
    if (left === 0) return finishRound();
    Alert.alert(
      "Finish round?",
      `${left} hole${left === 1 ? " has" : "s have"} no score yet. The round will be saved with the ${playedHoles} you've played.`,
      [
        { text: "Keep Playing", style: "cancel" },
        { text: "Finish", onPress: finishRound },
      ],
    );
  };

  const handleAbandon = () => {
    Alert.alert(
      "Abandon round?",
      "The round is kept in your history as abandoned and won't count toward your stats.",
      [
        { text: "Keep Playing", style: "cancel" },
        {
          text: "Abandon",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await roundsApi.update(roundId, { status: "ABANDONED" });
              qc.invalidateQueries({ queryKey: ["rounds"] });
              qc.invalidateQueries({ queryKey: ["round", roundId] });
              setShowMenu(false);
              router.replace("/(tabs)");
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to abandon round");
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const handleSaveNotes = async () => {
    setBusy(true);
    try {
      await roundsApi.update(roundId, { notes });
      setShowMenu(false);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save notes");
    } finally {
      setBusy(false);
    }
  };

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
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update hole");
    } finally {
      setSavingHole(false);
    }
  };

  const played = holes.filter((h: any) => scores[h.id]);
  const playedHoles = played.length;
  const allPlayed = holes.length > 0 && playedHoles === holes.length;
  const totalScore = played.reduce((sum: number, h: any) => sum + scores[h.id].strokes, 0);
  const parThrough = played.reduce((sum: number, h: any) => sum + h.par, 0);
  const scoreToPar = totalScore - parThrough;
  const totalPutts = played.reduce((sum: number, h: any) => sum + (scores[h.id].putts ?? 0), 0);

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

  const holeIndex = holes.findIndex((h: any) => h.holeNumber === currentHole);

  return (
    <SafeAreaView style={styles.safe}>
      <LiveMap
        visible={showMap}
        onClose={() => setShowMap(false)}
        courseLat={course.latitude}
        courseLng={course.longitude}
        courseName={course.name}
      />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push("/(tabs)")} style={styles.iconBtn} accessibilityLabel="Back to home">
          <ArrowLeft color="#fff" size={22} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.courseName} numberOfLines={1}>{course.name}</Text>
          <Text style={styles.courseParText}>Par {course.par}</Text>
        </View>

        <TouchableOpacity onPress={() => setShowMap(true)} style={styles.iconBtn} accessibilityLabel="Course map">
          <MapIcon color="#fff" size={20} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowMenu(true)} style={styles.iconBtn} accessibilityLabel="Round menu">
          <Menu color="#fff" size={22} />
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
          <Text style={styles.scoreValue}>{playedHoles ? totalScore : "—"}</Text>
        </View>
        <View style={styles.scoreDivider} />
        <View style={styles.scoreItem}>
          <Text style={styles.scoreLabel}>Putts</Text>
          <Text style={styles.scoreValue}>{playedHoles ? totalPutts : "—"}</Text>
        </View>
        <Text style={[styles.scoreToPar, { color: scoreToPar <= 0 ? "#fbbf24" : "#fff" }]}>
          {playedHoles > 0
            ? scoreToPar === 0 ? "E" : scoreToPar > 0 ? `+${scoreToPar}` : `${scoreToPar}`
            : "E"
          }
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Hole card */}
        <View style={styles.holeCard}>
          <View style={styles.holeNav}>
            <TouchableOpacity
              onPress={() => holeIndex > 0 && setCurrentHole(holes[holeIndex - 1].holeNumber)}
              disabled={holeIndex <= 0}
              style={[styles.navBtn, holeIndex <= 0 && { opacity: 0.3 }]}
              accessibilityLabel="Previous hole"
            >
              <ChevronLeft color="#fff" size={22} />
            </TouchableOpacity>
            <View style={styles.holeNumArea}>
              <Text style={styles.holeLabel}>Hole</Text>
              <Text style={styles.holeNum}>{currentHole}</Text>
            </View>
            <TouchableOpacity
              onPress={() => holeIndex < holes.length - 1 && setCurrentHole(holes[holeIndex + 1].holeNumber)}
              disabled={holeIndex >= holes.length - 1}
              style={[styles.navBtn, holeIndex >= holes.length - 1 && { opacity: 0.3 }]}
              accessibilityLabel="Next hole"
            >
              <ChevronRight color="#fff" size={22} />
            </TouchableOpacity>
          </View>

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
            <TouchableOpacity
              onPress={() => {
                setEditPar(hole.par);
                setEditYardage(hole.yardage?.toString() ?? "");
                setEditHandicap(hole.handicapRank?.toString() ?? "");
                setShowEditHole(true);
              }}
              style={styles.editHoleBtn}
              accessibilityLabel="Edit this hole's par and yardage"
            >
              <Pencil color="#fff" size={16} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Hole strip — follows the current hole */}
        <HolePills
          holes={holes}
          currentHole={currentHole}
          strokesFor={(id) => scores[id]?.strokes}
          onSelect={setCurrentHole}
        />

        {/* Score entry: keyed by hole so each one starts from its own score */}
        <HoleScoreEntry
          key={hole.id}
          hole={hole}
          saved={scores[hole.id]}
          saving={saving}
          onSave={handleSaveScore}
        />

        {allPlayed && (
          <TouchableOpacity style={styles.completeBtn} onPress={handleFinish} disabled={busy}>
            <Text style={styles.completeBtnText}>Finish Round — View Summary</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Round menu */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMenu(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Round</Text>
            <TouchableOpacity onPress={() => setShowMenu(false)} accessibilityLabel="Close menu">
              <X color="#9ca3af" size={22} />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalLabel}>Notes</Text>
          <TextInput
            style={[styles.modalInput, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Conditions, what worked, what didn't…"
            placeholderTextColor="#6b7280"
            multiline
          />
          <TouchableOpacity
            style={[styles.menuBtn, busy && { opacity: 0.6 }]}
            onPress={handleSaveNotes}
            disabled={busy}
          >
            <Text style={styles.menuBtnText}>Save Notes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuBtn, styles.menuBtnPrimary, (busy || playedHoles === 0) && { opacity: 0.5 }]}
            onPress={handleFinish}
            disabled={busy || playedHoles === 0}
          >
            <Flag color="#fbbf24" size={18} />
            <Text style={[styles.menuBtnText, { color: "#fbbf24" }]}>
              Finish Round{allPlayed ? "" : ` (${playedHoles}/${holes.length} holes)`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuDanger} onPress={handleAbandon} disabled={busy}>
            <Trash2 color="#ef4444" size={16} />
            <Text style={styles.menuDangerText}>Abandon Round</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Edit hole modal */}
      <Modal visible={showEditHole} transparent animationType="fade" onRequestClose={() => setShowEditHole(false)}>
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
    paddingBottom: 14, gap: 16,
  },
  scoreItem: { alignItems: "center" },
  scoreLabel: { fontSize: 11, color: "rgba(255,255,255,0.6)" },
  scoreValue: { fontSize: 20, fontWeight: "700", color: "#fff" },
  scoreDivider: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.2)" },
  scoreToPar: { fontSize: 32, fontWeight: "800", marginLeft: "auto" },

  holeCard: { backgroundColor: "#155c37", padding: 20 },
  holeNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  navBtn: { padding: 10, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 10 },
  holeNumArea: { alignItems: "center" },
  holeLabel: { fontSize: 13, color: "rgba(255,255,255,0.6)" },
  holeNum: { fontSize: 52, fontWeight: "800", color: "#fff", lineHeight: 60 },
  holeStats: { flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
  holeStat: { alignItems: "center" },
  holeStatLabel: { fontSize: 12, color: "rgba(255,255,255,0.6)" },
  holeStatValue: { fontSize: 22, fontWeight: "700", color: "#fff", marginTop: 2 },
  editHoleBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },

  completeBtn: {
    marginHorizontal: 16, marginBottom: 24, backgroundColor: "#92400e",
    borderRadius: 14, paddingVertical: 16, alignItems: "center",
  },
  completeBtnText: { color: "#fbbf24", fontSize: 15, fontWeight: "700" },

  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  modalSheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#1c1a15", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
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
  notesInput: { minHeight: 84, textAlignVertical: "top" },
  modalNote: { fontSize: 12, color: "#6b7280", marginTop: 12 },
  modalBtns: { flexDirection: "row", gap: 12, marginTop: 20 },
  modalCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: "#3f3c35", alignItems: "center",
  },
  modalCancelText: { color: "#9ca3af", fontWeight: "600" },
  modalSave: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#1d5a3c", alignItems: "center" },
  modalSaveText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  menuBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 14, borderRadius: 12, backgroundColor: "#2a2822", marginTop: 12,
  },
  menuBtnPrimary: { backgroundColor: "#92400e", marginTop: 20 },
  menuBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  menuDanger: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, marginTop: 4 },
  menuDangerText: { color: "#ef4444", fontWeight: "600", fontSize: 14 },
});
