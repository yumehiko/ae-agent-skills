#!/usr/bin/env bash
set -euo pipefail

# Create a development self-signed certificate for CEP extension signing.
# Usage:
#   scripts/signing/create-dev-cert.sh --password "your-pass"
# Optional:
#   --country JP --state Tokyo --org "Example Inc." --unit Dev --name "Your Name" --email you@example.com

CERT_DIR="${CERT_DIR:-certs}"
CERT_FILE="${CERT_FILE:-${CERT_DIR}/dev-cert.p12}"
KEY_FILE="${KEY_FILE:-${CERT_DIR}/dev-cert.key.pem}"
CRT_FILE="${CRT_FILE:-${CERT_DIR}/dev-cert.crt.pem}"

COUNTRY="JP"
STATE="Tokyo"
CITY="Tokyo"
ORG="AE Agent Skills"
UNIT="Development"
NAME="AE Agent Skills Dev"
EMAIL="dev@example.com"
PASSWORD=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --password)
      PASSWORD="$2"
      shift 2
      ;;
    --country)
      COUNTRY="$2"
      shift 2
      ;;
    --state)
      STATE="$2"
      shift 2
      ;;
    --org)
      ORG="$2"
      shift 2
      ;;
    --city)
      CITY="$2"
      shift 2
      ;;
    --unit)
      UNIT="$2"
      shift 2
      ;;
    --name)
      NAME="$2"
      shift 2
      ;;
    --email)
      EMAIL="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "${PASSWORD}" ]]; then
  echo "Missing required argument: --password" >&2
  exit 1
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl not found." >&2
  exit 1
fi

mkdir -p "${CERT_DIR}"

if [[ -f "${CERT_FILE}" || -f "${KEY_FILE}" || -f "${CRT_FILE}" ]]; then
  echo "Certificate files already exist under ${CERT_DIR}. Remove them before recreating." >&2
  exit 1
fi

SUBJECT="/C=${COUNTRY}/ST=${STATE}/L=${CITY}/O=${ORG}/OU=${UNIT}/CN=${NAME}/emailAddress=${EMAIL}"

openssl req -x509 -newkey rsa:2048 -sha256 -days 3650 -nodes \
  -subj "${SUBJECT}" \
  -keyout "${KEY_FILE}" \
  -out "${CRT_FILE}"

openssl pkcs12 -export \
  -inkey "${KEY_FILE}" \
  -in "${CRT_FILE}" \
  -out "${CERT_FILE}" \
  -passout "pass:${PASSWORD}"

echo "Created development certificate: ${CERT_FILE}"
echo "Private key: ${KEY_FILE}"
echo "Certificate: ${CRT_FILE}"
