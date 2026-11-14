import { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal, Share,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Trophy, Crown, Users, MessageCircle,
  Send, X, Share2, Play, ChevronRight, Flag, Map as MapIcon,
} from "lucide-react-native";
import { ApiError, roundsApi, sessionsApi, scoresApi } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { getAblyClient } from "@/lib/ably-rn";
import { LiveMap } from "@/components/LiveMap";
import { HoleScoreEntry, type HoleScore } from "@/components/HoleScoreEntry";
import { HolePills, nextUnscoredHole } from "@/components/HolePills";

export default function SessionScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const [status, setStatus] = useState<"lobby" | "playing" | "ended">("lobby");
  const [players, setPlayers] = useState<any[]>([]);
  const [myRoundId, setMyRoundId] = useState<string | null>(null);
  const [myScores, setMyScores] = useState<number[]>(Array(18).fill(0));
  const [currentHole, setCurrentHole] = useState(1);
  // My saved score per hole id (putts, fairway, green, penalties included)
  const [myDetails, setMyDetails] = useState<Record<string, HoleScore>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  // The host ended (or cancelled) the session while we had it open
  const [endedRemotely, setEndedRemotely] = useState(false);
  const showChatRef = useRef(false);
  const chatScrollRef = useRef<ScrollView>(null);
  const [readyLoading, setReadyLoading] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["session", code],
    queryFn: () => sessionsApi.get(code),
    // Lobby: watch for players joining. Playing: a slow poll whose only
    // job is noticing that the host ended the session (the leaderboard
    // itself arrives over Ably).
    refetchInterval: endedRemotely || status === "ended" ? false : status === "lobby" ? 3000 : 15000,
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 1,
  });

  // The API stops serving a session by invite code once it has ended, so a
  // 404 on a session we already had open means exactly that.
  useEffect(() => {
    if (data?.data && error instanceof ApiError && error.status === 404) {
      setEndedRemotely(true);
      setStatus("ended");
      qc.invalidateQueries({ queryKey: ["sessions"] });
    }
  }, [error]);

  const session = data?.data;
  const course = session?.course;
  const holes = course?.holes ?? Array.from({ length: 18 }, (_, i) => ({ id: `h${i+1}`, holeNumber: i+1, par: 4 }));
  const hole = holes[currentHole - 1];
  const isHost = session?.hostId === user?.id;
  const myMember = session?.members?.find((m: any) => m.userId === user?.id);
  const isMeReady = !!myMember?.isReady;
  const myRound = session?.rounds?.find((r: any) => r.userId === user?.id);
  // Finished (or abandoned) my own round while the session is still going
  const myRoundDone = !!myRound && myRound.status !== "IN_PROGRESS";

  // Load session data
  useEffect(() => {
    if (!session) return;
    setStatus(
      session.status === "WAITING" ? "lobby"
        : session.status === "IN_PROGRESS" ? "playing"
        : "ended", // COMPLETED or CANCELLED
    );

    if (session.status !== "WAITING" && session.rounds) {
      const myRound = session.rounds.find((r: any) => r.userId === user?.id);
      if (myRound) {
        setMyRoundId(myRound.id);
        const loaded = Array(18).fill(0);
        myRound.scores?.forEach((s: any) => {
          const h = holes.find((h: any) => h.id === s.holeId);
          if (h) loaded[h.holeNumber - 1] = s.strokes;
        });
        setMyScores(loaded);
        const details: Record<string, HoleScore> = {};
        myRound.scores?.forEach((s: any) => {
          details[s.holeId] = {
            strokes: s.strokes,
            putts: s.putts ?? null,
            fairwayHit: s.fairwayHit ?? null,
            greenInReg: s.greenInReg ?? null,
            penalties: s.penalties ?? 0,
          };
        });
        setMyDetails(details);
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

  // Load chat history, then listen for new messages. The web app publishes
  // each message on this channel as well as saving it, and so do we.
  useEffect(() => {
    if (!session?.id) return;
    sessionsApi.chat(session.id)
      .then((d) => setChatMessages(d.data ?? []))
      .catch(() => {});

    try {
      const channel = getAblyClient().channels.get(`session:${session.id}:chat`);
      channel.subscribe("message", (msg: any) => {
        const m = msg.data;
        // Our own messages are already on screen
        if (!m?.text || m.userId === user?.id) return;
        setChatMessages((prev) => [...prev, { ...m, id: m.id ?? `${m.userId}-${m.timestamp ?? Date.now()}` }]);
        if (!showChatRef.current) setUnreadCount((n) => n + 1);
      });
      return () => { channel.unsubscribe(); };
    } catch { /* Ably optional — history still loads */ }
  }, [session?.id]);

  useEffect(() => {
    showChatRef.current = showChat;
    if (showChat) setUnreadCount(0);
  }, [showChat]);

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
    } catch (err: any) {
      Alert.alert("Can't start yet", err.message || "Failed to start the session");
    } finally { setStartLoading(false); }
  };

  const goHome = () => {
    qc.invalidateQueries({ queryKey: ["sessions"] });
    qc.invalidateQueries({ queryKey: ["rounds"] });
    router.replace("/(tabs)");
  };

  // Lobby: a member leaves, or the host cancels for everyone
  const handleLeaveOrCancel = () => {
    if (!session) return;
    const action = isHost ? "cancel" : "leave";
    Alert.alert(
      isHost ? "Cancel session?" : "Leave session?",
      isHost
        ? "This closes the lobby for everyone."
        : "You can rejoin with the invite code while the lobby is open.",
      [
        { text: "Stay", style: "cancel" },
        {
          text: isHost ? "Cancel Session" : "Leave",
          style: "destructive",
          onPress: async () => {
            setActionLoading(true);
            try {
              // cancel/leave answer 200 with { success: false, error } on failure
              const res = await sessionsApi.action({ sessionId: session.id, action });
              if (res?.success === false) throw new Error(res.error);
              goHome();
            } catch (err: any) {
              Alert.alert("Error", err.message || "Something went wrong");
            } finally { setActionLoading(false); }
          },
        },
      ],
    );
  };

  // Playing: finish my own round and go to its summary. Other players
  // keep going; the host ends the session itself.
  const handleFinishRound = () => {
    if (!myRoundId) return;
    const holesLeft = holes.length - played;
    Alert.alert(
      "Finish round?",
      holesLeft > 0
        ? `You still have ${holesLeft} hole${holesLeft === 1 ? "" : "s"} without a score. Your round will be saved as is.`
        : "Your score will be final.",
      [
        { text: "Keep Playing", style: "cancel" },
        {
          text: "Finish",
          onPress: async () => {
            setActionLoading(true);
            try {
              await roundsApi.update(myRoundId, { status: "COMPLETED" });
              qc.invalidateQueries({ queryKey: ["rounds"] });
              qc.invalidateQueries({ queryKey: ["stats"] });
              qc.invalidateQueries({ queryKey: ["session", code] });
              router.replace(`/round/${myRoundId}/summary` as any);
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to finish round");
            } finally { setActionLoading(false); }
          },
        },
      ],
    );
  };

  // Playing: host closes the session for everyone
  const handleEndSession = () => {
    if (!session) return;
    Alert.alert(
      "End session?",
      "This ends the session for all players. Anyone still playing can finish their round from History.",
      [
        { text: "Not Yet", style: "cancel" },
        {
          text: "End Session",
          style: "destructive",
          onPress: async () => {
            setActionLoading(true);
            try {
              // The API stops serving a session by invite code once it has
              // ended, so keep the final state it returns here instead of
              // refetching.
              const res = await sessionsApi.action({ sessionId: session.id, action: "end" });
              qc.setQueryData(["session", code], res);
              qc.invalidateQueries({ queryKey: ["sessions"] });
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to end session");
            } finally { setActionLoading(false); }
          },
        },
      ],
    );
  };

  // Par of the holes that have a score, whatever order they were played in
  const parOfScored = (list: number[]) =>
    holes.reduce((sum: number, h: any) => sum + (list[h.holeNumber - 1] > 0 ? h.par : 0), 0);

  const handleSaveScore = async (score: HoleScore & { putts: number }) => {
    if (!hole || !myRoundId) { Alert.alert("Error", "Round not found"); return; }
    setIsSaving(true);
    try {
      await scoresApi.save({
        roundId: myRoundId,
        holeId: hole.id,
        holeNumber: hole.holeNumber,
        strokes: score.strokes,
        putts: score.putts,
        fairwayHit: score.fairwayHit ?? undefined,
        greenInReg: score.greenInReg ?? undefined,
        penalties: score.penalties,
      });
      const updated = [...myScores];
      updated[hole.holeNumber - 1] = score.strokes;
      setMyScores(updated);
      const details: Record<string, HoleScore> = { ...myDetails, [hole.id]: score };
      setMyDetails(details);
      setPlayers((prev) => prev.map((p) => {
        if (p.userId !== user?.id) return p;
        const newTotal = updated.reduce((a, b) => a + (b || 0), 0);
        const played = updated.filter((s) => s > 0).length;
        const par = parOfScored(updated);
        return { ...p, scores: updated, totalScore: newTotal, scoreToPar: par ? newTotal - par : 0, holesPlayed: played };
      }));
      // Move on to the next hole that still needs a score
      const next = nextUnscoredHole(holes, hole.holeNumber, (id) => !!details[id]);
      if (next !== null) setCurrentHole(next);
    } catch (err: any) { Alert.alert("Error", err.message || "Failed to save score"); }
    finally { setIsSaving(false); }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !session?.id) return;
    const text = chatInput.trim();
    setChatInput("");
    const message = {
      userId: user?.id,
      userName: user?.name || user?.username || "Player",
      text,
      timestamp: Date.now(),
    };
    const localId = `local-${message.timestamp}`;
    setChatMessages((prev) => [...prev, { ...message, id: localId }]);
    try {
      await sessionsApi.sendChat(session.id, text);
      // Saved — now deliver it live to the other players
      getAblyClient().channels.get(`session:${session.id}:chat`).publish("message", message).catch(() => {});
    } catch {
      setChatMessages((prev) => prev.filter((m) => m.id !== localId));
      setChatInput(text);
      Alert.alert("Error", "Message not sent");
    }
  };

  const handleShareCode = () => {
    if (!session) return;
    Share.share({
      message: `Join my GolfnMe session — invite code ${session.inviteCode}`,
    }).catch(() => {});
  };

  const myTotal = myScores.reduce((a, b) => a + (b || 0), 0);
  const played = myScores.filter((s) => s > 0).length;
  const parThrough = parOfScored(myScores);
  const myToPar = parThrough ? myTotal - parThrough : 0;

  if (isLoading && !session) {
    return <View style={styles.center}><ActivityIndicator color="#4ade80" size="large" /></View>;
  }

  // Wrong code, or the session has already ended / been cancelled
  if (!session) {
    return (
      <View style={[styles.center, { gap: 16, padding: 24 }]}>
        <Text style={styles.doneTitle}>{(error as Error | null)?.message || "Session not found"}</Text>
        <TouchableOpacity style={[styles.finishBtn, { paddingHorizontal: 24 }]} onPress={goHome}>
          <Text style={styles.finishBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <LiveMap
        visible={showMap}
        onClose={() => setShowMap(false)}
        courseLat={course?.latitude}
        courseLng={course?.longitude}
        courseName={course?.name}
      />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push("/(tabs)")} style={styles.iconBtn}>
          <ArrowLeft color="#1c1a15" size={22} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{course?.name ?? "Golf Session"}</Text>
          <Text style={styles.headerSub}>{session?.members?.length ?? 1} players</Text>
        </View>
        {status === "playing" && (
          <TouchableOpacity style={styles.chatBtn} onPress={() => setShowMap(true)} accessibilityLabel="Course map">
            <MapIcon color="#1c1a15" size={22} />
          </TouchableOpacity>
        )}
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
              <TouchableOpacity style={styles.copyBtn} onPress={handleShareCode}>
                <Share2 color="#9ca3af" size={18} />
                <Text style={styles.copyText}>Share</Text>
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

            <TouchableOpacity style={styles.dangerBtn} onPress={handleLeaveOrCancel} disabled={actionLoading}>
              <Text style={styles.dangerBtnText}>{isHost ? "Cancel Session" : "Leave Session"}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── PLAYING / ENDED ── */}
        {status !== "lobby" && (
          <View style={styles.section}>
            {status === "ended" && (
              <View style={styles.doneCard}>
                <Text style={styles.doneTitle}>
                  {session?.status === "CANCELLED" ? "Session cancelled" : "Session ended"}
                </Text>
                <Text style={styles.doneSub}>
                  {session?.status === "CANCELLED"
                    ? "This session was cancelled."
                    : endedRemotely
                      ? "The host ended the session. Standings below are the last ones received."
                      : "Final standings are below."}
                </Text>
              </View>
            )}

            {/* Leaderboard */}
            <View style={styles.leaderboard}>
              <View style={styles.lbHeader}>
                <Trophy color="#f59e0b" size={18} />
                <Text style={styles.lbTitle}>Leaderboard</Text>
                <Text style={styles.lbLive}>{status === "ended" ? "Final" : "Live"}</Text>
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

            {/* Finished my round — nothing left to enter */}
            {(status === "ended" || myRoundDone) && (
              <>
                {status === "playing" && (
                  <View style={styles.doneCard}>
                    <Text style={styles.doneTitle}>You've finished</Text>
                    <Text style={styles.doneSub}>The leaderboard keeps updating while the others play.</Text>
                  </View>
                )}
                {myRound && (
                  <TouchableOpacity style={styles.startBtn} onPress={() => router.push(`/round/${myRound.id}/summary` as any)}>
                    <Flag color="#1c1a15" size={18} />
                    <Text style={styles.startBtnText}>View My Summary</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {status === "playing" && !myRoundDone && (
              <>
            {/* My hole: number, par and running total */}
            <View style={styles.scoreCard}>
              <View style={styles.holeNav}>
                <TouchableOpacity onPress={() => setCurrentHole((h) => Math.max(1, h - 1))} disabled={currentHole === 1} style={[styles.navBtn, currentHole === 1 && { opacity: 0.3 }]} accessibilityLabel="Previous hole">
                  <ChevronRight color="#fff" size={22} style={{ transform: [{ rotate: "180deg" }] }} />
                </TouchableOpacity>
                <View style={styles.holeNumArea}>
                  <Text style={styles.holeLabel}>Hole</Text>
                  <Text style={styles.holeNum}>{currentHole}</Text>
                  <Text style={styles.holePar}>Par {hole?.par ?? 4}</Text>
                </View>
                <TouchableOpacity onPress={() => setCurrentHole((h) => Math.min(holes.length, h + 1))} disabled={currentHole === holes.length} style={[styles.navBtn, currentHole === holes.length && { opacity: 0.3 }]} accessibilityLabel="Next hole">
                  <ChevronRight color="#fff" size={22} />
                </TouchableOpacity>
              </View>

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
            </View>

            {/* Hole strip — follows the current hole */}
            <View style={{ marginHorizontal: -16 }}>
              <HolePills
                holes={holes}
                currentHole={currentHole}
                strokesFor={(id) => myDetails[id]?.strokes}
                onSelect={setCurrentHole}
              />
            </View>

            {/* Score entry: keyed by hole so each one starts from its own score */}
            {hole && (
              <View style={{ marginHorizontal: -16, marginVertical: -16 }}>
                <HoleScoreEntry
                  key={hole.id}
                  hole={hole}
                  saved={myDetails[hole.id]}
                  saving={isSaving || !myRoundId}
                  onSave={handleSaveScore}
                />
              </View>
            )}

            <TouchableOpacity
              style={[styles.finishBtn, (played === 0 || actionLoading || !myRoundId) && { opacity: 0.5 }]}
              onPress={handleFinishRound}
              disabled={played === 0 || actionLoading || !myRoundId}
            >
              <Flag color="#4ade80" size={18} />
              <Text style={styles.finishBtnText}>Finish Round</Text>
            </TouchableOpacity>
              </>
            )}

            {status === "playing" && isHost && (
              <TouchableOpacity style={styles.dangerBtn} onPress={handleEndSession} disabled={actionLoading}>
                <Text style={styles.dangerBtnText}>End Session for Everyone</Text>
              </TouchableOpacity>
            )}

            {status === "ended" && (
              <TouchableOpacity style={styles.finishBtn} onPress={goHome}>
                <Text style={styles.finishBtnText}>Back to Home</Text>
              </TouchableOpacity>
            )}
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
            <ScrollView
              ref={chatScrollRef}
              style={styles.chatMessages}
              contentContainerStyle={{ padding: 16, gap: 8 }}
              onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
            >
              {chatMessages.map((msg: any, i) => (
                <View key={msg.id ?? i} style={[styles.bubble, msg.userId === user?.id && styles.bubbleMe]}>
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
  finishBtn: { backgroundColor: "#2a2822", borderRadius: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderColor: "#1d5a3c" },
  finishBtnText: { color: "#4ade80", fontWeight: "600", fontSize: 15 },
  dangerBtn: { paddingVertical: 12, alignItems: "center" },
  dangerBtnText: { color: "#ef4444", fontWeight: "600", fontSize: 14 },
  doneCard: { backgroundColor: "#2a2822", borderRadius: 14, padding: 18, alignItems: "center", gap: 4 },
  doneTitle: { fontSize: 16, fontWeight: "700", color: "#fff" },
  doneSub: { fontSize: 13, color: "#9ca3af", textAlign: "center" },
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
