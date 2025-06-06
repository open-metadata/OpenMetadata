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

/* eslint-disable @typescript-eslint/no-unused-vars */
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { t } from 'i18next';
import { capitalize } from 'lodash';
import { FC } from 'react';
import DataProductsPage from '../components/DataProducts/DataProductsPage/DataProductsPage.component';
import { GlobalSettingsMenuCategory } from '../constants/GlobalSettings.constants';
import {
  OperationPermission,
  ResourceEntity,
} from '../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { APICollection } from '../generated/entity/data/apiCollection';
import { Database } from '../generated/entity/data/database';
import { DatabaseSchema } from '../generated/entity/data/databaseSchema';
import { ServicesType } from '../interface/service.interface';
import APICollectionPage from '../pages/APICollectionPage/APICollectionPage';
import APIEndpointPage from '../pages/APIEndpointPage/APIEndpointPage';
import ContainerPage from '../pages/ContainerPage/ContainerPage';
import DashboardDetailsPage from '../pages/DashboardDetailsPage/DashboardDetailsPage.component';
import DatabaseDetailsPage from '../pages/DatabaseDetailsPage/DatabaseDetailsPage';
import DatabaseSchemaPageComponent from '../pages/DatabaseSchemaPage/DatabaseSchemaPage.component';
import DataModelsPage from '../pages/DataModelPage/DataModelPage.component';
import { VersionData } from '../pages/EntityVersionPage/EntityVersionPage.component';
import MetricDetailsPage from '../pages/MetricsPage/MetricDetailsPage/MetricDetailsPage';
import MlModelPage from '../pages/MlModelPage/MlModelPage.component';
import PipelineDetailsPage from '../pages/PipelineDetails/PipelineDetailsPage.component';
import SearchIndexDetailsPage from '../pages/SearchIndexDetailsPage/SearchIndexDetailsPage';
import StoredProcedurePage from '../pages/StoredProcedure/StoredProcedurePage';
import TableDetailsPageV1 from '../pages/TableDetailsPageV1/TableDetailsPageV1';
import TopicDetailsPage from '../pages/TopicDetails/TopicDetailsPage.component';
import {
  getDatabaseDetailsByFQN,
  getDatabaseSchemaDetailsByFQN,
} from '../rest/databaseAPI';
import { getGlossariesByName } from '../rest/glossaryAPI';
import { getServiceByFQN } from '../rest/serviceAPI';
import { getTableDetailsByFQN } from '../rest/tableAPI';
import { ExtraDatabaseDropdownOptions } from './Database/Database.util';
import { ExtraDatabaseSchemaDropdownOptions } from './DatabaseSchemaDetailsUtils';
import { ExtraDatabaseServiceDropdownOptions } from './DatabaseServiceUtils';
import { createNormalizedLookupMap } from './EntityUtils';
import {
  getApplicationDetailsPath,
  getDomainDetailsPath,
  getEditWebhookPath,
  getEntityDetailsPath,
  getGlossaryTermDetailsPath,
  getIncidentManagerDetailPagePath,
  getNotificationAlertDetailsPath,
  getObservabilityAlertDetailsPath,
  getPersonaDetailsPath,
  getPolicyWithFqnPath,
  getRoleWithFqnPath,
  getServiceDetailsPath,
  getSettingPath,
  getTagsDetailsPath,
  getTeamsWithFqnPath,
  getUserPath,
} from './RouterUtils';
import { ExtraTableDropdownOptions } from './TableUtils';
import { getTestSuiteDetailsPath } from './TestSuiteUtils';

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

