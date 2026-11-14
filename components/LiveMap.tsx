import * as Location from "expo-location";
import { Crosshair, Flag, Minus, Plus, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Linking, Modal, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

interface LiveMapProps {
  visible: boolean;
  onClose: () => void;
  /** Course coordinates, when the course has them */
  courseLat?: number | null;
  courseLng?: number | null;
  courseName?: string;
}

type Point = { latitude: number; longitude: number };
type Fix = Point & { accuracy: number | null };

// Span of the map in degrees of latitude. 0.0025 is roughly 280 m top to
// bottom — about one hole.
const HOLE_ZOOM = 0.0025;
const MIN_DELTA = 0.0004; // ~45 m: as close as satellite imagery stays sharp
const MAX_DELTA = 0.2;
// Beyond this the player isn't on the course, so the map stays on the course
const ON_COURSE_YARDS = 3000;

// Great-circle distance in yards
function yardsBetween(a: Point, b: Point) {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h)) * 1.09361;
}

function formatDistance(yards: number) {
  if (yards < 1000) return `${Math.round(yards)} yd`;
  return `${(yards / 1760).toFixed(yards < 17600 ? 1 : 0)} mi`;
}

function accuracyColor(meters: number) {
  if (meters <= 10) return "#4ade80";
  if (meters <= 30) return "#f59e0b";
  return "#ef4444";
}

function regionAt(center: Point, delta: number): Region {
  return { ...center, latitudeDelta: delta, longitudeDelta: delta };
}

// Full-screen satellite map with the player's live position. Pinch or
// double-tap to zoom, or use the + / − buttons.
export function LiveMap({ visible, onClose, courseLat, courseLng, courseName }: LiveMapProps) {
  const mapRef = useRef<MapView>(null);
  const region = useRef<Region | null>(null);
  const centered = useRef(false);
  const [fix, setFix] = useState<Fix | null>(null);
  const [state, setState] = useState<"loading" | "live" | "denied" | "error">("loading");

  const course: Point | null =
    courseLat != null && courseLng != null
      ? { latitude: courseLat, longitude: courseLng }
      : null;

  // The view we last asked for. Applied again once the native map is ready,
  // because Google Maps doesn't reliably honour initialRegion's zoom.
  const wanted = useRef<Region | null>(null);
  const ready = useRef(false);

  const moveTo = (next: Region, duration = 350) => {
    wanted.current = next;
    region.current = next;
    if (ready.current) mapRef.current?.animateToRegion(next, duration);
  };

  const zoomBy = (factor: number) => {
    const current = region.current;
    if (!current) return;
    const delta = Math.min(MAX_DELTA, Math.max(MIN_DELTA, current.latitudeDelta * factor));
    moveTo(regionAt(current, delta));
  };

  // Track position only while the map is open
  useEffect(() => {
    if (!visible) return;
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;
    centered.current = false;
    ready.current = false;
    wanted.current = course ? regionAt(course, HOLE_ZOOM * 2) : null;
    region.current = wanted.current;
    setFix(null);
    setState("loading");

    (async () => {
      try {
        const { granted } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (!granted) {
          setState("denied");
          return;
        }
        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 2, timeInterval: 2000 },
          (pos) => {
            const next = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            };
            setFix(next);
            setState("live");
            if (!centered.current) {
              centered.current = true;
              // Start on the player at hole level — unless they're nowhere
              // near the course, in which case stay on the course.
              const onCourse = !course || yardsBetween(next, course) <= ON_COURSE_YARDS;
              if (onCourse) moveTo(regionAt(next, HOLE_ZOOM));
            }
          },
        );
        if (cancelled) subscription.remove();
      } catch {
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [visible]);

  const distance = fix && course ? yardsBetween(fix, course) : null;
  const offCourse = distance !== null && distance > ON_COURSE_YARDS;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          mapType="hybrid"
          showsUserLocation={state === "live"}
          showsMyLocationButton={false}
          showsCompass
          zoomEnabled
          zoomTapEnabled
          scrollEnabled
          rotateEnabled
          pitchEnabled={false}
          toolbarEnabled={false}
          initialRegion={course ? regionAt(course, HOLE_ZOOM * 2) : undefined}
          onMapReady={() => {
            ready.current = true;
            if (wanted.current) mapRef.current?.animateToRegion(wanted.current, 0);
          }}
          onRegionChangeComplete={(r) => {
            // Ignore the map's own starting view until ours has been applied
            if (ready.current) region.current = r;
          }}
        >
          {course && <Marker coordinate={course} title={courseName ?? "Course"} />}
        </MapView>

        <SafeAreaView style={styles.overlay} pointerEvents="box-none">
          <View style={styles.topRow} pointerEvents="box-none">
            <View style={styles.pill}>
              {state === "loading" && (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.pillText}>Finding you…</Text>
                </>
              )}
              {state === "live" && fix && (
                <>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: accuracyColor(fix.accuracy ?? 99) },
                    ]}
                  />
                  <Text style={styles.pillText} numberOfLines={1}>
                    {offCourse
                      ? `You're ${formatDistance(distance!)} from the course`
                      : [
                          fix.accuracy != null ? `±${Math.round(fix.accuracy)} m` : "Live",
                          distance !== null ? `${formatDistance(distance)} to course pin` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                  </Text>
                </>
              )}
              {state === "denied" && (
                <TouchableOpacity onPress={() => Linking.openSettings()}>
                  <Text style={styles.pillText}>Location is off — tap to open settings</Text>
                </TouchableOpacity>
              )}
              {state === "error" && <Text style={styles.pillText}>Couldn't get your location</Text>}
            </View>
            <TouchableOpacity style={styles.roundBtn} onPress={onClose} accessibilityLabel="Close map">
              <X color="#fff" size={22} />
            </TouchableOpacity>
          </View>

          <View style={styles.controls} pointerEvents="box-none">
            <TouchableOpacity style={styles.roundBtn} onPress={() => zoomBy(0.5)} accessibilityLabel="Zoom in">
              <Plus color="#fff" size={22} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.roundBtn} onPress={() => zoomBy(2)} accessibilityLabel="Zoom out">
              <Minus color="#fff" size={22} />
            </TouchableOpacity>
            {course && (
              <TouchableOpacity
                style={[styles.roundBtn, styles.spaced]}
                onPress={() => moveTo(regionAt(course, HOLE_ZOOM * 2))}
                accessibilityLabel="Go to the course"
              >
                <Flag color="#fff" size={20} />
              </TouchableOpacity>
            )}
            {fix && (
              <TouchableOpacity
                style={styles.roundBtn}
                onPress={() => moveTo(regionAt(fix, HOLE_ZOOM))}
                accessibilityLabel="Center on my position"
              >
                <Crosshair color="#fff" size={22} />
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1c1a15" },
  overlay: { flex: 1, justifyContent: "space-between", padding: 12 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  pill: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(28,26,21,0.85)", borderRadius: 22, paddingHorizontal: 14, minHeight: 44 },
  pillText: { color: "#fff", fontSize: 13, fontWeight: "600", flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  roundBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(28,26,21,0.85)", alignItems: "center", justifyContent: "center" },
  controls: { alignSelf: "flex-end", gap: 8 },
  spaced: { marginTop: 10 },
});
