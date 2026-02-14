#!/usr/bin/env bash
set -euo pipefail

# Install a signed ZXP package with ExManCmd.
# Usage:
#   scripts/signing/install-zxp.sh dist/ae-agent-skill-0.2.0.zxp
# Optional env:
#   EXMANCMD_BIN=ExManCmd

EXMANCMD_BIN="${EXMANCMD_BIN:-ExManCmd}"
ZXP_PATH="${1:-}"

if [[ -z "${ZXP_PATH}" ]]; then
  echo "Usage: $0 <path-to-zxp>" >&2
  exit 1
fi

if ! command -v "${EXMANCMD_BIN}" >/dev/null 2>&1; then
  echo "ExManCmd not found. Set EXMANCMD_BIN or install ExManCmd." >&2
  exit 1
fi

if [[ ! -f "${ZXP_PATH}" ]]; then
  echo "ZXP not found: ${ZXP_PATH}" >&2
  exit 1
fi

"${EXMANCMD_BIN}" --install "${ZXP_PATH}"
echo "Installed: ${ZXP_PATH}"
