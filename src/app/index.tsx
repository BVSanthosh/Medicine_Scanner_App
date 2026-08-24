import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

export default function Index() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        // 1. Check local storage for an active user session token
        const userToken = await AsyncStorage.getItem("userToken");

        // 2. Route the user based on whether they are logged in
        if (userToken) {
          // User is logged in -> Send to the main scanner
          router.replace("/(tabs)/scan");
        } else {
          // No active session -> Send to the login screen
          router.replace("/(auth)/login");
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        // Fallback to the login screen if storage fails
        router.replace("/(auth)/login");
      } finally {
        setIsChecking(false);
      }
    };

    checkAuthStatus();
  }, []);

  // Show a blank screen with a loading spinner while checking storage
  if (isChecking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // Return null because the router.replace handles the actual UI transition
  return null;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
});
