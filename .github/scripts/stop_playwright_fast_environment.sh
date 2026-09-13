#!/usr/bin/env bash

set -euo pipefail

compose_file="docker/development/docker-compose-postgres.yml"
fast_compose_file="docker/development/docker-compose-playwright-fast.yml"

if [[ "${PW_STARTUP_FAILED:-false}" == "true" ]]; then
  diagnostics_dir="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/playwright-ci-diagnostics"
  mkdir -p "$diagnostics_dir"
  if [[ -n "${PW_SERVER_PID_FILE:-}" && -f "$PW_SERVER_PID_FILE" ]]; then
    server_pid=$(cat "$PW_SERVER_PID_FILE")
    ps -p "$server_pid" -o pid,ppid,stat,etime,%cpu,%mem \
      > "$diagnostics_dir/server-process.txt" 2>&1 || true
    if kill -0 "$server_pid" 2>/dev/null && command -v jcmd >/dev/null 2>&1; then
      timeout --signal=TERM --kill-after=1s 5s jcmd "$server_pid" Thread.print -l 2>&1 |
        head -n 5000 > "$diagnostics_dir/server-threads.txt" || true
    fi
  fi
fi

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

if [[ -n "${PW_AUTOPILOT_MYSQL_CONTAINER:-}" ]]; then
  docker rm --force --volumes "$PW_AUTOPILOT_MYSQL_CONTAINER" 2>/dev/null || true
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

if [[ "${PW_STARTUP_FAILED:-false}" == "true" && -n "${PW_RUNTIME_ROOT:-}" ]]; then
  # The capture process flushes when the server closes its output; retain that
  # tail and the native JVM/application logs before deleting the RAM filesystem.
  for log_path in \
    "${PW_SERVER_LOG:-$PW_RUNTIME_ROOT/logs/openmetadata-server.log}" \
    "$PW_RUNTIME_ROOT/logs/openmetadata-gc.log" \
    "$PW_RUNTIME_ROOT/server/logs/openmetadata.log" \
    "$PW_RUNTIME_ROOT/server/logs/openmetadata-operations.log"; do
    if [[ -f "$log_path" ]]; then
      tail -n 5000 "$log_path" > "$diagnostics_dir/$(basename "$log_path")" 2>&1 || true
    fi
  done
  for log_path in "$diagnostics_dir/openmetadata-server.log" "$diagnostics_dir/openmetadata.log"; do
    if [[ -f "$log_path" ]]; then
      tail -n 500 "$log_path" >&2 || true
    fi
  done
  if [[ -f "$diagnostics_dir/server-threads.txt" ]]; then
    head -n 200 "$diagnostics_dir/server-threads.txt" >&2 || true
  fi
  if [[ -n "${PW_POSTGRES_DATA_DIR:-}" && -n "${PW_OPENSEARCH_DATA_DIR:-}" ]]; then
    docker compose -f "$compose_file" -f "$fast_compose_file" ps --all \
      > "$diagnostics_dir/docker-compose-ps.txt" 2>&1 || true
    docker compose -f "$compose_file" -f "$fast_compose_file" logs --no-color --tail 500 postgresql opensearch \
      > "$diagnostics_dir/docker-compose.log" 2>&1 || true
  fi
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
