import { useRouter } from "expo-router";
import { useState } from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
} from "react-native";

export default function ManualEntryScreen() {
  const router = useRouter();

  // We use state to hold the values the user types into the text boxes
  const [medicineName, setMedicineName] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [dose, setDose] = useState("");

  // This function runs when the user taps the Verify button
  const handleVerify = () => {
    // Basic validation: make sure they didn't leave the important fields blank
    if (!medicineName || !batchNumber) {
      Alert.alert(
        "Missing Info",
        "Please enter at least the Medicine Name and Batch Number.",
      );
      return;
    }

    // Push to Result screen and pass data as an object
    router.push({
      pathname: "/result",
      params: {
        name: medicineName,
        batch: batchNumber,
        dose: dose,
      },
    });

    // For now, we'll just show an alert. Next, we'll send this to a Result screen!
    Alert.alert(
      "Success",
      `Checking ${medicineName} (Batch: ${batchNumber})...`,
    );
  };

  return (
    // We use a ScrollView instead of a normal View so the screen can scroll
    // when the phone's digital keyboard pops up and covers the bottom of the screen.
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Enter Details</Text>
      <Text style={styles.subtitle}>
        Type the details found on the medicine packaging.
      </Text>

      {/* Input for Medicine Name */}
      <Text style={styles.label}>Medicine Name *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., Paracetamol"
        value={medicineName}
        onChangeText={setMedicineName} // Updates the state every time a letter is typed
      />

      {/* Input for Batch Number */}
      <Text style={styles.label}>Batch Number *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., BATCH-12345"
        value={batchNumber}
        onChangeText={setBatchNumber}
        autoCapitalize="characters" // Automatically makes the keyboard uppercase
      />

      {/* Input for Dose */}
      <Text style={styles.label}>Dose / Strength (Optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., 500mg"
        value={dose}
        onChangeText={setDose}
      />

      {/* Submit Button */}
      <TouchableOpacity style={styles.button} onPress={handleVerify}>
        <Text style={styles.buttonText}>Verify Medicine</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#64748b",
    marginBottom: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
    color: "#0f172a",
  },
  button: {
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
  },
});
