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
import { getUserLocation } from "../services/location";
import { parseIndianMedicineLabel } from "../services/ocrParser";

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);
  const cameraRef = useRef<any>(null);

  if (!permission || !permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.message}>
          Camera permission is required to scan medicines.
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // LAYER 1: Standard Barcode Scanned Automatically
  const handleBarcodeScanned = async ({
    type,
    data,
  }: {
    type: string;
    data: string;
  }) => {
    if (scanned) return;
    setScanned(true);
    setLoading(true);

    // Silently grab background location
    const location = await getUserLocation();

    // Route to result screen with barcode data & location
    router.push({
      pathname: "/result",
      params: {
        barcode: data,
        method: "barcode",
        lat: location?.latitude || "",
        lng: location?.longitude || "",
      },
    });

    setLoading(false);
  };

  // LAYER 2: OCR Fallback (Triggered manually via button if barcode is missing)
  const handleManualCaptureOCR = async () => {
    if (cameraRef.current && !loading) {
      try {
        setLoading(true);

        // 1. Take snapshot image
        const photo = await cameraRef.current.takePictureAsync({
          skipProcessing: true,
        });

        // 2. Extract text locally via ML Kit OCR
        const ocrResult = await recognizeText(photo.uri);
        const extractedData = parseIndianMedicineLabel(ocrResult.text);

        // 3. Grab background location
        const location = await getUserLocation();

        setLoading(false);

        // Check if we found meaningful details
        if (extractedData.batchNumber || extractedData.expDate) {
          router.push({
            pathname: "/result",
            params: {
              ...extractedData,
              method: "ocr",
              lat: location?.latitude || "",
              lng: location?.longitude || "",
            },
          });
        } else {
          // LAYER 3: Ultimate Fallback -> Manual Entry
          alert(
            "Could not read package text clearly. Please enter details manually.",
          );
          router.push("/manual-entry");
        }
      } catch (error) {
        setLoading(false);
        router.push("/manual-entry");
      }
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        ref={cameraRef}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      >
        <View style={styles.overlay}>
          <View style={styles.scanTarget} />
          <Text style={styles.instruction}>
            Align Barcode inside frame OR capture text below
          </Text>

          {loading ? (
            <ActivityIndicator
              size="large"
              color="#3b82f6"
              style={{ marginTop: 20 }}
            />
          ) : (
            <TouchableOpacity
              style={styles.captureButton}
              onPress={handleManualCaptureOCR}
            >
              <Text style={styles.captureButtonText}>Capture Text (OCR)</Text>
            </TouchableOpacity>
          )}
        </View>
      </CameraView>
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
  button: {
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 40,
  },
  scanTarget: {
    width: 300,
    height: 140,
    borderWidth: 2,
    borderColor: "#3b82f6",
    borderRadius: 12,
    backgroundColor: "transparent",
  },
  instruction: {
    color: "#ffffff",
    fontSize: 13,
    marginTop: 20,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  captureButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 30,
  },
  captureButtonText: { color: "#ffffff", fontSize: 16, fontWeight: "bold" },
});
