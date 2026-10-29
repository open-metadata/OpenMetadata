#!/usr/bin/env bash

#  Copyright 2026 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

# Sourced by the fixture builder, validator and fast-environment launcher so the
# database a fixture was seeded on (the `database` input of
# playwright-e2e-reusable.yml) is restored onto the same engine and search
# backend. The PostgreSQL stack pairs with OpenSearch, the MySQL stack with
# Elasticsearch, mirroring their docker/development compose files.
# ADR:2026-10-28-playwright-golden-fixtures-are-scoped-to-their-seed-database
load_playwright_fixture_profile() {
  case "$1" in
    postgresql)
      PW_COMPOSE_FILE=docker/development/docker-compose-postgres.yml
      PW_FAST_COMPOSE_FILE=docker/development/docker-compose-playwright-fast.yml
      PW_DATABASE_SERVICE=postgresql
      PW_DATABASE_CONTAINER=openmetadata_postgresql
      PW_DATABASE_DATA_PATH=/var/lib/postgresql/data
      PW_DATABASE_DOCKERFILE=docker/postgresql/Dockerfile_postgres
      PW_DATABASE_MARKER=./database/PG_VERSION
      PW_DB_DRIVER_CLASS=org.postgresql.Driver
      PW_DB_SCHEME=postgresql
      PW_DB_PORT=5432
      PW_AIRFLOW_DB_SCHEME=postgresql+psycopg2
      PW_SEARCH_SERVICE=opensearch
      PW_SEARCH_CONTAINER=openmetadata_opensearch
      PW_SEARCH_DATA_PATH=/usr/share/opensearch/data
      PW_SEARCH_MARKER=./search/nodes/
      PW_SEARCH_TYPE=opensearch
      ;;
    mysql)
      PW_COMPOSE_FILE=docker/development/docker-compose.yml
      PW_FAST_COMPOSE_FILE=docker/development/docker-compose-playwright-fast-mysql.yml
      PW_DATABASE_SERVICE=mysql
      PW_DATABASE_CONTAINER=openmetadata_mysql
      PW_DATABASE_DATA_PATH=/var/lib/mysql
      PW_DATABASE_DOCKERFILE=docker/mysql/Dockerfile_mysql
      PW_DATABASE_MARKER=./database/mysql.ibd
      PW_DB_DRIVER_CLASS=com.mysql.cj.jdbc.Driver
      PW_DB_SCHEME=mysql
      PW_DB_PORT=3306
      PW_AIRFLOW_DB_SCHEME=mysql+mysqldb
      PW_SEARCH_SERVICE=elasticsearch
      PW_SEARCH_CONTAINER=openmetadata_elasticsearch
      PW_SEARCH_DATA_PATH=/usr/share/elasticsearch/data
      # Elasticsearch 8+ dropped the nodes/<n>/ level that OpenSearch still uses.
      PW_SEARCH_MARKER=./search/indices/
      PW_SEARCH_TYPE=elasticsearch
      ;;
    *)
      echo "Unsupported Playwright fixture database: ${1:-<empty>}" >&2
      return 1
      ;;
  esac
}

# Loads the profile of the database a fixture manifest was seeded on, refusing
# a fixture from another engine when the workflow pins PLAYWRIGHT_DATABASE.
load_playwright_fixture_profile_from_manifest() {
  PW_FIXTURE_DATABASE=$(jq -r '.database // empty' "$1")
  if [[ -n "${PLAYWRIGHT_DATABASE:-}" && "$PW_FIXTURE_DATABASE" != "$PLAYWRIGHT_DATABASE" ]]; then
    echo "The Playwright fixture was seeded on '${PW_FIXTURE_DATABASE:-unknown}', not '$PLAYWRIGHT_DATABASE'" >&2
    return 1
  fi
  load_playwright_fixture_profile "$PW_FIXTURE_DATABASE"
}
