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

import athena from '../assets/img/service-icon-athena.webp';
import azuresql from '../assets/img/service-icon-azuresql.webp';
import bigtable from '../assets/img/service-icon-bigtable.webp';
import burstiq from '../assets/img/service-icon-burstiq.webp';
import cassandra from '../assets/img/service-icon-cassandra.webp';
import clickhouse from '../assets/img/service-icon-clickhouse.webp';
import cockroach from '../assets/img/service-icon-cockroach.webp';
import couchbase from '../assets/img/service-icon-couchbase.svg';
import databrick from '../assets/img/service-icon-databrick.webp';
import datalake from '../assets/img/service-icon-datalake.webp';
import deltalake from '../assets/img/service-icon-delta-lake.webp';
import doris from '../assets/img/service-icon-doris.webp';
import druid from '../assets/img/service-icon-druid.webp';
import dynamodb from '../assets/img/service-icon-dynamodb.webp';
import exasol from '../assets/img/service-icon-exasol.webp';
import glue from '../assets/img/service-icon-glue.webp';
import greenplum from '../assets/img/service-icon-greenplum.webp';
import hive from '../assets/img/service-icon-hive.webp';
import ibmdb2 from '../assets/img/service-icon-ibmdb2.webp';
import impala from '../assets/img/service-icon-impala.webp';
import iomete from '../assets/img/service-icon-iomete.webp';
import mariadb from '../assets/img/service-icon-mariadb.webp';
import mongodb from '../assets/img/service-icon-mongodb.webp';
import mssql from '../assets/img/service-icon-mssql.webp';
import oracle from '../assets/img/service-icon-oracle.webp';
import pinot from '../assets/img/service-icon-pinot.webp';
import postgres from '../assets/img/service-icon-post.webp';
import presto from '../assets/img/service-icon-presto.webp';
import bigquery from '../assets/img/service-icon-query.webp';
import questdb from '../assets/img/service-icon-questdb.webp';
import redshift from '../assets/img/service-icon-redshift.webp';
import salesforce from '../assets/img/service-icon-salesforce.webp';
import saperp from '../assets/img/service-icon-sap-erp.webp';
import saphana from '../assets/img/service-icon-sap-hana.webp';
import sas from '../assets/img/service-icon-sas.svg';
import singlestore from '../assets/img/service-icon-singlestore.webp';
import snowflake from '../assets/img/service-icon-snowflakes.webp';
import mysql from '../assets/img/service-icon-sql.webp';
import sqlite from '../assets/img/service-icon-sqlite.webp';
import starrocks from '../assets/img/service-icon-starrocks.webp';
import timescale from '../assets/img/service-icon-timescale.webp';
import trino from '../assets/img/service-icon-trino.webp';
import unitycatalog from '../assets/img/service-icon-unitycatalog.svg';
import vertica from '../assets/img/service-icon-vertica.webp';
import teradata from '../assets/svg/teradata.svg';

// Messaging services
import kafka from '../assets/img/service-icon-kafka.webp';
import kinesis from '../assets/img/service-icon-kinesis.webp';
import redpanda from '../assets/img/service-icon-redpanda.webp';
import pubsub from '../assets/svg/service-icon-pubsub.svg';

// Dashboard services
import domo from '../assets/img/service-icon-domo.webp';
import grafana from '../assets/img/service-icon-grafana.webp';
import lightdash from '../assets/img/service-icon-lightdash.webp';
import looker from '../assets/img/service-icon-looker.webp';
import metabase from '../assets/img/service-icon-metabase.webp';
import microstrategy from '../assets/img/service-icon-microstrategy.svg';
import mode from '../assets/img/service-icon-mode.webp';
import omni from '../assets/img/service-icon-omni.webp';
import powerbi from '../assets/img/service-icon-power-bi.webp';
import qliksense from '../assets/img/service-icon-qlik-sense.webp';
import quicksight from '../assets/img/service-icon-quicksight.webp';
import redash from '../assets/img/service-icon-redash.webp';
import sigma from '../assets/img/service-icon-sigma.webp';
import ssrs from '../assets/img/service-icon-ssrs.webp';
import superset from '../assets/img/service-icon-superset.webp';
import tableau from '../assets/img/service-icon-tableau.webp';
import hex from '../assets/svg/service-icon-hex.svg';

// Pipeline services
import airbyte from '../assets/img/Airbyte.webp';
import airflow from '../assets/img/service-icon-airflow.webp';
import dagster from '../assets/img/service-icon-dagster.webp';
import dbt from '../assets/img/service-icon-dbt.webp';
import fivetran from '../assets/img/service-icon-fivetran.webp';
import flink from '../assets/img/service-icon-flink.webp';
import nifi from '../assets/img/service-icon-nifi.webp';
import openlineage from '../assets/img/service-icon-openlineage.svg';
import spark from '../assets/img/service-icon-spark.webp';
import spline from '../assets/img/service-icon-spline.webp';

// ML Model services
import sagemaker from '../assets/img/service-icon-sagemaker.webp';
import scikit from '../assets/img/service-icon-scikit.webp';
import mlflow from '../assets/svg/service-icon-mlflow.svg';

// Storage services
import amazons3 from '../assets/img/service-icon-amazon-s3.svg';
import gcs from '../assets/img/service-icon-gcs.webp';

// Search services
import elasticsearch from '../assets/svg/elasticsearch.svg';
import opensearch from '../assets/svg/open-search.svg';

// Metadata services
import alationsink from '../assets/img/service-icon-alation-sink.webp';
import amundsen from '../assets/img/service-icon-amundsen.webp';
import atlas from '../assets/img/service-icon-atlas.svg';

