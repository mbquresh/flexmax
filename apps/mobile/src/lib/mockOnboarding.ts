import { supabase } from "./supabase";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const DEMO_QUESTIONS = [
  "Got it — that helps. What time of day do you actually have energy, not what you wish were true?",
  "When you've failed to stick to a routine before, what usually goes wrong?",
  "Do you do better when someone's checking on you, or does that make you rebel?",
  "What's one part of your day that almost always goes well, no matter what?",
  "That's everything I need. Let's build your schedule.",
];

export function getDemoReply(userTurnCount: number): {
  reply: string;
  isComplete: boolean;
} {
  if (userTurnCount >= DEMO_QUESTIONS.length) {
    return {
      reply: "That's everything I need. Let's build your schedule.",
      isComplete: true,
    };
  }

  const reply = DEMO_QUESTIONS[userTurnCount - 1];
  return {
    reply,
    isComplete: reply.includes("That's everything I need"),
  };
}

export async function saveDemoProfile(userId: string, messages: Message[]) {
  const userMessages = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content);

  const { data, error } = await supabase
    .from("psychology_profiles")
    .upsert({
      user_id: userId,
      onboarding_messages: messages,
      peak_energy_times: ["morning"],
      avoidance_patterns: [
        userMessages[0]?.slice(0, 80) ?? "putting off important tasks",
      ],
      motivation_style: "accountability",
      sabotage_triggers: ["tiredness", "distractions", "unclear next step"],
      goals: [userMessages[0]?.slice(0, 80) ?? "build a consistent routine"],
      accountability_tone: "gentle",
      raw_ai_summary:
        "Demo profile saved locally. Connect Anthropic later for a fully personalized AI profile.",
      completed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
