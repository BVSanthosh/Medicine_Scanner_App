import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
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

export default function ManualEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Form State
  const [name, setName] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [mfdDate, setMfdDate] = useState("");
  const [expDate, setExpDate] = useState("");
  const [dose, setDose] = useState("");

  // Helper UI State
  const [showRawText, setShowRawText] = useState(false);

  // Sync state with incoming parameters when routed from the Scanner tab
  useEffect(() => {
    if (params) {
      setName((params.name as string) || "");
      setBatchNumber((params.batchNumber as string) || "");
      setMfdDate((params.mfdDate as string) || "");
      setExpDate((params.expDate as string) || "");
      setDose((params.dose as string) || "");

      // Automatically show the helper box if raw text was passed
      if (params.rawText) {
        setShowRawText(true);
      }
    }
  }, [
    params.name,
    params.batchNumber,
    params.mfdDate,
    params.expDate,
    params.dose,
    params.rawText,
  ]);

  const handleSubmit = () => {
    if (!batchNumber) {
      Alert.alert(
        "Required Field",
        "Please enter at least the Batch Number to verify the medicine.",
      );
      return;
    }

    // Submit data to the Results screen
    router.push({
      pathname: "/result",
      params: {
        name,
        batchNumber,
        mfdDate,
        expDate,
        dose,
        method: params.rawText ? "ocr_corrected" : "manual",
        lat: params.lat || "",
        lng: params.lng || "",
      },
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Manual Entry</Text>
        <Text style={styles.subtitle}>
          Enter or correct the medicine details below for verification.
        </Text>

        {/* OCR Helper Box - Only renders if the LLM struggled and passed raw text */}
        {showRawText && params.rawText && (
          <View style={styles.helperBox}>
            <View style={styles.helperHeader}>
              <Text style={styles.helperTitle}>Extracted Text</Text>
              <TouchableOpacity onPress={() => setShowRawText(false)}>
                <Ionicons name="close-circle" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <Text style={styles.helperText}>{params.rawText}</Text>
            <Text style={styles.helperInstruction}>
              Use the text above to find the missing details.
            </Text>
          </View>
        )}

        <View style={styles.formGroup}>
          <Text style={styles.label}>Medicine Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Paracetamol"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Batch Number *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. B.NO.12345"
            value={batchNumber}
            onChangeText={setBatchNumber}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Manufacturing Date</Text>
          <TextInput
            style={styles.input}
            placeholder="MM/YYYY or DD/MM/YYYY"
            value={mfdDate}
            onChangeText={setMfdDate}
          />

          <Text style={styles.label}>Expiration Date</Text>
          <TextInput
            style={styles.input}
            placeholder="MM/YYYY or DD/MM/YYYY"
            value={expDate}
            onChangeText={setExpDate}
          />

          <Text style={styles.label}>Dose</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 500mg"
            value={dose}
            onChangeText={setDose}
          />
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Verify Medicine</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollContent: {
    padding: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#64748b",
    marginBottom: 24,
  },
  helperBox: {
    backgroundColor: "#e0f2fe",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bae6fd",
    marginBottom: 24,
  },
  helperHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  helperTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#0369a1",
  },
  helperText: {
    fontSize: 14,
    color: "#0c4a6e",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginBottom: 8,
  },
  helperInstruction: {
    fontSize: 12,
    color: "#0284c7",
    fontStyle: "italic",
  },
  formGroup: {
    marginBottom: 16,
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
  submitButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
  submitButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
  },
});
