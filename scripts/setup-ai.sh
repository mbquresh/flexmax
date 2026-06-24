#!/usr/bin/env bash
# Deploy FlexMax AI edge functions to Supabase
#
# Usage:
#   ./scripts/setup-ai.sh demo
#   ./scripts/setup-ai.sh gemini YOUR_GEMINI_API_KEY
#   ./scripts/setup-ai.sh anthropic YOUR_ANTHROPIC_API_KEY
#
# Gemini free key: https://aistudio.google.com/apikey
# Anthropic key:   https://console.anthropic.com/settings/keys

set -euo pipefail
export PATH="/opt/homebrew/bin:$PATH"

PROJECT_REF="njsoqgaorebtwwcxgagf"
DB_PASSWORD="${SUPABASE_DB_PASSWORD:-}"

PROVIDER="${1:-anthropic}"
API_KEY="${2:-}"

if [[ "$PROVIDER" != "demo" && "$PROVIDER" != "gemini" && "$PROVIDER" != "anthropic" ]]; then
  echo "Usage:"
  echo "  ./scripts/setup-ai.sh demo"
  echo "  ./scripts/setup-ai.sh gemini YOUR_GEMINI_API_KEY"
  echo "  ./scripts/setup-ai.sh anthropic YOUR_ANTHROPIC_API_KEY"
  exit 1
fi

if [[ "$PROVIDER" == "gemini" && -z "$API_KEY" ]]; then
  API_KEY="${GEMINI_API_KEY:-}"
fi

if [[ "$PROVIDER" == "anthropic" && -z "$API_KEY" ]]; then
  API_KEY="${ANTHROPIC_API_KEY:-}"
fi

if [[ "$PROVIDER" == "gemini" && -z "$API_KEY" ]]; then
  echo "Get a free Gemini key at: https://aistudio.google.com/apikey"
  exit 1
fi

if [[ "$PROVIDER" == "anthropic" && -z "$API_KEY" ]]; then
  echo "Get an Anthropic key at: https://console.anthropic.com/settings/keys"
  exit 1
fi

cd "$(dirname "$0")/.."

echo "→ Step 1: Log into Supabase (browser will open — click Authorize)"
supabase login

if [[ -n "$DB_PASSWORD" ]]; then
  supabase link --project-ref "$PROJECT_REF" --password "$DB_PASSWORD" --yes
else
  echo "→ Linking project (enter your database password when prompted)..."
  supabase link --project-ref "$PROJECT_REF"
fi

echo "→ Setting AI_PROVIDER=$PROVIDER"
supabase secrets set "AI_PROVIDER=$PROVIDER"

if [[ "$PROVIDER" == "gemini" ]]; then
  echo "→ Setting Gemini API key..."
  supabase secrets set "GEMINI_API_KEY=$API_KEY"
elif [[ "$PROVIDER" == "anthropic" ]]; then
  echo "→ Setting Anthropic API key..."
  supabase secrets set "ANTHROPIC_API_KEY=$API_KEY"
fi

echo "→ Deploying edge functions..."
supabase functions deploy onboarding-chat
supabase functions deploy extract-psychology-profile
supabase functions deploy generate-schedule-tips

echo ""
echo "✓ AI onboarding is live with provider: $PROVIDER"
echo "  Refresh the app and try chatting again."
