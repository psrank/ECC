#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf '[ecc-codex-local-plugin] ERROR: %s is required but was not found on PATH\n' "$1" >&2
    exit 127
  fi
}

if [[ "$#" -ne 0 ]]; then
  printf 'Usage: %s\n' "$(basename "$0")" >&2
  exit 64
fi

require_command codex
require_command node

printf '[ecc-codex-local-plugin] Removing existing ecc@ecc plugin (if installed)\n'
if ! codex plugin remove ecc@ecc; then
  printf '[ecc-codex-local-plugin] No existing ecc@ecc plugin was removed; continuing\n' >&2
fi

printf '[ecc-codex-local-plugin] Removing existing ecc marketplace (if installed)\n'
if ! codex plugin marketplace remove ecc; then
  printf '[ecc-codex-local-plugin] No existing ecc marketplace was removed; continuing\n' >&2
fi

printf '[ecc-codex-local-plugin] Adding marketplace: %s\n' "$REPO_ROOT"
codex plugin marketplace add "$REPO_ROOT"
printf '[ecc-codex-local-plugin] Installing ecc@ecc\n'
codex plugin add ecc@ecc
printf '[ecc-codex-local-plugin] Verifying plugin cache\n'
node "$REPO_ROOT/scripts/codex/check-plugin-cache.js"
