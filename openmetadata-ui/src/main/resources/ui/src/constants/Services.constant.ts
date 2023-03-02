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

import { ObjectStoreServiceType } from 'generated/entity/services/objectstoreService';
import { map, startCase } from 'lodash';
import { ServiceTypes } from 'Models';
import i18n from 'utils/i18next/LocalUtil';
import addPlaceHolder from '../assets/img/add-placeholder.svg';
import airbyte from '../assets/img/Airbyte.png';
import noDataFound from '../assets/img/no-data-placeholder.svg';
import noService from '../assets/img/no-service.png';
import airflow from '../assets/img/service-icon-airflow.png';
import amundsen from '../assets/img/service-icon-amundsen.png';
import athena from '../assets/img/service-icon-athena.png';
import atlas from '../assets/img/service-icon-atlas.svg';
import azuresql from '../assets/img/service-icon-azuresql.png';
import clickhouse from '../assets/img/service-icon-clickhouse.png';
import dagster from '../assets/img/service-icon-dagster.png';
import databrick from '../assets/img/service-icon-databrick.png';
import datalake from '../assets/img/service-icon-datalake.png';
import deltalake from '../assets/img/service-icon-delta-lake.png';
import domo from '../assets/img/service-icon-domo.png';
import druid from '../assets/img/service-icon-druid.png';
import dynamodb from '../assets/img/service-icon-dynamodb.png';
import fivetran from '../assets/img/service-icon-fivetran.png';
import databaseDefault from '../assets/img/service-icon-generic.png';
import glue from '../assets/img/service-icon-glue.png';
import hive from '../assets/img/service-icon-hive.png';
import ibmdb2 from '../assets/img/service-icon-ibmdb2.png';
import kafka from '../assets/img/service-icon-kafka.png';
import kinesis from '../assets/img/service-icon-kinesis.png';
import looker from '../assets/img/service-icon-looker.png';
import mariadb from '../assets/img/service-icon-mariadb.png';
import metabase from '../assets/img/service-icon-metabase.png';
import mode from '../assets/img/service-icon-mode.png';
import mssql from '../assets/img/service-icon-mssql.png';
import nifi from '../assets/img/service-icon-nifi.png';
import oracle from '../assets/img/service-icon-oracle.png';
import pinot from '../assets/img/service-icon-pinot.png';
import postgres from '../assets/img/service-icon-post.png';
import powerbi from '../assets/img/service-icon-power-bi.png';
import prefect from '../assets/img/service-icon-prefect.png';
import presto from '../assets/img/service-icon-presto.png';
import pulsar from '../assets/img/service-icon-pulsar.png';
import query from '../assets/img/service-icon-query.png';
import quicksight from '../assets/img/service-icon-quicksight.png';
import redash from '../assets/img/service-icon-redash.png';
import redpanda from '../assets/img/service-icon-redpanda.png';
import redshift from '../assets/img/service-icon-redshift.png';
import sagemaker from '../assets/img/service-icon-sagemaker.png';
import salesforce from '../assets/img/service-icon-salesforce.png';
import scikit from '../assets/img/service-icon-scikit.png';
import singlestore from '../assets/img/service-icon-singlestore.png';
import snowflakes from '../assets/img/service-icon-snowflakes.png';
import mysql from '../assets/img/service-icon-sql.png';
import sqlite from '../assets/img/service-icon-sqlite.png';
import superset from '../assets/img/service-icon-superset.png';
import tableau from '../assets/img/service-icon-tableau.png';
import trino from '../assets/img/service-icon-trino.png';
import vertica from '../assets/img/service-icon-vertica.png';
import dashboardDefault from '../assets/svg/dashboard.svg';
import iconDefaultService from '../assets/svg/default-service-icon.svg';
import logo from '../assets/svg/logo-monogram.svg';
import pipelineDefault from '../assets/svg/pipeline.svg';
import plus from '../assets/svg/plus.svg';
import mlflow from '../assets/svg/service-icon-mlflow.svg';
import topicDefault from '../assets/svg/topic.svg';
import { ServiceCategory } from '../enums/service.enum';
import { DashboardServiceType } from '../generated/entity/services/dashboardService';
import { DatabaseServiceType } from '../generated/entity/services/databaseService';
import { MessagingServiceType } from '../generated/entity/services/messagingService';
import { MetadataServiceType } from '../generated/entity/services/metadataService';
import { MlModelServiceType } from '../generated/entity/services/mlmodelService';
import { PipelineServiceType } from '../generated/entity/services/pipelineService';
import { customServiceComparator } from '../utils/StringsUtils';

