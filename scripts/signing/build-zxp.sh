#!/usr/bin/env bash
set -euo pipefail

# Build a signed ZXP from this repository.
# Required env:
#   SIGN_CERT_P12=certs/dev-cert.p12
#   SIGN_CERT_PASSWORD=your-pass
# Optional env:
#   ZXPSIGNCMD_BIN=ZXPSignCmd

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ZXPSIGNCMD_BIN="${ZXPSIGNCMD_BIN:-ZXPSignCmd}"
DIST_DIR="${DIST_DIR:-${ROOT_DIR}/dist}"
STAGE_DIR="${DIST_DIR}/stage/ae-agent-skill"
CERT_P12="${SIGN_CERT_P12:-}"
CERT_PASSWORD="${SIGN_CERT_PASSWORD:-}"
TIMESTAMP_URL="${TIMESTAMP_URL:-http://timestamp.digicert.com}"

if [[ -z "${CERT_P12}" ]]; then
  echo "SIGN_CERT_P12 is required. Example: SIGN_CERT_P12=certs/dev-cert.p12" >&2
  exit 1
fi

if [[ -z "${CERT_PASSWORD}" ]]; then
  echo "SIGN_CERT_PASSWORD is required." >&2
  exit 1
fi

if ! command -v "${ZXPSIGNCMD_BIN}" >/dev/null 2>&1; then
  echo "ZXPSignCmd not found. Set ZXPSIGNCMD_BIN or install ZXPSignCmd." >&2
  exit 1
fi

if [[ ! -f "${ROOT_DIR}/CSXS/manifest.xml" ]]; then
  echo "CSXS/manifest.xml not found." >&2
  exit 1
fi

VERSION="$(rg -o 'ExtensionBundleVersion=\"[^\"]+\"' "${ROOT_DIR}/CSXS/manifest.xml" | head -n1 | sed -E 's/.*\"([^\"]+)\"/\1/')"
if [[ -z "${VERSION}" ]]; then
  echo "Failed to parse ExtensionBundleVersion from CSXS/manifest.xml" >&2
  exit 1
fi

OUT_ZXP="${DIST_DIR}/ae-agent-skill-${VERSION}.zxp"

rm -rf "${STAGE_DIR}"
mkdir -p "${STAGE_DIR}" "${DIST_DIR}"

cp -R "${ROOT_DIR}/CSXS" "${STAGE_DIR}/"
cp -R "${ROOT_DIR}/client" "${STAGE_DIR}/"
cp -R "${ROOT_DIR}/host" "${STAGE_DIR}/"

"${ZXPSIGNCMD_BIN}" -sign "${STAGE_DIR}" "${OUT_ZXP}" "${CERT_P12}" "${CERT_PASSWORD}" -tsa "${TIMESTAMP_URL}"

echo "Built signed ZXP: ${OUT_ZXP}"
