#!/usr/bin/env bash
#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements. See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

while ! wget -O /dev/null -o /dev/null mysql:3306; do sleep 5; done
export AIRFLOW_HOME=/airflow
airflow db init
echo "AUTH_ROLE_PUBLIC = 'Admin'" >> /airflow/webserver_config.py
mv /ingestion/examples/airflow/airflow.cfg /airflow/airflow.cfg
airflow users create \
    --username admin \
    --firstname Peter \
    --lastname Parker \
    --role Admin \
    --email spiderman@superhero.org \
    --password admin
airflow webserver --port 8080 -D & 
(sleep 5; airflow db init)
(sleep 5; airflow db init)
(sleep 5; curl -u admin:admin --data '{"dag_run_id":"sample_data"}' -H "Content-type: application/json" -X POST http://localhost:8080/api/v1/dags/sample_data/dagRuns) &
(sleep 7; curl -u admin:admin --data '{"dag_run_id":"sample_users"}' -H "Content-type: application/json" -X POST http://localhost:8080/api/v1/dags/sample_users/dagRuns) &
(sleep 12; curl -u admin:admin --data '{"dag_run_id":"sample_usage"}' -H "Content-type: application/json" -X POST http://localhost:8080/api/v1/dags/sample_usage/dagRuns) &
(sleep 17; curl -u admin:admin --data '{"dag_run_id":"elasticsearch"}' -H "Content-type: application/json" -X POST http://localhost:8080/api/v1/dags/elasticsearch/dagRuns) &
airflow scheduler