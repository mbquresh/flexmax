#!/bin/bash
export PATH="/opt/homebrew/opt/node@20/bin:/opt/homebrew/bin:$PATH"
cd "$(dirname "$0")"
exec ./scripts/start-mobile-native.sh
