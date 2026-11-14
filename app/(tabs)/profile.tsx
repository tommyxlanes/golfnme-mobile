import { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, ScrollView, Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut, Edit2, Check, X, User, Camera, Settings } from "lucide-react-native";
import { useAuthStore } from "@/stores/authStore";
import { resolveMediaUrl, userApi } from "@/lib/api";

export default function ProfileTab() {
  const { user, logout, setUser } = useAuthStore();
  const qc = useQueryClient();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarUri = resolveMediaUrl(user?.avatarUrl);

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7, // keeps the upload well under the API's 5 MB limit
    });
    if (result.canceled || !user) return;

    setAvatarBusy(true);
    try {
      const res = await userApi.uploadAvatar(result.assets[0]);
      setUser({ ...user, avatarUrl: res.avatarUrl });
    } catch (err: any) {
      Alert.alert("Upload failed", err.message || "Couldn't update your photo");
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    if (!user) return;
    setAvatarBusy(true);
    try {
      await userApi.removeAvatar();
      setUser({ ...user, avatarUrl: null });
    } catch (err: any) {
      Alert.alert("Error", err.message || "Couldn't remove your photo");
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleAvatarPress = () => {
    if (!user?.avatarUrl) return pickAvatar();
    Alert.alert("Profile photo", undefined, [
      { text: "Choose New Photo", onPress: pickAvatar },
      { text: "Remove Photo", style: "destructive", onPress: removeAvatar },
      { text: "Cancel", style: "cancel" },
    ]);
  };
  const [name, setName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [handicap, setHandicap] = useState(user?.handicap?.toString() ?? "");

  const { mutate: saveProfile, isPending: saving } = useMutation({
    mutationFn: () => userApi.update({
      name,
      username,
      handicap: handicap ? parseFloat(handicap) : undefined,
    }),
    onSuccess: (data: any) => {
      const updated = data.data ?? data.user;
      if (updated) setUser(updated);
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: () => Alert.alert("Error", "Failed to save profile"),
  });

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => router.push("/settings" as any)}
          accessibilityLabel="Settings"
        >
          <Settings color="#9ca3af" size={22} />
        </TouchableOpacity>

        {/* Avatar — tap to change */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            onPress={handleAvatarPress}
            disabled={avatarBusy}
            accessibilityLabel="Change profile photo"
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarCircle} />
            ) : (
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitial}>
                  {(user?.name || user?.username || "?")[0].toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.cameraBadge}>
              {avatarBusy
                ? <ActivityIndicator color="#1c1a15" size="small" />
                : <Camera color="#1c1a15" size={15} />
              }
            </View>
          </TouchableOpacity>
          {!editing && (
            <>
              <Text style={styles.displayName}>{user?.name ?? "Golfer"}</Text>
              <Text style={styles.displayUsername}>@{user?.username}</Text>
              {user?.handicap != null && (
                <View style={styles.hcpBadge}>
                  <Text style={styles.hcpText}>Handicap {user.handicap.toFixed(1)}</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Edit form */}
        {editing ? (
          <View style={styles.form}>
            {[
              { label: "Name", value: name, setter: setName, placeholder: "Your name", autoCapitalize: "words" as const },
              { label: "Username", value: username, setter: setUsername, placeholder: "username", autoCapitalize: "none" as const },
            ].map((field) => (
              <View key={field.label}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <TextInput
                  style={styles.input}
                  value={field.value}
                  onChangeText={field.setter}
                  placeholder={field.placeholder}
                  placeholderTextColor="#6b7280"
                  autoCapitalize={field.autoCapitalize}
                  autoCorrect={false}
                />
              </View>
            ))}
            <Text style={styles.fieldLabel}>Handicap Index</Text>
            <TextInput
              style={styles.input}
              value={handicap}
              onChangeText={setHandicap}
              placeholder="e.g. 12.4"
              placeholderTextColor="#6b7280"
              keyboardType="decimal-pad"
            />

            <View style={styles.editBtns}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setEditing(false); setName(user?.name ?? ""); setUsername(user?.username ?? ""); setHandicap(user?.handicap?.toString() ?? ""); }}
              >
                <X color="#9ca3af" size={18} />
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                onPress={() => saveProfile()}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Check color="#fff" size={18} />}
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
            <Edit2 color="#4ade80" size={18} />
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        )}

        {/* Info rows */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.infoLabel}>Member since</Text>
            <Text style={styles.infoValue}>2024</Text>
          </View>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut color="#ef4444" size={20} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1c1a15" },
  content: { padding: 24, paddingBottom: 60 },
  settingsBtn: { alignSelf: "flex-end", padding: 6 },
  cameraBadge: { position: "absolute", right: -2, bottom: 12, width: 30, height: 30, borderRadius: 15, backgroundColor: "#c9a227", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#1c1a15" },
  avatarSection: { alignItems: "center", marginBottom: 24 },
  avatarCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: "#1d5a3c", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  avatarInitial: { fontSize: 40, fontWeight: "700", color: "#4ade80" },
  displayName: { fontSize: 24, fontWeight: "700", color: "#fff" },
  displayUsername: { fontSize: 15, color: "#9ca3af", marginTop: 2 },
  hcpBadge: { marginTop: 10, backgroundColor: "#2a2822", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6 },
  hcpText: { color: "#4ade80", fontWeight: "600", fontSize: 14 },
  editBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#2a2822", borderRadius: 14, paddingVertical: 14, marginBottom: 20 },
  editBtnText: { color: "#4ade80", fontWeight: "600", fontSize: 15 },
  form: { backgroundColor: "#2a2822", borderRadius: 16, padding: 16, marginBottom: 20, gap: 4 },
  fieldLabel: { fontSize: 13, color: "#9ca3af", marginTop: 10, marginBottom: 4 },
  input: { backgroundColor: "#1c1a15", borderRadius: 10, padding: 13, fontSize: 15, color: "#fff", borderWidth: 1, borderColor: "#3f3c35" },
  editBtns: { flexDirection: "row", gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, borderWidth: 1, borderColor: "#3f3c35", paddingVertical: 12 },
  cancelBtnText: { color: "#9ca3af", fontWeight: "600" },
  saveBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, backgroundColor: "#1d5a3c", paddingVertical: 12 },
  saveBtnText: { color: "#fff", fontWeight: "600" },
  infoCard: { backgroundColor: "#2a2822", borderRadius: 16, marginBottom: 20, overflow: "hidden" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#3f3c35" },
  infoLabel: { fontSize: 14, color: "#9ca3af" },
  infoValue: { fontSize: 14, color: "#fff", fontWeight: "500" },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#2a1515", borderRadius: 14, paddingVertical: 16 },
  logoutText: { color: "#ef4444", fontWeight: "600", fontSize: 15 },
});
