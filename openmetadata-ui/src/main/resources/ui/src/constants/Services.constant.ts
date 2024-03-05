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
import addPlaceHolder from '../assets/img/add-placeholder.svg';
import airbyte from '../assets/img/Airbyte.png';
import noDataFound from '../assets/img/no-data-placeholder.svg';
import noService from '../assets/img/no-service.png';
import airflow from '../assets/img/service-icon-airflow.png';
import amazonS3 from '../assets/img/service-icon-amazon-s3.svg';
import amundsen from '../assets/img/service-icon-amundsen.png';
import athena from '../assets/img/service-icon-athena.png';
import atlas from '../assets/img/service-icon-atlas.svg';
import azuresql from '../assets/img/service-icon-azuresql.png';
import bigtable from '../assets/img/service-icon-bigtable.png';
import clickhouse from '../assets/img/service-icon-clickhouse.png';
import couchbase from '../assets/img/service-icon-couchbase.svg';
import dagster from '../assets/img/service-icon-dagster.png';
import databrick from '../assets/img/service-icon-databrick.png';
import datalake from '../assets/img/service-icon-datalake.png';
import deltalake from '../assets/img/service-icon-delta-lake.png';
import domo from '../assets/img/service-icon-domo.png';
import doris from '../assets/img/service-icon-doris.png';
import druid from '../assets/img/service-icon-druid.png';
import dynamodb from '../assets/img/service-icon-dynamodb.png';
import fivetran from '../assets/img/service-icon-fivetran.png';
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
import mode from '../assets/img/service-icon-mode.png';
import mongodb from '../assets/img/service-icon-mongodb.png';
import msAzure from '../assets/img/service-icon-ms-azure.png';
import mssql from '../assets/img/service-icon-mssql.png';
import mstr from '../assets/img/service-icon-mstr.png';
import nifi from '../assets/img/service-icon-nifi.png';
import oracle from '../assets/img/service-icon-oracle.png';
import pinot from '../assets/img/service-icon-pinot.png';
import postgres from '../assets/img/service-icon-post.png';
import powerbi from '../assets/img/service-icon-power-bi.png';
import prefect from '../assets/img/service-icon-prefect.png';
import presto from '../assets/img/service-icon-presto.png';
import pulsar from '../assets/img/service-icon-pulsar.png';
import qlikSense from '../assets/img/service-icon-qlik-sense.png';
import query from '../assets/img/service-icon-query.png';
import quicksight from '../assets/img/service-icon-quicksight.png';
import redash from '../assets/img/service-icon-redash.png';
import redpanda from '../assets/img/service-icon-redpanda.png';
import redshift from '../assets/img/service-icon-redshift.png';
import sagemaker from '../assets/img/service-icon-sagemaker.png';
import salesforce from '../assets/img/service-icon-salesforce.png';
import sapHana from '../assets/img/service-icon-sap-hana.png';
import sas from '../assets/img/service-icon-sas.svg';
import scikit from '../assets/img/service-icon-scikit.png';
import singlestore from '../assets/img/service-icon-singlestore.png';
import snowflakes from '../assets/img/service-icon-snowflakes.png';
import spark from '../assets/img/service-icon-spark.png';
import spline from '../assets/img/service-icon-spline.png';
import mysql from '../assets/img/service-icon-sql.png';
import sqlite from '../assets/img/service-icon-sqlite.png';
import superset from '../assets/img/service-icon-superset.png';
import tableau from '../assets/img/service-icon-tableau.png';
import trino from '../assets/img/service-icon-trino.png';
import vertica from '../assets/img/service-icon-vertica.png';
import dashboardDefault from '../assets/svg/dashboard.svg';
import iconDefaultService from '../assets/svg/default-service-icon.svg';
import elasticSearch from '../assets/svg/elasticsearch.svg';
import databaseDefault from '../assets/svg/ic-custom-database.svg';
import mlModelDefault from '../assets/svg/ic-custom-model.svg';
import storageDefault from '../assets/svg/ic-custom-storage.svg';
import logo from '../assets/svg/logo-monogram.svg';
import openSearch from '../assets/svg/open-search.svg';
import pipelineDefault from '../assets/svg/pipeline.svg';
import plus from '../assets/svg/plus.svg';
import mlflow from '../assets/svg/service-icon-mlflow.svg';
import topicDefault from '../assets/svg/topic.svg';
import { EntityType } from '../enums/entity.enum';
import { ServiceCategory } from '../enums/service.enum';
import { PipelineType } from '../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { WorkflowStatus } from '../generated/entity/automations/workflow';
import { StorageServiceType } from '../generated/entity/data/container';
import { DashboardServiceType } from '../generated/entity/services/dashboardService';
import { DatabaseServiceType } from '../generated/entity/services/databaseService';
import { MessagingServiceType } from '../generated/entity/services/messagingService';
import { MetadataServiceType } from '../generated/entity/services/metadataService';
import { MlModelServiceType } from '../generated/entity/services/mlmodelService';
import { PipelineServiceType } from '../generated/entity/services/pipelineService';
import { SearchServiceType } from '../generated/entity/services/searchService';
import { ServiceType } from '../generated/entity/services/serviceType';
import i18n from '../utils/i18next/LocalUtil';
import {
  addDBTIngestionGuide,
  addLineageIngestionGuide,
  addMetadataIngestionGuide,
  addProfilerIngestionGuide,
  addUsageIngestionGuide,
} from './service-guide.constant';

