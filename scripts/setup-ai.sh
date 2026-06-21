#!/usr/bin/env bash
# One-time setup: deploy FlexMax AI edge functions to Supabase
#
# Usage:
#   ./scripts/setup-ai.sh YOUR_ANTHROPIC_API_KEY
#
# You need:
#   1. Anthropic API key from https://console.anthropic.com/
#   2. Supabase database password (from project creation)
#   3. One browser click to authorize `supabase login`

set -euo pipefail
export PATH="/opt/homebrew/bin:$PATH"

PROJECT_REF="njsoqgaorebtwwcxgagf"
ANTHROPIC_KEY="${1:-${ANTHROPIC_API_KEY:-}}"
DB_PASSWORD="${SUPABASE_DB_PASSWORD:-}"

if [[ -z "$ANTHROPIC_KEY" ]]; then
  echo "Usage: ./scripts/setup-ai.sh sk-ant-your-key-here"
  echo "Get a key at: https://console.anthropic.com/settings/keys"
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

echo "→ Setting Anthropic API key..."
supabase secrets set "ANTHROPIC_API_KEY=$ANTHROPIC_KEY"

echo "→ Deploying edge functions..."
supabase functions deploy onboarding-chat
supabase functions deploy extract-psychology-profile

echo ""
echo "✓ AI onboarding is live. Refresh the app and try chatting again."
