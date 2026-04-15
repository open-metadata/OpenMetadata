#!/bin/bash
#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

RED='\033[0;31m'
RUN_LOCAL_DOCKER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
authorizationToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"

helpFunction() {
   echo ""
   echo "Usage: $0 -m mode -d database"
   echo "\t-m Running mode: [ui, no-ui]. Default [ui]\n"
   echo "\t-d Database: [mysql, postgresql]. Default [mysql]\n"
   echo "\t-s Skip maven build: [true, false]. Default [false]\n"
   echo "\t-i Include ingestion: [true, false]. Default [true]\n"
   echo "\t-x Open JVM debug port on 5005: [true, false]. Default [false]\n"
   echo "\t-h For usage help\n"
   echo "\t-r For Cleaning DB Volumes. [true, false]. Default [true]\n"
   exit 1
}

current_time_ms() {
  python3 -c "import time; print(int(time.time() * 1000))"
}

run_with_timeout() {
  local secs=$1
  shift
  if command -v timeout &>/dev/null; then
    timeout "$secs" "$@"
  elif command -v gtimeout &>/dev/null; then
    gtimeout "$secs" "$@"
  else
    "$@"
  fi
}

parse_app_run_status_line() {
  local payload=$1
  local payload_shape=$2
  local threshold_ms=$3
  local tolerance_ms=$4

  APP_RUN_BODY="$payload" python3 - "$payload_shape" "$threshold_ms" "$tolerance_ms" <<'PY'
import json
import os
import sys

payload_shape = sys.argv[1]
threshold = int(sys.argv[2])
tolerance = int(sys.argv[3])

try:
    payload = json.loads(os.environ["APP_RUN_BODY"])
except json.JSONDecodeError:
    print("invalid")
    sys.exit(0)

if payload_shape == "latest":
    record = payload if isinstance(payload, dict) else None
else:
    records = payload.get("data") if isinstance(payload, dict) else None
    record = records[0] if records else None

if not isinstance(record, dict) or not record:
    print("missing")
    sys.exit(0)

timestamp = int(record.get("timestamp") or 0)
start_time = int(record.get("startTime") or 0)
status = str(record.get("status") or "").lower()
execution_time = record.get("executionTime")

marker = start_time if start_time > 0 else timestamp
success_statuses = {"completed", "success"}
failure_statuses = {"activeerror", "failed", "stopped"}
active_statuses = {"running", "started", "pending", "active", "stopinprogress"}
has_execution_time = execution_time not in (None, "", 0, "0")

if marker + tolerance < threshold:
    print(f"stale:{status}:{marker}")
elif status in success_statuses:
    print(f"success:{status}:{marker}")
elif status in failure_statuses or (has_execution_time and status not in active_statuses):
    print(f"failure:{status}:{marker}")
elif status in active_statuses:
    print(f"active:{status}:{marker}")
else:
    print(f"seen:{status}:{marker}")
PY
}

wait_for_app_availability() {
  local app_name=$1
  local timeout_seconds=${2:-120}
  local deadline=$((SECONDS + timeout_seconds))

  while [ $SECONDS -lt $deadline ]; do
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" \
      --header "Authorization: Bearer $authorizationToken" \
      "http://localhost:8585/api/v1/apps/name/${app_name}")

    if [ "$http_code" = "200" ]; then
      echo "✓ App ${app_name} is available"
      return 0
    fi

    echo "Waiting for app ${app_name} to become available..."
    sleep 5
  done

  echo "✗ App ${app_name} did not become available within ${timeout_seconds}s"
  return 1
}