export const NoDataFoundPlaceHolder = noDataFound;
export const AddPlaceHolder = addPlaceHolder;
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
export const PULSAR = pulsar;
export const REDPANDA = redpanda;
export const SUPERSET = superset;
export const LOOKER = looker;
export const MSTR = mstr;
export const TABLEAU = tableau;
export const REDASH = redash;
export const METABASE = metabase;
export const AZURESQL = azuresql;
export const CLICKHOUSE = clickhouse;
export const DATABRICK = databrick;
export const UNITYCATALOG = databrick;
export const IBMDB2 = ibmdb2;
export const DORIS = doris;
export const DRUID = druid;
export const DYNAMODB = dynamodb;
export const SINGLESTORE = singlestore;
export const SALESFORCE = salesforce;
export const MLFLOW = mlflow;
export const SAP_HANA = sapHana;
export const SCIKIT = scikit;
export const DELTALAKE = deltalake;
export const DEFAULT_SERVICE = iconDefaultService;
export const AIRBYTE = airbyte;
export const PINOT = pinot;
export const DATALAKE = datalake;
export const MODE = mode;
export const DAGSTER = dagster;
export const FIVETRAN = fivetran;
export const AMUNDSEN = amundsen;
export const ATLAS = atlas;
export const SAS = sas;
export const LOGO = logo;

export const AIRFLOW = airflow;
export const PREFECT = prefect;
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
export const MS_AZURE = msAzure;
export const SPARK = spark;
export const SPLINE = spline;
export const MONGODB = mongodb;
export const QLIK_SENSE = qlikSense;
export const LIGHT_DASH = lightDash;
export const COUCHBASE = couchbase;
export const GREENPLUM = greenplum;
export const ELASTIC_SEARCH = elasticSearch;
export const OPEN_SEARCH = openSearch;
export const PLUS = plus;
export const NOSERVICE = noService;
export const ICEBERGE = iceberge;
export const excludedService = [
  MlModelServiceType.Sklearn,
  MetadataServiceType.MetadataES,
  MetadataServiceType.OpenMetadata,
  SearchServiceType.OpenSearch,
];

export const arrServiceTypes: Array<ServiceTypes> = [
  'databaseServices',
  'messagingServices',
  'dashboardServices',
  'pipelineServices',
  'mlmodelServices',
  'storageServices',
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
};

export const DEF_UI_SCHEMA = {
  supportsMetadataExtraction: { 'ui:widget': 'hidden', 'ui:hideError': true },
  supportsUsageExtraction: { 'ui:widget': 'hidden', 'ui:hideError': true },
  supportsLineageExtraction: { 'ui:widget': 'hidden', 'ui:hideError': true },
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

export const INGESTION_WORKFLOW_NAME_UI_SCHEMA = {
  name: { 'ui:disabled': true },
};

export const INGESTION_WORKFLOW_UI_SCHEMA = {
  type: { 'ui:widget': 'hidden', 'ui:hideError': true },
  'ui:order': [
    'name',
    'databaseFilterPattern',
    'schemaFilterPattern',
    'tableFilterPattern',
    'enableDebugLog',
    '*',
  ],
};

export const COMMON_UI_SCHEMA = {
  ...DEF_UI_SCHEMA,
  connection: {
    ...DEF_UI_SCHEMA,
  },
  metastoreConnection: {
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

export const INGESTION_GUIDE_MAP = {
  [PipelineType.Usage]: addUsageIngestionGuide,
  [PipelineType.Lineage]: addLineageIngestionGuide,
  [PipelineType.Profiler]: addProfilerIngestionGuide,
  [PipelineType.Dbt]: addDBTIngestionGuide,
  [PipelineType.Metadata]: addMetadataIngestionGuide,
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
};

export const BETA_SERVICES = [
  DatabaseServiceType.BigTable,
  DatabaseServiceType.SAS,
  DatabaseServiceType.Doris,
  PipelineServiceType.Spline,
  PipelineServiceType.Spark,
  DashboardServiceType.QlikSense,
  DatabaseServiceType.Couchbase,
  DatabaseServiceType.Greenplum,
  DatabaseServiceType.Iceberg,
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

export const TEST_CONNECTION_INFO_MESSAGE = i18n.t(
  'message.test-connection-taking-too-long'
);

export const TEST_CONNECTION_WARNING_MESSAGE = i18n.t(
  'message.connection-test-warning'
);

export const ADVANCED_PROPERTIES = [
  'connectionArguments',
  'connectionOptions',
  'scheme',
  'sampleDataStorageConfig',
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
];
