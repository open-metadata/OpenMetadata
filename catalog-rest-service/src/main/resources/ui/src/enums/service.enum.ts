/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

export enum ServiceCategory {
  DATABASE_SERVICES = 'databaseServices',
  MESSAGING_SERVICES = 'messagingServices',
  DASHBOARD_SERVICES = 'dashboardServices',
  PIPELINE_SERVICES = 'pipelineServices',
}

export enum DatabaseServiceType {
  MYSQL = 'MySQL',
  REDSHIFT = 'Redshift',
  BIGQUERY = 'BigQuery',
  HIVE = 'Hive',
  POSTGRES = 'Postgres',
  ORACLE = 'Oracle',
  SNOWFLAKE = 'Snowflake',
  MSSQL = 'MSSQL',
  ATHENA = 'Athena',
  PRESTO = 'Presto',
  TRINO = 'Trino',
}

export enum MessagingServiceType {
  KAFKA = 'Kafka',
  PULSAR = 'Pulsar',
}

export enum DashboardServiceType {
  SUPERSET = 'Superset',
  LOOKER = 'Looker',
  TABLEAU = 'Tableau',
  REDASH = 'Redash',
}

export enum PipelineServiceType {
  AIRFLOW = 'Airflow',
  PREFECT = 'Prefect',
}

export enum IngestionType {
  BIGQUERY = 'bigquery',
  BIGQUERY_USAGE = 'bigquery-usage',
  REDSHIFT = 'redshift',
  REDSHIFT_USAGE = 'redshift-usage',
  SNOWFLAKE = 'snowflake',
  SNOWFLAKE_USAGE = 'snowflake-usage',
  HIVE = 'hive',
  MSSQL = 'mssql',
  MYSQL = 'mysql',
  POSTGRES = 'postgres',
  TRINO = 'trino',
  VERTICA = 'vertica',
}
