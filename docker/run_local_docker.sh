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

helpFunction()
{
   echo ""
   echo "Usage: $0 -m mode -d database"
   echo "\t-m Running mode: [ui, no-ui]. Default [ui]\n"
   echo "\t-d Database: [mysql, postgresql]. Default [mysql]\n"
   echo "\t-s Skip maven build: [true, false]. Default [false]\n"
   echo "\t-x Open JVM debug port on 5005: [true, false]. Default [false]\n"
   echo "\t-h For usage help\n"
   echo "\t-r For Cleaning DB Volumes. [true, false]. Default [true]\n"
   exit 1 # Exit script after printing help
}

while getopts "m:d:s:x:r:h" opt
do
   case "$opt" in
      m ) mode="$OPTARG" ;;
      d ) database="$OPTARG" ;;
      s ) skipMaven="$OPTARG" ;;
      x ) debugOM="$OPTARG" ;;
      r ) cleanDbVolumes="$OPTARG" ;;
      h ) helpFunction ;;
      ? ) helpFunction ;;
   esac
done

mode="${mode:=ui}"
database="${database:=mysql}"
skipMaven="${skipMaven:=false}"
debugOM="${debugOM:=false}"
authorizationToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
cleanDbVolumes="${cleanDbVolumes:=true}"

echo "Running local docker using mode [$mode] database [$database] and skipping maven build [$skipMaven] with cleanDB as [$cleanDbVolumes]"

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

if [[ $VIRTUAL_ENV == "" ]];
then
  echo "Please Use Virtual Environment and make sure to generate Pydantic Models";
else
  echo "Generating Pydantic Models";
  make install_dev generate
fi


echo "Starting Local Docker Containers"
echo "Using ingestion dependency: ${INGESTION_DEPENDENCY:-all}"

if [[ $database == "postgresql" ]]; then
    docker compose -f docker/development/docker-compose-postgres.yml build --build-arg INGESTION_DEPENDENCY="${INGESTION_DEPENDENCY:-all}" && docker compose -f docker/development/docker-compose-postgres.yml up -d
elif [[ $database == "mysql" ]]; then
    docker compose -f docker/development/docker-compose.yml build --build-arg INGESTION_DEPENDENCY="${INGESTION_DEPENDENCY:-all}" && docker compose -f docker/development/docker-compose.yml up -d
else
    echo "Invalid database type: $database"
    exit 1
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

until curl -s -f --header 'Authorization: Basic YWRtaW46YWRtaW4=' "http://localhost:8080/api/v1/dags/sample_data"; do
  echo 'Checking if Sample Data DAG is reachable...\n'
  sleep 5
done

until curl -s -f --header "Authorization: Bearer $authorizationToken" "http://localhost:8585/api/v1/tables"; do
  echo 'Checking if OM Server is reachable...\n'
  sleep 5
done

curl --location --request PATCH 'localhost:8080/api/v1/dags/sample_data' \
  --header 'Authorization: Basic YWRtaW46YWRtaW4=' \
  --header 'Content-Type: application/json' \
  --data-raw '{
        "is_paused": false
      }'

curl --location --request PATCH 'localhost:8080/api/v1/dags/extended_sample_data' \
  --header 'Authorization: Basic YWRtaW46YWRtaW4=' \
  --header 'Content-Type: application/json' \
  --data-raw '{
        "is_paused": false
      }'

echo 'Validate sample data DAG...'
sleep 5
# This validates the sample data DAG flow
make install
python docker/validate_compose.py

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

echo "✔running reindexing"
# Trigger ElasticSearch ReIndexing from UI
curl --location --request POST 'http://localhost:8585/api/v1/apps/trigger/SearchIndexingApplication' \
--header 'Authorization: Bearer eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg'

sleep 60 # Sleep for 60 seconds to make sure the elasticsearch reindexing from UI finishes
tput setaf 2
echo "✔ OpenMetadata is up and running"

