#!/usr/bin/env bash

set -euo pipefail

compose_file="docker/development/docker-compose-postgres.yml"
fast_compose_file="docker/development/docker-compose-playwright-fast.yml"

unlink_seeded_state() {
  local link_path=$1
  local expected_target=$2
  if [[ -n "$link_path" && -L "$link_path" && "$(readlink "$link_path")" == "$expected_target" ]]; then
    unlink "$link_path"
  fi
}

if [[ -n "${PW_AIRFLOW_CONTAINER:-}" ]]; then
  docker rm --force --volumes "$PW_AIRFLOW_CONTAINER" 2>/dev/null || true
  docker rm --force "${PW_AIRFLOW_CONTAINER}_seed" 2>/dev/null || true
fi

if [[ -n "${PW_SERVER_PID_FILE:-}" && -f "$PW_SERVER_PID_FILE" ]]; then
  server_pid=$(cat "$PW_SERVER_PID_FILE")
  kill "$server_pid" 2>/dev/null || true
  for _ in $(seq 1 10); do
    kill -0 "$server_pid" 2>/dev/null || break
    sleep 1
  done
  kill -9 "$server_pid" 2>/dev/null || true
fi

if [[ -n "${PW_SERVER_CAPTURE_PID_FILE:-}" && -f "$PW_SERVER_CAPTURE_PID_FILE" ]]; then
  capture_pid=$(cat "$PW_SERVER_CAPTURE_PID_FILE")
  kill -USR1 "$capture_pid" 2>/dev/null || true
  for _ in $(seq 1 20); do
    kill -0 "$capture_pid" 2>/dev/null || break
    sleep 1
  done
  kill "$capture_pid" 2>/dev/null || true
fi

if [[ -n "${PW_POSTGRES_DATA_DIR:-}" && -n "${PW_OPENSEARCH_DATA_DIR:-}" ]]; then
  docker compose -f "$compose_file" -f "$fast_compose_file" down --remove-orphans || true
fi

if [[ -n "${PW_RUNTIME_ROOT:-}" && "$PW_RUNTIME_ROOT" == /dev/shm/openmetadata-playwright-* ]]; then
  unlink_seeded_state \
    "${PW_AUTH_LINK:-}" \
    "$PW_RUNTIME_ROOT/data/playwright-state/auth"
  unlink_seeded_state \
    "${PW_ENTITY_STATE_LINK:-}" \
    "$PW_RUNTIME_ROOT/data/playwright-state/entity-response-data.json"
  sudo rm -rf "$PW_RUNTIME_ROOT"
fi
