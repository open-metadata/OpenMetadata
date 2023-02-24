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

import { ServiceTypes } from 'Models';
import i18n from 'utils/i18next/LocalUtil';
import addPlaceHolder from '../assets/img/add-placeholder.svg';
import airbyte from '../assets/img/Airbyte.webp';
import noDataFound from '../assets/img/no-data-placeholder.svg';
import noService from '../assets/img/no-service.webp';
import airflow from '../assets/img/service-icon-airflow.webp';
import amundsen from '../assets/img/service-icon-amundsen.webp';
import athena from '../assets/img/service-icon-athena.webp';
import atlas from '../assets/img/service-icon-atlas.svg';
import azuresql from '../assets/img/service-icon-azuresql.webp';
import clickhouse from '../assets/img/service-icon-clickhouse.webp';
import dagster from '../assets/img/service-icon-dagster.webp';
import databrick from '../assets/img/service-icon-databrick.webp';
import datalake from '../assets/img/service-icon-datalake.webp';
import deltalake from '../assets/img/service-icon-delta-lake.webp';
import domo from '../assets/img/service-icon-domo.webp';
import druid from '../assets/img/service-icon-druid.webp';
import dynamodb from '../assets/img/service-icon-dynamodb.webp';
import fivetran from '../assets/img/service-icon-fivetran.webp';
import databaseDefault from '../assets/img/service-icon-generic.webp';
import glue from '../assets/img/service-icon-glue.webp';
import hive from '../assets/img/service-icon-hive.webp';
import ibmdb2 from '../assets/img/service-icon-ibmdb2.webp';
import kafka from '../assets/img/service-icon-kafka.webp';
import kinesis from '../assets/img/service-icon-kinesis.webp';
import looker from '../assets/img/service-icon-looker.webp';
import mariadb from '../assets/img/service-icon-mariadb.webp';
import metabase from '../assets/img/service-icon-metabase.webp';
import mode from '../assets/img/service-icon-mode.webp';
import mssql from '../assets/img/service-icon-mssql.webp';
import nifi from '../assets/img/service-icon-nifi.webp';
import oracle from '../assets/img/service-icon-oracle.webp';
import pinot from '../assets/img/service-icon-pinot.webp';
import postgres from '../assets/img/service-icon-post.webp';
import powerbi from '../assets/img/service-icon-power-bi.webp';
import prefect from '../assets/img/service-icon-prefect.webp';
import presto from '../assets/img/service-icon-presto.webp';
import pulsar from '../assets/img/service-icon-pulsar.webp';
import query from '../assets/img/service-icon-query.webp';
import quicksight from '../assets/img/service-icon-quicksight.webp';
import redash from '../assets/img/service-icon-redash.webp';
import redpanda from '../assets/img/service-icon-redpanda.webp';
import redshift from '../assets/img/service-icon-redshift.webp';
import sagemaker from '../assets/img/service-icon-sagemaker.webp';
import salesforce from '../assets/img/service-icon-salesforce.webp';
import scikit from '../assets/img/service-icon-scikit.webp';
import singlestore from '../assets/img/service-icon-singlestore.webp';
import snowflakes from '../assets/img/service-icon-snowflakes.webp';
import mysql from '../assets/img/service-icon-sql.webp';
import sqlite from '../assets/img/service-icon-sqlite.webp';
import superset from '../assets/img/service-icon-superset.webp';
import tableau from '../assets/img/service-icon-tableau.webp';
import trino from '../assets/img/service-icon-trino.webp';
import vertica from '../assets/img/service-icon-vertica.webp';
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
};

export const arrServiceTypes: Array<ServiceTypes> = [
  'databaseServices',
  'messagingServices',
  'dashboardServices',
  'pipelineServices',
  'mlmodelServices',
];

export const SERVICE_CATEGORY: { [key: string]: ServiceCategory } = {
  databases: ServiceCategory.DATABASE_SERVICES,
  messaging: ServiceCategory.MESSAGING_SERVICES,
  dashboards: ServiceCategory.DASHBOARD_SERVICES,
  pipelines: ServiceCategory.PIPELINE_SERVICES,
  mlModels: ServiceCategory.ML_MODEL_SERVICES,
  metadata: ServiceCategory.METADATA_SERVICES,
};

export const SERVICE_CATEGORY_TYPE = {
  databaseServices: 'databases',
  messagingServices: 'messaging',
  dashboardServices: 'dashboards',
  pipelineServices: 'pipelines',
  mlmodelServices: 'mlModels',
  metadataServices: 'metadata',
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
