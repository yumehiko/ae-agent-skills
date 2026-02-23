#!/usr/bin/env bash
set -euo pipefail

# Build signed ZXP by prompting for certificate password interactively.
# Optional env:
#   SIGN_CERT_P12=certs/dev-cert.p12
#   ZXPSIGNCMD_BIN=/absolute/path/to/ZXPSignCmd
#   TIMESTAMP_URL=http://timestamp.digicert.com

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
CERT_P12="${SIGN_CERT_P12:-${ROOT_DIR}/certs/dev-cert.p12}"

if [[ ! -f "${CERT_P12}" ]]; then
  echo "Certificate file not found: ${CERT_P12}" >&2
  echo "Set SIGN_CERT_P12 to a valid .p12 file path." >&2
  exit 1
fi

read -r -s -p "SIGN_CERT_PASSWORD: " SIGN_CERT_PASSWORD
echo

if [[ -z "${SIGN_CERT_PASSWORD}" ]]; then
  echo "Password is empty." >&2
  exit 1
fi

SIGN_CERT_P12="${CERT_P12}" SIGN_CERT_PASSWORD="${SIGN_CERT_PASSWORD}" \
  "${ROOT_DIR}/scripts/signing/build-zxp.sh"

unset SIGN_CERT_PASSWORD
