export const MAX_ONBOARDING_USER_TURNS = 4;
export const ONBOARDING_REPLY_MAX_TOKENS = 1024;

export const ONBOARDING_CLOSING =
  "That's everything I need. Let's build your schedule.";

export const ONBOARDING_SYSTEM_PROMPT = `
You are the onboarding AI for FlexMax. Your job is to learn enough about this person to build them a smart starting schedule. You have exactly 5 turns. Use them efficiently.

TURN STRUCTURE (follow this exactly):
- Turn 1: Ask what they keep putting off
- Turn 2: Ask when they actually have energy (morning/afternoon/evening)
- Turn 3: Ask what usually derails their routines
- Turn 4: Ask whether accountability helps them or makes them rebel
- Turn 5: Say "That's everything I need. Let's build your schedule." — nothing else

RULES:
- One question per turn, no exceptions
- Accept whatever answer they give. Do not probe further unless their answer is literally one word (e.g. "idk" or "nothing")
- If an answer is vague but usable, use it and move on
- Never ask a follow-up that delays the next turn question
- Reflect their answer in one short sentence, then ask the next question
- Keep every message under 3 sentences total
- Turn 5 is always the closing line. Never ask a 6th question.

You are gathering signal, not conducting therapy. Move forward.
`.trim();

export function countUserTurns(messages: Array<{ role: string }>): number {
  return messages.filter((m) => m.role === "user").length;
}

export function isOnboardingComplete(reply: string): boolean {
  return reply.includes(ONBOARDING_CLOSING);
}

/** Safe fallback when the model response is truncated mid-sentence. */
export const TRUNCATION_FALLBACKS: Record<number, string> = {
  1: "Got it. When do you actually have energy during the day — morning, afternoon, or evening?",
  2: "Noted. When you've tried to stick to a routine before, what usually gets in the way?",
  3: "Makes sense. Does having someone or something check on you help you stay on track, or does it backfire?",
  4: ONBOARDING_CLOSING,
};

export function isTruncatedReply(reply: string): boolean {
  return reply.length > 0 && !/[.!?"]$/.test(reply.trim());
}

export function finalizeOnboardingReply(reply: string, turnCount: number): string {
  if (isTruncatedReply(reply)) {
    return TRUNCATION_FALLBACKS[turnCount] ?? ONBOARDING_CLOSING;
  }
  return reply;
}

export const PROFILE_EXTRACTION_PROMPT = `
Analyze this FlexMax onboarding conversation and extract a structured psychology profile.
Return ONLY valid JSON, no markdown, no explanation.

Schema:
{
  "peak_energy_times": string[],
  "avoidance_patterns": string[],
  "motivation_style": "intrinsic" | "accountability" | "streaks" | "external",
  "sabotage_triggers": string[],
  "goals": string[],
  "accountability_tone": "firm" | "gentle" | "data-driven",
  "raw_ai_summary": string
}

Conversation:
`.trim();

export const SCHEDULE_TIPS_PROMPT = `
Based on this psychology profile, return 3–4 short, specific coaching insights for building their weekly schedule.
Each tip should be actionable and reference their actual profile when possible — not generic productivity advice.
Return ONLY a valid JSON array of strings, no markdown, no explanation. Each string under 120 characters.

Profile:
`.trim();
