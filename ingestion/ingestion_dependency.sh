#!/usr/bin/env bash
#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

DB_HOST=${DB_HOST:-mysql}
DB_PORT=${DB_PORT:-3306}

AIRFLOW_DB=${AIRFLOW_DB:-airflow_db}
DB_USER=${DB_USER:-airflow_user}
DB_SCHEME=${DB_SCHEME:-mysql+mysqldb}
DB_PASSWORD=${DB_PASSWORD:-airflow_pass}
DB_PROPERTIES=${DB_PROPERTIES:-""}

AIRFLOW_ADMIN_USER=${AIRFLOW_ADMIN_USER:-admin}
AIRFLOW_ADMIN_PASSWORD=${AIRFLOW_ADMIN_PASSWORD:-admin}

DB_USER_VAR=`echo "${DB_USER}" | python3 -c "import urllib.parse; encoded_user = urllib.parse.quote(input()); print(encoded_user)"`
DB_PASSWORD_VAR=`echo "${DB_PASSWORD}" | python3 -c "import urllib.parse; encoded_user = urllib.parse.quote(input()); print(encoded_user)"`

DB_CONN=`echo -n "${DB_SCHEME}://${DB_USER_VAR}:${DB_PASSWORD_VAR}@${DB_HOST}:${DB_PORT}/${AIRFLOW_DB}${DB_PROPERTIES}"`

# Airflow 3.x configuration
export AIRFLOW__API__AUTH_BACKENDS=${AIRFLOW__API__AUTH_BACKENDS:-"airflow.api.auth.backend.basic_auth,airflow.api.auth.backend.session"}
export AIRFLOW__API__BASE_URL=${AIRFLOW__API__BASE_URL:-"http://localhost:8080"}

# Enable CSRF for API endpoints (required for production security)
export AIRFLOW__API__ENABLE_CSRF=${AIRFLOW__API__ENABLE_CSRF:-"True"}

# Configure SimpleAuthManager
echo "Configuring SimpleAuthManager (default in Airflow 3.x)"
export AIRFLOW__CORE__SIMPLE_AUTH_MANAGER_USERS="${AIRFLOW_ADMIN_USER}:admin"

AIRFLOW_HOME=${AIRFLOW_HOME:-/opt/airflow}
export AIRFLOW__CORE__SIMPLE_AUTH_MANAGER_PASSWORDS_FILE="${AIRFLOW_HOME}/simple_auth_manager_passwords.json"

# Airflow 3.x uses [database] section for SQL Alchemy connection
export AIRFLOW__DATABASE__SQL_ALCHEMY_CONN=${AIRFLOW__DATABASE__SQL_ALCHEMY_CONN:-$DB_CONN}

# Checked before anything starts: a non-numeric value would make the restart loop below unbounded.
SCHEDULER_MAX_ATTEMPTS=${SCHEDULER_MAX_ATTEMPTS:-5}
case "${SCHEDULER_MAX_ATTEMPTS}" in
  '' | *[!0-9]* | 0 | 0*)
    echo "SCHEDULER_MAX_ATTEMPTS must be a positive integer, got '${SCHEDULER_MAX_ATTEMPTS}'" >&2
    exit 1
    ;;
esac

airflow db migrate

# Create users for SimpleAuthManager
echo "SimpleAuthManager configured - user: ${AIRFLOW_ADMIN_USER}:admin"

AIRFLOW_HOME=${AIRFLOW_HOME:-/opt/airflow}
PASSWORD_FILE="${AIRFLOW_HOME}/simple_auth_manager_passwords.json"

echo "Setting password for ${AIRFLOW_ADMIN_USER} in ${PASSWORD_FILE}..."
mkdir -p "${AIRFLOW_HOME}"

python3 -c "
import json
import os
from pathlib import Path

password_file = Path('${PASSWORD_FILE}')
passwords = {}

if password_file.exists():
    try:
        with open(password_file, 'r') as f:
            passwords = json.load(f)
    except:
        pass

passwords['${AIRFLOW_ADMIN_USER}'] = '${AIRFLOW_ADMIN_PASSWORD}'

with open(password_file, 'w') as f:
    json.dump(passwords, f, indent=2)

print(f'Password set for ${AIRFLOW_ADMIN_USER}')
"

echo "SimpleAuthManager user created with custom password"

rm -f /opt/airflow/airflow-webserver-monitor.pid

# Start Airflow 3.x components
echo "Starting Airflow 3.x components..."
nohup airflow api-server --port 8080 > /opt/airflow/logs/api-server.log 2>&1 &
nohup airflow dag-processor > /opt/airflow/logs/dag-processor.log 2>&1 &

# The scheduler is the container's foreground process, so when it exits the container
# stops and takes the api-server down with it. Its startup can lose a MySQL connection
# ("Lost connection to server during query"), so restart it before giving up.
# ADR:2026-11-18-airflow-startup-restarts-the-scheduler-and-bounds-the-wait
scheduler_attempt=1
until airflow scheduler; do
  scheduler_status=$?
  if [ "${scheduler_attempt}" -ge "${SCHEDULER_MAX_ATTEMPTS}" ]; then
    echo "Airflow scheduler exited with status ${scheduler_status} on attempt ${scheduler_attempt}/${SCHEDULER_MAX_ATTEMPTS}, giving up" >&2
    exit "${scheduler_status}"
  fi
  scheduler_attempt=$((scheduler_attempt + 1))
  echo "Airflow scheduler exited with status ${scheduler_status}, restarting (attempt ${scheduler_attempt}/${SCHEDULER_MAX_ATTEMPTS})" >&2
  sleep 5
done
