import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        {/* Main Tab Navigator */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* Authentication Flow */}
        <Stack.Screen
          name="(auth)/login"
          options={{
            headerShown: false,
            animation: "fade",
          }}
        />
        <Stack.Screen
          name="(auth)/register"
          options={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />

        {/* Results Screen */}
        <Stack.Screen
          name="result"
          options={{
            headerShown: true,
            title: "Verification Result",
            headerBackTitle: "Back",
            headerTintColor: "#0f172a",
            headerStyle: { backgroundColor: "#ffffff" },
            headerTitleStyle: { fontWeight: "bold" },
          }}
        />
      </Stack>
    </>
  );
}
