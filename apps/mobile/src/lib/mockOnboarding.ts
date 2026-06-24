import { supabase } from "./supabase";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const CLOSING = "That's everything I need. Let's build your schedule.";

const DEMO_REPLIES: Record<number, string> = {
  1: "Got it. When do you actually have energy during the day — morning, afternoon, or evening?",
  2: "Noted. When you've tried to stick to a routine before, what usually gets in the way?",
  3: "Makes sense. Does having someone or something check on you help you stay on track, or does it backfire?",
  4: CLOSING,
};

export function getDemoReply(turnCount: number): {
  reply: string;
  isComplete: boolean;
} {
  const reply = DEMO_REPLIES[turnCount] ?? CLOSING;
  return {
    reply,
    isComplete: reply.includes(CLOSING),
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
        "Demo profile saved locally. Deploy edge functions for real AI extraction.",
      completed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
