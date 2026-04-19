import { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut, Edit2, Check, X, User } from "lucide-react-native";
import { useAuthStore } from "@/stores/authStore";
import { userApi } from "@/lib/api";

export default function ProfileTab() {
  const { user, logout, setUser } = useAuthStore();
  const qc = useQueryClient();

  const [editing, setEditing] = useState(false);
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
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>
              {(user?.name || user?.username || "?")[0].toUpperCase()}
            </Text>
          </View>
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
