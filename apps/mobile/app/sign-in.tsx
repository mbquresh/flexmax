import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "../src/providers/AuthProvider";
import { useTheme } from "../src/providers/ThemeProvider";
import { handleError, getErrorMessage } from "../src/lib/errors";
import { BrandMark } from "../src/components/BrandMark";
import { PressableScale } from "../src/components/PressableScale";
import { Colors, spacing, radii, typography } from "../src/theme";

export default function SignInScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { signIn, signUp, session, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && session) {
      router.replace("/");
    }
  }, [session, authLoading]);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) return;
    if (mode === "sign-up" && !name.trim()) return;

    setError(null);
    setLoading(true);
    try {
      if (mode === "sign-in") {
        await signIn(email.trim(), password);
        router.replace("/");
      } else {
        await signUp(email.trim(), password, name.trim());
        setMode("sign-in");
        setError(
          "Account created. If email confirmation is on, check your inbox — then sign in."
        );
      }
    } catch (err) {
      const message = getErrorMessage(err);

      if (message.toLowerCase().includes("email not confirmed")) {
        const userMessage =
          "Please confirm your email first (check your inbox), or turn off email confirmation in Supabase Auth settings.";
        handleError(err, "signIn", userMessage);
        setError(userMessage);
      } else if (message.toLowerCase().includes("invalid login")) {
        const userMessage = "Wrong email or password. Try again.";
        handleError(err, "signIn", userMessage);
        setError(userMessage);
      } else {
        handleError(err, "signIn", message);
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
        <View style={styles.wordmark}>
          <BrandMark size={72} />
          <Text style={styles.title}>FlexMax</Text>
        </View>
        <Text style={styles.subtitle}>
          {mode === "sign-in" ? "Welcome back" : "Create your account"}
        </Text>

        {error ? (
          <Text style={styles.errorBox}>{error}</Text>
        ) : null}

        {mode === "sign-up" && (
          <TextInput
            style={styles.input}
            placeholder="Name"
            placeholderTextColor={colors.textPlaceholder}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.textPlaceholder}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.textPlaceholder}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          onSubmitEditing={handleSubmit}
        />

        <PressableScale
          style={styles.button}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.buttonText}>
              {mode === "sign-in" ? "Sign in" : "Sign up"}
            </Text>
          )}
        </PressableScale>

        <TouchableOpacity
          onPress={() => {
            setMode(mode === "sign-in" ? "sign-up" : "sign-in");
            setError(null);
          }}
        >
          <Text style={styles.toggle}>
            {mode === "sign-in"
              ? "Need an account? Sign up"
              : "Already have an account? Sign in"}
          </Text>
        </TouchableOpacity>

        <View style={styles.footerMark}>
          <BrandMark size={28} />
        </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    scrollContent: { flexGrow: 1, justifyContent: "center" },
    inner: { padding: spacing.xxl, gap: spacing.md },
    wordmark: { gap: spacing.lg },
    title: { ...typography.display, color: c.text, marginBottom: spacing.xs },
    subtitle: { fontSize: 15, color: c.textMuted, marginBottom: spacing.xxl },
    errorBox: {
      backgroundColor: c.errorTint,
      borderColor: c.errorBorder,
      borderWidth: 1,
      borderRadius: radii.md,
      padding: spacing.md,
      color: c.error,
      fontSize: 14,
      lineHeight: 20,
    },
    input: {
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
      borderRadius: radii.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: 14,
      color: c.text,
      fontSize: 16,
    },
    button: {
      backgroundColor: c.primary,
      borderRadius: radii.lg,
      paddingVertical: spacing.lg,
      alignItems: "center",
      marginTop: spacing.sm,
    },
    buttonText: { color: c.onPrimary, fontSize: 16, fontWeight: "600" },
    toggle: { color: c.textMuted, textAlign: "center", marginTop: spacing.lg, fontSize: 14 },
    footerMark: { marginTop: spacing.xxxl, opacity: 0.4, alignItems: "center" },
  });
