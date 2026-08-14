import * as Location from "expo-location";

export async function getUserLocation() {
  try {
    // 1. Prompt the user for permission to access location
    const { status } = await Location.requestForegroundPermissionsAsync();

    // If they click "Deny", we just return null and move on smoothly
    if (status !== "granted") {
      console.log("Permission to access location was denied");
      return null;
    }

    // 2. Fetch the actual GPS coordinates
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    // Return an object with just the data we care about
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    console.error("Error fetching location:", error);
    return null;
  }
}
