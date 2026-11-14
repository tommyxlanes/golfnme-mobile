import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

// react-native-maps has no web build; the browser version of the app shows
// this instead of the satellite map.
export function LiveMap({ visible, onClose }: { visible: boolean; onClose: () => void; [key: string]: unknown }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        <Text style={styles.text}>The course map is available in the iOS and Android app.</Text>
        <TouchableOpacity onPress={onClose} style={styles.btn}>
          <Text style={styles.btnText}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "rgba(28,26,21,0.95)", alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  text: { color: "#d1d5db", fontSize: 15, textAlign: "center" },
  btn: { backgroundColor: "#1d5a3c", borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  btnText: { color: "#fff", fontWeight: "600" },
});
