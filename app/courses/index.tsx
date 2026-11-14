import { coursesApi, roundsApi, sessionsApi } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ArrowLeft, Flag, MapPin, Play, Search, Users, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value.trim()), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function locationOf(course: any) {
  return [course.city, course.state].filter(Boolean).join(", ");
}

export default function CoursesScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  const [tab, setTab] = useState<"my" | "search">("my");
  const [search, setSearch] = useState("");
  const [apiQuery, setApiQuery] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [importing, setImporting] = useState<number | string | null>(null);
  const [starting, setStarting] = useState<"solo" | "group" | null>(null);

  const debounced = useDebounced(search, 350);
  const apiDebounced = useDebounced(apiQuery, 400);

  const { data: myCourses, isLoading: loadingMy, isError: myError, refetch } = useQuery({
    queryKey: ["courses", debounced],
    queryFn: () => coursesApi.list(debounced || undefined),
  });

  const { data: apiResults, isFetching: searching, isError: searchError } = useQuery({
    queryKey: ["courses-search", apiDebounced],
    queryFn: () => coursesApi.search(apiDebounced),
    enabled: apiDebounced.length >= 2,
  });

  const courses = myCourses?.data ?? [];

  // Import from the course database, then open it like any saved course
  const handleImport = async (course: any) => {
    setImporting(course.id);
    try {
      const res = await coursesApi.import(course.id);
      qc.invalidateQueries({ queryKey: ["courses"] });
      setTab("my");
      setSelected(res.data);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to import course");
    } finally {
      setImporting(null);
    }
  };

  const handlePlaySolo = async () => {
    if (!selected) return;
    setStarting("solo");
    try {
      const res = await roundsApi.create({ courseId: selected.id });
      qc.invalidateQueries({ queryKey: ["rounds"] });
      setSelected(null);
      router.replace(`/round/${res.data.id}`);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to start round");
    } finally {
      setStarting(null);
    }
  };

  const handleGroupSession = async () => {
    if (!selected) return;
    setStarting("group");
    try {
      const res = await sessionsApi.create({ courseId: selected.id });
      qc.invalidateQueries({ queryKey: ["sessions"] });
      setSelected(null);
      router.replace(`/session/${res.data.inviteCode}`);
    } catch (err: any) {
      // e.g. "You already have an active session"
      Alert.alert("Can't create session", err.message || "Failed to create session");
    } finally {
      setStarting(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color="#fff" size={22} />
        </TouchableOpacity>
        <Text style={styles.title}>Courses</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.tabs}>
        {([
          { id: "my", label: "Saved Courses" },
          { id: "search", label: "Search Database" },
        ] as const).map((t) => (
          <TouchableOpacity
            key={t.id}
            onPress={() => setTab(t.id)}
            style={[styles.tab, tab === t.id && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Saved courses */}
      {tab === "my" && (
        <>
          <View style={styles.searchBox}>
            <Search color="#9ca3af" size={18} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search saved courses..."
              placeholderTextColor="#6b7280"
              autoCorrect={false}
            />
          </View>
          {loadingMy ? (
            <ActivityIndicator color="#4ade80" style={{ marginTop: 40 }} />
          ) : myError ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Couldn't load courses</Text>
              <TouchableOpacity onPress={() => refetch()}>
                <Text style={styles.link}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={courses}
              keyExtractor={(c: any) => c.id}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item: course }) => (
                <TouchableOpacity
                  style={styles.courseRow}
                  onPress={() => setSelected(course)}
                  activeOpacity={0.8}
                >
                  <View style={styles.courseIcon}>
                    <Flag color="#4ade80" size={20} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.courseName} numberOfLines={1}>{course.name}</Text>
                    <Text style={styles.courseSub} numberOfLines={1}>
                      {[locationOf(course), `Par ${course.par}`, `${course.numHoles} holes`]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Flag color="#3f3c35" size={40} />
                  <Text style={styles.emptyText}>
                    {debounced ? `No saved courses match "${debounced}"` : "No courses yet"}
                  </Text>
                  <TouchableOpacity onPress={() => setTab("search")}>
                    <Text style={styles.link}>Search the course database</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          )}
        </>
      )}

      {/* Course database */}
      {tab === "search" && (
        <>
          <View style={styles.searchBox}>
            <Search color="#9ca3af" size={18} />
            <TextInput
              style={styles.searchInput}
              value={apiQuery}
              onChangeText={setApiQuery}
              placeholder="Course or club name..."
              placeholderTextColor="#6b7280"
              autoCorrect={false}
              autoFocus
            />
            {searching && <ActivityIndicator color="#9ca3af" size="small" />}
          </View>
          <FlatList
            data={apiDebounced.length >= 2 ? (apiResults?.courses ?? []) : []}
            keyExtractor={(c: any) => c.id.toString()}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: course }) => {
              const tees = course.tees?.male ?? [];
              const tee =
                tees.find((t: any) => t.tee_name?.toLowerCase() === "white") || tees[0];
              return (
                <View style={styles.courseRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.courseName} numberOfLines={1}>
                      {course.course_name || course.club_name}
                    </Text>
                    <Text style={styles.courseSub} numberOfLines={1}>
                      {[
                        [course.location?.city, course.location?.state].filter(Boolean).join(", "),
                        tee ? `Par ${tee.par_total}` : null,
                        tee ? `${tee.number_of_holes} holes` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.importBtn, importing !== null && { opacity: 0.6 }]}
                    onPress={() => handleImport(course)}
                    disabled={importing !== null}
                  >
                    {importing === course.id ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.importBtnText}>Add</Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.hint}>
                {apiDebounced.length < 2
                  ? "Type at least 2 characters to search"
                  : searchError
                    ? "Course search is unavailable right now"
                    : searching
                      ? ""
                      : `No courses found for "${apiDebounced}"`}
              </Text>
            }
          />
        </>
      )}

      {/* Course sheet */}
      <Modal
        visible={!!selected}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.overlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setSelected(null)} />
          {selected && (
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>{selected.name}</Text>
                  {!!locationOf(selected) && (
                    <View style={styles.locRow}>
                      <MapPin color="#9ca3af" size={13} />
                      <Text style={styles.sheetSub}>{locationOf(selected)}</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={() => setSelected(null)} style={styles.closeBtn}>
                  <X color="#9ca3af" size={22} />
                </TouchableOpacity>
              </View>

              <View style={styles.factRow}>
                {[
                  { label: "Par", value: selected.par },
                  { label: "Holes", value: selected.numHoles },
                  { label: "Rating", value: selected.rating ?? "—" },
                  { label: "Slope", value: selected.slope ?? "—" },
                ].map((f) => (
                  <View key={f.label} style={styles.fact}>
                    <Text style={styles.factValue}>{f.value}</Text>
                    <Text style={styles.factLabel}>{f.label}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, starting !== null && { opacity: 0.6 }]}
                onPress={handlePlaySolo}
                disabled={starting !== null}
              >
                {starting === "solo" ? (
                  <ActivityIndicator color="#1c1a15" size="small" />
                ) : (
                  <>
                    <Play color="#1c1a15" size={18} />
                    <Text style={styles.primaryBtnText}>Play a Solo Round</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryBtn, starting !== null && { opacity: 0.6 }]}
                onPress={handleGroupSession}
                disabled={starting !== null}
              >
                {starting === "group" ? (
                  <ActivityIndicator color="#4ade80" size="small" />
                ) : (
                  <>
                    <Users color="#4ade80" size={18} />
                    <Text style={styles.secondaryBtnText}>Start a Group Session</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1c1a15" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 },
  backBtn: { padding: 8 },
  title: { fontSize: 18, fontWeight: "700", color: "#fff" },

  tabs: { flexDirection: "row", marginHorizontal: 16, backgroundColor: "#2a2822", borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center" },
  tabActive: { backgroundColor: "#1d5a3c" },
  tabText: { color: "#9ca3af", fontSize: 13, fontWeight: "600" },
  tabTextActive: { color: "#fff" },

  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#2a2822", borderRadius: 12, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 14 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: "#fff" },

  list: { padding: 16, gap: 8, flexGrow: 1 },
  courseRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#2a2822", borderRadius: 14, padding: 14 },
  courseIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#0d2e1a", alignItems: "center", justifyContent: "center" },
  courseName: { fontSize: 15, fontWeight: "600", color: "#fff" },
  courseSub: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  importBtn: { backgroundColor: "#1d5a3c", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9, minWidth: 60, alignItems: "center" },
  importBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },

  empty: { alignItems: "center", gap: 10, marginTop: 60, paddingHorizontal: 24 },
  emptyText: { color: "#d1d5db", fontSize: 15, textAlign: "center" },
  link: { color: "#4ade80", fontSize: 14, fontWeight: "600" },
  hint: { color: "#6b7280", fontSize: 14, textAlign: "center", marginTop: 40 },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { backgroundColor: "#1c1a15", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, gap: 14 },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  sheetTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },
  locRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  sheetSub: { fontSize: 13, color: "#9ca3af" },
  closeBtn: { padding: 4 },
  factRow: { flexDirection: "row", backgroundColor: "#2a2822", borderRadius: 14, paddingVertical: 14 },
  fact: { flex: 1, alignItems: "center" },
  factValue: { fontSize: 18, fontWeight: "700", color: "#fff" },
  factLabel: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  primaryBtn: { backgroundColor: "#c9a227", borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryBtnText: { color: "#1c1a15", fontWeight: "700", fontSize: 16 },
  secondaryBtn: { backgroundColor: "#2a2822", borderRadius: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderColor: "#1d5a3c" },
  secondaryBtnText: { color: "#4ade80", fontWeight: "600", fontSize: 15 },
});
