/**
 * OnboardingScreen
 *
 * AI-driven onboarding chat. Sends messages to our Supabase edge function
 * which proxies to the Claude API (API key never touches the client).
 * On completion, saves the psychology profile and navigates to schedule builder.
 */

import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { saveDemoProfile } from "../lib/mockOnboarding";
import { useAuth } from "../providers/AuthProvider";
import { useStore } from "../store";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content:
    "Hey — before we build your schedule, I want to understand how you actually work.\n\nWhat's one thing you keep putting off, even though you know it matters?",
};

const PROVIDER_LABELS: Record<string, string> = {
  demo: "Demo mode — scripted replies",
  gemini: "Powered by Gemini (dev)",
  anthropic: "Powered by Claude",
  offline: "Offline demo — deploy edge functions for real AI",
};

export default function OnboardingScreen() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [aiProvider, setAiProvider] = useState<string>("anthropic");
  const listRef = useRef<FlatList>(null);
  const { session, refreshProfile } = useAuth();
  const { setPsychologyProfile } = useStore();
  const userId = session?.user.id;

  useEffect(() => {
    // Scroll to bottom when new message arrives
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  const finishOnboarding = async (finalMessages: Message[]) => {
    setIsComplete(true);
    if (!userId) return;

    try {
      if (aiProvider === "offline") {
        const profile = await saveDemoProfile(userId, finalMessages);
        setPsychologyProfile(profile);
        await refreshProfile();
        return;
      }

      await extractAndSaveProfile(finalMessages);
    } catch (err) {
      console.error("Profile save error:", err);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("onboarding-chat", {
        body: { messages: updatedMessages },
      });

      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      if (!data?.reply) throw new Error("AI backend not set up yet");

      if (data.provider) setAiProvider(String(data.provider));

      const { reply, isComplete: done } = data;
      const finalMessages = [
        ...updatedMessages,
        { role: "assistant" as const, content: reply },
      ];
      setMessages(finalMessages);

      if (done) await finishOnboarding(finalMessages);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Onboarding error:", err);
      if (Platform.OS !== "web") {
        Alert.alert("Something went wrong", message);
      }
    } finally {
      setLoading(false);
    }
  };

  const extractAndSaveProfile = async (msgs: Message[]) => {
    if (!userId) return;

    try {
      const { data, error } = await supabase.functions.invoke(
        "extract-psychology-profile",
        { body: { messages: msgs } }
      );

      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      if (data?.provider) setAiProvider(String(data.provider));
      setPsychologyProfile(data.profile);
      await refreshProfile();
    } catch (err) {
      console.error("Profile extraction error:", err);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.messageWrapper,
        item.role === "user" ? styles.userWrapper : styles.aiWrapper,
      ]}
    >
      <View
        style={[
          styles.bubble,
          item.role === "user" ? styles.userBubble : styles.aiBubble,
        ]}
      >
        <Text
          style={[
            styles.bubbleText,
            item.role === "user" ? styles.userText : styles.aiText,
          ]}
        >
          {item.content}
        </Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={88}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => i.toString()}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>FlexMax</Text>
            <Text style={styles.headerSub}>
              {PROVIDER_LABELS[aiProvider] ?? "Understanding how you work"}
            </Text>
          </View>
        }
      />

      {isComplete ? (
        <View style={styles.completeBox}>
          <Text style={styles.completeText}>
            Profile built. We'll share a few tips tailored to your answers as you build your schedule.
          </Text>
          <TouchableOpacity
            style={styles.completeBtn}
            onPress={() => router.replace("/schedule-builder")}
          >
            <Text style={styles.completeBtnText}>Build my schedule →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Type your answer..."
            placeholderTextColor="#999999"
            multiline
            onSubmitEditing={sendMessage}
            returnKeyType="send"
            editable={!loading}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!input.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.sendIcon}>→</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#DCDCDC" },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#CCCCCC",
  },
  headerTitle: { fontSize: 20, fontWeight: "600", color: "#1E1E1E" },
  headerSub: { fontSize: 13, color: "#888888", marginTop: 2 },
  messageList: { padding: 16, paddingBottom: 8 },
  messageWrapper: { marginBottom: 12 },
  aiWrapper: { alignItems: "flex-start" },
  userWrapper: { alignItems: "flex-end" },
  bubble: { maxWidth: "82%", borderRadius: 14, padding: 12 },
  aiBubble: { backgroundColor: "#EDEDED", borderBottomLeftRadius: 2 },
  userBubble: { backgroundColor: "#2C4A6E", borderBottomRightRadius: 2 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  aiText: { color: "#333333" },
  userText: { color: "#FFFFFF" },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    paddingBottom: 28,
    borderTopWidth: 0.5,
    borderTopColor: "#EDEDED",
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: "#EDEDED",
    borderWidth: 0.5,
    borderColor: "#C4C4C4",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: "#1E1E1E",
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#3B6EA5",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: "#A8C0DC" },
  sendIcon: { color: "#fff", fontSize: 18 },
  completeBox: {
    padding: 20,
    paddingBottom: 40,
    borderTopWidth: 0.5,
    borderTopColor: "#EDEDED",
    alignItems: "center",
    gap: 12,
  },
  completeText: { color: "#666666", fontSize: 14, textAlign: "center" },
  completeBtn: {
    backgroundColor: "#3B6EA5",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  completeBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
});
