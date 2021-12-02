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

while ! wget -O /dev/null -o /dev/null mysql:3306; do sleep 5; done
airflow users create \
    --username admin \
    --firstname Peter \
    --lastname Parker \
    --role Admin \
    --email spiderman@superhero.org \
    --password admin
airflow db upgrade
(while ! wget -O /dev/null -o /dev/null http://ingestion:8080; do sleep 5; done; sleep 5; curl -u admin:admin --data '{"dag_run_id":"sample_data_1"}' -H "Content-type: application/json" -X POST http://ingestion:8080/api/v1/dags/sample_data/dagRuns) &
(while ! wget -O /dev/null -o /dev/null http://openmetadata-server:8585/api/v1/tables/name/bigquery_gcp.shopify.fact_sale; do sleep 5; done; sleep 7; curl -u admin:admin --data '{"dag_run_id":"sample_usage_1"}' -H "Content-type: application/json" -X POST http://ingestion:8080/api/v1/dags/sample_usage/dagRuns) &
(while ! wget -O /dev/null -o /dev/null http://openmetadata-server:8585/api/v1/tables/name/bigquery_gcp.shopify.fact_sale; do sleep 5; done; sleep 9; curl -u admin:admin --data '{"dag_run_id":"sample_dbt_1"}' -H "Content-type: application/json" -X POST http://ingestion:8080/api/v1/dags/sample_dbt/dagRuns) &
(while ! wget -O /dev/null -o /dev/null http://openmetadata-server:8585/api/v1/tables/name/bigquery_gcp.shopify.fact_sale; do sleep 5; done; sleep 10; curl -u admin:admin --data '{"dag_run_id":"index_metadata_1"}' -H "Content-type: application/json" -X POST http://ingestion:8080/api/v1/dags/index_metadata/dagRuns) &
airflow standalone