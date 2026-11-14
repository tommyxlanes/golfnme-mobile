import { authApi, WEB_BASE } from "@/lib/api";
import { completeBrowserSignIn } from "@/lib/authLink";
import { useAuthStore } from "@/stores/authStore";
import * as Google from "expo-auth-session/providers/google";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
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

// ── Google sign-in ──────────────────────────────────────────────────────
// Native: when a Google OAuth client ID is configured for this platform,
// sign in on the device and exchange the ID token at POST /api/auth/google.
// The same IDs must be listed in the API's GOOGLE_CLIENT_IDS.
//
// Browser hand-off (fallback): open the web app's /login page, which
// deep-links back to this app with ?token=…
const GOOGLE_CLIENT_IDS = {
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
};

const HAS_NATIVE_GOOGLE = !!Platform.select({
  ios: GOOGLE_CLIENT_IDS.iosClientId,
  android: GOOGLE_CLIENT_IDS.androidClientId,
  default: GOOGLE_CLIENT_IDS.webClientId,
});

function GoogleButtonFace({ loading }: { loading: boolean }) {
  return loading ? (
    <ActivityIndicator color="#1c1a15" />
  ) : (
    <>
      <Text style={styles.googleIcon}>G</Text>
      <Text style={styles.googleBtnText}>Continue with Google</Text>
    </>
  );
}

// Rendered only when a client ID exists for this platform — the hook
// cannot run without one.
function NativeGoogleButton() {
  const [loading, setLoading] = useState(false);
  const [request, response, promptAsync] =
    Google.useIdTokenAuthRequest(GOOGLE_CLIENT_IDS);

  useEffect(() => {
    if (!response) return;

    if (response.type !== "success") {
      setLoading(false);
      if (response.type === "error") {
        Alert.alert("Sign In Failed", response.error?.message ?? "Google sign in failed");
      }
      return;
    }

    const idToken =
      response.params?.id_token ?? response.authentication?.idToken;
    if (!idToken) {
      setLoading(false);
      Alert.alert("Sign In Failed", "Google did not return an ID token.");
      return;
    }

    authApi
      .google(idToken)
      .then((data) => useAuthStore.getState().setSession(data.token, data.user))
      .catch((err: any) =>
        Alert.alert("Sign In Failed", err.message || "Google sign in failed"),
      )
      .finally(() => setLoading(false));
  }, [response]);

  return (
    <TouchableOpacity
      style={[styles.googleBtn, (loading || !request) && styles.btnDisabled]}
      onPress={() => {
        setLoading(true);
        promptAsync().catch(() => setLoading(false));
      }}
      disabled={loading || !request}
      activeOpacity={0.85}
    >
      <GoogleButtonFace loading={loading} />
    </TouchableOpacity>
  );
}

function BrowserGoogleButton() {
  const [loading, setLoading] = useState(false);

  // Where the web app sends the result: this login screen's own deep link,
  // golfnme://login in a real build, exp://<host>/--/login inside Expo Go
  // (which doesn't own the golfnme:// scheme).
  const returnUrl = Linking.createURL("login");

  // On Android the redirect also arrives as a deep link, which the router
  // delivers to LoginScreen below as ?token= / ?error= params; on iOS it
  // only comes back as the browser session's result. completeBrowserSignIn
  // ignores the second delivery.
  const handleAuthUrl = async (url: string) => {
    const parsed = Linking.parse(url);
    try {
      await completeBrowserSignIn({
        token: parsed.queryParams?.token as string | undefined,
        error: parsed.queryParams?.error as string | undefined,
      });
    } catch (err: any) {
      Alert.alert("Sign In Failed", err.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePress = async () => {
    setLoading(true);
    try {
      // The web app signs the user in, then its /api/auth/mobile/callback
      // redirects to returnUrl with ?token=…
      const callbackUrl = encodeURIComponent(
        `${WEB_BASE}/api/auth/mobile/callback?redirect=${encodeURIComponent(returnUrl)}`,
      );
      const result = await WebBrowser.openAuthSessionAsync(
        `${WEB_BASE}/login?callbackUrl=${callbackUrl}`,
        returnUrl,
      );
      if (result.type === "success" && result.url) {
        await handleAuthUrl(result.url);
      } else {
        setLoading(false);
      }
    } catch (err: any) {
      setLoading(false);
      Alert.alert("Error", err.message || "Google sign in failed");
    }
  };

  return (
    <TouchableOpacity
      style={[styles.googleBtn, loading && styles.btnDisabled]}
      onPress={handlePress}
      disabled={loading}
      activeOpacity={0.85}
    >
      <GoogleButtonFace loading={loading} />
    </TouchableOpacity>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Returning from the browser-based Google sign-in: the web app deep-links
  // to this screen with ?token=… (or ?error=…). Once the session is set,
  // the guard in app/_layout.tsx moves on to the tabs.
  const { token, error } = useLocalSearchParams<{ token?: string; error?: string }>();
  useEffect(() => {
    if (!token && !error) return;
    completeBrowserSignIn({ token, error }).catch((err: any) =>
      Alert.alert("Sign In Failed", err.message || "Sign in failed"),
    );
  }, [token, error]);

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
        {HAS_NATIVE_GOOGLE ? <NativeGoogleButton /> : <BrowserGoogleButton />}

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
