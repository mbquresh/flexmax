/**
 * Edge Function: onboarding-chat
 *
 * Proxies onboarding messages to the configured AI provider.
 * Set AI_PROVIDER=anthropic in Supabase secrets for production.
 *
 * Deploy: supabase functions deploy onboarding-chat
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { onboardingReply } from "../_shared/ai.ts";
import { ONBOARDING_SYSTEM_PROMPT } from "../_shared/prompts.ts";
import { corsHeaders, getAuthenticatedUser } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { allowed, limit } = await checkRateLimit(user.id, "onboarding-chat");
    if (!allowed) {
      return new Response(
        JSON.stringify({
          error: `Rate limit exceeded. Max ${limit} requests per hour.`,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": "3600",
          },
        }
      );
    }

    const { messages } = await req.json();
    const result = await onboardingReply(messages, ONBOARDING_SYSTEM_PROMPT);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
