#!/usr/bin/env bash
# Use Node 20 (Expo 51 works best with it) and open in browser
set -euo pipefail
export PATH="/opt/homebrew/opt/node@20/bin:/opt/homebrew/bin:$PATH"
cd "$(dirname "$0")/.."
echo "FlexMax starting..."
echo "Open http://localhost:8081 in your browser when ready."
echo "Do NOT press 'i' — Xcode is not installed. Use the browser or Expo Go on your phone."
echo "(Close with Ctrl+C when done)"
yarn workspace @flexmax/mobile exec expo start --web --clear
