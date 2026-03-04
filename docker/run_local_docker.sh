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

cd "$(dirname "${BASH_SOURCE[0]}")" || exit

helpFunction()
{
   echo ""
   echo "Usage: $0 -m mode -d database"
   echo "\t-m Running mode: [ui, no-ui]. Default [ui]\n"
   echo "\t-d Database: [mysql, postgresql]. Default [mysql]\n"
   echo "\t-s Skip maven build: [true, false]. Default [false]\n"
   echo "\t-i Include ingestion: [true, false]. Default [true]\n"
   echo "\t-x Open JVM debug port on 5005: [true, false]. Default [false]\n"
   echo "\t-h For usage help\n"
   echo "\t-r For Cleaning DB Volumes. [true, false]. Default [true]\n"
   exit 1 # Exit script after printing help
}

while getopts "m:d:s:i:x:r:h" opt
do
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
authorizationToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
cleanDbVolumes="${cleanDbVolumes:=true}"

echo "Running local docker using mode [$mode] database [$database] and skipping maven build [$skipMaven] with cleanDB as [$cleanDbVolumes] and including ingestion [$includeIngestion]"

cd ../

echo "Stopping any previous Local Docker Containers"
docker compose -f docker/development/docker-compose-postgres.yml down --remove-orphans
docker compose -f docker/development/docker-compose.yml down --remove-orphans

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

RESULT=$?
if [ $RESULT -ne 0 ]; then
  echo "Failed to run Maven build!"
  exit 1
fi

if [[ $debugOM == "true" ]]; then
 export OPENMETADATA_DEBUG=true
fi

if [[ $cleanDbVolumes == "true" ]]
then
  if [[ -d "$PWD/docker/development/docker-volume/" ]]
  then
      rm -rf $PWD/docker/development/docker-volume
    fi
fi

if [[ $includeIngestion == "true" ]]; then
  if [[ $VIRTUAL_ENV == "" ]];
  then
    echo "Please Use Virtual Environment and make sure to generate Pydantic Models";
  else
    echo "Generating Pydantic Models";
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

if [[ $includeIngestion == "true" ]]; then
    echo "Building all services including ingestion (dependency: ${INGESTION_DEPENDENCY:-all})"
    docker compose -f $COMPOSE_FILE build --build-arg INGESTION_DEPENDENCY="${INGESTION_DEPENDENCY:-all}" && docker compose -f $COMPOSE_FILE up -d
else
    echo "Building services without ingestion"
    docker compose -f $COMPOSE_FILE build $SEARCH_SERVICE $DB_SERVICE execute-migrate-all openmetadata-server && \
    docker compose -f $COMPOSE_FILE up -d $SEARCH_SERVICE $DB_SERVICE execute-migrate-all openmetadata-server
fi

RESULT=$?
if [ $RESULT -ne 0 ]; then
  echo "Failed to start Docker instances!"
  exit 1
fi

until curl -s -f "http://localhost:9200/_cat/indices/openmetadata_team_search_index"; do
  echo 'Checking if Elastic Search instance is up...\n'
  sleep 5
done

if [[ $includeIngestion == "true" ]]; then
  # Function to get OAuth access token for Airflow API
  get_airflow_token() {
    local token_response=$(curl -s -X POST 'http://localhost:8080/auth/token' \
      -H 'Content-Type: application/json' \
      -d '{"username": "admin", "password": "admin"}')

    local access_token=$(echo "$token_response" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('access_token', ''))" 2>/dev/null || echo "")

    if [ -z "$access_token" ]; then
      echo "✗ Failed to get access token" >&2
      echo "  Response: ${token_response}" >&2
      return 1
    fi

    echo "$access_token"
  }

  # Wait for Airflow API to be ready and get initial token
  echo "Waiting for Airflow API to be ready..."
  until AIRFLOW_ACCESS_TOKEN=$(get_airflow_token) 2>/dev/null && [ -n "$AIRFLOW_ACCESS_TOKEN" ]; do
    echo 'Checking if Airflow API is reachable...'
    sleep 5
  done
  echo "✓ Airflow API is ready, token obtained"

  # Check if sample_data DAG is available
  echo "Checking if Sample Data DAG is available..."
  until curl -s -f -H "Authorization: Bearer $AIRFLOW_ACCESS_TOKEN" "http://localhost:8080/api/v2/dags/sample_data" >/dev/null 2>&1; do
    # Check for import errors
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
    # Refresh token if needed (tokens expire after 24h)
    AIRFLOW_ACCESS_TOKEN=$(get_airflow_token) 2>/dev/null
  done
  echo "✓ Sample Data DAG is available"
fi

until curl -s -f --header "Authorization: Bearer $authorizationToken" "http://localhost:8585/api/v1/tables"; do
  echo 'Checking if OM Server is reachable...\n'
  sleep 5
done

if [[ $includeIngestion == "true" ]]; then
  # Function to unpause DAG using Airflow API with OAuth Bearer token
  unpause_dag() {
    local dag_id=$1
    echo "Unpausing DAG: ${dag_id}"

    # Get fresh token if not already set
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
      # Token might be expired, try refreshing once
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

  # Trigger sample_data DAG to run
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
  # This validates the sample data DAG flow
  make install

  # Run validation with timeout to avoid hanging indefinitely
  echo "Running DAG validation (this may take a few minutes)..."
  timeout 300 python docker/validate_compose.py || {
    exit_code=$?
    if [ $exit_code -eq 124 ]; then
      echo "⚠ Warning: DAG validation timed out after 5 minutes"
      echo "  The DAG may still be running. Check Airflow UI at http://localhost:8080"
    else
      echo "⚠ Warning: DAG validation failed with exit code $exit_code"
    fi
    echo "  Continuing with remaining setup..."
  }

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
# Trigger ElasticSearch ReIndexing from UI
curl --location --request POST 'http://localhost:8585/api/v1/apps/trigger/SearchIndexingApplication' \
--header 'Authorization: Bearer eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg'

sleep 60 # Sleep for 60 seconds to make sure the elasticsearch reindexing from UI finishes
tput setaf 2
echo "✔ OpenMetadata is up and running"

