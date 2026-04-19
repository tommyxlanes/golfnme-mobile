import { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, TextInput, ActivityIndicator, Alert, Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Trophy, Crown, Users, MessageCircle,
  Send, X, Copy, Check, Play, ChevronRight, Minus, Plus, Flag,
} from "lucide-react-native";
import { sessionsApi, scoresApi } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { getAblyClient } from "@/lib/ably-rn";

export default function SessionScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const [status, setStatus] = useState<"lobby" | "playing">("lobby");
  const [players, setPlayers] = useState<any[]>([]);
  const [myRoundId, setMyRoundId] = useState<string | null>(null);
  const [myScores, setMyScores] = useState<number[]>(Array(18).fill(0));
  const [currentHole, setCurrentHole] = useState(1);
  const [strokes, setStrokes] = useState(4);
  const [putts, setPutts] = useState<number | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [readyLoading, setReadyLoading] = useState(false);
  const [startLoading, setStartLoading] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["session", code],
    queryFn: () => sessionsApi.get(code),
    refetchInterval: status === "lobby" ? 3000 : false,
  });

  const session = data?.data;
  const course = session?.course;
  const holes = course?.holes ?? Array.from({ length: 18 }, (_, i) => ({ id: `h${i+1}`, holeNumber: i+1, par: 4 }));
  const hole = holes[currentHole - 1];
  const isHost = session?.hostId === user?.id;
  const myMember = session?.members?.find((m: any) => m.userId === user?.id);
  const isMeReady = !!myMember?.isReady;

  // Load session data
  useEffect(() => {
    if (!session) return;
    setStatus(session.status === "WAITING" ? "lobby" : "playing");

    if (session.status === "IN_PROGRESS" && session.rounds) {
      const myRound = session.rounds.find((r: any) => r.userId === user?.id);
      if (myRound) {
        setMyRoundId(myRound.id);
        const loaded = Array(18).fill(0);
        myRound.scores?.forEach((s: any) => {
          const h = holes.find((h: any) => h.id === s.holeId);
          if (h) loaded[h.holeNumber - 1] = s.strokes;
        });
        setMyScores(loaded);
        const firstUnplayed = loaded.findIndex((s) => s === 0);
        if (firstUnplayed !== -1) setCurrentHole(firstUnplayed + 1);
      }

      // Build leaderboard
      const entries = session.rounds.map((round: any) => {
        const scores = Array(18).fill(0);
        round.scores?.forEach((s: any) => {
          const h = holes.find((h: any) => h.id === s.holeId);
          if (h) scores[h.holeNumber - 1] = s.strokes;
        });
        const total = scores.reduce((a: number, b: number) => a + b, 0);
        const played = scores.filter((s: number) => s > 0).length;
        const par = holes.slice(0, played).reduce((a: number, h: any) => a + h.par, 0);
        return {
          userId: round.userId,
          userName: round.user?.name || round.user?.username || "Player",
          totalScore: total, scoreToPar: par ? total - par : 0,
          holesPlayed: played, scores,
        };
      });
      entries.sort((a: any, b: any) => {
        if (!a.totalScore) return 1;
        if (!b.totalScore) return -1;
        return a.scoreToPar - b.scoreToPar;
      });
      setPlayers(entries);
    }
  }, [session?.id, session?.status]);

  // Ably leaderboard subscription
  useEffect(() => {
    if (status !== "playing" || !session?.id) return;
    try {
      const ably = getAblyClient();
      const channel = ably.channels.get(`session:${session.id}:leaderboard`);
      channel.subscribe("update", (msg: any) => {
        const entries = msg.data;
        if (!Array.isArray(entries)) return;
        setPlayers((prev) => entries.map((e: any) => ({
          userId: e.userId,
          userName: e.playerName ?? e.userName ?? "Player",
          totalScore: e.totalScore ?? 0,
          scoreToPar: e.relativeToPar ?? 0,
          holesPlayed: e.holesPlayed ?? 0,
          scores: prev.find((p) => p.userId === e.userId)?.scores ?? Array(18).fill(0),
        })));
      });
      return () => { channel.unsubscribe(); };
    } catch { /* Ably optional */ }
  }, [status, session?.id]);

  // Load chat
  useEffect(() => {
    if (!session?.id) return;
    sessionsApi.chat(session.id).then((d) => {
      setChatMessages(d.data ?? []);
    });
  }, [session?.id]);

  useEffect(() => {
    if (!hole) return;
    setStrokes(myScores[currentHole - 1] || hole.par || 4);
    setPutts(undefined);
  }, [currentHole]);

  const handleReady = async () => {
    if (!session) return;
    setReadyLoading(true);
    try {
      await sessionsApi.action({ sessionId: session.id, action: isMeReady ? "unready" : "ready" });
      refetch();
    } finally { setReadyLoading(false); }
  };

  const handleStart = async () => {
    if (!session) return;
    setStartLoading(true);
    try {
      await sessionsApi.action({ sessionId: session.id, action: "start" });
      refetch();
    } finally { setStartLoading(false); }
  };

  const handleSaveScore = async () => {
    if (!hole || !myRoundId) { Alert.alert("Error", "Round not found"); return; }
    setIsSaving(true);
    try {
      await scoresApi.save({ roundId: myRoundId, holeId: hole.id, strokes, putts, penalties: 0 });
      const updated = [...myScores];
      updated[currentHole - 1] = strokes;
      setMyScores(updated);
      setPlayers((prev) => prev.map((p) => {
        if (p.userId !== user?.id) return p;
        const newTotal = updated.reduce((a, b) => a + (b || 0), 0);
        const played = updated.filter((s) => s > 0).length;
        const par = holes.slice(0, played).reduce((a: number, h: any) => a + h.par, 0);
        return { ...p, scores: updated, totalScore: newTotal, scoreToPar: par ? newTotal - par : 0, holesPlayed: played };
      }));
      if (currentHole < holes.length) setCurrentHole((h) => h + 1);
    } catch { Alert.alert("Error", "Failed to save score"); }
    finally { setIsSaving(false); }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !session?.id) return;
    const text = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { userId: user?.id, userName: user?.name || "You", text, id: Date.now() }]);
    await sessionsApi.sendChat(session.id, text);
  };

  const myTotal = myScores.reduce((a, b) => a + (b || 0), 0);
  const played = myScores.filter((s) => s > 0).length;
  const parThrough = holes.slice(0, played).reduce((a: number, h: any) => a + h.par, 0);
  const myToPar = parThrough ? myTotal - parThrough : 0;

  if (isLoading && !session) {
    return <View style={styles.center}><ActivityIndicator color="#4ade80" size="large" /></View>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push("/(tabs)")} style={styles.iconBtn}>
          <ArrowLeft color="#1c1a15" size={22} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{course?.name ?? "Golf Session"}</Text>
          <Text style={styles.headerSub}>{session?.members?.length ?? 1} players</Text>
        </View>
        <TouchableOpacity style={styles.chatBtn} onPress={() => { setShowChat(true); setUnreadCount(0); }}>
          <MessageCircle color="#1c1a15" size={22} />
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── LOBBY ── */}
        {status === "lobby" && session && (
          <View style={styles.section}>
            {/* Invite code */}
            <View style={styles.codeCard}>
              <Text style={styles.codeLabel}>Invite Code</Text>
              <Text style={styles.code}>{session.inviteCode}</Text>
              <TouchableOpacity style={styles.copyBtn} onPress={() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                {copied ? <Check color="#4ade80" size={18} /> : <Copy color="#9ca3af" size={18} />}
                <Text style={styles.copyText}>{copied ? "Copied!" : "Copy"}</Text>
              </TouchableOpacity>
            </View>

            {/* Players */}
            <View style={styles.playersList}>
              {session.members?.map((m: any) => (
                <View key={m.id} style={styles.lobbyPlayer}>
                  <View style={[styles.avatar, m.userId === session.hostId && { backgroundColor: "#2a2210" }]}>
                    {m.userId === session.hostId
                      ? <Crown color="#f59e0b" size={18} />
                      : <Text style={styles.avatarText}>{(m.user?.name || m.user?.username)?.[0]?.toUpperCase()}</Text>
                    }
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.playerName}>{m.user?.name || m.user?.username}</Text>
                    <Text style={[styles.readyStatus, { color: m.isReady ? "#4ade80" : "#9ca3af" }]}>
                      {m.userId === session.hostId ? "Host" : m.isReady ? "Ready" : "Not ready"}
                    </Text>
                  </View>
                  {m.userId === user?.id && <View style={styles.youBadge}><Text style={styles.youText}>You</Text></View>}
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.readyBtn, isMeReady && styles.readyBtnActive]}
              onPress={handleReady}
              disabled={readyLoading}
            >
              {readyLoading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.readyBtnText}>{isMeReady ? "Cancel Ready" : "I'm Ready"}</Text>
              }
            </TouchableOpacity>

            {isHost && (
              <TouchableOpacity style={styles.startBtn} onPress={handleStart} disabled={startLoading}>
                {startLoading
                  ? <ActivityIndicator color="#1c1a15" size="small" />
                  : <><Play color="#1c1a15" size={20} /><Text style={styles.startBtnText}>Start Round</Text></>
                }
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── PLAYING ── */}
        {status === "playing" && (
          <View style={styles.section}>
            {/* Leaderboard */}
            <View style={styles.leaderboard}>
              <View style={styles.lbHeader}>
                <Trophy color="#f59e0b" size={18} />
                <Text style={styles.lbTitle}>Leaderboard</Text>
                <Text style={styles.lbLive}>Live</Text>
              </View>
              {players.map((p, i) => (
                <View key={p.userId} style={[styles.lbRow, p.userId === user?.id && styles.lbRowMe]}>
                  <View style={[styles.lbPos, i === 0 && { backgroundColor: "#f59e0b" }, i === 1 && { backgroundColor: "#6b7280" }, i === 2 && { backgroundColor: "#b45309" }]}>
                    <Text style={styles.lbPosText}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lbName}>{p.userName}{p.userId === user?.id ? " (You)" : ""}</Text>
                    <Text style={styles.lbThru}>Thru {p.holesPlayed}</Text>
                  </View>
                  <Text style={[styles.lbScore, { color: p.totalScore === 0 ? "#6b7280" : p.scoreToPar <= 0 ? "#4ade80" : "#f59e0b" }]}>
                    {p.totalScore > 0 ? (p.scoreToPar === 0 ? "E" : p.scoreToPar > 0 ? `+${p.scoreToPar}` : `${p.scoreToPar}`) : "—"}
                  </Text>
                </View>
              ))}
            </View>

            {/* Score entry */}
            <View style={styles.scoreCard}>
              <View style={styles.holeNav}>
                <TouchableOpacity onPress={() => setCurrentHole((h) => Math.max(1, h - 1))} disabled={currentHole === 1} style={[styles.navBtn, currentHole === 1 && { opacity: 0.3 }]}>
                  <ChevronRight color="#fff" size={22} style={{ transform: [{ rotate: "180deg" }] }} />
                </TouchableOpacity>
                <View style={styles.holeNumArea}>
                  <Text style={styles.holeLabel}>Hole</Text>
                  <Text style={styles.holeNum}>{currentHole}</Text>
                  <Text style={styles.holePar}>Par {hole?.par ?? 4}</Text>
                </View>
                <TouchableOpacity onPress={() => setCurrentHole((h) => Math.min(holes.length, h + 1))} disabled={currentHole === holes.length} style={[styles.navBtn, currentHole === holes.length && { opacity: 0.3 }]}>
                  <ChevronRight color="#fff" size={22} />
                </TouchableOpacity>
              </View>

              <View style={styles.strokeArea}>
                <TouchableOpacity style={styles.strokeBtn} onPress={() => setStrokes((s) => Math.max(1, s - 1))}>
                  <Minus color="#fff" size={24} />
                </TouchableOpacity>
                <View style={styles.strokeBubble}>
                  <Text style={styles.strokeNum}>{strokes}</Text>
                </View>
                <TouchableOpacity style={styles.strokeBtn} onPress={() => setStrokes((s) => Math.min(15, s + 1))}>
                  <Plus color="#fff" size={24} />
                </TouchableOpacity>
              </View>

              {/* Quick buttons */}
              <View style={styles.quickRow}>
                {[hole?.par - 2, hole?.par - 1, hole?.par, hole?.par + 1, hole?.par + 2]
                  .filter((s: number) => s > 0)
                  .map((s: number) => (
                    <TouchableOpacity key={s} onPress={() => setStrokes(s)} style={[styles.quickBtn, strokes === s && styles.quickBtnActive]}>
                      <Text style={[styles.quickBtnText, strokes === s && { color: "#fff" }]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
              </View>

              {/* Running total */}
              <View style={styles.runningTotal}>
                <View style={styles.totalItem}><Text style={styles.totalLabel}>Thru</Text><Text style={styles.totalValue}>{played}</Text></View>
                <View style={styles.totalItem}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalValue}>{myTotal || "—"}</Text></View>
                <View style={styles.totalItem}>
                  <Text style={styles.totalLabel}>To Par</Text>
                  <Text style={[styles.totalValue, { color: myToPar <= 0 ? "#4ade80" : "#f59e0b" }]}>
                    {played ? (myToPar === 0 ? "E" : myToPar > 0 ? `+${myToPar}` : `${myToPar}`) : "E"}
                  </Text>
                </View>
              </View>

              <TouchableOpacity style={[styles.saveBtn, (isSaving || !myRoundId) && { opacity: 0.6 }]} onPress={handleSaveScore} disabled={isSaving || !myRoundId}>
                {isSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save & Continue</Text>}
              </TouchableOpacity>
            </View>

            {/* Hole pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              {holes.map((h: any) => {
                const s = myScores[h.holeNumber - 1];
                return (
                  <TouchableOpacity key={h.id} onPress={() => setCurrentHole(h.holeNumber)}
                    style={[styles.pill, currentHole === h.holeNumber && styles.pillActive, s && { backgroundColor: s - h.par <= -1 ? "#16a34a" : s - h.par === 0 ? "#374151" : "#b45309" }]}>
                    <Text style={styles.pillText}>{s || h.holeNumber}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Chat modal */}
      <Modal visible={showChat} animationType="slide" transparent>
        <View style={styles.chatOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowChat(false)} />
          <View style={styles.chatSheet}>
            <View style={styles.chatHeader}>
              <Text style={styles.chatTitle}>Group Chat</Text>
              <TouchableOpacity onPress={() => setShowChat(false)}><X color="#9ca3af" size={22} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.chatMessages} contentContainerStyle={{ padding: 16, gap: 8 }}>
              {chatMessages.map((msg: any, i) => (
                <View key={i} style={[styles.bubble, msg.userId === user?.id && styles.bubbleMe]}>
                  <Text style={styles.bubbleUser}>{msg.userName}</Text>
                  <Text style={styles.bubbleText}>{msg.text}</Text>
                </View>
              ))}
              {chatMessages.length === 0 && <Text style={styles.noMsgs}>No messages yet. Say hello!</Text>}
            </ScrollView>
            <View style={styles.chatInput}>
              <TextInput style={styles.chatTextInput} value={chatInput} onChangeText={setChatInput} placeholder="Type a message..." placeholderTextColor="#6b7280" onSubmitEditing={handleSendChat} returnKeyType="send" />
              <TouchableOpacity style={styles.sendBtn} onPress={handleSendChat} disabled={!chatInput.trim()}>
                <Send color="#fff" size={18} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1c1a15" },
  center: { flex: 1, backgroundColor: "#1c1a15", alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", backgroundColor: "#c9a227", padding: 12, gap: 10 },
  iconBtn: { padding: 6 },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 15, fontWeight: "700", color: "#1c1a15" },
  headerSub: { fontSize: 12, color: "rgba(28,26,21,0.6)" },
  chatBtn: { padding: 6, position: "relative" },
  unreadBadge: { position: "absolute", top: 2, right: 2, width: 16, height: 16, borderRadius: 8, backgroundColor: "#ef4444", alignItems: "center", justifyContent: "center" },
  unreadText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  section: { padding: 16, gap: 14 },
  codeCard: { backgroundColor: "#2a2822", borderRadius: 16, padding: 20, alignItems: "center", gap: 8 },
  codeLabel: { fontSize: 13, color: "#9ca3af" },
  code: { fontSize: 36, fontWeight: "800", color: "#c9a227", letterSpacing: 4, fontFamily: "monospace" },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: "#3f3c35" },
  copyText: { color: "#9ca3af", fontSize: 13 },
  playersList: { backgroundColor: "#2a2822", borderRadius: 14, overflow: "hidden" },
  lobbyPlayer: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: "#3f3c35", gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1d5a3c", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontWeight: "700", color: "#4ade80" },
  playerName: { fontSize: 14, fontWeight: "600", color: "#fff" },
  readyStatus: { fontSize: 12, marginTop: 1 },
  youBadge: { backgroundColor: "#1d5a3c", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  youText: { color: "#4ade80", fontSize: 11, fontWeight: "600" },
  readyBtn: { backgroundColor: "#2a2822", borderRadius: 14, paddingVertical: 14, alignItems: "center", borderWidth: 1.5, borderColor: "#3f3c35" },
  readyBtnActive: { backgroundColor: "#0d2e1a", borderColor: "#1d5a3c" },
  readyBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  startBtn: { backgroundColor: "#c9a227", borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  startBtnText: { color: "#1c1a15", fontWeight: "700", fontSize: 16 },
  leaderboard: { backgroundColor: "#2a2822", borderRadius: 14, overflow: "hidden" },
  lbHeader: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#c9a227", padding: 12 },
  lbTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: "#1c1a15" },
  lbLive: { fontSize: 12, color: "rgba(28,26,21,0.7)", fontWeight: "600" },
  lbRow: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: "#3f3c35", gap: 10 },
  lbRowMe: { backgroundColor: "#0d2e1a" },
  lbPos: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#3f3c35", alignItems: "center", justifyContent: "center" },
  lbPosText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  lbName: { fontSize: 14, fontWeight: "600", color: "#fff" },
  lbThru: { fontSize: 11, color: "#9ca3af", marginTop: 1 },
  lbScore: { fontSize: 20, fontWeight: "800" },
  scoreCard: { backgroundColor: "#155c37", borderRadius: 16, overflow: "hidden" },
  holeNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
  navBtn: { padding: 8, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 10 },
  holeNumArea: { alignItems: "center" },
  holeLabel: { fontSize: 13, color: "rgba(255,255,255,0.6)" },
  holeNum: { fontSize: 48, fontWeight: "800", color: "#fff", lineHeight: 54 },
  holePar: { fontSize: 14, color: "rgba(255,255,255,0.7)" },
  strokeArea: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20, paddingBottom: 16 },
  strokeBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  strokeBubble: { width: 90, height: 90, borderRadius: 45, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  strokeNum: { fontSize: 42, fontWeight: "800", color: "#fff" },
  quickRow: { flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingBottom: 14 },
  quickBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center" },
  quickBtnActive: { backgroundColor: "rgba(255,255,255,0.3)" },
  quickBtnText: { color: "rgba(255,255,255,0.7)", fontWeight: "600", fontSize: 15 },
  runningTotal: { flexDirection: "row", justifyContent: "space-around", backgroundColor: "rgba(0,0,0,0.2)", padding: 14 },
  totalItem: { alignItems: "center" },
  totalLabel: { fontSize: 11, color: "rgba(255,255,255,0.6)" },
  totalValue: { fontSize: 18, fontWeight: "700", color: "#fff", marginTop: 2 },
  saveBtn: { margin: 14, backgroundColor: "#c9a227", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  saveBtnText: { color: "#1c1a15", fontSize: 15, fontWeight: "700" },
  pill: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#2a2822", alignItems: "center", justifyContent: "center", marginRight: 6 },
  pillActive: { borderWidth: 2, borderColor: "#4ade80" },
  pillText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  chatOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  chatSheet: { backgroundColor: "#1c1a15", borderTopLeftRadius: 24, borderTopRightRadius: 24, height: "70%", flexDirection: "column" },
  chatHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#2a2822" },
  chatTitle: { fontSize: 17, fontWeight: "700", color: "#fff" },
  chatMessages: { flex: 1 },
  bubble: { alignSelf: "flex-start", maxWidth: "80%", backgroundColor: "#2a2822", borderRadius: 14, padding: 12 },
  bubbleMe: { alignSelf: "flex-end", backgroundColor: "#1d5a3c" },
  bubbleUser: { fontSize: 11, color: "#9ca3af", marginBottom: 4 },
  bubbleText: { fontSize: 14, color: "#fff" },
  noMsgs: { textAlign: "center", color: "#6b7280", marginTop: 40, fontSize: 14 },
  chatInput: { flexDirection: "row", gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: "#2a2822" },
  chatTextInput: { flex: 1, backgroundColor: "#2a2822", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: "#fff" },
  sendBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#1d5a3c", alignItems: "center", justifyContent: "center" },
});
