import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Dimensions,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function InstructionsScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [currentGuideStep, setCurrentGuideStep] = useState(0);

  // Use require() to load local images from your assets folder
  const guideSteps = [
    {
      title: "Align Barcode",
      desc: "Place the medicine's barcode squarely inside the blue box.",
      image: require("../../assets/instruction1.png"),
    },
    {
      title: "Good Lighting",
      desc: "Ensure there is no glare blocking the text or barcode.",
      image: require("../../assets/instruction2.png"),
    },
    {
      title: "Scan Text Directly",
      desc: "If the barcode fails, tap 'Scan Text' to read the printed label.",
      image: require("../../assets/instruction3.png"),
    },
  ];

  const handleScroll = (event: any) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(scrollPosition / SCREEN_WIDTH);
    setCurrentGuideStep(currentIndex);
  };

  const completeOnboardingAndRequestPermissions = async () => {
    await AsyncStorage.setItem("hasSeenOnboarding", "true");

    if (!permission?.granted) {
      await requestPermission();
    }

    await Location.requestForegroundPermissionsAsync();
    router.replace("/(tabs)/scan");
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>How to Scan</Text>

      <View style={styles.carouselContainer}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          style={styles.scrollView}
        >
          {guideSteps.map((step, index) => (
            <View key={index} style={styles.slide}>
              {/* React Native Image component loading local require() source */}
              <Image
                source={step.image}
                style={styles.guideImage}
                resizeMode="contain"
              />
              <Text style={styles.slideTitle}>{step.title}</Text>
              <Text style={styles.slideDesc}>{step.desc}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={styles.pagination}>
        {guideSteps.map((_, index) => (
          <View
            key={index}
            style={[styles.dot, currentGuideStep === index && styles.activeDot]}
          />
        ))}
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={completeOnboardingAndRequestPermissions}
      >
        <Text style={styles.buttonText}>Get Started</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 32,
    marginTop: 40,
  },
  carouselContainer: {
    height: 340,
    width: SCREEN_WIDTH,
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    alignItems: "center",
    paddingHorizontal: 40,
  },
  guideImage: {
    width: "100%",
    height: 200,
    borderRadius: 16,
    marginBottom: 24,
  },
  slideTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 12,
    textAlign: "center",
  },
  slideDesc: {
    fontSize: 16,
    color: "#475569",
    textAlign: "center",
    lineHeight: 24,
  },
  pagination: {
    flexDirection: "row",
    marginTop: 24,
    marginBottom: 40,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#cbd5e1",
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: "#2563eb",
    width: 20,
  },
  primaryButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: "center",
    width: "100%",
    marginBottom: 20,
  },
  buttonText: { color: "#ffffff", fontSize: 18, fontWeight: "bold" },
});
