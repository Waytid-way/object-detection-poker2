#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-5000}"

if ! command -v ngrok >/dev/null 2>&1; then
    echo "ngrok not found in PATH"
    echo "Install ngrok and run: ngrok config add-authtoken <YOUR_TOKEN>"
    exit 1
fi

echo "Starting ngrok tunnel for http://127.0.0.1:${PORT}"
ngrok http "$PORT"
