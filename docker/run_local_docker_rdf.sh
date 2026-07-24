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

cd "$(dirname "${BASH_SOURCE[0]}")" || exit

helpFunction() {
   echo ""
   echo "Usage: $0 [run_local_docker.sh args]"
   echo "\t-f Start Fuseki for RDF support: [true, false]. Default [true]"
   echo "\t-h For usage help"
   exit 1
}

startFuseki=true
filtered_args=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -f)
      if [[ $# -lt 2 ]]; then
        helpFunction
      fi
      startFuseki="$2"
      shift 2
      ;;
    -h)
      helpFunction
      ;;
    *)
      filtered_args+=("$1")
      shift
      ;;
  esac
done

if [[ $startFuseki == "true" ]]; then
  if [[ ",${COMPOSE_PROFILES:-}," != *",rdf,"* ]]; then
    export COMPOSE_PROFILES="${COMPOSE_PROFILES:+${COMPOSE_PROFILES},}rdf"
  fi
  export RDF_ENABLED=true
  export RDF_AUTO_REINDEX=true
  export RDF_MATERIALIZED_INFERENCE_ENABLED="${RDF_MATERIALIZED_INFERENCE_ENABLED:-true}"
  export RDF_INFERENCE_ENABLED="${RDF_INFERENCE_ENABLED:-true}"
  export RDF_DEFAULT_INFERENCE_LEVEL="${RDF_DEFAULT_INFERENCE_LEVEL:-CUSTOM}"
  export RDF_SHACL_VALIDATION_MODE="${RDF_SHACL_VALIDATION_MODE:-REPORT}"
  export RDF_DEREFERENCEABLE_IRIS="${RDF_DEREFERENCEABLE_IRIS:-true}"
  export RDF_STRICT_OWL_PROFILE="${RDF_STRICT_OWL_PROFILE:-true}"
  export RDF_ASK_COLLATE_ENABLED="${RDF_ASK_COLLATE_ENABLED:-false}"
  export RDF_STORAGE_TYPE="${RDF_STORAGE_TYPE:-FUSEKI}"
  export RDF_ENDPOINT="${RDF_ENDPOINT:-${RDF_REMOTE_ENDPOINT:-http://fuseki:3030/openmetadata}}"
  export RDF_REMOTE_USERNAME="${RDF_REMOTE_USERNAME:-admin}"
  export RDF_REMOTE_PASSWORD="${RDF_REMOTE_PASSWORD:-admin}"
  export RDF_BASE_URI="${RDF_BASE_URI:-https://open-metadata.org/}"
  export RDF_DATASET="${RDF_DATASET:-openmetadata}"
  # RDF listeners slow down sample-data ingestion enough that the default 5-minute
  # validation window is too aggressive for CI.
  export VALIDATE_COMPOSE_MAX_RETRIES="${VALIDATE_COMPOSE_MAX_RETRIES:-60}"
  export VALIDATE_COMPOSE_DAG_RUN_RETRIES="${VALIDATE_COMPOSE_DAG_RUN_RETRIES:-120}"
  export VALIDATE_COMPOSE_RETRY_INTERVAL_SECONDS="${VALIDATE_COMPOSE_RETRY_INTERVAL_SECONDS:-10}"
  export VALIDATE_COMPOSE_DAG_RUN_POLL_SECONDS="${VALIDATE_COMPOSE_DAG_RUN_POLL_SECONDS:-5}"
  export VALIDATION_TIMEOUT_SECONDS="${VALIDATION_TIMEOUT_SECONDS:-900}"
  export APP_RUN_WAIT_TIMEOUT_SECONDS="${APP_RUN_WAIT_TIMEOUT_SECONDS:-900}"
  export STRICT_DAG_VALIDATION=true
  export OM_EXTRA_COMPOSE_FILES="docker/development/docker-compose-fuseki.yml"
  export OM_ADDITIONAL_UP_SERVICES="fuseki"
else
  unset COMPOSE_PROFILES
  export RDF_ENABLED=false
  export RDF_AUTO_REINDEX=false
  unset RDF_MATERIALIZED_INFERENCE_ENABLED
  unset RDF_INFERENCE_ENABLED
  unset RDF_DEFAULT_INFERENCE_LEVEL
  unset RDF_SHACL_VALIDATION_MODE
  unset RDF_DEREFERENCEABLE_IRIS
  unset RDF_STRICT_OWL_PROFILE
  unset RDF_ASK_COLLATE_ENABLED
  unset RDF_STORAGE_TYPE
  unset RDF_ENDPOINT
  unset RDF_REMOTE_USERNAME
  unset RDF_REMOTE_PASSWORD
  unset RDF_BASE_URI
  unset RDF_DATASET
  unset VALIDATE_COMPOSE_MAX_RETRIES
  unset VALIDATE_COMPOSE_DAG_RUN_RETRIES
  unset VALIDATE_COMPOSE_RETRY_INTERVAL_SECONDS
  unset VALIDATE_COMPOSE_DAG_RUN_POLL_SECONDS
  export VALIDATION_TIMEOUT_SECONDS="${VALIDATION_TIMEOUT_SECONDS:-300}"
  export APP_RUN_WAIT_TIMEOUT_SECONDS="${APP_RUN_WAIT_TIMEOUT_SECONDS:-300}"
  unset STRICT_DAG_VALIDATION
  unset OM_EXTRA_COMPOSE_FILES
  unset OM_ADDITIONAL_UP_SERVICES
fi

source ./run_local_docker_common.sh

run_local_docker_main "${filtered_args[@]}"

if [[ $startFuseki != "true" || $RDF_AUTO_REINDEX != "true" ]]; then
  exit 0
fi

ensure_app_installed "RdfIndexApp"
echo "✔running RDF reindexing"
trigger_app_and_wait "RdfIndexApp" '{
  "entities": [],
  "recreateIndex": true,
  "batchSize": 100,
  "useDistributedIndexing": true,
  "partitionSize": 10000
}' "$APP_RUN_WAIT_TIMEOUT_SECONDS"

tput setaf 2
echo "✔ RDF/Knowledge Graph support is enabled"
echo "  - Fuseki UI: http://localhost:3030"
echo "  - SPARQL endpoint: http://localhost:3030/openmetadata/sparql"
