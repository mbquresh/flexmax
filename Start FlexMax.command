#!/bin/bash
export PATH="/opt/homebrew/opt/node@20/bin:/opt/homebrew/bin:$PATH"
cd "$(dirname "$0")/.."

echo ""
echo "========================================"
echo "  FLEXMAX"
echo "  LEAVE THIS WINDOW OPEN"
echo "  Open: http://localhost:8081"
echo "  Close with Ctrl+C when done"
echo "========================================"
echo ""

yarn workspace @flexmax/mobile exec expo start --web
