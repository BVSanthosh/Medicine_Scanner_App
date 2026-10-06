import * as Location from "expo-location";
import { Alert, Linking } from "react-native";

export async function getUserLocation() {
  try {
    // 1. Check current permission status before asking
    const { status: existingStatus, canAskAgain } =
      await Location.getForegroundPermissionsAsync();

    let finalStatus = existingStatus;

    // 2. If we don't have permission and the OS allows us to ask, request it
    if (existingStatus !== "granted" && canAskAgain) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      finalStatus = status;
    }

    // 3. If they denied it (or previously denied it forever), prompt them to open OS Settings
    if (finalStatus !== "granted") {
      Alert.alert(
        "Location Required",
        "Location permissions are needed to track where this medicine is being scanned to help detect counterfeit hotspots. Please enable it in your settings.",
        [
          { text: "Continue Without", style: "cancel" },
          {
            text: "Open Settings",
            // Linking.openSettings() automatically deep-links to your app's specific settings page
            onPress: () => Linking.openSettings(),
          },
        ],
      );
      return null;
    }

    // 4. Fetch the actual GPS coordinates
    const location = await Location.getCurrentPositionAsync({
      // Balanced is faster and uses less battery than Highest
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    console.error("Error fetching location:", error);
    return null;
  }
}
