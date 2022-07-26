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

cd "$(dirname "${BASH_SOURCE[0]}")"
echo "Maven Build - Skipping Tests"
cd ../ && mvn -DskipTests clean package -pl !openmetadata-ui
echo "Prepare Docker volume for the operators"
cd docker/local-metadata
echo "Starting Local Docker Containers"

docker compose down && docker compose --env-file .ci_env up --build -d

until curl -s -f "http://localhost:9200/_cat/indices/team_search_index"; do
  printf 'Checking if Elastic Search instance is up...\n'
  sleep 5
done
until curl -s -f --header 'Authorization: Basic YWRtaW46YWRtaW4=' "http://localhost:8080/api/v1/dags/sample_data"; do
  printf 'Checking if Sample Data DAG is reachable...\n'
  sleep 5
done
curl --location --request PATCH 'localhost:8080/api/v1/dags/sample_data' \
  --header 'Authorization: Basic YWRtaW46YWRtaW4=' \
  --header 'Content-Type: application/json' \
  --data-raw '{
        "is_paused": false
      }'

cd ../
printf 'Validate sample data DAG...'
sleep 5
python validate_compose.py

until curl -s -f "http://localhost:8585/api/v1/tables/name/sample_data.ecommerce_db.shopify.fact_sale"; do
  printf 'Waiting on Sample Data Ingestion to complete...\n'
  curl -v "http://localhost:8585/api/v1/tables"
  sleep 5
done
sleep 5
curl --location --request PATCH 'localhost:8080/api/v1/dags/sample_usage' \
  --header 'Authorization: Basic YWRtaW46YWRtaW4=' \
  --header 'Content-Type: application/json' \
  --data-raw '{
      "is_paused": false
      }'
sleep 5
curl --location --request PATCH 'localhost:8080/api/v1/dags/index_metadata' \
  --header 'Authorization: Basic YWRtaW46YWRtaW4=' \
  --header 'Content-Type: application/json' \
  --data-raw '{
      "is_paused": false
      }'
sleep 2
curl --location --request PATCH 'localhost:8080/api/v1/dags/sample_lineage' \
  --header 'Authorization: Basic YWRtaW46YWRtaW4=' \
  --header 'Content-Type: application/json' \
  --data-raw '{
      "is_paused": false
      }'
tput setaf 2
echo "✔ OpenMetadata is up and running"


