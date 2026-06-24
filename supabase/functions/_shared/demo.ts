import { ONBOARDING_CLOSING } from "./prompts.ts";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const DEMO_REPLIES: Record<number, string> = {
  1: "Got it. When do you actually have energy during the day — morning, afternoon, or evening?",
  2: "Noted. When you've tried to stick to a routine before, what usually gets in the way?",
  3: "Makes sense. Does having someone or something check on you help you stay on track, or does it backfire?",
  4: ONBOARDING_CLOSING,
};

export function getDemoReply(turnCount: number): {
  reply: string;
  isComplete: boolean;
} {
  const reply = DEMO_REPLIES[turnCount] ?? ONBOARDING_CLOSING;
  return {
    reply,
    isComplete: reply.includes(ONBOARDING_CLOSING),
  };
}

export function buildDemoScheduleTips(profile: Record<string, unknown>): string[] {
  const peak =
    (profile.peak_energy_times as string[] | null)?.[0] ?? "morning";
  const trigger =
    (profile.sabotage_triggers as string[] | null)?.[0] ?? "distractions";
  const goal = (profile.goals as string[] | null)?.[0] ?? "your top priority";
  const tone = (profile.accountability_tone as string | null) ?? "gentle";

  return [
    `Block deep work during your ${peak} energy — that's when you'll actually follow through.`,
    `Watch for ${trigger}; shorter blocks on risky days beat ambitious ones you skip.`,
    `Name blocks after ${goal} so each slot has a clear why, not just a time slot.`,
    tone === "firm"
      ? "Set hard start times — your profile responds better to structure than flexibility."
      : "Leave small buffers between blocks — gentle accountability works better than a packed day.",
  ];
}

export function buildDemoProfile(messages: ChatMessage[]) {
  const userMessages = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content);

  return {
    peak_energy_times: ["morning"],
    avoidance_patterns: [
      userMessages[0]?.slice(0, 80) ?? "putting off important tasks",
    ],
    motivation_style: "accountability" as const,
    sabotage_triggers: ["tiredness", "distractions", "unclear next step"],
    goals: [userMessages[0]?.slice(0, 80) ?? "build a consistent routine"],
    accountability_tone: "gentle" as const,
    raw_ai_summary:
      "Demo profile from scripted onboarding. Switch AI_PROVIDER to gemini or anthropic for real extraction.",
  };
}
