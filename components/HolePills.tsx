import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";

const PILL = 42;
const GAP = 6;
const PADDING = 16;

interface Props {
  holes: { id: string; holeNumber: number; par: number }[];
  currentHole: number;
  /** Strokes saved for a hole, or undefined if it hasn't been scored */
  strokesFor: (holeId: string) => number | undefined;
  onSelect: (holeNumber: number) => void;
}

function pillColor(diff: number) {
  if (diff <= -1) return "#16a34a";
  if (diff === 0) return "#374151";
  if (diff === 1) return "#b45309";
  return "#b91c1c";
}

// One pill per hole: the hole number until it's scored, then the score.
// The strip keeps the current hole in view as the round moves on.
export function HolePills({ holes, currentHole, strokesFor, onSelect }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!width) return;
    const index = holes.findIndex((h) => h.holeNumber === currentHole);
    if (index < 0) return;
    const center = PADDING + index * (PILL + GAP) + PILL / 2;
    scrollRef.current?.scrollTo({ x: Math.max(0, center - width / 2), animated: true });
  }, [currentHole, width, holes.length]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {holes.map((h) => {
        const strokes = strokesFor(h.id);
        const active = h.holeNumber === currentHole;
        return (
          <TouchableOpacity
            key={h.id}
            onPress={() => onSelect(h.holeNumber)}
            style={[
              styles.pill,
              strokes !== undefined && { backgroundColor: pillColor(strokes - h.par) },
              active && styles.active,
            ]}
            accessibilityLabel={
              strokes !== undefined
                ? `Hole ${h.holeNumber}, scored ${strokes}`
                : `Hole ${h.holeNumber}, not scored`
            }
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.text, strokes === undefined && styles.textUnscored]}>
              {strokes ?? h.holeNumber}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// The next hole without a score, looking forward from `from` and wrapping
// round to the start. null once every hole is scored.
export function nextUnscoredHole(
  holes: { id: string; holeNumber: number }[],
  from: number,
  isScored: (holeId: string) => boolean,
): number | null {
  const ordered = [...holes].sort((a, b) => a.holeNumber - b.holeNumber);
  const start = ordered.findIndex((h) => h.holeNumber === from);
  for (let i = 1; i <= ordered.length; i++) {
    const h = ordered[(start + i) % ordered.length];
    if (!isScored(h.id)) return h.holeNumber;
  }
  return null;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: PADDING, paddingVertical: 8, gap: GAP },
  pill: { width: PILL, height: PILL, borderRadius: PILL / 2, backgroundColor: "#2a2822", alignItems: "center", justifyContent: "center" },
  active: { borderWidth: 2, borderColor: "#4ade80" },
  text: { color: "#fff", fontSize: 13, fontWeight: "700" },
  textUnscored: { color: "#6b7280", fontWeight: "500" },
});
