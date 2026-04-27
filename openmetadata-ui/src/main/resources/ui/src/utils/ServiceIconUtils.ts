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

import athena from '../assets/img/service-icon-athena.png';
import azuresql from '../assets/img/service-icon-azuresql.png';
import bigtable from '../assets/img/service-icon-bigtable.png';
import burstiq from '../assets/img/service-icon-burstiq.png';
import cassandra from '../assets/img/service-icon-cassandra.png';
import clickhouse from '../assets/img/service-icon-clickhouse.png';
import cockroach from '../assets/img/service-icon-cockroach.png';
import couchbase from '../assets/img/service-icon-couchbase.svg';
import databrick from '../assets/img/service-icon-databrick.png';
import datalake from '../assets/img/service-icon-datalake.png';
import deltalake from '../assets/img/service-icon-delta-lake.png';
import doris from '../assets/img/service-icon-doris.png';
import druid from '../assets/img/service-icon-druid.png';
import dynamodb from '../assets/img/service-icon-dynamodb.png';
import exasol from '../assets/img/service-icon-exasol.png';
import glue from '../assets/img/service-icon-glue.png';
import greenplum from '../assets/img/service-icon-greenplum.png';
import hive from '../assets/img/service-icon-hive.png';
import ibmdb2 from '../assets/img/service-icon-ibmdb2.png';
import impala from '../assets/img/service-icon-impala.png';
import iomete from '../assets/img/service-icon-iomete.png';
import mariadb from '../assets/img/service-icon-mariadb.png';
import microsoftFabric from '../assets/img/service-icon-microsoftfabric.png';
import mongodb from '../assets/img/service-icon-mongodb.png';
import mssql from '../assets/img/service-icon-mssql.png';
import oracle from '../assets/img/service-icon-oracle.png';
import pinot from '../assets/img/service-icon-pinot.png';
import postgres from '../assets/img/service-icon-post.png';
import presto from '../assets/img/service-icon-presto.png';
import bigquery from '../assets/img/service-icon-query.png';
import redshift from '../assets/img/service-icon-redshift.png';
import salesforce from '../assets/img/service-icon-salesforce.png';
import saperp from '../assets/img/service-icon-sap-erp.png';
import saphana from '../assets/img/service-icon-sap-hana.png';
import sas from '../assets/img/service-icon-sas.svg';
import singlestore from '../assets/img/service-icon-singlestore.png';
import snowflake from '../assets/img/service-icon-snowflakes.png';
import mysql from '../assets/img/service-icon-sql.png';
import sqlite from '../assets/img/service-icon-sqlite.png';
import starrocks from '../assets/img/service-icon-starrocks.png';
import timescale from '../assets/img/service-icon-timescale.png';
import trino from '../assets/img/service-icon-trino.png';
import unitycatalog from '../assets/img/service-icon-unitycatalog.svg';
import vertica from '../assets/img/service-icon-vertica.png';
import teradata from '../assets/svg/teradata.svg';

// Messaging services
import kafka from '../assets/img/service-icon-kafka.png';
import kinesis from '../assets/img/service-icon-kinesis.png';
import redpanda from '../assets/img/service-icon-redpanda.png';
import pubsub from '../assets/svg/service-icon-pubsub.svg';

// Dashboard services
import domo from '../assets/img/service-icon-domo.png';
import grafana from '../assets/img/service-icon-grafana.png';
import lightdash from '../assets/img/service-icon-lightdash.png';
import looker from '../assets/img/service-icon-looker.png';
import metabase from '../assets/img/service-icon-metabase.png';
import microstrategy from '../assets/img/service-icon-microstrategy.svg';
import mode from '../assets/img/service-icon-mode.png';
import powerbi from '../assets/img/service-icon-power-bi.png';
import qliksense from '../assets/img/service-icon-qlik-sense.png';
import quicksight from '../assets/img/service-icon-quicksight.png';
import redash from '../assets/img/service-icon-redash.png';
import sigma from '../assets/img/service-icon-sigma.png';
import ssrs from '../assets/img/service-icon-ssrs.png';
import superset from '../assets/img/service-icon-superset.png';
import tableau from '../assets/img/service-icon-tableau.png';
import hex from '../assets/svg/service-icon-hex.svg';

