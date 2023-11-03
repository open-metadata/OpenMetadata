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

DB_CONN="${DB_SCHEME}://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${AIRFLOW_DB}"

AIRFLOW_ADMIN_USER=${AIRFLOW_ADMIN_USER:-admin}
AIRFLOW_ADMIN_PASSWORD=${AIRFLOW_ADMIN_PASSWORD:-admin}

OPENMETADATA_SERVER=${OPENMETADATA_SERVER:-"http://openmetadata-server:8585"}

sed -i "s#\(sql_alchemy_conn = \).*#\1${DB_CONN}#" /opt/airflow/airflow.cfg

airflow db init

airflow users create \
    --username ${AIRFLOW_ADMIN_USER} \
    --firstname Peter \
    --lastname Parker \
    --role Admin \
    --email spiderman@superhero.org \
    --password ${AIRFLOW_ADMIN_PASSWORD}

(sleep 5; airflow db upgrade)
(sleep 5; airflow db upgrade)

# we need to this in case the container is restarted and the scheduler exited without tidying up its lock file
rm -f /opt/airflow/airflow-webserver-monitor.pid
airflow webserver --port 8080 -D &
airflow scheduler