export const NoDataFoundPlaceHolder = noDataFound;
export const AddPlaceHolder = addPlaceHolder;
export const MYSQL = mysql;
export const SQLITE = sqlite;
export const MSSQL = mssql;
export const REDSHIFT = redshift;
export const BIGQUERY = query;
export const HIVE = hive;
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
export const TABLEAU = tableau;
export const REDASH = redash;
export const METABASE = metabase;
export const AZURESQL = azuresql;
export const CLICKHOUSE = clickhouse;
export const DATABRICK = databrick;
export const IBMDB2 = ibmdb2;
export const DRUID = druid;
export const DYNAMODB = dynamodb;
export const SINGLESTORE = singlestore;
export const SALESFORCE = salesforce;
export const MLFLOW = mlflow;
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
export const LOGO = logo;

export const AIRFLOW = airflow;
export const PREFECT = prefect;
export const POWERBI = powerbi;
export const DATABASE_DEFAULT = databaseDefault;
export const TOPIC_DEFAULT = topicDefault;
export const DASHBOARD_DEFAULT = dashboardDefault;
export const PIPELINE_DEFAULT = pipelineDefault;
export const NIFI = nifi;
export const KINESIS = kinesis;
export const QUICKSIGHT = quicksight;
export const DOMO = domo;
export const SAGEMAKER = sagemaker;

export const PLUS = plus;
export const NOSERVICE = noService;
export const excludedService = [
  MlModelServiceType.Sklearn,
  MetadataServiceType.MetadataES,
  MetadataServiceType.OpenMetadata,
];

export const IGNORED_DB_SERVICES: Array<string> = ['QueryLog', 'Dbt'];

export const serviceTypes: Record<ServiceTypes, Array<string>> = {
  databaseServices: (Object.values(DatabaseServiceType) as string[])
    .filter((key: string) => !IGNORED_DB_SERVICES.includes(key))
    .sort(customServiceComparator),
  messagingServices: (Object.values(MessagingServiceType) as string[]).sort(
    customServiceComparator
  ),
  dashboardServices: (Object.values(DashboardServiceType) as string[]).sort(
    customServiceComparator
  ),
  pipelineServices: (Object.values(PipelineServiceType) as string[]).sort(
    customServiceComparator
  ),
  mlmodelServices: (Object.values(MlModelServiceType) as string[]).sort(
    customServiceComparator
  ),
  metadataServices: (Object.values(MetadataServiceType) as string[]).sort(
    customServiceComparator
  ),
  objectstoreServices: (Object.values(ObjectStoreServiceType) as string[]).sort(
    customServiceComparator
  ),
};

export const arrServiceTypes: Array<ServiceTypes> = [
  'databaseServices',
  'messagingServices',
  'dashboardServices',
  'pipelineServices',
  'mlmodelServices',
  'objectstoreServices',
];

export const SERVICE_CATEGORY: { [key: string]: ServiceCategory } = {
  databases: ServiceCategory.DATABASE_SERVICES,
  messaging: ServiceCategory.MESSAGING_SERVICES,
  dashboards: ServiceCategory.DASHBOARD_SERVICES,
  pipelines: ServiceCategory.PIPELINE_SERVICES,
  mlModels: ServiceCategory.ML_MODEL_SERVICES,
  metadata: ServiceCategory.METADATA_SERVICES,
  objectStores: ServiceCategory.OBJECT_STORE_SERVICES,
};

export const SERVICE_CATEGORY_TYPE = {
  databaseServices: 'databases',
  messagingServices: 'messaging',
  dashboardServices: 'dashboards',
  pipelineServices: 'pipelines',
  mlmodelServices: 'mlModels',
  metadataServices: 'metadata',
  objectstoreServices: 'objectStores',
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
  objectstoreServices: i18n.t('label.entity-service', {
    entity: i18n.t('label.object-store'),
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

export const COMMON_UI_SCHEMA = {
  ...DEF_UI_SCHEMA,
  connection: {
    ...DEF_UI_SCHEMA,
  },
};

export const OPENMETADATA = 'OpenMetadata';
export const JWT_CONFIG = 'openMetadataJWTClientConfig';

export const SERVICE_CATEGORY_OPTIONS = map(ServiceCategory, (value) => ({
  label: startCase(value),
  value,
}));
