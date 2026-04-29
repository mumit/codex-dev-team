#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-$(pwd)}"

command -v node >/dev/null 2>&1 || {
  echo "Node.js is required to install codex-dev-team."
  exit 1
}

node "$SCRIPT_DIR/scripts/bootstrap.js" "$TARGET"
