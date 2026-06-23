#!/usr/bin/env bash
# Start Expo for phone testing (Expo Go). Same WiFi as your Mac.
set -euo pipefail
export PATH="/opt/homebrew/opt/node@20/bin:/opt/homebrew/bin:$PATH"
cd "$(dirname "$0")/.."

echo ""
echo "========================================"
echo "  FLEXMAX — MOBILE (Expo Go)"
echo "  LEAVE THIS WINDOW OPEN"
echo ""
echo "  1. Install 'Expo Go' on your phone"
echo "  2. Same WiFi as this Mac"
echo "  3. Scan the QR code below"
echo ""
echo "  iPhone: Camera app → tap banner"
echo "  Android: Expo Go app → Scan QR"
echo "========================================"
echo ""

yarn workspace @flexmax/mobile exec expo start --clear
