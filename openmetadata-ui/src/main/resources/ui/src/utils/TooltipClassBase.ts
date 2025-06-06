/*
 *  Copyright 2025 Collate.
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
import { t } from 'i18next';
import { capitalize } from 'lodash';
import { EntityType } from '../enums/entity.enum';

export const EntityTypeName: Record<EntityType, string> = {
  [EntityType.API_SERVICE]: t('label.api-service'),
  [EntityType.DATABASE_SERVICE]: t('label.database-service'),
  [EntityType.MESSAGING_SERVICE]: t('label.messaging-service'),
  [EntityType.PIPELINE_SERVICE]: t('label.pipeline-service'),
  [EntityType.MLMODEL_SERVICE]: t('label.mlmodel-service'),
  [EntityType.DASHBOARD_SERVICE]: t('label.dashboard-service'),
  [EntityType.STORAGE_SERVICE]: t('label.storage-service'),
  [EntityType.SEARCH_SERVICE]: t('label.search-service'),
  [EntityType.METRIC]: t('label.metric'),
  [EntityType.CONTAINER]: t('label.container'),
  [EntityType.DASHBOARD_DATA_MODEL]: t('label.dashboard-data-model'),
  [EntityType.TABLE]: t('label.table'),
  [EntityType.GLOSSARY_TERM]: t('label.glossary-term'),
  [EntityType.PAGE]: t('label.page'),
  [EntityType.DATABASE_SCHEMA]: t('label.database-schema'),
  [EntityType.CHART]: t('label.chart'),
  [EntityType.STORED_PROCEDURE]: t('label.stored-procedure'),
  [EntityType.DATABASE]: t('label.database'),
  [EntityType.PIPELINE]: t('label.pipeline'),
  [EntityType.TAG]: t('label.tag'),
  [EntityType.DASHBOARD]: t('label.dashboard'),
  [EntityType.API_ENDPOINT]: t('label.api-endpoint'),
  [EntityType.TOPIC]: t('label.topic'),
  [EntityType.DATA_PRODUCT]: t('label.data-product'),
  [EntityType.MLMODEL]: t('label.ml-model'),
  [EntityType.SEARCH_INDEX]: t('label.search-index'),
  [EntityType.API_COLLECTION]: t('label.api-collection'),
  [EntityType.TEST_SUITE]: t('label.test-suite'),
  [EntityType.TEAM]: t('label.team'),
  [EntityType.TEST_CASE]: t('label.test-case'),
  [EntityType.DOMAIN]: t('label.domain'),
  [EntityType.PERSONA]: t('label.persona'),
  [EntityType.POLICY]: t('label.policy'),
  [EntityType.ROLE]: t('label.role'),
  [EntityType.APPLICATION]: t('label.application'),
  [EntityType.CLASSIFICATION]: t('label.classification'),
  [EntityType.GLOSSARY]: t('label.glossary'),
  [EntityType.METADATA_SERVICE]: t('label.metadata-service'),
  [EntityType.WEBHOOK]: t('label.webhook'),
  [EntityType.TYPE]: t('label.type'),
  [EntityType.USER]: t('label.user'),
  [EntityType.BOT]: t('label.bot'),
  [EntityType.DATA_INSIGHT_CHART]: t('label.data-insight-chart'),
  [EntityType.KPI]: t('label.kpi'),
  [EntityType.ALERT]: t('label.alert'),
  [EntityType.SUBSCRIPTION]: t('label.subscription'),
  [EntityType.SAMPLE_DATA]: t('label.sample-data'),
  [EntityType.APP_MARKET_PLACE_DEFINITION]: t(
    'label.app-market-place-definition'
  ),
  [EntityType.DOC_STORE]: t('label.doc-store'),
  [EntityType.KNOWLEDGE_PAGE]: t('label.knowledge-page'),
  [EntityType.knowledgePanels]: t('label.knowledge-panels'),
  [EntityType.GOVERN]: t('label.govern'),
  [EntityType.ALL]: t('label.all'),
  [EntityType.CUSTOM_METRIC]: t('label.custom-metric'),
  [EntityType.INGESTION_PIPELINE]: t('label.ingestion-pipeline'),
  [EntityType.QUERY]: t('label.query'),
  [EntityType.ENTITY_REPORT_DATA]: t('label.entity-report-data'),
  [EntityType.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA]: t(
    'label.web-analytic-entity-view-report-data'
  ),
  [EntityType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA]: t(
    'label.web-analytic-user-activity-report-data'
  ),
  [EntityType.TEST_CASE_RESOLUTION_STATUS]: t(
    'label.test-case-resolution-status'
  ),
  [EntityType.TEST_CASE_RESULT]: t('label.test-case-result'),
  [EntityType.EVENT_SUBSCRIPTION]: t('label.event-subscription'),
  [EntityType.LINEAGE_EDGE]: t('label.lineage-edge'),
  [EntityType.WORKFLOW_DEFINITION]: t('label.workflow-definition'),
  [EntityType.SERVICE]: t('label.service'),
};
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

export type ServiceType =
  | keyof typeof FormattedMlModelServiceType
  | keyof typeof FormattedMetadataServiceType
  | keyof typeof FormattedPipelineServiceType
  | keyof typeof FormattedSearchServiceType
  | keyof typeof FormattedDatabaseServiceType
  | keyof typeof FormattedDashboardServiceType
  | keyof typeof FormattedMessagingServiceType
  | keyof typeof FormattedAPIServiceType
  | keyof typeof FormattedStorageServiceType;

// Helper function to create normalized lookup map
const createNormalizedLookupMap = <T extends Record<string, string>>(
  obj: T
): Map<string, string> => {
  return new Map(
    Object.entries(obj).map(([key, value]) => [key.toLowerCase(), value])
  );
};

class TooltipClassBase {
  public getServiceTypeLookupMap(): Map<string, string> {
    return createNormalizedLookupMap({
      ...FormattedMlModelServiceType,
      ...FormattedMetadataServiceType,
      ...FormattedPipelineServiceType,
      ...FormattedSearchServiceType,
      ...FormattedDatabaseServiceType,
      ...FormattedDashboardServiceType,
      ...FormattedMessagingServiceType,
      ...FormattedAPIServiceType,
      ...FormattedStorageServiceType,
    });
  }

  public getEntityTypeLookupMap(): Map<string, string> {
    return createNormalizedLookupMap(EntityTypeName);
  }

  public getFormattedEntityType(entityType: string): string {
    const normalizedKey = entityType.toLowerCase();

    return (
      this.getEntityTypeLookupMap().get(normalizedKey) || capitalize(entityType)
    );
  }

  public getFormattedServiceType(serviceType: string): string {
    const normalizedKey = serviceType.toLowerCase();

    return (
      this.getServiceTypeLookupMap().get(normalizedKey) ||
      this.getEntityTypeLookupMap().get(normalizedKey) ||
      serviceType
    );
  }
}

const tooltipClassBase = new TooltipClassBase();

export default tooltipClassBase;
export { tooltipClassBase };