ensure_app_installed() {
  local app_name=$1
  local response
  local http_code
  local body

  response=$(curl -s -w "\n%{http_code}" \
    --header "Authorization: Bearer $authorizationToken" \
    "http://localhost:8585/api/v1/apps/name/${app_name}")
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" = "200" ]; then
    echo "✓ App ${app_name} is already installed"
    return 0
  fi

  if [ "$http_code" != "404" ]; then
    echo "✗ Failed to inspect app ${app_name} (HTTP ${http_code})"
    echo "  Response: ${body}"
    return 1
  fi

  echo "App ${app_name} is not installed. Installing it from the marketplace definition..."
  local marketplace_response
  marketplace_response=$(curl -s -f \
    --header "Authorization: Bearer $authorizationToken" \
    "http://localhost:8585/api/v1/apps/marketplace/name/${app_name}") || {
      echo "✗ Could not fetch marketplace definition for ${app_name}"
      return 1
    }

  local create_payload
  create_payload=$(MARKETPLACE_RESPONSE="$marketplace_response" python3 - <<'PY'
import json
import os

definition = json.loads(os.environ["MARKETPLACE_RESPONSE"])
payload = {
    "name": definition["name"],
    "displayName": definition.get("displayName"),
    "description": definition.get("description"),
    "appConfiguration": definition.get("appConfiguration", {}),
    "appSchedule": {"scheduleTimeline": "None"},
    "supportsInterrupt": definition.get("supportsInterrupt", False),
}
print(json.dumps(payload))
PY
)

  response=$(curl -s -w "\n%{http_code}" --location --request POST 'http://localhost:8585/api/v1/apps' \
    --header "Authorization: Bearer $authorizationToken" \
    --header 'Content-Type: application/json' \
    --data-raw "$create_payload")
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" = "200" ] || [ "$http_code" = "201" ] || [ "$http_code" = "409" ]; then
    wait_for_app_availability "$app_name" 120
    return $?
  fi

  echo "✗ Failed to install app ${app_name} (HTTP ${http_code})"
  echo "  Response: ${body}"
  return 1
}

wait_for_app_run_completion() {
  local app_name=$1
  local trigger_timestamp_ms=$2
  local timeout_seconds=${3:-${APP_RUN_WAIT_TIMEOUT_SECONDS:-300}}
  local freshness_tolerance_ms=${APP_RUN_FRESHNESS_TOLERANCE_MS:-5000}
  local deadline=$((SECONDS + timeout_seconds))

  while [ $SECONDS -lt $deadline ]; do
    local latest_run_response
    local fallback_status_response
    local http_code
    local fallback_http_code
    local body
    local fallback_body
    local status_line
    local fallback_status_line

    latest_run_response=$(curl -s -w "\n%{http_code}" \
      --header "Authorization: Bearer $authorizationToken" \
      "http://localhost:8585/api/v1/apps/name/${app_name}/runs/latest")
    http_code=$(printf "%s" "$latest_run_response" | tail -n1)
    body=$(printf "%s" "$latest_run_response" | sed '$d')

    case "$http_code" in
      200)
        status_line=$(parse_app_run_status_line "$body" "latest" "$trigger_timestamp_ms" "$freshness_tolerance_ms")
        ;;
      204)
        status_line="missing"
        ;;
      *)
        status_line="endpoint_error:${http_code}"
        ;;
    esac

    if [[ "$status_line" == stale:* || "$status_line" == "missing" || "$status_line" == "invalid" || "$status_line" == endpoint_error:* ]]; then
      fallback_status_response=$(curl -s -w "\n%{http_code}" \
        --header "Authorization: Bearer $authorizationToken" \
        "http://localhost:8585/api/v1/apps/name/${app_name}/status?offset=0&limit=1")
      fallback_http_code=$(printf "%s" "$fallback_status_response" | tail -n1)
      fallback_body=$(printf "%s" "$fallback_status_response" | sed '$d')

      case "$fallback_http_code" in
        200)
          fallback_status_line=$(parse_app_run_status_line "$fallback_body" "list" "$trigger_timestamp_ms" "$freshness_tolerance_ms")
          ;;
        204)
          fallback_status_line="missing"
          ;;
        *)
          fallback_status_line="endpoint_error:${fallback_http_code}"
          ;;
      esac

      if [[ "$fallback_status_line" != stale:* && "$fallback_status_line" != "missing" && "$fallback_status_line" != "invalid" && "$fallback_status_line" != endpoint_error:* ]]; then
        status_line="$fallback_status_line"
        body="$fallback_body"
      elif [[ "$status_line" == endpoint_error:* && "$fallback_status_line" == endpoint_error:* ]]; then
        echo "✗ Failed to read run status for ${app_name} from both app run endpoints"
        echo "  runs/latest response: ${body}"
        echo "  status response: ${fallback_body}"
        return 1
      elif [[ "$status_line" == "missing" || "$status_line" == "invalid" || "$status_line" == endpoint_error:* ]]; then
        status_line="$fallback_status_line"
        body="$fallback_body"
      fi
    fi

    case "$status_line" in
      success:completed:*|success:success:*)
        echo "✓ ${app_name} completed successfully"
        return 0
        ;;
      failure:*)
        echo "✗ ${app_name} finished with status ${status_line#failure:}"
        echo "  Response: ${body}"
        return 1
        ;;
      active:*)
        echo "Waiting for ${app_name} to finish (${status_line#active:})..."
        ;;
      seen:*)
        echo "Waiting for ${app_name}; latest status was ${status_line#seen:}"
        ;;
      stale:*|missing|invalid)
        echo "Waiting for a fresh run record for ${app_name}..."
        ;;
      *)
        echo "Waiting for ${app_name}; latest status was ${status_line}"
        ;;
    esac

    sleep 5
  done

  echo "✗ Timed out waiting for ${app_name} to finish within ${timeout_seconds}s"
  return 1
}

