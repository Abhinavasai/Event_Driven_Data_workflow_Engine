#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:8000}"
API_KEY="${API_KEY:-${ADMIN_API_KEY:-}}"
SAMPLE_CSV="${SAMPLE_CSV:-sample-data/sample_orders.csv}"
POLL_SECONDS="${POLL_SECONDS:-120}"
INTERVAL="${INTERVAL:-5}"

log() { echo "[smoke] $*"; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd curl
require_cmd python

log "Health check (no auth required)"
curl -sf "${API_BASE_URL}/api/v1/health" | python -m json.tool >/dev/null

auth_header=()
if [[ -n "${API_KEY}" ]]; then
  auth_header=(-H "X-API-Key: ${API_KEY}")
else
  log "No API_KEY set — attempting to create admin key (requires bootstrap admin or DEFAULT_ADMIN_API_KEY)"
  KEY_JSON="$(python scripts/create_api_key.py --name "Smoke Test" --role admin --base-url "${API_BASE_URL}" 2>/dev/null || true)"
  API_KEY="$(echo "${KEY_JSON}" | python -c "import sys,json; d=json.load(sys.stdin); print(d.get('api_key',''))" 2>/dev/null || true)"
  if [[ -z "${API_KEY}" ]]; then
    echo "Unable to obtain API key. Export API_KEY or ADMIN_API_KEY." >&2
    exit 1
  fi
  auth_header=(-H "X-API-Key: ${API_KEY}")
fi

log "List workflow definitions"
DEF_ID="$(curl -sf "${auth_header[@]}" "${API_BASE_URL}/api/v1/workflows?page=1&page_size=1" | python -c "import sys,json; d=json.load(sys.stdin); items=d.get('items') or d; print(items[0]['id'] if items else '')")"
if [[ -z "${DEF_ID}" ]]; then
  log "Seeding definitions"
  API_KEY="${API_KEY}" python scripts/seed_workflow_definitions.py
  DEF_ID="$(curl -sf "${auth_header[@]}" "${API_BASE_URL}/api/v1/workflows?page=1&page_size=1" | python -c "import sys,json; d=json.load(sys.stdin); items=d.get('items') or d; print(items[0]['id'])")"
fi

if [[ ! -f "${SAMPLE_CSV}" ]]; then
  python scripts/generate_test_files.py
fi

log "Upload sample file"
UPLOAD_JSON="$(curl -sf "${auth_header[@]}" -F "file=@${SAMPLE_CSV}" -F "definition_id=${DEF_ID}" "${API_BASE_URL}/api/v1/upload")"
RUN_ID="$(echo "${UPLOAD_JSON}" | python -c "import sys,json; print(json.load(sys.stdin)['run_id'])")"
log "Run ID: ${RUN_ID}"

log "Polling run status for up to ${POLL_SECONDS}s"
elapsed=0
while [[ "${elapsed}" -lt "${POLL_SECONDS}" ]]; do
  STATUS="$(curl -sf "${auth_header[@]}" "${API_BASE_URL}/api/v1/runs/${RUN_ID}" | python -c "import sys,json; print(json.load(sys.stdin).get('status',''))")"
  log "Status: ${STATUS}"
  if [[ "${STATUS}" == "COMPLETED" || "${STATUS}" == "FAILED" || "${STATUS}" == "CANCELLED" ]]; then
    break
  fi
  sleep "${INTERVAL}"
  elapsed=$((elapsed + INTERVAL))
done

if [[ "${STATUS}" != "COMPLETED" ]]; then
  echo "Smoke test did not reach COMPLETED (last status: ${STATUS})" >&2
  exit 1
fi

log "Smoke test passed"
