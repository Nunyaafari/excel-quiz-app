#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PROJECT_ID="${PROJECT_ID:-excel-quiz-app-28d21}"
BACKEND_ID="${BACKEND_ID:-quiz}"
ENV_FILE="${ENV_FILE:-.env.local}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

required_secrets=(
  OPENAI_API_KEY
  RESEND_API_KEY
  QUIZ_RESULTS_FROM_EMAIL
  QUIZ_RESULTS_REPLY_TO
  RESEND_WEBHOOK_SECRET
)

optional_secrets=(
  FIREBASE_ADMIN_CLIENT_EMAIL
  FIREBASE_ADMIN_PRIVATE_KEY
  TELEGRAM_BOT_TOKEN
  WHATSAPP_TOKEN
  WHATSAPP_PHONE_NUMBER_ID
  WHATSAPP_VERIFY_TOKEN
)

is_placeholder() {
  local value="${1:-}"

  if [[ -z "$value" ]]; then
    return 0
  fi

  case "$value" in
    your_*|test|test_*|admin@example.com|admin123|support@yourdomain.com)
      return 0
      ;;
    "Excel Mastery Quiz <results@yourdomain.com>")
      return 0
      ;;
    sk-test-key)
      return 0
      ;;
    *example.com*)
      return 0
      ;;
  esac

  return 1
}

missing_required=()
secrets_to_set=()

for name in "${required_secrets[@]}"; do
  value="${!name:-}"
  if is_placeholder "$value"; then
    missing_required+=("$name")
    continue
  fi
  secrets_to_set+=("$name")
done

for name in "${optional_secrets[@]}"; do
  value="${!name:-}"
  if is_placeholder "$value"; then
    continue
  fi
  secrets_to_set+=("$name")
done

if [[ "${#missing_required[@]}" -gt 0 ]]; then
  printf 'Missing real values for required App Hosting secrets:\n' >&2
  for name in "${missing_required[@]}"; do
    printf '  - %s\n' "$name" >&2
  done
  printf '\nSet them in %s or export them in your shell, then rerun this script.\n' "$ENV_FILE" >&2
  exit 1
fi

for name in "${secrets_to_set[@]}"; do
  value="${!name}"
  printf 'Setting %s...\n' "$name"
  printf '%s' "$value" | firebase apphosting:secrets:set "$name" \
    --project "$PROJECT_ID" \
    --data-file -
done

if [[ "${#secrets_to_set[@]}" -gt 0 ]]; then
  secret_csv="$(IFS=,; echo "${secrets_to_set[*]}")"
  printf 'Granting backend %s access to configured secrets...\n' "$BACKEND_ID"
  firebase apphosting:secrets:grantaccess "$secret_csv" \
    --project "$PROJECT_ID" \
    --backend "$BACKEND_ID"
fi

printf '\nApp Hosting secrets configured for backend %s.\n' "$BACKEND_ID"
printf 'Next step: firebase deploy --project %s\n' "$PROJECT_ID"
