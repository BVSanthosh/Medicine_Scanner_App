import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function ScanScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");

  // --- BARCODE DETECTION STATE ---
  const [detectedBarcode, setDetectedBarcode] = useState<string | null>(null);
  // We use a ref for the timer so it doesn't trigger re-renders when counting down
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer if the user leaves the screen
  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.message}>
          We need your permission to show the camera
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- FEATURE 1: Capture Photo for OCR ---
  const handleCaptureForOCR = async () => {
    if (!cameraRef.current) return;
    try {
      setLoading(true);
      setLoadingText("Reading package text...");

      const photo = await cameraRef.current.takePictureAsync({
        skipProcessing: false,
      });
      if (!photo?.uri) throw new Error("Failed to capture image");

      // Simulated OCR Extraction (Replace with your ML Kit logic later)
      const extractedData = {
        name: "Sample Paracetamol",
        batchNumber: "",
        expDate: "12/2028",
        dose: "500mg",
      };

      setLoading(false);
      router.push({
        pathname: "/manual-entry",
        params: extractedData,
      });
    } catch (error) {
      setLoading(false);
      Alert.alert("Scan Failed", "Could not read text from image.");
    }
  };

  // --- FEATURE 2: Dynamic Barcode Detection ---
  const handleBarCodeScanned = ({
    type,
    data,
  }: {
    type: string;
    data: string;
  }) => {
    // 1. Show the button and save the data
    setDetectedBarcode(data);

    // 2. Clear any existing timer
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
    }

    // 3. Start a new timer. If the camera doesn't scan a barcode for 1.2 seconds,
    // we assume the user pointed the camera away, and we hide the button.
    hideTimer.current = setTimeout(() => {
      setDetectedBarcode(null);
    }, 1200);
  };

  // Called when the user explicitly taps the pop-up barcode button
  const confirmBarcodeSelection = () => {
    if (!detectedBarcode) return;

    // Stop the timer and clear the screen
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setDetectedBarcode(null);

    // Send the captured barcode to your Manual Entry Screen
    router.push({
      pathname: "/manual-entry",
      params: { batchNumber: detectedBarcode },
    });
  };

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        onBarcodeScanned={handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr", "ean13", "ean8", "code128", "upc_a"],
        }}
      >
        <View style={styles.overlayContainer}>
          <View style={styles.scanBox} />
          <Text style={styles.instructionText}>Align package inside box</Text>
        </View>

        <View style={styles.buttonContainer}>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#ffffff" />
              <Text style={styles.loadingText}>{loadingText}</Text>
            </View>
          ) : (
            <>
              {/* This button ONLY appears when a barcode is in the viewfinder */}
              {detectedBarcode && (
                <TouchableOpacity
                  style={styles.barcodeFoundButton}
                  onPress={confirmBarcodeSelection}
                >
                  <Text style={styles.barcodeFoundText}>
                    Use Barcode: {detectedBarcode}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Standard OCR Capture Button (Always visible) */}
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleCaptureForOCR}
              >
                <Text style={styles.buttonText}>Scan Text (OCR)</Text>
              </TouchableOpacity>
            </>
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
  },
  camera: { flex: 1 },
  overlayContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  scanBox: {
    width: 280,
    height: 140,
    borderWidth: 2,
    borderColor: "#3b82f6",
    backgroundColor: "transparent",
    borderRadius: 12,
  },
  instructionText: {
    color: "#ffffff",
    marginTop: 16,
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  buttonContainer: {
    position: "absolute",
    bottom: 40,
    left: 24,
    right: 24,
    gap: 16,
  },
  primaryButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: { color: "#ffffff", fontSize: 18, fontWeight: "bold" },
  barcodeFoundButton: {
    backgroundColor: "#16a34a",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  barcodeFoundText: { color: "#ffffff", fontSize: 16, fontWeight: "bold" },
  loadingBox: { alignItems: "center", paddingVertical: 20 },
  loadingText: { color: "#ffffff", marginTop: 8, fontSize: 16 },
  message: {
    textAlign: "center",
    paddingBottom: 10,
    fontSize: 16,
    color: "#334155",
  },
  button: { backgroundColor: "#2563eb", padding: 12, borderRadius: 8 },
});