trigger_app_and_wait() {
  local app_name=$1
  local payload=${2:-}
  local timeout_seconds=${3:-${APP_RUN_WAIT_TIMEOUT_SECONDS:-300}}
  local trigger_timestamp_ms
  local response
  local http_code
  local body

  trigger_timestamp_ms=$(current_time_ms)
  if [ -n "$payload" ]; then
    response=$(curl -s -w "\n%{http_code}" --location --request POST "http://localhost:8585/api/v1/apps/trigger/${app_name}" \
      --header "Authorization: Bearer $authorizationToken" \
      --header 'Content-Type: application/json' \
      --data-raw "$payload")
  else
    response=$(curl -s -w "\n%{http_code}" --location --request POST "http://localhost:8585/api/v1/apps/trigger/${app_name}" \
      --header "Authorization: Bearer $authorizationToken")
  fi

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" != "200" ] && [ "$http_code" != "201" ] && [ "$http_code" != "202" ]; then
    echo "✗ Failed to trigger ${app_name} (HTTP ${http_code})"
    echo "  Response: ${body}"
    return 1
  fi

  wait_for_app_run_completion "$app_name" "$trigger_timestamp_ms" "$timeout_seconds"
}

run_local_docker_main() {
  local mode database skipMaven includeIngestion debugOM cleanDbVolumes
  local COMPOSE_FILE DB_SERVICE SEARCH_SERVICE
  local response http_code body
  local validation_timeout_seconds sample_data_validation_failed
  local AIRFLOW_ACCESS_TOKEN IMPORT_ERRORS LOGICAL_DATE
  local extra_compose_file
  local -a COMPOSE_ARGS additional_up_services

  OPTIND=1
  while getopts "m:d:s:i:x:r:h" opt; do
    case "$opt" in
      m ) mode="$OPTARG" ;;
      d ) database="$OPTARG" ;;
      s ) skipMaven="$OPTARG" ;;
      i ) includeIngestion="$OPTARG" ;;
      x ) debugOM="$OPTARG" ;;
      r ) cleanDbVolumes="$OPTARG" ;;
      h ) helpFunction ;;
      ? ) helpFunction ;;
    esac
  done

  mode="${mode:=ui}"
  database="${database:=mysql}"
  skipMaven="${skipMaven:=false}"
  includeIngestion="${includeIngestion:=true}"
  debugOM="${debugOM:=false}"
  cleanDbVolumes="${cleanDbVolumes:=true}"
  export APP_RUN_WAIT_TIMEOUT_SECONDS="${APP_RUN_WAIT_TIMEOUT_SECONDS:-300}"

  echo "Running local docker using mode [$mode] database [$database] and skipping maven build [$skipMaven] with cleanDB as [$cleanDbVolumes] and including ingestion [$includeIngestion]"

  cd "$RUN_LOCAL_DOCKER_DIR/.." || exit 1

  echo "Stopping any previous Local Docker Containers"
  docker compose -f docker/development/docker-compose-postgres.yml down --remove-orphans
  docker compose -f docker/development/docker-compose.yml down --remove-orphans
  if [[ -n "${OM_EXTRA_COMPOSE_FILES:-}" ]]; then
    for extra_compose_file in $OM_EXTRA_COMPOSE_FILES; do
      docker compose -f docker/development/docker-compose-postgres.yml -f "$extra_compose_file" down --remove-orphans
      docker compose -f docker/development/docker-compose.yml -f "$extra_compose_file" down --remove-orphans
    done
  fi

  if [[ $skipMaven == "false" ]]; then
    if [[ $mode == "no-ui" ]]; then
      echo "Maven Build - Skipping Tests and UI"
      mvn -DskipTests -DonlyBackend clean package -pl !openmetadata-ui
    else
      echo "Maven Build - Skipping Tests"
      mvn -DskipTests clean package
    fi
  else
    echo "Skipping Maven Build"
  fi

  if [ $? -ne 0 ]; then
    echo "Failed to run Maven build!"
    exit 1
  fi

  if [[ $debugOM == "true" ]]; then
    export OPENMETADATA_DEBUG=true
  fi

  if [[ $cleanDbVolumes == "true" ]]; then
    if [[ -d "$PWD/docker/development/docker-volume/" ]]; then
      if ! rm -rf "$PWD/docker/development/docker-volume"; then
        if command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
          sudo rm -rf "$PWD/docker/development/docker-volume"
        else
          echo "Warning: failed to remove $PWD/docker/development/docker-volume; continuing may reuse stale database state"
        fi
      fi
    fi
  fi

  if [[ $includeIngestion == "true" ]]; then
    if [[ $VIRTUAL_ENV == "" ]]; then
      echo "Please Use Virtual Environment and make sure to generate Pydantic Models"
    else
      echo "Generating Pydantic Models"
      make install_dev generate
    fi
  else
    echo "Skipping Pydantic Models generation (ingestion disabled)"
  fi

  echo "Starting Local Docker Containers"

  if [[ $database == "postgresql" ]]; then
    COMPOSE_FILE="docker/development/docker-compose-postgres.yml"
    DB_SERVICE="postgresql"
    SEARCH_SERVICE="opensearch"
  elif [[ $database == "mysql" ]]; then
    COMPOSE_FILE="docker/development/docker-compose.yml"
    DB_SERVICE="mysql"
    SEARCH_SERVICE="elasticsearch"
  else
    echo "Invalid database type: $database"
    exit 1
  fi

  COMPOSE_ARGS=(-f "$COMPOSE_FILE")
  if [[ -n "${OM_EXTRA_COMPOSE_FILES:-}" ]]; then
    for extra_compose_file in $OM_EXTRA_COMPOSE_FILES; do
      COMPOSE_ARGS+=(-f "$extra_compose_file")
    done
  fi

  if [[ $includeIngestion == "true" ]]; then
    echo "Building all services including ingestion (dependency: ${INGESTION_DEPENDENCY:-all})"
    docker compose "${COMPOSE_ARGS[@]}" build --build-arg INGESTION_DEPENDENCY="${INGESTION_DEPENDENCY:-all}" && \
      docker compose "${COMPOSE_ARGS[@]}" up -d
  else
    echo "Building services without ingestion"
    docker compose "${COMPOSE_ARGS[@]}" build $SEARCH_SERVICE $DB_SERVICE execute-migrate-all openmetadata-server || exit 1
    if [[ -n "${OM_ADDITIONAL_UP_SERVICES:-}" ]]; then
      for extra_compose_file in $OM_ADDITIONAL_UP_SERVICES; do
        additional_up_services+=("$extra_compose_file")
      done
    fi
    docker compose "${COMPOSE_ARGS[@]}" up -d "${additional_up_services[@]}" $SEARCH_SERVICE $DB_SERVICE execute-migrate-all openmetadata-server
  fi

  if [ $? -ne 0 ]; then
    echo "Failed to start Docker instances!"
    exit 1
  fi

  until curl -s -f "http://localhost:9200/_cat/indices/openmetadata_team_search_index"; do
    echo 'Checking if Elastic Search instance is up...\n'
    sleep 5
  done

  if [[ $includeIngestion == "true" ]]; then
    get_airflow_token() {
      local token_response
      local access_token

      token_response=$(curl -s -X POST 'http://localhost:8080/auth/token' \
        -H 'Content-Type: application/json' \
        -d '{"username": "admin", "password": "admin"}')

      access_token=$(echo "$token_response" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('access_token', ''))" 2>/dev/null || echo "")

      if [ -z "$access_token" ]; then
        echo "✗ Failed to get access token" >&2
        echo "  Response: ${token_response}" >&2
        return 1
      fi

      echo "$access_token"
    }

    echo "Waiting for Airflow API to be ready..."
    until AIRFLOW_ACCESS_TOKEN=$(get_airflow_token) 2>/dev/null && [ -n "$AIRFLOW_ACCESS_TOKEN" ]; do
      echo 'Checking if Airflow API is reachable...'
      sleep 5
    done
    echo "✓ Airflow API is ready, token obtained"

    echo "Checking if Sample Data DAG is available..."
    until curl -s -f -H "Authorization: Bearer $AIRFLOW_ACCESS_TOKEN" "http://localhost:8080/api/v2/dags/sample_data" >/dev/null 2>&1; do
      IMPORT_ERRORS=$(curl -s -H "Authorization: Bearer $AIRFLOW_ACCESS_TOKEN" "http://localhost:8080/api/v2/importErrors" 2>/dev/null)
      if [ -n "$IMPORT_ERRORS" ]; then
        echo "$IMPORT_ERRORS" | grep "/airflow_sample_data.py" > /dev/null 2>&1
        if [ "$?" == "0" ]; then
          echo -e "${RED}Airflow found an error importing \`sample_data\` DAG"
          echo "$IMPORT_ERRORS" | python3 -c "import sys, json; data=json.load(sys.stdin); [print(json.dumps(e, indent=2)) for e in data.get('import_errors', []) if e.get('filename', '').endswith('airflow_sample_data.py')]" 2>/dev/null || echo "$IMPORT_ERRORS"
          exit 1
        fi
      fi
      echo 'Checking if Sample Data DAG is reachable...'
      sleep 5
      AIRFLOW_ACCESS_TOKEN=$(get_airflow_token) 2>/dev/null
    done
    echo "✓ Sample Data DAG is available"
  fi

  until curl -s -f --header "Authorization: Bearer $authorizationToken" "http://localhost:8585/api/v1/tables"; do
    echo 'Checking if OM Server is reachable...\n'
    sleep 5
  done

  if [[ $includeIngestion == "true" ]]; then
    unpause_dag() {
      local dag_id=$1

      echo "Unpausing DAG: ${dag_id}"
      if [ -z "$AIRFLOW_ACCESS_TOKEN" ]; then
        AIRFLOW_ACCESS_TOKEN=$(get_airflow_token)
        if [ -z "$AIRFLOW_ACCESS_TOKEN" ]; then
          return 1
        fi
        echo "✓ OAuth token obtained"
      fi

      response=$(curl -s -w "\n%{http_code}" --location --request PATCH "http://localhost:8080/api/v2/dags/${dag_id}" \
        --header "Authorization: Bearer $AIRFLOW_ACCESS_TOKEN" \
        --header 'Content-Type: application/json' \
        --data-raw '{"is_paused": false}')

      http_code=$(echo "$response" | tail -n1)
      body=$(echo "$response" | sed '$d')

      if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo "✓ Successfully unpaused ${dag_id}"
      else
        echo "✗ Failed to unpause ${dag_id} (HTTP ${http_code})"
        echo "  Response: ${body}"
        if [ "$http_code" = "401" ]; then
          echo "  Refreshing token and retrying..."
          AIRFLOW_ACCESS_TOKEN=$(get_airflow_token)
          if [ -n "$AIRFLOW_ACCESS_TOKEN" ]; then
            response=$(curl -s -w "\n%{http_code}" --location --request PATCH "http://localhost:8080/api/v2/dags/${dag_id}" \
              --header "Authorization: Bearer $AIRFLOW_ACCESS_TOKEN" \
              --header 'Content-Type: application/json' \
              --data-raw '{"is_paused": false}')
            http_code=$(echo "$response" | tail -n1)
            if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
              echo "✓ Successfully unpaused ${dag_id} after retry"
            fi
          fi
        fi
      fi
    }

    unpause_dag "sample_data"
    unpause_dag "extended_sample_data"

    echo "Triggering sample_data DAG..."
    LOGICAL_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    response=$(curl -s -w "\n%{http_code}" -X POST "http://localhost:8080/api/v2/dags/sample_data/dagRuns" \
      --header "Authorization: Bearer $AIRFLOW_ACCESS_TOKEN" \
      --header 'Content-Type: application/json' \
      --data-raw "{\"logical_date\": \"$LOGICAL_DATE\"}")

    http_code=$(echo "$response" | tail -n1)
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
      echo "✓ Successfully triggered sample_data DAG"
    else
      echo "⚠ Could not trigger sample_data DAG (HTTP ${http_code})"
      echo "  Response: $(echo "$response" | sed '$d')"
      echo "  Note: DAG may run automatically on schedule"
    fi

    echo 'Validate sample data DAG...'
    sleep 5
    make install

    echo "Running DAG validation (this may take a few minutes)..."
    sample_data_validation_failed=false
    validation_timeout_seconds="${VALIDATION_TIMEOUT_SECONDS:-300}"

    run_with_timeout "$validation_timeout_seconds" python docker/validate_compose.py || {
      local exit_code=$?
      sample_data_validation_failed=true
      if [ $exit_code -eq 124 ]; then
        echo "⚠ Warning: DAG validation timed out after ${validation_timeout_seconds} seconds"
        echo "  The DAG may still be running. Check Airflow UI at http://localhost:8080"
      else
        echo "⚠ Warning: DAG validation failed with exit code $exit_code"
      fi
      echo "  Continuing with remaining setup..."
    }

    if [[ "${STRICT_DAG_VALIDATION:-false}" == "true" && "$sample_data_validation_failed" == "true" ]]; then
      echo "✗ Startup requires sample data ingestion to complete before continuing."
      exit 1
    fi

    sleep 5
    unpause_dag "sample_usage"
    sleep 5
    unpause_dag "index_metadata"
    sleep 2
    unpause_dag "sample_lineage"
  else
    echo "Skipping Airflow DAG setup (ingestion disabled)"
  fi

  echo "✔running reindexing"
  ensure_app_installed "SearchIndexingApplication"
  if ! trigger_app_and_wait "SearchIndexingApplication" "" "$APP_RUN_WAIT_TIMEOUT_SECONDS"; then
    exit 1
  fi

  tput setaf 2
  echo "✔ OpenMetadata is up and running"
}
