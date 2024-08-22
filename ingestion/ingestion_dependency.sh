#!/usr/bin/env bash
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

DB_HOST=${DB_HOST:-mysql}
DB_PORT=${DB_PORT:-3306}

AIRFLOW_DB=${AIRFLOW_DB:-airflow_db}
DB_USER=${DB_USER:-airflow_user}
DB_SCHEME=${DB_SCHEME:-mysql+pymysql}
DB_PASSWORD=${DB_PASSWORD:-airflow_pass}
DB_PROPERTIES=${DB_PROPERTIES:-""}

AIRFLOW_ADMIN_USER=${AIRFLOW_ADMIN_USER:-admin}
AIRFLOW_ADMIN_PASSWORD=${AIRFLOW_ADMIN_PASSWORD:-admin}

DB_USER_VAR=`echo "${DB_USER}" | python3 -c "import urllib.parse; encoded_user = urllib.parse.quote(input()); print(encoded_user)"`
DB_PASSWORD_VAR=`echo "${DB_PASSWORD}" | python3 -c "import urllib.parse; encoded_user = urllib.parse.quote(input()); print(encoded_user)"`

DB_CONN=`echo -n "${DB_SCHEME}://${DB_USER_VAR}:${DB_PASSWORD_VAR}@${DB_HOST}:${DB_PORT}/${AIRFLOW_DB}${DB_PROPERTIES}"`

# Set the default necessary auth_backend information
export AIRFLOW__API__AUTH_BACKEND=${AIRFLOW__API__AUTH_BACKENDS:-"airflow.api.auth.backend.basic_auth,airflow.api.auth.backend.session"}

# Use the default airflow env var or the one we set from OM properties
export AIRFLOW__DATABASE__SQL_ALCHEMY_CONN=${AIRFLOW__DATABASE__SQL_ALCHEMY_CONN:-$DB_CONN}

airflow db migrate

airflow users create \
    --username ${AIRFLOW_ADMIN_USER} \
    --firstname Peter \
    --lastname Parker \
    --role Admin \
    --email spiderman@superhero.org \
    --password ${AIRFLOW_ADMIN_PASSWORD}

# we need to this in case the container is restarted and the scheduler exited without tidying up its lock file
rm -f /opt/airflow/airflow-webserver-monitor.pid
airflow webserver --port 8080 -D &
airflow scheduler
