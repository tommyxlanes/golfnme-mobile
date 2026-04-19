import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Flag, Users, Plus, Zap, ChevronRight, Play, History } from "lucide-react-native";
import { roundsApi, sessionsApi, statsApi } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PlayTab() {
  const router = useRouter();
  const { user } = useAuthStore();

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: () => statsApi.overview(),
  });

  const { data: inProgress } = useQuery({
    queryKey: ["rounds", "in-progress"],
    queryFn: () => roundsApi.list({ status: "IN_PROGRESS", limit: 1 }),
    refetchInterval: 10_000,
  });

  const { data: sessions, refetch: refetchSessions } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const [waiting, playing] = await Promise.all([
        sessionsApi.list("WAITING"),
        sessionsApi.list("IN_PROGRESS"),
      ]);
      return [...(playing.data ?? []), ...(waiting.data ?? [])];
    },
    refetchInterval: 5_000,
  });

  const inProgressRound = inProgress?.items?.[0] ?? null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              Hey, {user?.name?.split(" ")[0] ?? "Golfer"} 👋
            </Text>
            <Text style={styles.subtitle}>Ready to play?</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statNum}>{stats?.data?.totalRounds ?? 0}</Text>
            <Text style={styles.statLbl}>rounds</Text>
          </View>
        </View>

        {/* In-progress round banner */}
        {inProgressRound && (
          <TouchableOpacity
            style={styles.resumeBanner}
            onPress={() => router.push(`/round/${inProgressRound.id}`)}
            activeOpacity={0.85}
          >
            <View style={styles.pulseDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.resumeTitle}>Round in progress</Text>
              <Text style={styles.resumeSub}>
                {inProgressRound.course?.name} · {inProgressRound.scores?.length ?? 0} holes played
              </Text>
            </View>
            <ChevronRight color="#4ade80" size={20} />
          </TouchableOpacity>
        )}

        {/* Start Round */}
        <Text style={styles.sectionTitle}>Play</Text>
        <View style={styles.cardRow}>
          <TouchableOpacity
            style={[styles.playCard, { backgroundColor: "#1d5a3c" }]}
            onPress={() => router.push("/round/new")}
            activeOpacity={0.85}
          >
            <Flag color="#4ade80" size={28} />
            <Text style={styles.playCardTitle}>Solo Round</Text>
            <Text style={styles.playCardSub}>Track your scores</Text>
          </TouchableOpacity>

          <View style={[styles.playCard, { backgroundColor: "#2a2210" }]}>
            <Users color="#f59e0b" size={28} />
            <Text style={[styles.playCardTitle, { color: "#f59e0b" }]}>Group Play</Text>
            <View style={styles.groupBtns}>
              <TouchableOpacity
                style={styles.groupBtn}
                onPress={() => router.push("/session/new")}
              >
                <Plus color="#fff" size={14} />
                <Text style={styles.groupBtnText}>Create</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.groupBtn, { backgroundColor: "#3f3420" }]}
                onPress={() => router.push("/session/join")}
              >
                <Zap color="#f59e0b" size={14} />
                <Text style={styles.groupBtnText}>Join</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Active sessions */}
        {sessions && sessions.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Active Sessions</Text>
            {sessions.map((session: any) => (
              <TouchableOpacity
                key={session.id}
                style={styles.sessionCard}
                onPress={() => router.push(`/session/${session.inviteCode}`)}
                activeOpacity={0.85}
              >
                <View style={[styles.sessionDot, {
                  backgroundColor: session.status === "IN_PROGRESS" ? "#4ade80" : "#f59e0b"
                }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sessionName}>
                    {session.course?.name ?? "Golf Session"}
                  </Text>
                  <Text style={styles.sessionInfo}>
                    {session.members?.length ?? 1}/{session.maxPlayers} players ·{" "}
                    {session.status === "IN_PROGRESS" ? "Playing" : "Waiting"}
                  </Text>
                </View>
                <Text style={styles.sessionCode}>{session.inviteCode}</Text>
                <ChevronRight color="#6b7280" size={18} />
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Quick actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionList}>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push("/courses")}
          >
            <Flag color="#4ade80" size={20} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.actionTitle}>Browse Courses</Text>
              <Text style={styles.actionSub}>Find and add courses</Text>
            </View>
            <ChevronRight color="#6b7280" size={18} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push("/(tabs)/rounds")}
          >
            <History color="#4ade80" size={20} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.actionTitle}>Round History</Text>
              <Text style={styles.actionSub}>View all your rounds</Text>
            </View>
            <ChevronRight color="#6b7280" size={18} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1c1a15" },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  greeting: { fontSize: 24, fontWeight: "700", color: "#fff" },
  subtitle: { fontSize: 14, color: "#9ca3af", marginTop: 2 },
  statPill: {
    backgroundColor: "#2a2822", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, alignItems: "center",
  },
  statNum: { fontSize: 22, fontWeight: "700", color: "#4ade80" },
  statLbl: { fontSize: 11, color: "#9ca3af", marginTop: 1 },

  resumeBanner: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#0d2e1a", borderRadius: 14,
    borderWidth: 1, borderColor: "#1d5a3c",
    padding: 14, marginBottom: 24, gap: 12,
  },
  pulseDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#4ade80" },
  resumeTitle: { fontSize: 14, fontWeight: "600", color: "#4ade80" },
  resumeSub: { fontSize: 12, color: "#9ca3af", marginTop: 2 },

  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#d1d5db", marginBottom: 12, marginTop: 8 },

  cardRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  playCard: {
    flex: 1, borderRadius: 16, padding: 16,
    minHeight: 130, justifyContent: "space-between",
  },
  playCardTitle: { fontSize: 16, fontWeight: "700", color: "#fff", marginTop: 8 },
  playCardSub: { fontSize: 12, color: "rgba(255,255,255,0.6)" },
  groupBtns: { flexDirection: "row", gap: 6, marginTop: 8 },
  groupBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#f59e0b", borderRadius: 8, paddingVertical: 7, gap: 4,
  },
  groupBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },

  sessionCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#2a2822", borderRadius: 14,
    padding: 14, marginBottom: 8, gap: 10,
  },
  sessionDot: { width: 8, height: 8, borderRadius: 4 },
  sessionName: { fontSize: 14, fontWeight: "600", color: "#fff" },
  sessionInfo: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  sessionCode: { fontFamily: "monospace", fontSize: 12, color: "#6b7280", marginRight: 4 },

  actionList: { backgroundColor: "#2a2822", borderRadius: 14, overflow: "hidden" },
  actionRow: {
    flexDirection: "row", alignItems: "center",
    padding: 16, borderBottomWidth: 1, borderBottomColor: "#3f3c35",
  },
  actionTitle: { fontSize: 14, fontWeight: "600", color: "#fff" },
  actionSub: { fontSize: 12, color: "#9ca3af", marginTop: 1 },
});
