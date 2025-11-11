/*
 *  Copyright 2023 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { LinkProps } from 'react-router-dom';

export interface BasicEntityOverviewInfo {
  name: string;
  value: string | number | React.ReactNode;
  isLink?: boolean;
  isExternal?: boolean;
  isIcon?: boolean;
  url?: string;
  linkProps?: LinkProps['to'];
  visible?: Array<string>;
  dataTestId?: string;
}
// below enums are formatted for tooltips
export enum FormattedMlModelServiceType {
  CustomMlModel = 'Custom ML Model',
  Mlflow = 'ML Flow',
  SageMaker = 'SageMaker',
  Sklearn = 'Sklearn',
  VertexAI = 'Vertex AI',
}
export enum FormattedMetadataServiceType {
  Alation = 'Alation',
  AlationSink = 'AlationSink',
  Amundsen = 'Amundsen',
  Atlas = 'Atlas',
  MetadataES = 'MetadataES',
  OpenMetadata = 'OpenMetadata',
}

export enum FormattedPipelineServiceType {
  Airbyte = 'Airbyte',
  Airflow = 'Airflow',
  CustomPipeline = 'Custom Pipeline',
  DBTCloud = 'dbt Cloud',
  Dagster = 'Dagster',
  DataFactory = 'DataFactory',
  DatabricksPipeline = 'DataBricks Pipeline',
  DomoPipeline = 'Domo Pipeline',
  Fivetran = 'Fivetran',
  Flink = 'Flink',
  GluePipeline = 'Glue Pipeline',
  KafkaConnect = 'Kafka Connect',
  Matillion = 'Matillion',
  Nifi = 'Nifi',
  OpenLineage = 'Open Lineage',
  Spark = 'Spark',
  Spline = 'Spline',
  Stitch = 'Stitch',
  Wherescape = 'Wherescape',
}
export enum FormattedSearchServiceType {
  CustomSearch = 'Custom Search',
  ElasticSearch = 'Elastic Search',
  OpenSearch = 'Open Search',
}
export enum FormattedDatabaseServiceType {
  Athena = 'Athena',
  AzureSQL = 'Azure SQL',
  BigQuery = 'Big Query',
  BigTable = 'Big Table',
  Cassandra = 'Cassandra',
  Clickhouse = 'Clickhouse',
  Cockroach = 'Cockroach',
  Couchbase = 'Couchbase',
  CustomDatabase = 'Custom Database',
  Databricks = 'Databricks',
  Datalake = 'Datalake',
  Db2 = 'Db2',
  Dbt = 'dbt',
  DeltaLake = 'DeltaLake',
  DomoDatabase = 'Domo Database',
  Doris = 'Doris',
  Druid = 'Druid',
  DynamoDB = 'Dynamo DB',
  Exasol = 'Exasol',
  Glue = 'Glue',
  Greenplum = 'Greenplum',
  Hive = 'Hive',
  Iceberg = 'Iceberg',
  Impala = 'Impala',
  MariaDB = 'Maria DB',
  MongoDB = 'Mongo DB',
  Mssql = 'MS SQL',
  Mysql = 'MySQL',
  Oracle = 'Oracle',
  PinotDB = 'PinotDB',
  Postgres = 'Postgres',
  Presto = 'Presto',
  QueryLog = 'QueryLog',
  Redshift = 'Redshift',
  SAS = 'SAS',
  SQLite = 'SQLite',
  Salesforce = 'Salesforce',
  SapERP = 'SAP ERP',
  SapHana = 'SAP Hana',
  SingleStore = 'SingleStore',
  Snowflake = 'Snowflake',
  Synapse = 'Synapse',
  Teradata = 'Teradata',
  Trino = 'Trino',
  UnityCatalog = 'UnityCatalog',
  Vertica = 'Vertica',
}
export enum FormattedDashboardServiceType {
  CustomDashboard = 'Custom Dashboard',
  DomoDashboard = 'Domo Dashboard',
  Lightdash = 'Lightdash',
  Looker = 'Looker',
  Metabase = 'Metabase',
  MicroStrategy = 'Micro Strategy',
  Mode = 'Mode',
  PowerBI = 'PowerBI',
  PowerBIReportServer = 'PowerBI Report Server',
  QlikCloud = 'Qlik Cloud',
  QlikSense = 'Qlik Sense',
  QuickSight = 'Quick Sight',
  Redash = 'Redash',
  Sigma = 'Sigma',
  Superset = 'Superset',
  Tableau = 'Tableau',
}
export enum FormattedMessagingServiceType {
  CustomMessaging = 'Custom Messaging',
  Kafka = 'Kafka',
  Kinesis = 'Kinesis',
  Redpanda = 'Redpanda',
}

export enum FormattedAPIServiceType {
  REST = 'Rest',
  Webhook = 'Webhook',
}
export enum FormattedStorageServiceType {
  Adls = 'ADLS',
  CustomStorage = 'CustomStorage',
  Gcs = 'GCS',
  S3 = 'S3',
}

export enum FormattedDriveServiceType {
  CustomDrive = 'Custom Drive',
  GoogleDrive = 'Google Drive',
  SharePoint = 'Share Point',
}
