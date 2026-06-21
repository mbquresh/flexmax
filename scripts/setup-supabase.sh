#!/usr/bin/env bash
# FlexMax one-time Supabase setup
# Usage: ./scripts/setup-supabase.sh YOUR_DATABASE_PASSWORD
#
# Database password = the one you chose when creating the Supabase project.
# Find/reset it: Dashboard → Project Settings → Database

set -euo pipefail

export PATH="/opt/homebrew/bin:/opt/homebrew/opt/libpq/bin:$PATH"

PROJECT_REF="njsoqgaorebtwwcxgagf"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_PASSWORD="${1:-${SUPABASE_DB_PASSWORD:-}}"

if [[ -z "$DB_PASSWORD" ]]; then
  echo "Usage: ./scripts/setup-supabase.sh YOUR_DATABASE_PASSWORD"
  echo ""
  echo "This is the database password you set when creating your Supabase project."
  echo "Reset it here if needed:"
  echo "https://supabase.com/dashboard/project/${PROJECT_REF}/settings/database"
  exit 1
fi

cd "$ROOT"

echo "→ Logging into Supabase (a browser tab may open — click Authorize once)..."
supabase login

echo "→ Linking project ${PROJECT_REF}..."
supabase link --project-ref "$PROJECT_REF" --password "$DB_PASSWORD" --yes

echo "→ Pushing database migrations..."
supabase db push --linked --yes

echo ""
echo "✓ Database ready."
echo ""
echo "Next (optional, for AI onboarding chat):"
echo "  supabase secrets set ANTHROPIC_API_KEY=your-key"
echo "  supabase functions deploy onboarding-chat"
echo "  supabase functions deploy extract-psychology-profile"
