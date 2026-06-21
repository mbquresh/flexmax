/**
 * FlexMax AI Client
 * All Claude API interactions go through here.
 * This runs server-side (Supabase Edge Functions) — never in the mobile app.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  ONBOARDING_SYSTEM_PROMPT,
  PROFILE_EXTRACTION_PROMPT,
  SCHEDULE_REVIEW_PROMPT,
  ACCOUNTABILITY_NOTIFICATION_PROMPT,
  MISSED_BLOCK_RECOVERY_PROMPT,
  Message,
  PsychologyProfile,
  ScheduleBlock,
  ScheduleReview,
} from "./prompts";

const MODEL = "claude-sonnet-4-6";

export class FlexMaxAI {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  // ─────────────────────────────────────────
  // ONBOARDING — stream the conversation turn-by-turn
  // ─────────────────────────────────────────

  async onboardingReply(messages: Message[]): Promise<{
    reply: string;
    isComplete: boolean;
  }> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: ONBOARDING_SYSTEM_PROMPT,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const reply =
      response.content[0].type === "text" ? response.content[0].text : "";

    // AI signals completion with this exact phrase
    const isComplete = reply.includes("That's everything I need");

    return { reply, isComplete };
  }

  // ─────────────────────────────────────────
  // PROFILE EXTRACTION — after onboarding ends
  // ─────────────────────────────────────────

  async extractPsychologyProfile(
    messages: Message[]
  ): Promise<PsychologyProfile> {
    const transcript = messages
      .map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content}`)
      .join("\n\n");

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: PROFILE_EXTRACTION_PROMPT + "\n\n" + transcript,
        },
      ],
    });

    const raw =
      response.content[0].type === "text" ? response.content[0].text : "{}";

    try {
      return JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      throw new Error("Failed to parse psychology profile from AI response");
    }
  }

  // ─────────────────────────────────────────
  // SCHEDULE REVIEW
  // ─────────────────────────────────────────

  async reviewSchedule(
    profile: PsychologyProfile,
    blocks: ScheduleBlock[]
  ): Promise<ScheduleReview> {
    const input = JSON.stringify({ profile, blocks }, null, 2);

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 1000,
      system: SCHEDULE_REVIEW_PROMPT,
      messages: [
        {
          role: "user",
          content: `Here is the user's psychology profile and schedule:\n\n${input}`,
        },
      ],
    });

    const raw =
      response.content[0].type === "text" ? response.content[0].text : "{}";

    try {
      return JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      throw new Error("Failed to parse schedule review from AI response");
    }
  }

  // ─────────────────────────────────────────
  // SMART NOTIFICATION GENERATION
  // ─────────────────────────────────────────

  async generateNotification(params: {
    profile: PsychologyProfile;
    type:
      | "block_complete"
      | "missed_block"
      | "idle_alert"
      | "nightly_fill"
      | "morning_brief";
    blockName?: string;
    taskDetail?: string;
    recentHistory?: Array<{ blockName: string; status: string }>;
  }): Promise<{ title: string; body: string; tone: string }> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 200,
      system: ACCOUNTABILITY_NOTIFICATION_PROMPT,
      messages: [
        {
          role: "user",
          content: `Generate a notification for:\n${JSON.stringify(params, null, 2)}`,
        },
      ],
    });

    const raw =
      response.content[0].type === "text" ? response.content[0].text : "{}";

    try {
      return JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      // Fallback if parsing fails
      return {
        title: "FlexMax check-in",
        body: "How's your block going?",
        tone: "curious",
      };
    }
  }

  // ─────────────────────────────────────────
  // MISSED BLOCK RECOVERY
  // ─────────────────────────────────────────

  async missedBlockRecovery(params: {
    profile: PsychologyProfile;
    missedBlock: { name: string; start_minutes: number; end_minutes: number };
    remainingBlocksToday: ScheduleBlock[];
    missCount: number; // how many times this block has been missed recently
  }): Promise<{
    acknowledgment: string;
    reflection_prompt_why: string;
    reflection_prompt_improve: string;
    reschedule_suggestion: {
      available: boolean;
      suggested_start_minutes: number | null;
      suggested_end_minutes: number | null;
      reasoning: string;
    };
    pattern_note: string | null;
  }> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 600,
      system: MISSED_BLOCK_RECOVERY_PROMPT,
      messages: [
        {
          role: "user",
          content: `Missed block context:\n${JSON.stringify(params, null, 2)}`,
        },
      ],
    });

    const raw =
      response.content[0].type === "text" ? response.content[0].text : "{}";

    try {
      return JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      throw new Error("Failed to parse missed block recovery from AI response");
    }
  }
}

// ─────────────────────────────────────────
// Utility: convert minutes-since-midnight to display string
// ─────────────────────────────────────────
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ampm = h < 12 ? "AM" : "PM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export function timeToMinutes(time: string): number {
  const [timePart, ampm] = time.split(" ");
  const [h, m] = timePart.split(":").map(Number);
  let hours = h;
  if (ampm === "PM" && h !== 12) hours += 12;
  if (ampm === "AM" && h === 12) hours = 0;
  return hours * 60 + m;
}
