import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppButton } from "../../components/AppButton";
import { TextField } from "../../components/TextField";
import { colors, radius, shadow, spacing, typography } from "../../theme";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [submitting, setSubmitting] = useState(false);

  const signIn = useCallback(
    async (token: string) => {
      setSubmitting(true);
      try {
        // ==== TODO: REPLACE WITH THE REAL API CALL ========================
        //
        // const response = await fetch(`${API_BASE_URL}/auth/login`, {
        //   method: "POST",
        //   headers: { "Content-Type": "application/json" },
        //   body: JSON.stringify({ email: email.trim(), password }),
        // });
        //
        // if (!response.ok) throw new Error("Incorrect email or password.");
        //
        // const { token } = await response.json();
        //
        // ==================================================================
        await AsyncStorage.setItem("userToken", token);

        const hasSeenOnboarding =
          await AsyncStorage.getItem("hasSeenOnboarding");
        router.replace(hasSeenOnboarding ? "/(tabs)/scan" : "/instructions");
      } catch (error) {
        Alert.alert(
          "Could not sign in",
          error instanceof Error
            ? error.message
            : "Something went wrong signing you in. Please try again.",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [router],
  );

  const handleLogin = useCallback(() => {
    const nextErrors: { email?: string; password?: string } = {};
    if (!email.trim()) nextErrors.email = "Enter your email address.";
    else if (!EMAIL_RE.test(email.trim()))
      nextErrors.email = "That does not look like a valid email address.";
    if (!password) nextErrors.password = "Enter your password.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    signIn("mock_jwt_token_123");
  }, [email, password, signIn]);

  const handleSocialLogin = useCallback(
    (provider: string) => {
      // In production the provider token comes from Expo AuthSession first and
      // is then exchanged for a session by the backend.
      signIn(`mock_${provider.toLowerCase()}_token_123`);
    },
    [signIn],
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.xxl,
            paddingBottom: insets.bottom + spacing.xxl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logo}>
          <Ionicons name="shield-checkmark" size={32} color={colors.primary} />
        </View>

        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>
          Sign in to verify medicines and keep your scan history.
        </Text>

        <View style={styles.form}>
          <TextField
            label="Email"
            placeholder="you@example.com"
            icon="mail-outline"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
            }}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
          />

          <TextField
            label="Password"
            placeholder="Your password"
            icon="lock-closed-outline"
            secure
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (errors.password)
                setErrors((e) => ({ ...e, password: undefined }));
            }}
            error={errors.password}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />

          <AppButton
            label="Log in"
            onPress={handleLogin}
            loading={submitting}
            style={styles.submit}
          />
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={submitting}
          onPress={() => handleSocialLogin("Google")}
          style={({ pressed }) => [
            styles.socialButton,
            pressed && styles.pressed,
          ]}
        >
          <FontAwesome5 name="google" size={18} color="#db4437" />
          <Text style={styles.socialText}>Continue with Google</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={submitting}
          onPress={() => handleSocialLogin("Apple")}
          style={({ pressed }) => [
            styles.socialButton,
            pressed && styles.pressed,
          ]}
        >
          <FontAwesome5 name="apple" size={20} color={colors.text} />
          <Text style={styles.socialText}>Continue with Apple</Text>
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>New to MediCheck? </Text>
          <Pressable
            accessibilityRole="link"
            hitSlop={8}
            onPress={() => router.push("/(auth)/register")}
          >
            <Text style={styles.footerLink}>Create an account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.xl, flexGrow: 1 },
  logo: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySurface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  title: { ...typography.display, color: colors.text },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xxl,
    lineHeight: 22,
  },
  form: { marginBottom: spacing.sm },
  submit: { marginTop: spacing.sm },

  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.xl,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: {
    ...typography.caption,
    color: colors.textMuted,
    marginHorizontal: spacing.md,
  },

  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 52,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  pressed: { opacity: 0.85 },
  socialText: {
    ...typography.heading,
    fontSize: 15,
    color: colors.text,
    marginLeft: spacing.md,
  },

  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.xl,
  },
  footerText: { ...typography.body, color: colors.textSecondary },
  footerLink: { ...typography.body, color: colors.primary, fontWeight: "700" },
});