// Pipeline services
import airbyte from '../assets/img/Airbyte.png';
import airflow from '../assets/img/service-icon-airflow.png';
import dagster from '../assets/img/service-icon-dagster.png';
import dbt from '../assets/img/service-icon-dbt.png';
import fivetran from '../assets/img/service-icon-fivetran.png';
import flink from '../assets/img/service-icon-flink.png';
import nifi from '../assets/img/service-icon-nifi.png';
import openlineage from '../assets/img/service-icon-openlineage.svg';
import spark from '../assets/img/service-icon-spark.png';
import spline from '../assets/img/service-icon-spline.png';

// ML Model services
import sagemaker from '../assets/img/service-icon-sagemaker.png';
import scikit from '../assets/img/service-icon-scikit.png';
import mlflow from '../assets/svg/service-icon-mlflow.svg';

// Storage services
import amazons3 from '../assets/img/service-icon-amazon-s3.svg';
import gcs from '../assets/img/service-icon-gcs.png';

// Search services
import elasticsearch from '../assets/svg/elasticsearch.svg';
import opensearch from '../assets/svg/open-search.svg';

// Metadata services
import alationsink from '../assets/img/service-icon-alation-sink.png';
import amundsen from '../assets/img/service-icon-amundsen.png';
import atlas from '../assets/img/service-icon-atlas.svg';

// Drive services
import googledrive from '../assets/svg/service-icon-google-drive.svg';
import sftp from '../assets/svg/service-icon-sftp.svg';

// Default icons
import synapse from '../assets/img/service-icon-synapse.png';
import dashboarddefault from '../assets/svg/dashboard.svg';
import defaultservice from '../assets/svg/default-service-icon.svg';
import databasedefault from '../assets/svg/ic-custom-database.svg';
import customdrivedefault from '../assets/svg/ic-custom-drive.svg';
import mlmodeldefault from '../assets/svg/ic-custom-model.svg';
import searchdefault from '../assets/svg/ic-custom-search.svg';
import storagedefault from '../assets/svg/ic-custom-storage.svg';
import drivedefault from '../assets/svg/ic-drive-service.svg';
import restservice from '../assets/svg/ic-service-rest-api.svg';
import logo from '../assets/svg/logo-monogram.svg';
import pipelinedefault from '../assets/svg/pipeline.svg';
import securitydefault from '../assets/svg/security-safe.svg';
import topicdefault from '../assets/svg/topic.svg';

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
  domodatabase: domo,
  customdatabase: databasedefault,
  microsoftfabric: microsoftFabric,

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
  microsoftfabricpipeline: microsoftFabric,

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
  openmetadata: logo,

  // Drive services
  googledrive: googledrive,
  sftp: sftp,
  customdrive: customdrivedefault,

  // API services
  rest: restservice,

  // Default icons
  defaultservice: defaultservice,
  databasedefault: databasedefault,
  topicdefault: topicdefault,
  dashboarddefault: dashboarddefault,
  pipelinedefault: pipelinedefault,
  mlmodeldefault: mlmodeldefault,
  storagedefault: storagedefault,
  drivedefault: drivedefault,
  customdrivedefault: customdrivedefault,
  searchdefault: searchdefault,
  securitydefault: securitydefault,
  restservice: restservice,
  logo: logo,
  synapse: synapse,
};

export const getServiceIcon = (iconKey: string): string => {
  const normalizedKey = iconKey.toLowerCase().replaceAll(/[_-]/g, '');
  const icon = SERVICE_ICON_LOADERS[normalizedKey];

  return icon;
};