class EntityUtilClassBase {
  public getEntityLink(
    indexType: string,
    fullyQualifiedName: string,
    tab?: string,
    subTab?: string,
    isExecutableTestSuite?: boolean,
    isObservabilityAlert?: boolean
  ) {
    switch (indexType) {
      case SearchIndex.TOPIC:
      case EntityType.TOPIC:
        return getEntityDetailsPath(
          EntityType.TOPIC,
          fullyQualifiedName,
          tab,
          subTab
        );

      case SearchIndex.DASHBOARD:
      case EntityType.DASHBOARD:
        return getEntityDetailsPath(
          EntityType.DASHBOARD,
          fullyQualifiedName,
          tab,
          subTab
        );

      case SearchIndex.PIPELINE:
      case EntityType.PIPELINE:
        return getEntityDetailsPath(
          EntityType.PIPELINE,
          fullyQualifiedName,
          tab,
          subTab
        );

      case EntityType.DATABASE:
        return getEntityDetailsPath(
          EntityType.DATABASE,
          fullyQualifiedName,
          tab,
          subTab
        );

      case EntityType.DATABASE_SCHEMA:
        return getEntityDetailsPath(
          EntityType.DATABASE_SCHEMA,
          fullyQualifiedName,
          tab,
          subTab
        );

      case EntityType.GLOSSARY:
      case SearchIndex.GLOSSARY:
      case EntityType.GLOSSARY_TERM:
      case SearchIndex.GLOSSARY_TERM:
        return getGlossaryTermDetailsPath(fullyQualifiedName, tab, subTab);

      case EntityType.DATABASE_SERVICE:
      case EntityType.DASHBOARD_SERVICE:
      case EntityType.MESSAGING_SERVICE:
      case EntityType.PIPELINE_SERVICE:
      case EntityType.MLMODEL_SERVICE:
      case EntityType.METADATA_SERVICE:
      case EntityType.STORAGE_SERVICE:
      case EntityType.SEARCH_SERVICE:
      case EntityType.API_SERVICE:
        return getServiceDetailsPath(fullyQualifiedName, `${indexType}s`);

      case EntityType.WEBHOOK:
        return getEditWebhookPath(fullyQualifiedName);

      case EntityType.TYPE:
        return getSettingPath(
          GlobalSettingsMenuCategory.CUSTOM_PROPERTIES,
          `${fullyQualifiedName}s`
        );

      case EntityType.MLMODEL:
      case SearchIndex.MLMODEL:
        return getEntityDetailsPath(
          EntityType.MLMODEL,
          fullyQualifiedName,
          tab,
          subTab
        );

      case EntityType.CONTAINER:
      case SearchIndex.CONTAINER:
        return getEntityDetailsPath(
          EntityType.CONTAINER,
          fullyQualifiedName,
          tab,
          subTab
        );
      case SearchIndex.TAG:
      case EntityType.TAG:
      case EntityType.CLASSIFICATION:
        return getTagsDetailsPath(fullyQualifiedName);

      case SearchIndex.DASHBOARD_DATA_MODEL:
      case EntityType.DASHBOARD_DATA_MODEL:
        return getEntityDetailsPath(
          EntityType.DASHBOARD_DATA_MODEL,
          fullyQualifiedName,
          tab,
          subTab
        );

      case SearchIndex.STORED_PROCEDURE:
      case EntityType.STORED_PROCEDURE:
        return getEntityDetailsPath(
          EntityType.STORED_PROCEDURE,
          fullyQualifiedName,
          tab,
          subTab
        );

      case EntityType.TEST_CASE:
        return getIncidentManagerDetailPagePath(fullyQualifiedName);

      case EntityType.TEST_SUITE:
        return getTestSuiteDetailsPath({
          isExecutableTestSuite,
          fullyQualifiedName,
        });

      case EntityType.SEARCH_INDEX:
      case SearchIndex.SEARCH_INDEX:
        return getEntityDetailsPath(
          EntityType.SEARCH_INDEX,
          fullyQualifiedName,
          tab,
          subTab
        );

      case EntityType.DOMAIN:
      case SearchIndex.DOMAIN:
        return getDomainDetailsPath(fullyQualifiedName, tab);

      case EntityType.DATA_PRODUCT:
      case SearchIndex.DATA_PRODUCT:
        return getEntityDetailsPath(
          EntityType.DATA_PRODUCT,
          fullyQualifiedName,
          tab,
          subTab
        );
      case EntityType.APPLICATION:
        return getApplicationDetailsPath(fullyQualifiedName);

      case EntityType.USER:
      case SearchIndex.USER:
        return getUserPath(fullyQualifiedName, tab, subTab);

      case EntityType.TEAM:
      case SearchIndex.TEAM:
        return getTeamsWithFqnPath(fullyQualifiedName);

      case EntityType.EVENT_SUBSCRIPTION:
        return isObservabilityAlert
          ? getObservabilityAlertDetailsPath(fullyQualifiedName)
          : getNotificationAlertDetailsPath(fullyQualifiedName);

      case EntityType.ROLE:
        return getRoleWithFqnPath(fullyQualifiedName);

      case EntityType.POLICY:
        return getPolicyWithFqnPath(fullyQualifiedName);

      case EntityType.PERSONA:
        return getPersonaDetailsPath(fullyQualifiedName);

      case SearchIndex.API_COLLECTION_INDEX:
      case EntityType.API_COLLECTION:
        return getEntityDetailsPath(
          EntityType.API_COLLECTION,
          fullyQualifiedName,
          tab,
          subTab
        );

      case SearchIndex.API_ENDPOINT_INDEX:
      case EntityType.API_ENDPOINT:
        return getEntityDetailsPath(
          EntityType.API_ENDPOINT,
          fullyQualifiedName,
          tab,
          subTab
        );
      case SearchIndex.METRIC_SEARCH_INDEX:
      case EntityType.METRIC:
        return getEntityDetailsPath(
          EntityType.METRIC,
          fullyQualifiedName,
          tab,
          subTab
        );

      case SearchIndex.TABLE:
      case EntityType.TABLE:
      default:
        return getEntityDetailsPath(
          EntityType.TABLE,
          fullyQualifiedName,
          tab,
          subTab
        );
    }
  }

