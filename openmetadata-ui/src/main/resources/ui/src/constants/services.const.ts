/*
 *  Copyright 2021 Collate
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
import noDataFound from '../assets/img/no-data-placeholder.png';
import noService from '../assets/img/no-service.png';
import airflow from '../assets/img/service-icon-airflow.png';
import athena from '../assets/img/service-icon-athena.png';
import databaseDefault from '../assets/img/service-icon-generic.png';
import glue from '../assets/img/service-icon-glue.png';
import hive from '../assets/img/service-icon-hive.png';
import kafka from '../assets/img/service-icon-kafka.png';
import looker from '../assets/img/service-icon-looker.png';
import mariadb from '../assets/img/service-icon-mariadb.png';
import metabase from '../assets/img/service-icon-metabase.png';
import mssql from '../assets/img/service-icon-mssql.png';
import oracle from '../assets/img/service-icon-oracle.png';
import postgres from '../assets/img/service-icon-post.png';
import prefect from '../assets/img/service-icon-prefect.png';
import presto from '../assets/img/service-icon-presto.png';
import pulsar from '../assets/img/service-icon-pulsar.png';
import query from '../assets/img/service-icon-query.png';
import redash from '../assets/img/service-icon-redash.png';
import redshift from '../assets/img/service-icon-redshift.png';
import snowflakes from '../assets/img/service-icon-snowflakes.png';
import mysql from '../assets/img/service-icon-sql.png';
import superset from '../assets/img/service-icon-superset.png';
import tableau from '../assets/img/service-icon-tableau.png';
import trino from '../assets/img/service-icon-trino.png';
import vertica from '../assets/img/service-icon-vertica.png';
import dashboardDefault from '../assets/svg/dashboard.svg';
import pipelineDefault from '../assets/svg/pipeline.svg';
import plus from '../assets/svg/plus.svg';
import topicDefault from '../assets/svg/topic.svg';
import { DashboardServiceType } from '../generated/entity/services/dashboardService';
import { DatabaseServiceType } from '../generated/entity/services/databaseService';
import { MessagingServiceType } from '../generated/entity/services/messagingService';
import { PipelineServiceType } from '../generated/entity/services/pipelineService';

export const NoDataFoundPlaceHolder = noDataFound;
export const MYSQL = mysql;
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
export const SUPERSET = superset;
export const LOOKER = looker;
export const TABLEAU = tableau;
export const REDASH = redash;
export const METABASE = metabase;

export const AIRFLOW = airflow;
export const PREFECT = prefect;
export const DATABASE_DEFAULT = databaseDefault;
export const TOPIC_DEFAULT = topicDefault;
export const DASHBOARD_DEFAULT = dashboardDefault;
export const PIPELINE_DEFAULT = pipelineDefault;

export const PLUS = plus;
export const NOSERVICE = noService;

export const serviceTypes: Record<ServiceTypes, Array<string>> = {
  databaseServices: Object.values(DatabaseServiceType),
  messagingServices: Object.values(MessagingServiceType),
  dashboardServices: Object.values(DashboardServiceType),
  pipelineServices: Object.values(PipelineServiceType),
};

export const arrServiceTypes: Array<ServiceTypes> = [
  'databaseServices',
  'messagingServices',
  'dashboardServices',
  'pipelineServices',
];

export const servicesDisplayName = {
  databaseServices: 'Database Service',
  messagingServices: 'Messaging Service',
  dashboardServices: 'Dashboard Service',
  pipelineServices: 'Pipeline Service',
};
