import { API_BASE, setToken } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

WebBrowser.maybeCompleteAuthSession();

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? API_BASE;

export default function LoginScreen() {
  const router = useRouter();
  const { login, setUser } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // ── Listen for deep link callback from NextAuth ───────────────────────
  useEffect(() => {
    const subscription = Linking.addEventListener("url", handleDeepLink);
    return () => subscription.remove();
  }, []);

  const handleDeepLink = async (event: { url: string }) => {
    const { url } = event;
    if (!url.includes("golfnme://auth")) return;

    const parsed = Linking.parse(url);
    const token = parsed.queryParams?.token as string;
    const error = parsed.queryParams?.error as string;

    if (error) {
      setGoogleLoading(false);
      Alert.alert("Sign In Failed", error);
      return;
    }

    if (token) {
      try {
        // Fetch user info with the token
        const res = await fetch(`${API_URL}/api/auth/mobile/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error("Failed to get user");

        await setToken(token);
        setUser(data.user);
        router.replace("/(tabs)");
      } catch (err: any) {
        Alert.alert("Error", err.message || "Sign in failed");
      } finally {
        setGoogleLoading(false);
      }
    }
  };

  // ── Google Sign In via NextAuth ───────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const mobileCallbackUrl = `http://localhost:3000/api/auth/mobile/callback`;
      const callbackUrl = encodeURIComponent(mobileCallbackUrl);
      const fullUrl = `http://localhost:3000/login?callbackUrl=${callbackUrl}`;

      const result = await WebBrowser.openAuthSessionAsync(
        fullUrl,
        "golfnme://auth",
      );
      if (result.type === "cancel" || result.type === "dismiss") {
        setGoogleLoading(false);
      }
    } catch (err: any) {
      setGoogleLoading(false);
      Alert.alert("Error", err.message || "Google sign in failed");
    }
  };

  // ── Email/Password ────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace("/(tabs)");
    } catch (err: any) {
      Alert.alert("Login Failed", err.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>⛳</Text>
          </View>
          <Text style={styles.appName}>GolfnMe</Text>
          <Text style={styles.tagline}>Track scores. Beat friends.</Text>
        </View>

        {/* Google */}
        <TouchableOpacity
          style={[styles.googleBtn, googleLoading && styles.btnDisabled]}
          onPress={handleGoogleSignIn}
          disabled={googleLoading}
          activeOpacity={0.85}
        >
          {googleLoading ? (
            <ActivityIndicator color="#1c1a15" />
          ) : (
            <>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email/Password */}
        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#9ca3af"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor="#9ca3af"
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => router.push("/(auth)/signup")}
          >
            <Text style={styles.linkText}>
              Don't have an account?{" "}
              <Text style={styles.linkBold}>Sign up</Text>
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

  logoArea: { alignItems: "center", marginBottom: 40 },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1d5a3c",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoEmoji: { fontSize: 36 },
  appName: {
    fontSize: 32,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: -0.5,
  },
  tagline: { fontSize: 15, color: "#9ca3af", marginTop: 6 },

  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  googleIcon: { fontSize: 18, fontWeight: "700", color: "#4285F4" },
  googleBtnText: { fontSize: 15, fontWeight: "600", color: "#1c1a15" },

  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 20,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#2a2822" },
  dividerText: { color: "#6b7280", fontSize: 13 },

  form: { gap: 4 },
  label: { fontSize: 14, fontWeight: "500", color: "#d1d5db", marginTop: 8 },
  input: {
    backgroundColor: "#2a2822",
    borderWidth: 1,
    borderColor: "#3f3c35",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: "#fff",
    marginTop: 4,
  },

  btn: {
    backgroundColor: "#1d5a3c",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 24,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  linkBtn: { alignItems: "center", marginTop: 20 },
  linkText: { color: "#9ca3af", fontSize: 14 },
  linkBold: { color: "#4ade80", fontWeight: "600" },
});
