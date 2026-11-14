import { API_BASE } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import Constants from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { ArrowLeft, Bell, ChevronRight, Image as ImageIcon, LogOut, MapPin } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  Alert, AppState, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Permission = { granted: boolean; canAskAgain: boolean } | null;

function permissionLabel(p: Permission) {
  if (!p) return "Checking…";
  if (p.granted) return "Allowed";
  return p.canAskAgain ? "Not allowed yet" : "Blocked — change in system settings";
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const [location, setLocation] = useState<Permission>(null);
  const [photos, setPhotos] = useState<Permission>(null);

  const refresh = useCallback(async () => {
    const [loc, pho] = await Promise.all([
      Location.getForegroundPermissionsAsync(),
      ImagePicker.getMediaLibraryPermissionsAsync(),
    ]);
    setLocation({ granted: loc.granted, canAskAgain: loc.canAskAgain });
    setPhotos({ granted: pho.granted, canAskAgain: pho.canAskAgain });
  }, []);

  // Re-check when coming back from the system settings app
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // Ask in-app while the OS still lets us; after a hard "no" only the
  // system settings can change it.
  const handlePermission = async (
    current: Permission,
    request: () => Promise<unknown>,
  ) => {
    if (current?.granted || !current?.canAskAgain) {
      await Linking.openSettings();
    } else {
      await request();
      refresh();
    }
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <ArrowLeft color="#fff" size={22} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.section}>Account</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={styles.rowValue} numberOfLines={1}>{user?.email}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Username</Text>
            <Text style={styles.rowValue} numberOfLines={1}>@{user?.username}</Text>
          </View>
          <TouchableOpacity
            style={[styles.row, styles.rowLast]}
            onPress={() => router.push("/notifications" as any)}
          >
            <Bell color="#9ca3af" size={18} />
            <Text style={[styles.rowLabel, { flex: 1 }]}>Notifications</Text>
            <ChevronRight color="#6b7280" size={18} />
          </TouchableOpacity>
        </View>

        <Text style={styles.section}>Permissions</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => handlePermission(location, Location.requestForegroundPermissionsAsync)}
          >
            <MapPin color="#9ca3af" size={18} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Location</Text>
              <Text style={styles.rowHint}>Shows your position on the course map</Text>
            </View>
            <Text style={[styles.status, location?.granted && styles.statusOn]}>
              {permissionLabel(location)}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.row, styles.rowLast]}
            onPress={() => handlePermission(photos, ImagePicker.requestMediaLibraryPermissionsAsync)}
          >
            <ImageIcon color="#9ca3af" size={18} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Photos</Text>
              <Text style={styles.rowHint}>Used to pick a profile photo</Text>
            </View>
            <Text style={[styles.status, photos?.granted && styles.statusOn]}>
              {permissionLabel(photos)}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.section}>About</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Version</Text>
            <Text style={styles.rowValue}>{Constants.expoConfig?.version ?? "—"}</Text>
          </View>
          <View style={[styles.row, styles.rowLast]}>
            <Text style={styles.rowLabel}>Server</Text>
            <Text style={styles.rowValue} numberOfLines={1}>
              {API_BASE.replace(/^https?:\/\//, "")}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut color="#ef4444" size={18} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1c1a15" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 },
  iconBtn: { padding: 8 },
  title: { fontSize: 18, fontWeight: "700", color: "#fff" },
  content: { padding: 16, paddingBottom: 40 },
  section: { fontSize: 12, fontWeight: "600", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 18, marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: "#2a2822", borderRadius: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#3f3c35" },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 15, color: "#fff" },
  rowHint: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  rowValue: { flex: 1, textAlign: "right", fontSize: 14, color: "#9ca3af" },
  status: { fontSize: 12, color: "#9ca3af", maxWidth: 130, textAlign: "right" },
  statusOn: { color: "#4ade80" },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#2a1515", borderRadius: 14, paddingVertical: 16, marginTop: 28 },
  logoutText: { color: "#ef4444", fontWeight: "600", fontSize: 15 },
});
