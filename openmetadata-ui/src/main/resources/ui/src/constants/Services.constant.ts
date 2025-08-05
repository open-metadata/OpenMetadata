/*
 *  Copyright 2022 Collate.
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

import { map, startCase } from 'lodash';
import { ServiceTypes, StepperStepType } from 'Models';
import airbyte from '../assets/img/Airbyte.png';
import airflow from '../assets/img/service-icon-airflow.png';
import alationsink from '../assets/img/service-icon-alation-sink.png';
import amazonS3 from '../assets/img/service-icon-amazon-s3.svg';
import amundsen from '../assets/img/service-icon-amundsen.png';
import athena from '../assets/img/service-icon-athena.png';
import atlas from '../assets/img/service-icon-atlas.svg';
import azuresql from '../assets/img/service-icon-azuresql.png';
import bigtable from '../assets/img/service-icon-bigtable.png';
import cassandra from '../assets/img/service-icon-cassandra.png';
import clickhouse from '../assets/img/service-icon-clickhouse.png';
import cockroach from '../assets/img/service-icon-cockroach.png';
import couchbase from '../assets/img/service-icon-couchbase.svg';
import dagster from '../assets/img/service-icon-dagster.png';
import databrick from '../assets/img/service-icon-databrick.png';
import datalake from '../assets/img/service-icon-datalake.png';
import dbt from '../assets/img/service-icon-dbt.png';
import deltalake from '../assets/img/service-icon-delta-lake.png';
import domo from '../assets/img/service-icon-domo.png';
import doris from '../assets/img/service-icon-doris.png';
import druid from '../assets/img/service-icon-druid.png';
import dynamodb from '../assets/img/service-icon-dynamodb.png';
import exasol from '../assets/img/service-icon-exasol.png';
import fivetran from '../assets/img/service-icon-fivetran.png';
import flink from '../assets/img/service-icon-flink.png';
import gcs from '../assets/img/service-icon-gcs.png';
import glue from '../assets/img/service-icon-glue.png';
import greenplum from '../assets/img/service-icon-greenplum.png';
import hive from '../assets/img/service-icon-hive.png';
import ibmdb2 from '../assets/img/service-icon-ibmdb2.png';
import iceberge from '../assets/img/service-icon-iceberg.png';
import impala from '../assets/img/service-icon-impala.png';
import kafka from '../assets/img/service-icon-kafka.png';
import kinesis from '../assets/img/service-icon-kinesis.png';
import lightDash from '../assets/img/service-icon-lightdash.png';
import looker from '../assets/img/service-icon-looker.png';
import mariadb from '../assets/img/service-icon-mariadb.png';
import metabase from '../assets/img/service-icon-metabase.png';
import microstrategy from '../assets/img/service-icon-microstrategy.svg';
import mode from '../assets/img/service-icon-mode.png';
import mongodb from '../assets/img/service-icon-mongodb.png';
import mssql from '../assets/img/service-icon-mssql.png';
import nifi from '../assets/img/service-icon-nifi.png';
import openlineage from '../assets/img/service-icon-openlineage.svg';
import oracle from '../assets/img/service-icon-oracle.png';
import pinot from '../assets/img/service-icon-pinot.png';
import postgres from '../assets/img/service-icon-post.png';
import powerbi from '../assets/img/service-icon-power-bi.png';
import presto from '../assets/img/service-icon-presto.png';
import qlikSense from '../assets/img/service-icon-qlik-sense.png';
import query from '../assets/img/service-icon-query.png';
import quicksight from '../assets/img/service-icon-quicksight.png';
import redash from '../assets/img/service-icon-redash.png';
import redpanda from '../assets/img/service-icon-redpanda.png';
import redshift from '../assets/img/service-icon-redshift.png';
import sagemaker from '../assets/img/service-icon-sagemaker.png';
import salesforce from '../assets/img/service-icon-salesforce.png';
import sapErp from '../assets/img/service-icon-sap-erp.png';
import sapHana from '../assets/img/service-icon-sap-hana.png';
import sas from '../assets/img/service-icon-sas.svg';
import scikit from '../assets/img/service-icon-scikit.png';
import sigma from '../assets/img/service-icon-sigma.png';
import singlestore from '../assets/img/service-icon-singlestore.png';
import snowflakes from '../assets/img/service-icon-snowflakes.png';
import spark from '../assets/img/service-icon-spark.png';
import spline from '../assets/img/service-icon-spline.png';
import mysql from '../assets/img/service-icon-sql.png';
import sqlite from '../assets/img/service-icon-sqlite.png';
import superset from '../assets/img/service-icon-superset.png';
import synapse from '../assets/img/service-icon-synapse.png';
import tableau from '../assets/img/service-icon-tableau.png';
import trino from '../assets/img/service-icon-trino.png';
import unitycatalog from '../assets/img/service-icon-unitycatalog.svg';
import vertica from '../assets/img/service-icon-vertica.png';
import dashboardDefault from '../assets/svg/dashboard.svg';
import iconDefaultService from '../assets/svg/default-service-icon.svg';
import elasticSearch from '../assets/svg/elasticsearch.svg';
import databaseDefault from '../assets/svg/ic-custom-database.svg';
import mlModelDefault from '../assets/svg/ic-custom-model.svg';
import searchDefault from '../assets/svg/ic-custom-search.svg';
import storageDefault from '../assets/svg/ic-custom-storage.svg';
import restService from '../assets/svg/ic-service-rest-api.svg';
import logo from '../assets/svg/logo-monogram.svg';
import openSearch from '../assets/svg/open-search.svg';
import pipelineDefault from '../assets/svg/pipeline.svg';
import securitySafe from '../assets/svg/security-safe.svg';
import mlflow from '../assets/svg/service-icon-mlflow.svg';
import teradata from '../assets/svg/teradata.svg';
import topicDefault from '../assets/svg/topic.svg';
import { EntityType } from '../enums/entity.enum';
import {
  ServiceCategory,
  ServiceNestedConnectionFields,
} from '../enums/service.enum';
import { PipelineType } from '../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { WorkflowStatus } from '../generated/entity/automations/workflow';
import { StorageServiceType } from '../generated/entity/data/container';
import { APIServiceType } from '../generated/entity/services/apiService';
import { DashboardServiceType } from '../generated/entity/services/dashboardService';
import { DatabaseServiceType } from '../generated/entity/services/databaseService';
import { MessagingServiceType } from '../generated/entity/services/messagingService';
import { MetadataServiceType } from '../generated/entity/services/metadataService';
import { MlModelServiceType } from '../generated/entity/services/mlmodelService';
import { PipelineServiceType } from '../generated/entity/services/pipelineService';
import { SearchServiceType } from '../generated/entity/services/searchService';
import { Type as SecurityServiceType } from '../generated/entity/services/securityService';
import { ServiceType } from '../generated/entity/services/serviceType';
import i18n from '../utils/i18next/LocalUtil';
import { SERVICE_FILTER_PATTERN_FIELDS } from './ServiceConnection.constants';

export const MYSQL = mysql;
export const SQLITE = sqlite;
export const MSSQL = mssql;
export const REDSHIFT = redshift;
export const BIGQUERY = query;
export const BIGTABLE = bigtable;
export const HIVE = hive;
export const IMPALA = impala;
export const POSTGRES = postgres;
export const ORACLE = oracle;
export const SNOWFLAKE = snowflakes;
export const ATHENA = athena;
export const PRESTO = presto;
export const TRINO = trino;
export const GLUE = glue;
export const MARIADB = mariadb;
export const VERTICA = vertica;
export const KAFKA = kafka;
export const REDPANDA = redpanda;
export const SUPERSET = superset;
export const SYNAPSE = synapse;
export const LOOKER = looker;
export const MICROSTRATEGY = microstrategy;
export const TABLEAU = tableau;
export const REDASH = redash;
export const METABASE = metabase;
export const AZURESQL = azuresql;
export const CLICKHOUSE = clickhouse;
export const DATABRICK = databrick;
export const UNITYCATALOG = unitycatalog;
export const IBMDB2 = ibmdb2;
export const DORIS = doris;
export const DRUID = druid;
export const DYNAMODB = dynamodb;
export const SIGMA = sigma;
export const SINGLESTORE = singlestore;
export const SALESFORCE = salesforce;
export const MLFLOW = mlflow;
export const SAP_HANA = sapHana;
export const SAP_ERP = sapErp;
export const SCIKIT = scikit;
export const DELTALAKE = deltalake;
export const DEFAULT_SERVICE = iconDefaultService;
export const AIRBYTE = airbyte;
export const PINOT = pinot;
export const DATALAKE = datalake;
export const MODE = mode;
export const DAGSTER = dagster;
export const DBT = dbt;
export const FIVETRAN = fivetran;
export const AMUNDSEN = amundsen;
export const ATLAS = atlas;
export const ALATIONSINK = alationsink;
export const SAS = sas;
export const OPENLINEAGE = openlineage;
export const LOGO = logo;
export const EXASOL = exasol;
export const AIRFLOW = airflow;
export const POWERBI = powerbi;
export const DATABASE_DEFAULT = databaseDefault;
export const TOPIC_DEFAULT = topicDefault;
export const DASHBOARD_DEFAULT = dashboardDefault;
export const PIPELINE_DEFAULT = pipelineDefault;
export const ML_MODEL_DEFAULT = mlModelDefault;
export const CUSTOM_STORAGE_DEFAULT = storageDefault;
export const NIFI = nifi;
export const KINESIS = kinesis;
export const QUICKSIGHT = quicksight;
export const DOMO = domo;
export const SAGEMAKER = sagemaker;
export const AMAZON_S3 = amazonS3;
export const GCS = gcs;
export const SPARK = spark;
export const SPLINE = spline;
export const MONGODB = mongodb;
export const CASSANDRA = cassandra;
export const QLIK_SENSE = qlikSense;
export const LIGHT_DASH = lightDash;
export const COUCHBASE = couchbase;
export const GREENPLUM = greenplum;
export const ELASTIC_SEARCH = elasticSearch;
export const OPEN_SEARCH = openSearch;
export const CUSTOM_SEARCH_DEFAULT = searchDefault;
export const ICEBERGE = iceberge;
export const TERADATA = teradata;
export const FLINK = flink;
export const REST_SERVICE = restService;
export const COCKROACH = cockroach;
export const SECURITY_DEFAULT = securitySafe;
export const excludedService = [
  MlModelServiceType.Sklearn,
  MetadataServiceType.MetadataES,
  MetadataServiceType.OpenMetadata,
];

export const arrServiceTypes: Array<ServiceTypes> = [
  'databaseServices',
  'messagingServices',
  'dashboardServices',
  'pipelineServices',
  'mlmodelServices',
  'storageServices',
  'apiServices',
  'securityServices',
];

export const SERVICE_CATEGORY: { [key: string]: ServiceCategory } = {
  databases: ServiceCategory.DATABASE_SERVICES,
  messaging: ServiceCategory.MESSAGING_SERVICES,
  dashboards: ServiceCategory.DASHBOARD_SERVICES,
  pipelines: ServiceCategory.PIPELINE_SERVICES,
  mlmodels: ServiceCategory.ML_MODEL_SERVICES,
  metadata: ServiceCategory.METADATA_SERVICES,
  storages: ServiceCategory.STORAGE_SERVICES,
  search: ServiceCategory.SEARCH_SERVICES,
  apiServices: ServiceCategory.API_SERVICES,
  security: ServiceCategory.SECURITY_SERVICES,
};

export const servicesDisplayName: { [key: string]: string } = {
  databaseServices: i18n.t('label.entity-service', {
    entity: i18n.t('label.database'),
  }),
  messagingServices: i18n.t('label.entity-service', {
    entity: i18n.t('label.messaging'),
  }),
  dashboardServices: i18n.t('label.entity-service', {
    entity: i18n.t('label.dashboard'),
  }),
  pipelineServices: i18n.t('label.entity-service', {
    entity: i18n.t('label.pipeline'),
  }),
  mlmodelServices: i18n.t('label.entity-service', {
    entity: i18n.t('label.ml-model'),
  }),
  metadataServices: i18n.t('label.entity-service', {
    entity: i18n.t('label.metadata'),
  }),
  storageServices: i18n.t('label.entity-service', {
    entity: i18n.t('label.storage'),
  }),
  searchServices: i18n.t('label.entity-service', {
    entity: i18n.t('label.search'),
  }),
  dashboardDataModel: i18n.t('label.entity-service', {
    entity: i18n.t('label.data-model'),
  }),
  apiServices: i18n.t('label.entity-service', {
    entity: i18n.t('label.api-uppercase'),
  }),
  securityServices: i18n.t('label.entity-service', {
    entity: i18n.t('label.security'),
  }),
};

export const DEF_UI_SCHEMA = {
  supportsIncrementalMetadataExtraction: {
    'ui:widget': 'hidden',
    'ui:hideError': true,
  },
  supportsMetadataExtraction: { 'ui:widget': 'hidden', 'ui:hideError': true },
  supportsSystemProfile: { 'ui:widget': 'hidden', 'ui:hideError': true },
  supportsDataDiff: { 'ui:widget': 'hidden', 'ui:hideError': true },
  supportsUsageExtraction: { 'ui:widget': 'hidden', 'ui:hideError': true },
  supportsLineageExtraction: { 'ui:widget': 'hidden', 'ui:hideError': true },
  supportsViewLineageExtraction: {
    'ui:widget': 'hidden',
    'ui:hideError': true,
  },
  supportsProfiler: { 'ui:widget': 'hidden', 'ui:hideError': true },
  supportsDatabase: { 'ui:widget': 'hidden', 'ui:hideError': true },
  supportsQueryComment: { 'ui:widget': 'hidden', 'ui:hideError': true },
  supportsDBTExtraction: { 'ui:widget': 'hidden', 'ui:hideError': true },
  type: { 'ui:widget': 'hidden' },
};

export const INGESTION_ELASTIC_SEARCH_WORKFLOW_UI_SCHEMA = {
  useSSL: { 'ui:widget': 'hidden', 'ui:hideError': true },
  verifyCerts: { 'ui:widget': 'hidden', 'ui:hideError': true },
  timeout: { 'ui:widget': 'hidden', 'ui:hideError': true },
  caCerts: { 'ui:widget': 'hidden', 'ui:hideError': true },
  useAwsCredentials: { 'ui:widget': 'hidden', 'ui:hideError': true },
  regionName: { 'ui:widget': 'hidden', 'ui:hideError': true },
};

export const INGESTION_WORKFLOW_UI_SCHEMA = {
  type: { 'ui:widget': 'hidden', 'ui:hideError': true },
  name: { 'ui:widget': 'hidden', 'ui:hideError': true },
  processingEngine: { 'ui:widget': 'hidden', 'ui:hideError': true },
  'ui:order': [
    'name',
    'displayName',
    ...SERVICE_FILTER_PATTERN_FIELDS,
    'enableDebugLog',
    '*',
  ],
};

export const EXCLUDE_INCREMENTAL_EXTRACTION_SUPPORT_UI_SCHEMA = {
  incremental: {
    'ui:widget': 'hidden',
    'ui:hideError': true,
  },
};

export const COMMON_UI_SCHEMA = {
  ...DEF_UI_SCHEMA,
  [ServiceNestedConnectionFields.CONNECTION]: {
    ...DEF_UI_SCHEMA,
  },
  [ServiceNestedConnectionFields.METASTORE_CONNECTION]: {
    ...DEF_UI_SCHEMA,
  },
  [ServiceNestedConnectionFields.DATABASE_CONNECTION]: {
    ...DEF_UI_SCHEMA,
  },
};

export const OPEN_METADATA = 'OpenMetadata';
export const JWT_CONFIG = 'openMetadataJWTClientConfig';

export const SERVICE_CATEGORY_OPTIONS = map(ServiceCategory, (value) => ({
  label: startCase(value),
  value,
}));

export const STEPS_FOR_ADD_SERVICE: Array<StepperStepType> = [
  {
    name: i18n.t('label.select-field', {
      field: i18n.t('label.service-type'),
    }),
    step: 1,
  },
  {
    name: i18n.t('label.configure-entity', {
      entity: i18n.t('label.service'),
    }),
    step: 2,
  },
  {
    name: i18n.t('label.connection-entity', {
      entity: i18n.t('label.detail-plural'),
    }),
    step: 3,
  },
  {
    name: i18n.t('label.set-default-filters'),
    step: 4,
  },
];

export const STEPS_FOR_EDIT_SERVICE: Array<StepperStepType> = [
  {
    name: i18n.t('label.connection-entity', {
      entity: i18n.t('label.detail-plural'),
    }),
    step: 1,
  },
  {
    name: i18n.t('label.set-default-filters'),
    step: 2,
  },
];

export const SERVICE_DEFAULT_ERROR_MAP = {
  serviceType: false,
};
// 2 minutes
export const FETCHING_EXPIRY_TIME = 2 * 60 * 1000;
export const FETCH_INTERVAL = 2000;
export const WORKFLOW_COMPLETE_STATUS = [
  WorkflowStatus.Failed,
  WorkflowStatus.Successful,
];
export const TEST_CONNECTION_PROGRESS_PERCENTAGE = {
  ZERO: 0,
  ONE: 1,
  TEN: 10,
  TWENTY: 20,
  FORTY: 40,
  HUNDRED: 100,
};

export const SERVICE_TYPE_MAP = {
  [ServiceCategory.DASHBOARD_SERVICES]: ServiceType.Dashboard,
  [ServiceCategory.DATABASE_SERVICES]: ServiceType.Database,
  [ServiceCategory.MESSAGING_SERVICES]: ServiceType.Messaging,
  [ServiceCategory.ML_MODEL_SERVICES]: ServiceType.MlModel,
  [ServiceCategory.METADATA_SERVICES]: ServiceType.Metadata,
  [ServiceCategory.STORAGE_SERVICES]: ServiceType.Storage,
  [ServiceCategory.PIPELINE_SERVICES]: ServiceType.Pipeline,
  [ServiceCategory.SEARCH_SERVICES]: ServiceType.Search,
  [ServiceCategory.API_SERVICES]: ServiceType.API,
  [ServiceCategory.SECURITY_SERVICES]: ServiceType.Security,
};

export const SERVICE_TYPES_ENUM = {
  [ServiceCategory.DASHBOARD_SERVICES]: DashboardServiceType,
  [ServiceCategory.DATABASE_SERVICES]: DatabaseServiceType,
  [ServiceCategory.MESSAGING_SERVICES]: MessagingServiceType,
  [ServiceCategory.ML_MODEL_SERVICES]: MlModelServiceType,
  [ServiceCategory.METADATA_SERVICES]: MetadataServiceType,
  [ServiceCategory.STORAGE_SERVICES]: StorageServiceType,
  [ServiceCategory.PIPELINE_SERVICES]: PipelineServiceType,
  [ServiceCategory.SEARCH_SERVICES]: SearchServiceType,
  [ServiceCategory.API_SERVICES]: APIServiceType,
  [ServiceCategory.SECURITY_SERVICES]: SecurityServiceType,
};

export const BETA_SERVICES = [
  PipelineServiceType.OpenLineage,
  PipelineServiceType.Wherescape,
  DatabaseServiceType.Cassandra,
  MetadataServiceType.AlationSink,
  DatabaseServiceType.Cockroach,
  SearchServiceType.OpenSearch,
  PipelineServiceType.Ssis,
  DatabaseServiceType.Ssas,
  DashboardServiceType.ThoughtSpot,
  SecurityServiceType.Ranger,
  DatabaseServiceType.Epic,
];

export const TEST_CONNECTION_INITIAL_MESSAGE = i18n.t(
  'message.test-your-connection-before-creating-service'
);

export const TEST_CONNECTION_SUCCESS_MESSAGE = i18n.t(
  'message.connection-test-successful'
);

export const TEST_CONNECTION_FAILURE_MESSAGE = i18n.t(
  'message.connection-test-failed'
);

export const TEST_CONNECTION_TESTING_MESSAGE = i18n.t(
  'message.testing-your-connection-may-take-two-minutes'
);

export const TEST_CONNECTION_WARNING_MESSAGE = i18n.t(
  'message.connection-test-warning'
);

export const ADVANCED_PROPERTIES = [
  'connectionArguments',
  'connectionOptions',
  'scheme',
  'sampleDataStorageConfig',
  'computeTableMetrics',
  'computeColumnMetrics',
  'includeViews',
  'useStatistics',
  'confidence',
  'samplingMethodType',
  'randomizedSample',
  'sampleDataCount',
  'threadCount',
  'timeoutSeconds',
  'sslConfig',
  'sslMode',
  'schemaRegistrySSL',
  'consumerConfigSSL',
  'verify',
];

export const PIPELINE_SERVICE_PLATFORM = 'Airflow';

export const SERVICE_TYPES = [
  EntityType.DATABASE_SERVICE,
  EntityType.DASHBOARD_SERVICE,
  EntityType.MESSAGING_SERVICE,
  EntityType.PIPELINE_SERVICE,
  EntityType.MLMODEL_SERVICE,
  EntityType.METADATA_SERVICE,
  EntityType.STORAGE_SERVICE,
  EntityType.SEARCH_SERVICE,
  EntityType.API_SERVICE,
  EntityType.SECURITY_SERVICE,
];

export const EXCLUDE_AUTO_PILOT_SERVICE_TYPES = [EntityType.SECURITY_SERVICE];

export const SERVICE_INGESTION_PIPELINE_TYPES = [
  PipelineType.Metadata,
  PipelineType.Usage,
  PipelineType.Lineage,
  PipelineType.Profiler,
  PipelineType.AutoClassification,
  PipelineType.Dbt,
];

export const SERVICE_TYPE_WITH_DISPLAY_NAME = new Map<string, string>([
  [PipelineServiceType.GluePipeline, 'Glue Pipeline'],
  [DatabaseServiceType.DomoDatabase, 'Domo Database'],
  [DashboardServiceType.DomoDashboard, 'Domo Dashboard'],
  [DashboardServiceType.MicroStrategy, 'Micro Strategy'],
  [DashboardServiceType.PowerBIReportServer, 'PowerBI Report Server'],
  [PipelineServiceType.DatabricksPipeline, 'Databricks Pipeline'],
  [PipelineServiceType.DomoPipeline, 'Domo Pipeline'],
  [PipelineServiceType.KafkaConnect, 'Kafka Connect'],
  [DatabaseServiceType.SapERP, 'SAP ERP'],
  [DatabaseServiceType.SapHana, 'SAP HANA'],
  [DatabaseServiceType.UnityCatalog, 'Unity Catalog'],
  [PipelineServiceType.DataFactory, 'Data Factory'],
  [PipelineServiceType.DBTCloud, 'DBT Cloud'],
  [PipelineServiceType.OpenLineage, 'Open Lineage'],
  [MetadataServiceType.AlationSink, 'Alation Sink'],
  [SearchServiceType.ElasticSearch, 'Elasticsearch'],
]);
