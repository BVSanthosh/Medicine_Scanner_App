import { CameraView, useCameraPermissions } from "expo-camera";
import { recognizeText } from "expo-mlkit-ocr";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getUserLocation } from "../../services/location";

export default function ScannerScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  // State Management
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [scanned, setScanned] = useState(false);

  if (!permission?.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.message}>
          Camera permission is required to scan medicines.
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={requestPermission}
        >
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 2. LAYER 1: Standard Barcode Scan
  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);
    setLoadingText("Verifying barcode...");

    const location = await getUserLocation();

    setLoading(false);
    router.push({
      pathname: "/result",
      params: {
        barcode: data,
        method: "barcode",
        lat: location?.latitude || "",
        lng: location?.longitude || "",
      },
    });
  };

  // 3. LAYER 2: OCR -> Backend LLM Extraction
  const handleCaptureForOCR = async () => {
    if (!cameraRef.current || loading) return;

    try {
      setLoading(true);
      setLoadingText("Extracting text locally...");

      // 1. Take the full-resolution photo
      const photo = await cameraRef.current.takePictureAsync();

      // 2. Pass the image to the OCR
      const ocrResult = await recognizeText(photo.uri);
      const rawText = ocrResult.text;

      if (!rawText || rawText.trim() === "") {
        throw new Error("No text found in the target area.");
      }

      setLoadingText("Analyzing with AI...");
      const location = await getUserLocation();

      // 5. Send strictly the cropped text to the backend
      const llmResponse = await mockBackendLLMProcess(rawText);

      setLoading(false);

      if (llmResponse.batchNumber && llmResponse.name) {
        router.push({
          pathname: "/result",
          params: {
            ...llmResponse,
            method: "ocr_llm_success",
            lat: location?.latitude || "",
            lng: location?.longitude || "",
          },
        });
      } else {
        router.push({
          pathname: "/(tabs)/manual-entry",
          params: {
            ...llmResponse,
            rawText: rawText,
            method: "ocr_llm_partial",
            lat: location?.latitude || "",
            lng: location?.longitude || "",
          },
        });
      }
    } catch (error) {
      setLoading(false);
      console.error("🚨 EXACT ERROR: ", error);
      alert("Could not read text clearly inside the frame. Please try again.");
    }
  };

  // Mock function to simulate your Python/Gemini Backend returning JSON
  const mockBackendLLMProcess = async (text: string) => {
    return new Promise<any>((resolve) => {
      setTimeout(() => {
        // Simulate a scenario where batch number is found
        resolve({
          name: "Paracetamol",
          batchNumber: "B.NO.49302",
          expDate: "12/2026",
          dose: "500mg",
        });
      }, 1500);
    });
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        ref={cameraRef}
        onBarcodeScanned={handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr", "ean13", "ean8", "code128", "upc_a"],
        }}
      />
      <View style={styles.overlay}>
        <View style={styles.scanTarget} />
        <Text style={styles.instruction}>
          Align Barcode inside frame OR capture text below
        </Text>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>{loadingText}</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.captureButton}
            onPress={handleCaptureForOCR}
          >
            <Text style={styles.captureButtonText}>Scan Text</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  message: {
    textAlign: "center",
    marginBottom: 16,
    fontSize: 16,
    color: "#334155",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 40,
    zIndex: 10,
    elevation: 10,
  },
  scanTarget: {
    width: 280,
    height: 140,
    borderWidth: 2,
    borderColor: "#3b82f6",
    borderRadius: 12,
    backgroundColor: "transparent",
  },
  instruction: {
    color: "#ffffff",
    fontSize: 14,
    marginTop: 20,
    fontWeight: "600",
    textAlign: "center",
  },
  captureButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 40,
  },
  captureButtonText: { color: "#ffffff", fontSize: 16, fontWeight: "bold" },
  primaryButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    width: "100%",
    marginTop: 16,
  },
  buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "bold" },
  loadingBox: { alignItems: "center", marginTop: 40 },
  loadingText: {
    color: "#ffffff",
    marginTop: 12,
    fontSize: 14,
    fontWeight: "500",
  },
});
