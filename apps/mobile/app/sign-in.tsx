import React, { useState } from "react";
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
import { useAuth } from "../src/providers/AuthProvider";

export default function SignInScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) return;
    if (mode === "sign-up" && !name.trim()) return;

    setLoading(true);
    try {
      if (mode === "sign-in") {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password, name.trim());
        Alert.alert(
          "Check your email",
          "Confirm your account if email verification is enabled, then sign in."
        );
        setMode("sign-in");
      }
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Something went wrong");
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
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#555"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
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

        <TouchableOpacity onPress={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}>
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