  public getEntityByFqn(entityType: string, fqn: string, fields?: string[]) {
    switch (entityType) {
      case EntityType.DATABASE_SERVICE:
        return getServiceByFQN('databaseServices', fqn, { fields });
      case EntityType.DATABASE:
        return getDatabaseDetailsByFQN(fqn, { fields });
      case EntityType.DATABASE_SCHEMA:
        return getDatabaseSchemaDetailsByFQN(fqn, { fields });

      case EntityType.GLOSSARY_TERM:
        return getGlossariesByName(fqn, { fields });
      default:
        return getTableDetailsByFQN(fqn, { fields });
    }
  }

  public getEntityDetailComponent(entityType: string) {
    switch (entityType) {
      case EntityType.DATABASE:
        return DatabaseDetailsPage;
      case EntityType.DATABASE_SCHEMA:
        return DatabaseSchemaPageComponent;
      case EntityType.PIPELINE:
        return PipelineDetailsPage;
      case EntityType.TOPIC:
        return TopicDetailsPage;
      case EntityType.DASHBOARD:
        return DashboardDetailsPage;
      case EntityType.STORED_PROCEDURE:
        return StoredProcedurePage;
      case EntityType.DASHBOARD_DATA_MODEL:
        return DataModelsPage;
      case EntityType.MLMODEL:
        return MlModelPage;
      case EntityType.CONTAINER:
        return ContainerPage;
      case EntityType.SEARCH_INDEX:
        return SearchIndexDetailsPage;
      case EntityType.DATA_PRODUCT:
        return DataProductsPage;
      case EntityType.TABLE:
        return TableDetailsPageV1;
      case EntityType.API_COLLECTION:
        return APICollectionPage;
      case EntityType.API_ENDPOINT:
        return APIEndpointPage;
      case EntityType.METRIC:
        return MetricDetailsPage;

      default:
        return null;
    }
  }

  public getResourceEntityFromEntityType(entityType: string): string {
    switch (entityType) {
      case EntityType.TABLE: {
        return ResourceEntity.TABLE;
      }
      case EntityType.TOPIC: {
        return ResourceEntity.TOPIC;
      }
      case EntityType.DASHBOARD: {
        return ResourceEntity.DASHBOARD;
      }
      case EntityType.PIPELINE: {
        return ResourceEntity.PIPELINE;
      }
      case EntityType.MLMODEL: {
        return ResourceEntity.ML_MODEL;
      }
      case EntityType.CONTAINER: {
        return ResourceEntity.CONTAINER;
      }
      case EntityType.SEARCH_INDEX: {
        return ResourceEntity.SEARCH_INDEX;
      }
      case EntityType.DASHBOARD_DATA_MODEL: {
        return ResourceEntity.DASHBOARD_DATA_MODEL;
      }
      case EntityType.STORED_PROCEDURE: {
        return ResourceEntity.STORED_PROCEDURE;
      }
      case EntityType.DATABASE: {
        return ResourceEntity.DATABASE;
      }
      case EntityType.DATABASE_SCHEMA: {
        return ResourceEntity.DATABASE_SCHEMA;
      }
      case EntityType.GLOSSARY_TERM: {
        return ResourceEntity.GLOSSARY_TERM;
      }
      case EntityType.DATA_PRODUCT: {
        return ResourceEntity.DATA_PRODUCT;
      }
      case EntityType.API_COLLECTION: {
        return ResourceEntity.API_COLLECTION;
      }
      case EntityType.API_ENDPOINT: {
        return ResourceEntity.API_ENDPOINT;
      }
      case EntityType.METRIC: {
        return ResourceEntity.METRIC;
      }

      default: {
        return ResourceEntity.TABLE;
      }
    }
  }

  public getEntityFloatingButton(_: EntityType): FC | null {
    return null;
  }

  public getManageExtraOptions(
    _entityType: EntityType,
    _fqn: string,
    _permission: OperationPermission,
    _entityDetails:
      | VersionData
      | ServicesType
      | Database
      | DatabaseSchema
      | APICollection
  ): ItemType[] {
    const isEntityDeleted = _entityDetails?.deleted ?? false;
    switch (_entityType) {
      case EntityType.TABLE:
        return [
          ...ExtraTableDropdownOptions(_fqn, _permission, isEntityDeleted),
        ];
      case EntityType.DATABASE:
        return [
          ...ExtraDatabaseDropdownOptions(_fqn, _permission, isEntityDeleted),
        ];
      case EntityType.DATABASE_SCHEMA:
        return [
          ...ExtraDatabaseSchemaDropdownOptions(
            _fqn,
            _permission,
            isEntityDeleted
          ),
        ];
      case EntityType.DATABASE_SERVICE:
        return [
          ...ExtraDatabaseServiceDropdownOptions(
            _fqn,
            _permission,
            isEntityDeleted
          ),
        ];
      default:
        return [];
    }
  }

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

const entityUtilClassBase = new EntityUtilClassBase();

export default entityUtilClassBase;

export { EntityUtilClassBase };
