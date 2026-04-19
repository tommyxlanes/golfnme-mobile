import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { API_BASE, setToken } from "@/lib/api";

export default function SignupScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!name || !email || !username || !password) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/mobile/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email: email.trim().toLowerCase(), username: username.trim().toLowerCase(), password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");

      await setToken(data.token);
      router.replace("/(tabs)");
    } catch (err: any) {
      Alert.alert("Signup Failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>⛳</Text>
          </View>
          <Text style={styles.appName}>Create Account</Text>
          <Text style={styles.tagline}>Join GolfnMe and start tracking</Text>
        </View>

        <View style={styles.form}>
          {[
            { label: "Full Name", value: name, setter: setName, placeholder: "John Smith", autoCapitalize: "words" as const },
            { label: "Email", value: email, setter: setEmail, placeholder: "you@example.com", keyboardType: "email-address" as const, autoCapitalize: "none" as const },
            { label: "Username", value: username, setter: setUsername, placeholder: "johnsmith", autoCapitalize: "none" as const },
          ].map((field) => (
            <View key={field.label}>
              <Text style={styles.label}>{field.label}</Text>
              <TextInput
                style={styles.input}
                value={field.value}
                onChangeText={field.setter}
                placeholder={field.placeholder}
                placeholderTextColor="#9ca3af"
                keyboardType={field.keyboardType}
                autoCapitalize={field.autoCapitalize}
                autoCorrect={false}
              />
            </View>
          ))}

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Min. 6 characters"
            placeholderTextColor="#9ca3af"
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSignup}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Create Account</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkBtn} onPress={() => router.back()}>
            <Text style={styles.linkText}>
              Already have an account? <Text style={styles.linkBold}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1c1a15" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 24 },
  logoArea: { alignItems: "center", marginBottom: 36 },
  logoCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#1d5a3c", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  logoEmoji: { fontSize: 28 },
  appName: { fontSize: 26, fontWeight: "700", color: "#fff" },
  tagline: { fontSize: 14, color: "#9ca3af", marginTop: 4 },
  form: { gap: 4 },
  label: { fontSize: 14, fontWeight: "500", color: "#d1d5db", marginTop: 12, marginBottom: 4 },
  input: { backgroundColor: "#2a2822", borderWidth: 1, borderColor: "#3f3c35", borderRadius: 12, padding: 14, fontSize: 16, color: "#fff" },
  btn: { backgroundColor: "#1d5a3c", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 24 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  linkBtn: { alignItems: "center", marginTop: 20 },
  linkText: { color: "#9ca3af", fontSize: 14 },
  linkBold: { color: "#4ade80", fontWeight: "600" },
});
