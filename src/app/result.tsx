import { Ionicons } from "@expo/vector-icons"; // Expo's built-in icon library
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function ResultScreen() {
  const router = useRouter();

  // This hook grabs the data passed from the previous screen
  const params = useLocalSearchParams();

  // For now, we simulate a backend check.
  // Let's pretend any batch number starting with "FAKE" is a counterfeit.
  const batchNumber = (params.batchNumber || params.barcode || "UNKNOWN")
    .toString()
    .toUpperCase();
  const isSafe = !batchNumber.startsWith("FAKE");

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Dynamic Status Card (Turns Green or Red based on safety) */}
      <View
        style={[
          styles.statusCard,
          isSafe ? styles.safeCard : styles.dangerCard,
        ]}
      >
        <Ionicons
          name={isSafe ? "checkmark-circle" : "warning"}
          size={64}
          color={isSafe ? "#16a34a" : "#dc2626"}
        />
        <Text style={styles.statusTitle}>
          {isSafe ? "Safe for Consumption" : "Warning: Potential Counterfeit!"}
        </Text>
        <Text style={styles.statusSubtitle}>
          {isSafe
            ? "This medicine has been verified against the official database."
            : "This batch number has been flagged. Do not consume!"}
        </Text>
      </View>

      {/* Details Section */}
      <View style={styles.detailsBox}>
        <Text style={styles.sectionTitle}>Medicine Details</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Name:</Text>
          <Text style={styles.value}>
            {params.name || "Unknown (Scanned from Barcode)"}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Batch Number:</Text>
          <Text style={styles.value}>{batchNumber}</Text>
        </View>

        {params.mfdDate ? (
          <View style={styles.row}>
            <Text style={styles.label}>Manufacturing Date:</Text>
            <Text style={styles.value}>{params.mfdDate}</Text>
          </View>
        ) : null}

        {params.expDate ? (
          <View style={styles.row}>
            <Text style={styles.label}>Expiration Date:</Text>
            <Text style={styles.value}>{params.expDate}</Text>
          </View>
        ) : null}

        {params.dose ? (
          <View style={styles.row}>
            <Text style={styles.label}>Dose:</Text>
            <Text style={styles.value}>{params.dose}</Text>
          </View>
        ) : null}
      </View>

      {/* Return Button */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.replace("/")} // .replace() removes history so the user can't "swipe back" to the loading screen
      >
        <Text style={styles.buttonText}>Scan Another Medicine</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 24 },
  statusCard: {
    alignItems: "center",
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 24,
    marginTop: 20,
  },
  safeCard: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
  dangerCard: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  statusTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 12,
    textAlign: "center",
    color: "#0f172a",
  },
  statusSubtitle: {
    fontSize: 14,
    color: "#475569",
    textAlign: "center",
    marginTop: 8,
  },
  detailsBox: {
    backgroundColor: "#ffffff",
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 8,
  },
  label: { fontSize: 14, color: "#64748b" },
  value: { fontSize: 14, fontWeight: "bold", color: "#0f172a" },
  button: {
    backgroundColor: "#0f172a",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "bold" },
});
