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

MYSQL_HOST=${MYSQL_HOST:-mysql}
MYSQL_PORT=${MYSQL_PORT:-3306}

MYSQL_DB=${MYSQL_DB:-airflow_db}
MYSQL_USER=${MYSQL_USER:-airflow_user}
MYSQL_PASSWORD=${MYSQL_PASSWORD:-airflow_pass}

MYSQL_CONN="${MYSQL_USER}:${MYSQL_PASSWORD}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DB}"

AIRFLOW_ADMIN_USER=${AIRFLOW_ADMIN_USER:-admin}
AIRFLOW_ADMIN_PASSWORD=${AIRFLOW_ADMIN_PASSWORD:-admin}

OPENMETADATA_SERVER=${OPENMETADATA_SERVER:-"http://openmetadata-server:8585"}

sed -i "s#\(sql_alchemy_conn = \).*#\1mysql+pymysql://${MYSQL_CONN}#" /airflow/airflow.cfg

while ! wget -O /dev/null -o /dev/null $MYSQL_HOST:$MYSQL_PORT; do sleep 5; done

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
airflow webserver --port 8080 -D &
airflow scheduler
