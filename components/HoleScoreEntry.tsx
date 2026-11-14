import { Minus, Plus } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";

// What gets recorded for one hole. Nothing here is ever guessed: a field the
// player didn't mark stays null and is left out of their stats.
export interface HoleScore {
  strokes: number;
  putts: number | null;
  fairwayHit: boolean | null;
  greenInReg: boolean | null;
  penalties: number;
}

interface Props {
  hole: { id: string; holeNumber: number; par: number };
  /** The score already saved for this hole, if any */
  saved?: HoleScore;
  saving: boolean;
  onSave: (score: HoleScore & { putts: number }) => void;
}

const MAX_STROKES = 15;
const PUTT_OPTIONS = [0, 1, 2, 3, 4, 5];

function relationLabel(strokes: number, par: number) {
  const d = strokes - par;
  if (strokes === 1) return "Hole in one";
  if (d <= -3) return "Albatross";
  if (d === -2) return "Eagle";
  if (d === -1) return "Birdie";
  if (d === 0) return "Par";
  if (d === 1) return "Bogey";
  if (d === 2) return "Double";
  return `+${d}`;
}

function relationColor(strokes: number, par: number) {
  const d = strokes - par;
  if (d <= -2) return "#b45309";
  if (d === -1) return "#16a34a";
  if (d === 0) return "#374151";
  if (d === 1) return "#92400e";
  return "#b91c1c";
}

