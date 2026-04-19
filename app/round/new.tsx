import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, Flag, MapPin, ArrowLeft, Plus, X, ChevronRight, Loader2 } from "lucide-react-native";
import { coursesApi, roundsApi } from "@/lib/api";

export default function NewRoundScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [apiQuery, setApiQuery] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [tab, setTab] = useState<"my" | "search">("my");
  const [importing, setImporting] = useState<number | null>(null);

  // Debounce
  const handleSearch = (text: string) => {
    setSearch(text);
    clearTimeout((handleSearch as any)._t);
    (handleSearch as any)._t = setTimeout(() => setDebounced(text), 350);
  };

  const handleApiSearch = (text: string) => {
    setApiQuery(text);
    clearTimeout((handleApiSearch as any)._t);
    (handleApiSearch as any)._t = setTimeout(() => setApiDebounced(text), 400);
  };

  const [apiDebounced, setApiDebounced] = useState("");

  const { data: myCourses, isLoading: loadingMy } = useQuery({
    queryKey: ["courses", debounced],
    queryFn: () => coursesApi.list(debounced || undefined),
  });

  const { data: apiResults, isLoading: searching } = useQuery({
    queryKey: ["courses-search", apiDebounced],
    queryFn: () => coursesApi.search(apiDebounced),
    enabled: apiDebounced.length >= 2,
  });

  const { mutate: startRound, isPending: starting } = useMutation({
    mutationFn: () => roundsApi.create({ courseId: selected.id }),
    onSuccess: (data: any) => {
      const roundId = data.data?.id ?? data.id;
      router.replace(`/round/${roundId}`);
    },
    onError: () => Alert.alert("Error", "Failed to start round"),
  });

  const handleImport = async (course: any) => {
    setImporting(course.id);
    try {
      const res = await coursesApi.import(course.id);
      if (res.success) setSelected(res.data);
    } catch {
      Alert.alert("Error", "Failed to import course");
    } finally {
      setImporting(null);
    }
  };

  const courses = myCourses?.data ?? [];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color="#fff" size={22} />
        </TouchableOpacity>
        <Text style={styles.title}>New Round</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Selected course banner */}
      {selected && (
        <View style={styles.selectedBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.selectedName}>{selected.name}</Text>
            <Text style={styles.selectedSub}>
              {[selected.city, selected.state].filter(Boolean).join(", ")} · Par {selected.par}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setSelected(null)} style={styles.clearBtn}>
            <X color="#9ca3af" size={18} />
          </TouchableOpacity>
        </View>
      )}

      {/* Tab switcher */}
      <View style={styles.tabs}>
        {[{ id: "my", label: "My Courses" }, { id: "search", label: "Search Database" }].map((t) => (
          <TouchableOpacity
            key={t.id}
            onPress={() => setTab(t.id as any)}
            style={[styles.tab, tab === t.id && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* My courses tab */}
      {tab === "my" && (
        <>
          <View style={styles.searchBox}>
            <Search color="#9ca3af" size={18} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={handleSearch}
              placeholder="Search your courses..."
              placeholderTextColor="#6b7280"
            />
          </View>
          {loadingMy
            ? <ActivityIndicator color="#4ade80" style={{ marginTop: 40 }} />
            : (
              <FlatList
                data={courses}
                keyExtractor={(c) => c.id}
                contentContainerStyle={styles.list}
                renderItem={({ item: course }) => (
                  <TouchableOpacity
                    style={[styles.courseRow, selected?.id === course.id && styles.courseRowSelected]}
                    onPress={() => setSelected(course)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.courseIcon}>
                      <Flag color="#4ade80" size={20} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.courseName}>{course.name}</Text>
                      <Text style={styles.courseSub}>
                        {[course.city, course.state].filter(Boolean).join(", ")} · Par {course.par} · {course.numHoles} holes
                      </Text>
                    </View>
                    {selected?.id === course.id && (
                      <View style={styles.checkDot} />
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <Flag color="#3f3c35" size={40} />
                    <Text style={styles.emptyText}>No courses yet</Text>
                    <Text style={styles.emptySubText}>Search the database to import courses</Text>
                  </View>
                }
              />
            )
          }
        </>
      )}

      {/* Search database tab */}
      {tab === "search" && (
        <>
          <View style={styles.searchBox}>
            <Search color="#9ca3af" size={18} />
            <TextInput
              style={styles.searchInput}
              value={apiQuery}
              onChangeText={handleApiSearch}
              placeholder="Search 10,000+ courses..."
              placeholderTextColor="#6b7280"
              autoFocus
            />
            {searching && <ActivityIndicator color="#9ca3af" size="small" />}
          </View>
          <FlatList
            data={apiResults?.courses ?? []}
            keyExtractor={(c) => c.id.toString()}
            contentContainerStyle={styles.list}
            renderItem={({ item: course }) => {
              const tees = course.tees?.male ?? [];
              const tee = tees.find((t: any) => t.tee_name.toLowerCase() === "white") || tees[0];
              return (
                <View style={styles.courseRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.courseName}>{course.course_name || course.club_name}</Text>
                    <Text style={styles.courseSub}>
                      {course.location.city}, {course.location.state}
                      {tee ? ` · Par ${tee.par_total} · ${tee.number_of_holes} holes` : ""}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.importBtn, importing === course.id && { opacity: 0.6 }]}
                    onPress={() => handleImport(course)}
                    disabled={importing !== null}
                  >
                    {importing === course.id
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.importBtnText}>Import</Text>
                    }
                  </TouchableOpacity>
                </View>
              );
            }}
            ListEmptyComponent={
              apiDebounced.length < 2
                ? <Text style={styles.hint}>Type at least 2 characters to search</Text>
                : !searching
                  ? <Text style={styles.hint}>No courses found for "{apiDebounced}"</Text>
                  : null
            }
          />
        </>
      )}

      {/* Start button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.startBtn, (!selected || starting) && styles.startBtnDisabled]}
          onPress={() => startRound()}
          disabled={!selected || starting}
          activeOpacity={0.85}
        >
          {starting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.startBtnText}>
                {selected ? `Start Round at ${selected.name}` : "Select a Course"}
              </Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1c1a15" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, paddingBottom: 8 },
  backBtn: { padding: 6 },
  title: { fontSize: 20, fontWeight: "700", color: "#fff" },
  selectedBanner: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#0d2e1a", margin: 16, marginTop: 8,
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#1d5a3c",
  },
  selectedName: { fontSize: 14, fontWeight: "700", color: "#4ade80" },
  selectedSub: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  clearBtn: { padding: 4 },
  tabs: { flexDirection: "row", marginHorizontal: 16, marginBottom: 12, backgroundColor: "#2a2822", borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  tabActive: { backgroundColor: "#1d5a3c" },
  tabText: { fontSize: 13, color: "#9ca3af", fontWeight: "500" },
  tabTextActive: { color: "#fff" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginBottom: 8, backgroundColor: "#2a2822", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 15, color: "#fff" },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  courseRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#2a2822", borderRadius: 14, padding: 14, marginBottom: 8, gap: 12 },
  courseRowSelected: { borderWidth: 1.5, borderColor: "#4ade80" },
  courseIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#1d5a3c", alignItems: "center", justifyContent: "center" },
  courseName: { fontSize: 14, fontWeight: "600", color: "#fff" },
  courseSub: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  checkDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#4ade80" },
  importBtn: { backgroundColor: "#1d5a3c", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  importBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  empty: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#6b7280" },
  emptySubText: { fontSize: 13, color: "#4b5563" },
  hint: { textAlign: "center", color: "#6b7280", marginTop: 40, fontSize: 14 },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: "#1c1a15", borderTopWidth: 1, borderTopColor: "#2a2822" },
  startBtn: { backgroundColor: "#1d5a3c", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  startBtnDisabled: { opacity: 0.5 },
  startBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
