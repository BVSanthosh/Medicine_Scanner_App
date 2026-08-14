import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function HomeScreen() {
  // router allows us to navigate between screens
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <Text style={styles.title}>MediCheck</Text>
        <Text style={styles.subtitle}>
          Verify your medicine for safety and authenticity
        </Text>
      </View>

      {/* Main Action Buttons */}
      <View style={styles.actionContainer}>
        {/* Scan Button */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push("/scan")}
        >
          <Text style={styles.primaryButtonText}>Scan Medicine</Text>
        </TouchableOpacity>

        {/* Manual Entry Button */}
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push("/manual-entry")}
        >
          <Text style={styles.secondaryButtonText}>Enter Details Manually</Text>
        </TouchableOpacity>

        {/* View History Button */}
        <TouchableOpacity
          style={styles.tertiaryButton}
          onPress={() => router.push("/history")}
        >
          <Text style={styles.tertiaryButtonText}>View Scan History</Text>
        </TouchableOpacity>

        {/* TEMPORARY: Go to Login Button */}
        <TouchableOpacity
          style={styles.tertiaryButton}
          onPress={() => router.replace("/login")}
        >
          <Text style={[styles.tertiaryButtonText, { color: "#dc2626" }]}>
            Log Out
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// All styling happens down here
const styles = StyleSheet.create({
  container: {
    flex: 1, // Tells the view to fill the entire screen
    backgroundColor: "#f8fafc", // A soft, off-white background color
    padding: 24, // Adds breathing room around the edges
    justifyContent: "center", // Centers children vertically inside the container
  },
  header: {
    alignItems: "center", // Centers text horizontally
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#0f172a", // Dark navy blue
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#64748b", // Slate gray
    textAlign: "center",
  },
  actionContainer: {
    gap: 16, // Adds 16 pixels of space between the buttons
  },
  primaryButton: {
    backgroundColor: "#2563eb", // Bright blue
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    elevation: 3, // Adds a subtle drop shadow on Android
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
  },
  secondaryButton: {
    backgroundColor: "#ffffff",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#cbd5e1", // Light gray border
  },
  secondaryButtonText: {
    color: "#334155",
    fontSize: 16,
    fontWeight: "600",
  },
  tertiaryButton: {
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  tertiaryButtonText: {
    color: "#2563eb", // Blue text to look like a subtle link
    fontSize: 16,
    fontWeight: "600",
  },
});