// Yes / No pair where neither is selected until the player taps one.
// Tapping the selected option clears it again.
function Choice({
  value, onChange, yes, no,
}: {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  yes: string;
  no: string;
}) {
  return (
    <View style={styles.choiceRow}>
      {[
        { v: true, label: yes },
        { v: false, label: no },
      ].map((o) => {
        const active = value === o.v;
        return (
          <TouchableOpacity
            key={o.label}
            onPress={() => onChange(active ? null : o.v)}
            style={[styles.choiceBtn, active && (o.v ? styles.choiceYes : styles.choiceNo)]}
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.choiceText, active && styles.textOn]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Score entry for one hole. Mount it with key={hole.id} so each hole starts
// from its own saved score (or blank).
export function HoleScoreEntry({ hole, saved, saving, onSave }: Props) {
  const [strokes, setStrokes] = useState<number | null>(saved?.strokes ?? null);
  const [putts, setPutts] = useState<number | null>(saved?.putts ?? null);
  const [fairwayHit, setFairwayHit] = useState<boolean | null>(saved?.fairwayHit ?? null);
  const [greenInReg, setGreenInReg] = useState<boolean | null>(saved?.greenInReg ?? null);
  const [penalties, setPenalties] = useState(saved?.penalties ?? 0);

  // Quick picks around par; the stepper reaches everything else.
  const quick = [-2, -1, 0, 1, 2, 3].map((d) => hole.par + d).filter((n) => n >= 1);

  const chooseStrokes = (n: number) => {
    setStrokes(n);
    // You can't have more putts than strokes
    if (putts !== null && putts > n) setPutts(null);
  };

  const missing = [
    strokes === null ? "strokes" : null,
    putts === null ? "putts" : null,
  ].filter(Boolean);
  const canSave = missing.length === 0 && !saving;

  return (
    <View style={styles.card}>
      {/* Strokes */}
      <Text style={styles.label}>Strokes</Text>
      <View style={styles.strokeRow}>
        <TouchableOpacity
          style={[styles.stepBtn, (strokes === null || strokes <= 1) && styles.dim]}
          onPress={() => strokes !== null && chooseStrokes(Math.max(1, strokes - 1))}
          disabled={strokes === null || strokes <= 1}
          accessibilityLabel="One stroke fewer"
        >
          <Minus color="#fff" size={22} />
        </TouchableOpacity>

        <View
          style={[
            styles.bubble,
            strokes === null ? styles.bubbleEmpty : { backgroundColor: relationColor(strokes, hole.par) },
          ]}
        >
          <Text style={styles.bubbleNum}>{strokes ?? "–"}</Text>
          <Text style={styles.bubbleLabel}>
            {strokes === null ? "not scored" : relationLabel(strokes, hole.par)}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.stepBtn, (strokes === null || strokes >= MAX_STROKES) && styles.dim]}
          onPress={() => strokes !== null && chooseStrokes(Math.min(MAX_STROKES, strokes + 1))}
          disabled={strokes === null || strokes >= MAX_STROKES}
          accessibilityLabel="One stroke more"
        >
          <Plus color="#fff" size={22} />
        </TouchableOpacity>
      </View>

      <View style={styles.optionRow}>
        {quick.map((n) => (
          <TouchableOpacity
            key={n}
            onPress={() => chooseStrokes(n)}
            style={[styles.option, strokes === n && styles.optionOn]}
            accessibilityState={{ selected: strokes === n }}
          >
            <Text style={[styles.optionText, strokes === n && styles.textOn]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Putts — always marked by the player, never filled in for them */}
      <Text style={styles.label}>
        Putts <Text style={styles.required}>required</Text>
      </Text>
      <View style={styles.optionRow}>
        {PUTT_OPTIONS.map((p) => {
          const impossible = strokes !== null && p > strokes;
          return (
            <TouchableOpacity
              key={p}
              onPress={() => setPutts(p)}
              disabled={impossible}
              style={[styles.option, putts === p && styles.optionOn, impossible && styles.dim]}
              accessibilityState={{ selected: putts === p, disabled: impossible }}
            >
              <Text style={[styles.optionText, putts === p && styles.textOn]}>
                {p === 5 ? "5+" : p}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Fairway — par 3s have none */}
      {hole.par >= 4 && (
        <>
          <Text style={styles.label}>Fairway off the tee</Text>
          <Choice value={fairwayHit} onChange={setFairwayHit} yes="Hit" no="Missed" />
        </>
      )}

      <Text style={styles.label}>Green in regulation</Text>
      <Choice value={greenInReg} onChange={setGreenInReg} yes="Yes" no="No" />

      {/* Penalties */}
      <View style={styles.penaltyRow}>
        <Text style={styles.penaltyLabel}>Penalty strokes</Text>
        <TouchableOpacity
          style={[styles.smallStep, penalties === 0 && styles.dim]}
          onPress={() => setPenalties((p) => Math.max(0, p - 1))}
          disabled={penalties === 0}
          accessibilityLabel="One penalty fewer"
        >
          <Minus color="#fff" size={16} />
        </TouchableOpacity>
        <Text style={styles.penaltyValue}>{penalties}</Text>
        <TouchableOpacity
          style={styles.smallStep}
          onPress={() => setPenalties((p) => Math.min(9, p + 1))}
          accessibilityLabel="One penalty more"
        >
          <Plus color="#fff" size={16} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, !canSave && styles.saveBtnOff]}
        disabled={!canSave}
        onPress={() =>
          onSave({
            strokes: strokes!,
            putts: putts!,
            fairwayHit: hole.par >= 4 ? fairwayHit : null,
            greenInReg,
            penalties,
          })
        }
      >
        {saving ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.saveText}>
            {missing.length > 0
              ? `Choose ${missing.join(" and ")}`
              : saved
                ? `Update Hole ${hole.holeNumber}`
                : `Save Hole ${hole.holeNumber}`}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#2a2822", margin: 16, borderRadius: 16, padding: 20 },
  label: { fontSize: 13, color: "#9ca3af", marginBottom: 10, marginTop: 4 },
  required: { color: "#c9a227", fontSize: 11 },
  dim: { opacity: 0.3 },
  textOn: { color: "#fff" },

  strokeRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20, marginBottom: 16 },
  stepBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#3f3c35", alignItems: "center", justifyContent: "center" },
  bubble: { width: 104, height: 104, borderRadius: 52, alignItems: "center", justifyContent: "center" },
  bubbleEmpty: { backgroundColor: "#1c1a15", borderWidth: 2, borderColor: "#3f3c35", borderStyle: "dashed" },
  bubbleNum: { fontSize: 40, fontWeight: "800", color: "#fff" },
  bubbleLabel: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: -4 },

  optionRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  option: { flex: 1, minHeight: 46, borderRadius: 10, backgroundColor: "#3f3c35", alignItems: "center", justifyContent: "center" },
  optionOn: { backgroundColor: "#1d5a3c" },
  optionText: { color: "#9ca3af", fontWeight: "600", fontSize: 15 },

  choiceRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  choiceBtn: { flex: 1, minHeight: 46, borderRadius: 10, backgroundColor: "#3f3c35", alignItems: "center", justifyContent: "center" },
  choiceYes: { backgroundColor: "#1d5a3c" },
  choiceNo: { backgroundColor: "#7f1d1d" },
  choiceText: { color: "#9ca3af", fontWeight: "600", fontSize: 15 },

  penaltyRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  penaltyLabel: { flex: 1, fontSize: 13, color: "#9ca3af" },
  penaltyValue: { fontSize: 18, fontWeight: "700", color: "#fff", minWidth: 20, textAlign: "center" },
  smallStep: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#3f3c35", alignItems: "center", justifyContent: "center" },

  saveBtn: { backgroundColor: "#1d5a3c", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  saveBtnOff: { backgroundColor: "#3f3c35" },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
