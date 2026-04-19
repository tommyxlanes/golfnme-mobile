import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Zap } from "lucide-react-native";
import { sessionsApi } from "@/lib/api";

export default function JoinSessionScreen() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (code.trim().length < 4) { Alert.alert("Error", "Enter a valid invite code"); return; }
    setLoading(true);
    try {
      await sessionsApi.join(code.trim().toUpperCase());
      router.replace(`/session/${code.trim().toUpperCase()}`);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Session not found");
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color="#fff" size={22} />
        </TouchableOpacity>
        <Text style={styles.title}>Join Session</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.content}>
        <Zap color="#c9a227" size={48} style={{ alignSelf: "center", marginBottom: 24 }} />
        <Text style={styles.label}>Invite Code</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          placeholder="e.g. ABCD"
          placeholderTextColor="#6b7280"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={8}
          style={[styles.input, { letterSpacing: 8, textAlign: "center", fontSize: 28, fontWeight: "700" }]}
        />
        <Text style={styles.hint}>Ask the session host for their invite code</Text>

        <TouchableOpacity
          style={[styles.btn, (!code.trim() || loading) && styles.btnDisabled]}
          onPress={handleJoin}
          disabled={!code.trim() || loading}
        >
          {loading ? <ActivityIndicator color="#1c1a15" /> : <Text style={styles.btnText}>Join Session</Text>}
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
  content: { flex: 1, padding: 24 },
  label: { fontSize: 14, color: "#9ca3af", marginBottom: 8 },
  input: { backgroundColor: "#2a2822", borderRadius: 14, padding: 16, fontSize: 16, color: "#fff", borderWidth: 1, borderColor: "#3f3c35", marginBottom: 8 },
  hint: { fontSize: 13, color: "#6b7280", textAlign: "center", marginBottom: 32 },
  btn: { backgroundColor: "#c9a227", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#1c1a15", fontSize: 16, fontWeight: "700" },
});
