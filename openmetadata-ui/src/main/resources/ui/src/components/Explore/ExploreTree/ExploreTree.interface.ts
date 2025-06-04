/*
 *  Copyright 2024 Collate.
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
import { ReactNode } from 'react';
import { EntityTypeName } from '../../../constants/entity.constants';
import { EntityFields } from '../../../enums/AdvancedSearch.enum';
import { ExploreQuickFilterField } from '../ExplorePage.interface';

export type ExploreTreeNode = {
  title: ReactNode;
  key: string;
  children?: ExploreTreeNode[];
  isLeaf?: boolean;
  icon?: JSX.Element | SvgComponent;
  data?: TreeNodeData;
  count?: number;
  totalCount?: number;
  type?: string | null;
  tooltip?: string | ReactNode;
};

export type ExploreTreeProps = {
  onFieldValueSelect: (field: ExploreQuickFilterField[]) => void;
};

export type TreeNodeData = {
  isRoot?: boolean;
  isStatic?: boolean;
  currentBucketKey?: string;
  currentBucketValue?: string;
  filterField?: ExploreQuickFilterField[];
  parentSearchIndex?: string;
  rootIndex?: string;
  entityType?: string;
  dataId?: string;
  childEntities?: string[];
};

export type DatabaseFields =
  | EntityFields.SERVICE_TYPE
  | EntityFields.SERVICE
  | EntityFields.DATABASE_DISPLAY_NAME
  | EntityFields.DATABASE_SCHEMA_DISPLAY_NAME;

// below enums are formatted for tooltips
enum FormattedMlModelServiceType {
  CustomMlModel = 'Custom ML Model',
  Mlflow = 'ML Flow',
  SageMaker = 'SageMaker',
  Sklearn = 'Sklearn',
  VertexAI = 'Vertex AI',
}
enum FormattedMetadataServiceType {
  Alation = 'Alation',
  AlationSink = 'AlationSink',
  Amundsen = 'Amundsen',
  Atlas = 'Atlas',
  MetadataES = 'MetadataES',
  OpenMetadata = 'OpenMetadata',
}

enum FormattedPipelineServiceType {
  Airbyte = 'Airbyte',
  Airflow = 'Airflow',
  CustomPipeline = 'Custom Pipeline',
  DBTCloud = 'DBT Cloud',
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
enum FormattedSearchServiceType {
  CustomSearch = 'Custom Search',
  ElasticSearch = 'Elastic Search',
  OpenSearch = 'Open Search',
}
enum FormattedDatabaseServiceType {
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
  Dbt = 'Dbt',
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
enum FormattedDashboardServiceType {
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
enum FormattedMessagingServiceType {
  CustomMessaging = 'Custom Messaging',
  Kafka = 'Kafka',
  Kinesis = 'Kinesis',
  Redpanda = 'Redpanda',
}

enum FormattedAPIServiceType {
  REST = 'Rest',
  Webhook = 'Webhook',
}

const serviceTypeFormatters = {
  // ML Model Services
  CustomMlModel: FormattedMlModelServiceType.CustomMlModel,
  Mlflow: FormattedMlModelServiceType.Mlflow,
  SageMaker: FormattedMlModelServiceType.SageMaker,
  Sklearn: FormattedMlModelServiceType.Sklearn,
  VertexAI: FormattedMlModelServiceType.VertexAI,

  // Metadata Services
  Alation: FormattedMetadataServiceType.Alation,
  AlationSink: FormattedMetadataServiceType.AlationSink,
  Amundsen: FormattedMetadataServiceType.Amundsen,
  Atlas: FormattedMetadataServiceType.Atlas,
  MetadataES: FormattedMetadataServiceType.MetadataES,
  OpenMetadata: FormattedMetadataServiceType.OpenMetadata,

  // Pipeline Services
  Airbyte: FormattedPipelineServiceType.Airbyte,
  Airflow: FormattedPipelineServiceType.Airflow,
  CustomPipeline: FormattedPipelineServiceType.CustomPipeline,
  DBTCloud: FormattedPipelineServiceType.DBTCloud,
  Dagster: FormattedPipelineServiceType.Dagster,
  DataFactory: FormattedPipelineServiceType.DataFactory,
  DatabricksPipeline: FormattedPipelineServiceType.DatabricksPipeline,
  DomoPipeline: FormattedPipelineServiceType.DomoPipeline,
  Fivetran: FormattedPipelineServiceType.Fivetran,
  Flink: FormattedPipelineServiceType.Flink,
  GluePipeline: FormattedPipelineServiceType.GluePipeline,
  KafkaConnect: FormattedPipelineServiceType.KafkaConnect,
  Matillion: FormattedPipelineServiceType.Matillion,
  Nifi: FormattedPipelineServiceType.Nifi,
  OpenLineage: FormattedPipelineServiceType.OpenLineage,
  Spark: FormattedPipelineServiceType.Spark,
  Spline: FormattedPipelineServiceType.Spline,
  Stitch: FormattedPipelineServiceType.Stitch,
  Wherescape: FormattedPipelineServiceType.Wherescape,

  // Search Services
  CustomSearch: FormattedSearchServiceType.CustomSearch,
  ElasticSearch: FormattedSearchServiceType.ElasticSearch,
  OpenSearch: FormattedSearchServiceType.OpenSearch,

  // Database Services
  Athena: FormattedDatabaseServiceType.Athena,
  AzureSQL: FormattedDatabaseServiceType.AzureSQL,
  BigQuery: FormattedDatabaseServiceType.BigQuery,
  BigTable: FormattedDatabaseServiceType.BigTable,
  Cassandra: FormattedDatabaseServiceType.Cassandra,
  Clickhouse: FormattedDatabaseServiceType.Clickhouse,
  Cockroach: FormattedDatabaseServiceType.Cockroach,
  Couchbase: FormattedDatabaseServiceType.Couchbase,
  CustomDatabase: FormattedDatabaseServiceType.CustomDatabase,
  Databricks: FormattedDatabaseServiceType.Databricks,
  Datalake: FormattedDatabaseServiceType.Datalake,
  Db2: FormattedDatabaseServiceType.Db2,
  Dbt: FormattedDatabaseServiceType.Dbt,
  DeltaLake: FormattedDatabaseServiceType.DeltaLake,
  DomoDatabase: FormattedDatabaseServiceType.DomoDatabase,
  Doris: FormattedDatabaseServiceType.Doris,
  Druid: FormattedDatabaseServiceType.Druid,
  DynamoDB: FormattedDatabaseServiceType.DynamoDB,
  Exasol: FormattedDatabaseServiceType.Exasol,
  Glue: FormattedDatabaseServiceType.Glue,
  Greenplum: FormattedDatabaseServiceType.Greenplum,
  Hive: FormattedDatabaseServiceType.Hive,
  Iceberg: FormattedDatabaseServiceType.Iceberg,
  Impala: FormattedDatabaseServiceType.Impala,
  MariaDB: FormattedDatabaseServiceType.MariaDB,
  MongoDB: FormattedDatabaseServiceType.MongoDB,
  Mssql: FormattedDatabaseServiceType.Mssql,
  Mysql: FormattedDatabaseServiceType.Mysql,
  Oracle: FormattedDatabaseServiceType.Oracle,
  PinotDB: FormattedDatabaseServiceType.PinotDB,
  Postgres: FormattedDatabaseServiceType.Postgres,
  Presto: FormattedDatabaseServiceType.Presto,
  QueryLog: FormattedDatabaseServiceType.QueryLog,
  Redshift: FormattedDatabaseServiceType.Redshift,
  SAS: FormattedDatabaseServiceType.SAS,
  SQLite: FormattedDatabaseServiceType.SQLite,
  Salesforce: FormattedDatabaseServiceType.Salesforce,
  SapERP: FormattedDatabaseServiceType.SapERP,
  SapHana: FormattedDatabaseServiceType.SapHana,
  SingleStore: FormattedDatabaseServiceType.SingleStore,
  Snowflake: FormattedDatabaseServiceType.Snowflake,
  Synapse: FormattedDatabaseServiceType.Synapse,
  Teradata: FormattedDatabaseServiceType.Teradata,
  Trino: FormattedDatabaseServiceType.Trino,
  UnityCatalog: FormattedDatabaseServiceType.UnityCatalog,
  Vertica: FormattedDatabaseServiceType.Vertica,

  // Dashboard Services
  CustomDashboard: FormattedDashboardServiceType.CustomDashboard,
  DomoDashboard: FormattedDashboardServiceType.DomoDashboard,
  Lightdash: FormattedDashboardServiceType.Lightdash,
  Looker: FormattedDashboardServiceType.Looker,
  Metabase: FormattedDashboardServiceType.Metabase,
  MicroStrategy: FormattedDashboardServiceType.MicroStrategy,
  Mode: FormattedDashboardServiceType.Mode,
  PowerBI: FormattedDashboardServiceType.PowerBI,
  PowerBIReportServer: FormattedDashboardServiceType.PowerBIReportServer,
  QlikCloud: FormattedDashboardServiceType.QlikCloud,
  QlikSense: FormattedDashboardServiceType.QlikSense,
  QuickSight: FormattedDashboardServiceType.QuickSight,
  Redash: FormattedDashboardServiceType.Redash,
  Sigma: FormattedDashboardServiceType.Sigma,
  Superset: FormattedDashboardServiceType.Superset,
  Tableau: FormattedDashboardServiceType.Tableau,

  // Messaging Services
  CustomMessaging: FormattedMessagingServiceType.CustomMessaging,
  Kafka: FormattedMessagingServiceType.Kafka,
  Kinesis: FormattedMessagingServiceType.Kinesis,
  Redpanda: FormattedMessagingServiceType.Redpanda,

  // API Services
  REST: FormattedAPIServiceType.REST,
  Webhook: FormattedAPIServiceType.Webhook,
} as const;

// Type for the keys of the serviceTypeFormatters object
export type ServiceType = keyof typeof serviceTypeFormatters;

// Helper function to get formatted service type
export const getFormattedServiceType = (serviceType: string): string => {
  // Convert the input to lowercase for case-insensitive matching
  const normalizedKey = serviceType.toLowerCase();

  // Find the matching key in serviceTypeFormatters
  let matchingKey = undefined;

  // Find in serviceTypeFormatters
  const serviceTypeKey = Object.keys(serviceTypeFormatters).find(
    (key) => key.toLowerCase() === normalizedKey
  );

  // Find in EntityTypeName for nested tree value
  const entityTypeKey = Object.keys(EntityTypeName).find(
    (key) => key.toLowerCase() === normalizedKey
  );

  if (serviceTypeKey) {
    matchingKey = serviceTypeKey;
  } else {
    matchingKey = entityTypeKey;
  }

  // Return the formatted value if found, otherwise return the original input
  return matchingKey
    ? serviceTypeFormatters[matchingKey as ServiceType]
    : serviceType;
};
