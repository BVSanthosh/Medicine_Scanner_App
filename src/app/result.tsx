import { Ionicons } from "@expo/vector-icons";
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
  const params = useLocalSearchParams();

  // Simulated Backend Verification
  const batchNumber = (params.batchNumber || params.barcode || "UNKNOWN")
    .toString()
    .toUpperCase();

  // Mock logic: Any batch starting with "FAKE" or missing a batch number is flagged.
  const isSafe = !batchNumber.startsWith("FAKE") && batchNumber !== "UNKNOWN";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Dynamic Status Card */}
      <View
        style={[
          styles.statusCard,
          isSafe ? styles.safeCard : styles.dangerCard,
        ]}
      >
        <Ionicons
          name={isSafe ? "checkmark-circle" : "warning"}
          size={72}
          color={isSafe ? "#16a34a" : "#dc2626"}
        />
        <Text style={styles.statusTitle}>
          {isSafe ? "Safe for Consumption" : "Warning: Potential Counterfeit!"}
        </Text>
        <Text style={styles.statusSubtitle}>
          {isSafe
            ? "This medicine has been verified against the official database."
            : "This batch number has been flagged or could not be found. Do not consume!"}
        </Text>
      </View>

      {/* Details Section */}
      <View style={styles.detailsBox}>
        <Text style={styles.sectionTitle}>Medicine Details</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Name:</Text>
          <Text style={styles.value}>
            {params.name ? params.name : "Unknown"}
          </Text>
        </View>

        {params.salt ? (
          <View style={styles.row}>
            <Text style={styles.label}>Active Salt:</Text>
            <Text style={styles.value}>{params.salt}</Text>
          </View>
        ) : null}

        <View style={styles.row}>
          <Text style={styles.label}>Batch Number:</Text>
          <Text style={styles.value}>{batchNumber}</Text>
        </View>

        {params.mfdDate ? (
          <View style={styles.row}>
            <Text style={styles.label}>Mfg Date:</Text>
            <Text style={styles.value}>{params.mfdDate}</Text>
          </View>
        ) : null}

        {params.expDate ? (
          <View style={styles.row}>
            <Text style={styles.label}>Exp Date:</Text>
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
        onPress={() => router.replace("/(tabs)/scan")}
      >
        <Text style={styles.buttonText}>Scan Another Medicine</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 24, paddingBottom: 40 },
  statusCard: {
    alignItems: "center",
    padding: 32,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 24,
    marginTop: 10,
  },
  safeCard: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
  dangerCard: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  statusTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 16,
    textAlign: "center",
    color: "#0f172a",
  },
  statusSubtitle: {
    fontSize: 15,
    lineHeight: 22,
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
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 12,
  },
  label: { fontSize: 14, color: "#64748b", flex: 1 },
  value: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#0f172a",
    flex: 1,
    textAlign: "right",
  },
  button: {
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    elevation: 2,
  },
  buttonText: { color: "#ffffff", fontSize: 18, fontWeight: "bold" },
});
