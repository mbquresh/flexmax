import {
  buildDemoProfile,
  buildDemoScheduleTips,
  getDemoReply,
  type ChatMessage,
} from "./demo.ts";
import {
  countUserTurns,
  finalizeOnboardingReply,
  isOnboardingComplete,
  MAX_ONBOARDING_USER_TURNS,
  ONBOARDING_CLOSING,
  ONBOARDING_REPLY_MAX_TOKENS,
  ONBOARDING_SYSTEM_PROMPT,
  SCHEDULE_TIPS_PROMPT,
} from "./prompts.ts";

export type AIProvider = "demo" | "gemini" | "anthropic";

const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const GEMINI_MODEL = "gemini-2.5-flash";

export function resolveProvider(): AIProvider {
  const explicit = Deno.env.get("AI_PROVIDER")?.toLowerCase();
  if (explicit === "demo" || explicit === "gemini" || explicit === "anthropic") {
    return explicit;
  }
  if (Deno.env.get("ANTHROPIC_API_KEY")) return "anthropic";
  if (Deno.env.get("GEMINI_API_KEY")) return "gemini";
  return "demo";
}

function parseJsonFromText(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

function parseJsonArrayFromText(raw: string): string[] {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array of tips");
  }
  return parsed.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function formatProfileForTips(profile: Record<string, unknown>): string {
  const lines = [
    `- goals: ${JSON.stringify(profile.goals ?? [])}`,
    `- peak_energy_times: ${JSON.stringify(profile.peak_energy_times ?? [])}`,
    `- avoidance_patterns: ${JSON.stringify(profile.avoidance_patterns ?? [])}`,
    `- sabotage_triggers: ${JSON.stringify(profile.sabotage_triggers ?? [])}`,
    `- motivation_style: ${profile.motivation_style ?? "unknown"}`,
    `- accountability_tone: ${profile.accountability_tone ?? "unknown"}`,
    `- raw_ai_summary: ${profile.raw_ai_summary ?? ""}`,
  ];
  return lines.join("\n");
}

async function callAnthropicChat(
  system: string,
  messages: ChatMessage[],
  maxTokens: number
): Promise<string> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set in Supabase secrets");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message ?? "Anthropic API request failed");
  }

  return data.content?.[0]?.text ?? "";
}

async function callGeminiChat(
  system: string,
  messages: ChatMessage[],
  maxTokens: number
): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set in Supabase secrets");
  }

  const body: Record<string, unknown> = {
    contents: messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: { maxOutputTokens: maxTokens },
    systemInstruction: { parts: [{ text: system }] },
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      data.error?.message ?? data.error?.status ?? "Gemini API request failed"
    );
  }

  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callGeminiText(prompt: string, maxTokens: number): Promise<string> {
  return callGeminiChat("", [{ role: "user", content: prompt }], maxTokens);
}

async function callAnthropicText(prompt: string, maxTokens: number): Promise<string> {
  return callAnthropicChat("", [{ role: "user", content: prompt }], maxTokens);
}

export async function onboardingReply(
  messages: ChatMessage[],
  _baseSystemPrompt: string
): Promise<{ reply: string; isComplete: boolean; provider: AIProvider }> {
  const provider = resolveProvider();
  const apiMessages = messages.filter((m, i) => !(i === 0 && m.role === "assistant"));

  if (!apiMessages.length || apiMessages[0].role !== "user") {
    throw new Error("Invalid message format");
  }

  const turnCount = countUserTurns(apiMessages);

  if (turnCount > MAX_ONBOARDING_USER_TURNS) {
    return {
      reply: ONBOARDING_CLOSING,
      isComplete: true,
      provider,
    };
  }

  // Turn 5 in the prompt = close after the 4th user answer
  if (turnCount >= MAX_ONBOARDING_USER_TURNS) {
    return {
      reply: ONBOARDING_CLOSING,
      isComplete: true,
      provider,
    };
  }

  if (provider === "demo") {
    const { reply, isComplete } = getDemoReply(turnCount);
    return { reply, isComplete, provider };
  }

  const rawReply =
    provider === "gemini"
      ? await callGeminiChat(
          ONBOARDING_SYSTEM_PROMPT,
          apiMessages,
          ONBOARDING_REPLY_MAX_TOKENS
        )
      : await callAnthropicChat(
          ONBOARDING_SYSTEM_PROMPT,
          apiMessages,
          ONBOARDING_REPLY_MAX_TOKENS
        );

  const reply = finalizeOnboardingReply(rawReply, turnCount);

  return {
    reply,
    isComplete: isOnboardingComplete(reply),
    provider,
  };
}

export async function extractPsychologyProfile(
  messages: ChatMessage[],
  extractionPrompt: string
): Promise<{ profile: Record<string, unknown>; provider: AIProvider }> {
  const provider = resolveProvider();

  if (provider === "demo") {
    return { profile: buildDemoProfile(messages), provider };
  }

  const transcript = messages
    .map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content}`)
    .join("\n\n");

  const prompt = extractionPrompt + transcript;
  const raw =
    provider === "gemini"
      ? await callGeminiText(prompt, 800)
      : await callAnthropicText(prompt, 800);

  return { profile: parseJsonFromText(raw), provider };
}

export async function generateScheduleTips(
  profile: Record<string, unknown>
): Promise<{ tips: string[]; provider: AIProvider }> {
  const provider = resolveProvider();

  if (provider === "demo") {
    return { tips: buildDemoScheduleTips(profile), provider };
  }

  const prompt = `${SCHEDULE_TIPS_PROMPT}\n${formatProfileForTips(profile)}`;
  const raw =
    provider === "gemini"
      ? await callGeminiText(prompt, 512)
      : await callAnthropicText(prompt, 512);

  const tips = parseJsonArrayFromText(raw).slice(0, 4);
  if (tips.length < 3) {
    throw new Error("AI returned fewer than 3 schedule tips");
  }

  return { tips, provider };
}
