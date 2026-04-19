import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Flag, ChevronRight, Users } from "lucide-react-native";
import { coursesApi, sessionsApi } from "@/lib/api";

export default function NewSessionScreen() {
  const router = useRouter();
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [maxPlayers, setMaxPlayers] = useState(4);

  const { data } = useQuery({ queryKey: ["courses"], queryFn: () => coursesApi.list() });
  const courses = data?.data ?? [];

  const { mutate: create, isPending } = useMutation({
    mutationFn: () => sessionsApi.create({ courseId: selectedCourse.id, maxPlayers }),
    onSuccess: (res: any) => {
      const code = res.data?.inviteCode ?? res.inviteCode;
      router.replace(`/session/${code}`);
    },
    onError: () => Alert.alert("Error", "Failed to create session"),
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color="#fff" size={22} />
        </TouchableOpacity>
        <Text style={styles.title}>Create Session</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionLabel}>Select Course</Text>
        <View style={styles.courseList}>
          {courses.slice(0, 6).map((c: any) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.courseRow, selectedCourse?.id === c.id && styles.courseRowSelected]}
              onPress={() => setSelectedCourse(c)}
            >
              <Flag color={selectedCourse?.id === c.id ? "#4ade80" : "#9ca3af"} size={18} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.courseName}>{c.name}</Text>
                <Text style={styles.courseSub}>Par {c.par} · {c.numHoles} holes</Text>
              </View>
              {selectedCourse?.id === c.id && <View style={styles.checkDot} />}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Max Players</Text>
        <View style={styles.playerRow}>
          {[2, 3, 4, 6, 8].map((n) => (
            <TouchableOpacity
              key={n}
              onPress={() => setMaxPlayers(n)}
              style={[styles.playerBtn, maxPlayers === n && styles.playerBtnActive]}
            >
              <Users color={maxPlayers === n ? "#fff" : "#9ca3af"} size={16} />
              <Text style={[styles.playerBtnText, maxPlayers === n && { color: "#fff" }]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.createBtn, (!selectedCourse || isPending) && styles.createBtnDisabled]}
          onPress={() => create()}
          disabled={!selectedCourse || isPending}
        >
          {isPending ? <ActivityIndicator color="#1c1a15" /> : <Text style={styles.createBtnText}>Create Session</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1c1a15" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
  backBtn: { padding: 6 },
  title: { fontSize: 20, fontWeight: "700", color: "#fff" },
  content: { flex: 1, padding: 20 },
  sectionLabel: { fontSize: 13, fontWeight: "600", color: "#9ca3af", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  courseList: { backgroundColor: "#2a2822", borderRadius: 14, overflow: "hidden", marginBottom: 24 },
  courseRow: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: "#3f3c35" },
  courseRowSelected: { backgroundColor: "#0d2e1a" },
  courseName: { fontSize: 14, fontWeight: "600", color: "#fff" },
  courseSub: { fontSize: 12, color: "#9ca3af", marginTop: 1 },
  checkDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#4ade80" },
  playerRow: { flexDirection: "row", gap: 8 },
  playerBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: "#2a2822", borderRadius: 10, paddingVertical: 12 },
  playerBtnActive: { backgroundColor: "#1d5a3c" },
  playerBtnText: { color: "#9ca3af", fontWeight: "600" },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: "#2a2822" },
  createBtn: { backgroundColor: "#c9a227", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  createBtnDisabled: { opacity: 0.5 },
  createBtnText: { color: "#1c1a15", fontSize: 16, fontWeight: "700" },
});
