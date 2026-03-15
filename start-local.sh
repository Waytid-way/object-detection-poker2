#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v python3 >/dev/null 2>&1; then
    echo "python3 not found in PATH"
    exit 1
fi

echo "Starting Flask app at http://127.0.0.1:5000"
python3 app.py
