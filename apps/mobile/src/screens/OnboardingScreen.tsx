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
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
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

export default function OnboardingScreen() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const listRef = useRef<FlatList>(null);
  const { session, refreshProfile } = useAuth();
  const { setPsychologyProfile } = useStore();
  const userId = session?.user.id;

  useEffect(() => {
    // Scroll to bottom when new message arrives
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      // Call our Supabase edge function (which holds the API key)
      const { data, error } = await supabase.functions.invoke("onboarding-chat", {
        body: { messages: updatedMessages },
      });

      if (error) throw error;

      const { reply, isComplete: done } = data;
      const aiMessage: Message = { role: "assistant", content: reply };
      const finalMessages = [...updatedMessages, aiMessage];
      setMessages(finalMessages);

      if (done) {
        setIsComplete(true);
        // Extract psychology profile
        await extractAndSaveProfile(finalMessages);
      }
    } catch (err) {
      console.error("Onboarding error:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Something went wrong — mind trying that again?",
        },
      ]);
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>FlexMax</Text>
        <Text style={styles.headerSub}>Understanding how you work</Text>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => i.toString()}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
      />

      {isComplete ? (
        <View style={styles.completeBox}>
          <Text style={styles.completeText}>
            Profile built. Let's design your schedule.
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
            placeholderTextColor="#555"
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
  container: { flex: 1, backgroundColor: "#0f0f12" },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#222",
  },
  headerTitle: { fontSize: 20, fontWeight: "600", color: "#f0f0f0" },
  headerSub: { fontSize: 13, color: "#666", marginTop: 2 },
  messageList: { padding: 16, paddingBottom: 8 },
  messageWrapper: { marginBottom: 12 },
  aiWrapper: { alignItems: "flex-start" },
  userWrapper: { alignItems: "flex-end" },
  bubble: { maxWidth: "82%", borderRadius: 14, padding: 12 },
  aiBubble: { backgroundColor: "#1e1e28", borderBottomLeftRadius: 2 },
  userBubble: { backgroundColor: "#2d2250", borderBottomRightRadius: 2 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  aiText: { color: "#d0d0d0" },
  userText: { color: "#EEEDFE" },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    paddingBottom: 28,
    borderTopWidth: 0.5,
    borderTopColor: "#1e1e1e",
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderWidth: 0.5,
    borderColor: "#333",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: "#f0f0f0",
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#534AB7",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: "#2a2640" },
  sendIcon: { color: "#fff", fontSize: 18 },
  completeBox: {
    padding: 20,
    paddingBottom: 40,
    borderTopWidth: 0.5,
    borderTopColor: "#1e1e1e",
    alignItems: "center",
    gap: 12,
  },
  completeText: { color: "#888", fontSize: 14, textAlign: "center" },
  completeBtn: {
    backgroundColor: "#534AB7",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  completeBtnText: { color: "#EEEDFE", fontSize: 16, fontWeight: "600" },
});
