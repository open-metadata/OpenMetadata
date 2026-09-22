#!/usr/bin/env bash
#
# Reindex performance test bootstrap.
#
# Tears down any existing local OM stack, brings it up fresh against PostgreSQL,
# waits for the server to be healthy, fetches the ingestion-bot JWT, and runs
# scripts/ingest_100k_containers.py to populate ~100k containers (depth 1-10)
# with column-level tags.
#
# Usage:
#   ./scripts/reindex-perf-bootstrap.sh                # default 100k, skip-maven-build
#   CONTAINERS=50000 ./scripts/reindex-perf-bootstrap.sh
#   SKIP_BUILD=false ./scripts/reindex-perf-bootstrap.sh   # full mvn rebuild
#   SKIP_INGEST=true ./scripts/reindex-perf-bootstrap.sh   # docker only, no data
#   SKIP_DOCKER=true ./scripts/reindex-perf-bootstrap.sh   # data only, against running stack
#
# Requirements: docker, docker compose, python 3.10+, the `metadata` package
# installed (cd ingestion && make install_dev_env from the repo's venv).

set -euo pipefail

# Resolve repo root regardless of CWD.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

# Tunables (override via env).
CONTAINERS="${CONTAINERS:-100000}"
WORKERS="${WORKERS:-10}"
BATCH_SIZE="${BATCH_SIZE:-50}"
SERVICE_NAME="${SERVICE_NAME:-reindex_perf_storage}"
SERVER_URL="${SERVER_URL:-http://localhost:8585/api}"
SKIP_BUILD="${SKIP_BUILD:-true}"      # default: skip mvn rebuild for fast iteration
SKIP_DOCKER="${SKIP_DOCKER:-false}"
SKIP_INGEST="${SKIP_INGEST:-false}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-600}"  # seconds to wait for OM to come up

log() { printf "\n\033[1;36m== %s ==\033[0m\n" "$*" >&2; }
warn() { printf "\033[1;33m!! %s\033[0m\n" "$*" >&2; }
die() { printf "\033[1;31m++ %s\033[0m\n" "$*" >&2; exit 1; }

ensure_python_sdk() {
  python -c "import metadata" >/dev/null 2>&1 \
    || die "Python 'metadata' package not importable. Activate the repo's venv and run 'cd ingestion && make install_dev_env'."
}

stop_stack() {
  log "Tearing down any existing OM stack (postgres + mysql variants)"
  docker compose -f docker/development/docker-compose-postgres.yml down -v --remove-orphans 2>/dev/null || true
  docker compose -f docker/development/docker-compose.yml down -v --remove-orphans 2>/dev/null || true
}

start_stack() {
  log "Starting OM stack (PostgreSQL backing store)"
  local args=(-m ui -d postgresql)
  if [[ "${SKIP_BUILD}" == "true" ]]; then
    args+=(-s true)
  fi
  ./docker/run_local_docker.sh "${args[@]}"
}

wait_for_health() {
  log "Waiting for OpenMetadata server (max ${HEALTH_TIMEOUT}s)"
  local elapsed=0
  while (( elapsed < HEALTH_TIMEOUT )); do
    if curl -fsS "${SERVER_URL}/v1/system/version" >/dev/null 2>&1; then
      log "Server is up after ${elapsed}s"
      return 0
    fi
    sleep 5
    elapsed=$((elapsed + 5))
    if (( elapsed % 30 == 0 )); then
      printf "  still waiting... (%ds)\n" "${elapsed}"
    fi
  done
  die "Timed out waiting for OpenMetadata at ${SERVER_URL}"
}

fetch_token() {
  # The local dev stack ships a fixed admin JWT (see run_local_docker_common.sh
  # `authorizationToken`). It's bound to the built-in `admin` user and accepted by
  # the dev profile's JwtFilter. We use it as the bearer to fetch the live
  # ingestion-bot JWT; the bot's token is what we want for create_or_update calls
  # because it has unrestricted entity write perms in the dev policy set.
  log "Fetching ingestion-bot JWT"
  local admin_jwt="${ADMIN_JWT:-eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg}"
  local token
  token="$(curl -fsS -H "Authorization: Bearer ${admin_jwt}" \
    "${SERVER_URL}/v1/bots/name/ingestion-bot" \
    | python -c 'import json,sys; d=json.load(sys.stdin); print((d.get("botUser") or {}).get("authenticationMechanism", {}).get("config", {}).get("JWTToken", ""))' 2>/dev/null || true)"
  if [[ -z "${token}" ]]; then
    # Fallback: just use the admin JWT directly. It has all permissions in the dev profile.
    warn "Bot JWT lookup returned empty; falling back to the admin JWT (dev only)"
    token="${admin_jwt}"
  fi
  printf '%s' "${token}"
}

run_ingest() {
  local token="$1"
  log "Generating ${CONTAINERS} containers via ingest_100k_containers.py"
  python scripts/ingest_100k_containers.py \
    --server "${SERVER_URL}" \
    --token "${token}" \
    --service "${SERVICE_NAME}" \
    --containers "${CONTAINERS}" \
    --workers "${WORKERS}" \
    --batch-size "${BATCH_SIZE}"
}

main() {
  log "Reindex perf bootstrap starting"
  printf "  CONTAINERS=%s WORKERS=%s BATCH_SIZE=%s\n" "${CONTAINERS}" "${WORKERS}" "${BATCH_SIZE}"
  printf "  SKIP_BUILD=%s SKIP_DOCKER=%s SKIP_INGEST=%s\n" \
    "${SKIP_BUILD}" "${SKIP_DOCKER}" "${SKIP_INGEST}"

  if [[ "${SKIP_INGEST}" != "true" ]]; then
    ensure_python_sdk
  fi

  if [[ "${SKIP_DOCKER}" != "true" ]]; then
    stop_stack
    start_stack
    wait_for_health
  else
    log "Skipping docker bring-up (SKIP_DOCKER=true)"
    wait_for_health
  fi

  if [[ "${SKIP_INGEST}" == "true" ]]; then
    log "Skipping data generation (SKIP_INGEST=true). Stack is up at ${SERVER_URL}."
    exit 0
  fi

  local token
  if [[ -n "${OM_JWT_TOKEN:-}" ]]; then
    log "Using OM_JWT_TOKEN from env"
    token="${OM_JWT_TOKEN}"
  else
    token="$(fetch_token)"
  fi

  run_ingest "${token}"

  log "All done. Stack at ${SERVER_URL}, ~${CONTAINERS} containers under service '${SERVICE_NAME}'."
}

main "$@"
