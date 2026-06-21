import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "../src/providers/AuthProvider";

export default function SignInScreen() {
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

  const showError = (message: string) => {
    setError(message);
    if (Platform.OS !== "web") {
      Alert.alert("Error", message);
    }
  };

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
      const message =
        err instanceof Error ? err.message : "Something went wrong";

      if (message.toLowerCase().includes("email not confirmed")) {
        showError(
          "Please confirm your email first (check your inbox), or turn off email confirmation in Supabase Auth settings."
        );
      } else if (message.toLowerCase().includes("invalid login")) {
        showError("Wrong email or password. Try again.");
      } else {
        showError(message);
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
      <View style={styles.inner}>
        <Text style={styles.title}>FlexMax</Text>
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
            placeholderTextColor="#555"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#555"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#555"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          onSubmitEditing={handleSubmit}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {mode === "sign-in" ? "Sign in" : "Sign up"}
            </Text>
          )}
        </TouchableOpacity>

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
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f12" },
  inner: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 32, fontWeight: "700", color: "#f0f0f0", marginBottom: 4 },
  subtitle: { fontSize: 15, color: "#888", marginBottom: 24 },
  errorBox: {
    backgroundColor: "#3a1f1f",
    borderColor: "#7a3030",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    color: "#ffb4b4",
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    backgroundColor: "#1a1a1a",
    borderWidth: 0.5,
    borderColor: "#333",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#f0f0f0",
    fontSize: 16,
  },
  button: {
    backgroundColor: "#534AB7",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#EEEDFE", fontSize: 16, fontWeight: "600" },
  toggle: { color: "#888", textAlign: "center", marginTop: 16, fontSize: 14 },
});