// Drive services
import googledrive from '../assets/svg/service-icon-google-drive.svg';
import sftp from '../assets/svg/service-icon-sftp.svg';

// Default icons
import synapse from '../assets/img/service-icon-synapse.webp';
import dashboarddefault from '../assets/svg/dashboard.svg';
import defaultservice from '../assets/svg/default-service-icon.svg';
import databasedefault from '../assets/svg/ic-custom-database.svg';
import customdrivedefault from '../assets/svg/ic-custom-drive.svg';
import mlmodeldefault from '../assets/svg/ic-custom-model.svg';
import searchdefault from '../assets/svg/ic-custom-search.svg';
import storagedefault from '../assets/svg/ic-custom-storage.svg';
import drivedefault from '../assets/svg/ic-drive-service.svg';
import restservice from '../assets/svg/ic-service-rest-api.svg';
import openMetadataLogo from '../assets/svg/logo-monogram.svg';
import pipelinedefault from '../assets/svg/pipeline.svg';
import securitydefault from '../assets/svg/security-safe.svg';
import topicdefault from '../assets/svg/topic.svg';
import brandClassBase from './BrandData/BrandClassBase';

const { src: LogoSrc } = brandClassBase.getMonogram();

const SERVICE_ICON_LOADERS: Record<string, string> = {
  // Database services
  mysql: mysql,
  sqlite: sqlite,
  mssql: mssql,
  redshift: redshift,
  bigquery: bigquery,
  bigtable: bigtable,
  hive: hive,
  impala: impala,
  postgres: postgres,
  oracle: oracle,
  snowflake: snowflake,
  athena: athena,
  presto: presto,
  trino: trino,
  glue: glue,
  mariadb: mariadb,
  vertica: vertica,
  azuresql: azuresql,
  clickhouse: clickhouse,
  databricks: databrick,
  unitycatalog: unitycatalog,
  db2: ibmdb2,
  doris: doris,
  starrocks: starrocks,
  druid: druid,
  dynamodb: dynamodb,
  singlestore: singlestore,
  salesforce: salesforce,
  saphana: saphana,
  saperp: saperp,
  deltalake: deltalake,
  pinotdb: pinot,
  datalake: datalake,
  exasol: exasol,
  mongodb: mongodb,
  cassandra: cassandra,
  couchbase: couchbase,
  greenplum: greenplum,
  teradata: teradata,
  cockroach: cockroach,
  timescale: timescale,
  burstiq: burstiq,
  sas: sas,
  iomete: iomete,
  questdb: questdb,
  domodatabase: domo,
  customdatabase: databasedefault,

  // Messaging services
  kafka: kafka,
  pubsub: pubsub,
  redpanda: redpanda,
  kinesis: kinesis,
  custommessaging: topicdefault,

  // Dashboard services
  superset: superset,
  looker: looker,
  tableau: tableau,
  redash: redash,
  metabase: metabase,
  powerbi: powerbi,
  sigma: sigma,
  omni: omni,
  mode: mode,
  domodashboard: domo,
  quicksight: quicksight,
  qliksense: qliksense,
  lightdash: lightdash,
  microstrategy: microstrategy,
  grafana: grafana,
  hex: hex,
  ssrs: ssrs,
  customdashboard: dashboarddefault,

  // Pipeline services
  airflow: airflow,
  airbyte: airbyte,
  dagster: dagster,
  dbtcloud: dbt,
  fivetran: fivetran,
  nifi: nifi,
  spark: spark,
  spline: spline,
  flink: flink,
  openlineage: openlineage,
  domopipeline: domo,
  kafkaconnect: kafka,
  databrickspipeline: databrick,
  gluepipeline: glue,
  custompipeline: pipelinedefault,

  // ML Model services
  mlflow: mlflow,
  scikit: scikit,
  sagemaker: sagemaker,
  custommlmodel: mlmodeldefault,

  // Storage services
  s3: amazons3,
  gcs: gcs,

  // Search services
  elasticsearch: elasticsearch,
  opensearch: opensearch,

  // Metadata services
  amundsen: amundsen,
  atlas: atlas,
  alationsink: alationsink,
  openmetadata: openMetadataLogo,

  // Drive services
  googledrive: googledrive,
  sftp: sftp,
  customdrive: customdrivedefault,

  // API services
  rest: restservice,

  // Default icons
  defaultservice: defaultservice,
  databasedefault: databasedefault,
  databaseservice: databasedefault,
  topicdefault: topicdefault,
  topicservice: topicdefault,
  dashboarddefault: dashboarddefault,
  dashboardservice: dashboarddefault,
  pipelinedefault: pipelinedefault,
  pipelineservice: pipelinedefault,
  mlmodeldefault: mlmodeldefault,
  mlmodelservice: mlmodeldefault,
  storagedefault: storagedefault,
  storageservice: storagedefault,
  drivedefault: drivedefault,
  messagingservice: topicdefault,
  driveservice: drivedefault,
  customdrivedefault: customdrivedefault,
  searchdefault: searchdefault,
  searchservice: searchdefault,
  securitydefault: securitydefault,
  securityservice: securitydefault,
  restservice: restservice,
  // Dynamic logo based on build
  logo: LogoSrc,
  synapse: synapse,
};

export const getServiceIcon = (iconKey: string): string => {
  const normalizedKey = iconKey.toLowerCase().replaceAll(/[_-]/g, '');
  const icon = SERVICE_ICON_LOADERS[normalizedKey];

  return icon;
};
