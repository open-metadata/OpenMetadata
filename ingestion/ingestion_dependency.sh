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

mv /ingestion/examples/airflow/airflow.cfg /airflow/airflow.cfg
airflow db init
mkdir /airflow/dags
mv /ingestion/examples/airflow/dags/*.py /airflow/dags/
airflow users create \
    --username admin \
    --firstname Peter \
    --lastname Parker \
    --role Admin \
    --email spiderman@superhero.org \
    --password admin
echo "AUTH_ROLE_PUBLIC = 'Admin'" >> /airflow/webserver_config.py
airflow db check
airflow webserver --port 8080 &
airflow scheduler

