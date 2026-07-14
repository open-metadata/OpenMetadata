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

import { cloneDeep } from 'lodash';
import { COMMON_UI_SCHEMA } from '../constants/ServiceUISchema.constant';
import { DatabaseServiceType } from '../generated/entity/services/databaseService';
import athenaConnection from '../jsons/connectionSchemas/connections/database/athenaConnection.json';
import azureSQLConnection from '../jsons/connectionSchemas/connections/database/azureSQLConnection.json';
import bigQueryConnection from '../jsons/connectionSchemas/connections/database/bigQueryConnection.json';
import bigTableConnection from '../jsons/connectionSchemas/connections/database/bigTableConnection.json';
import burstiqConnection from '../jsons/connectionSchemas/connections/database/burstIQConnection.json';
import cassandraConnection from '../jsons/connectionSchemas/connections/database/cassandraConnection.json';
import clickhouseConnection from '../jsons/connectionSchemas/connections/database/clickhouseConnection.json';
import cockroachConnection from '../jsons/connectionSchemas/connections/database/cockroachConnection.json';
import couchbaseConnection from '../jsons/connectionSchemas/connections/database/couchbaseConnection.json';
import customDatabaseConnection from '../jsons/connectionSchemas/connections/database/customDatabaseConnection.json';
import databricksConnection from '../jsons/connectionSchemas/connections/database/databricksConnection.json';
import datalakeConnection from '../jsons/connectionSchemas/connections/database/datalakeConnection.json';
import db2Connection from '../jsons/connectionSchemas/connections/database/db2Connection.json';
import deltaLakeConnection from '../jsons/connectionSchemas/connections/database/deltaLakeConnection.json';
import domoDatabaseConnection from '../jsons/connectionSchemas/connections/database/domoDatabaseConnection.json';
import dorisConnection from '../jsons/connectionSchemas/connections/database/dorisConnection.json';
import druidConnection from '../jsons/connectionSchemas/connections/database/druidConnection.json';
import dynamoDBConnection from '../jsons/connectionSchemas/connections/database/dynamoDBConnection.json';
import exasolConnection from '../jsons/connectionSchemas/connections/database/exasolConnection.json';
import glueConnection from '../jsons/connectionSchemas/connections/database/glueConnection.json';
import greenplumConnection from '../jsons/connectionSchemas/connections/database/greenplumConnection.json';
import hiveConnection from '../jsons/connectionSchemas/connections/database/hiveConnection.json';
import impalaConnection from '../jsons/connectionSchemas/connections/database/impalaConnection.json';
import iometeConnection from '../jsons/connectionSchemas/connections/database/iometeConnection.json';
import mariaDBConnection from '../jsons/connectionSchemas/connections/database/mariaDBConnection.json';
import microsoftFabricConnection from '../jsons/connectionSchemas/connections/database/microsoftFabricConnection.json';
import mongoDBConnection from '../jsons/connectionSchemas/connections/database/mongoDBConnection.json';
import mssqlConnection from '../jsons/connectionSchemas/connections/database/mssqlConnection.json';
import mysqlConnection from '../jsons/connectionSchemas/connections/database/mysqlConnection.json';
import oracleConnection from '../jsons/connectionSchemas/connections/database/oracleConnection.json';
import pinotConnection from '../jsons/connectionSchemas/connections/database/pinotDBConnection.json';
import postgresConnection from '../jsons/connectionSchemas/connections/database/postgresConnection.json';
import prestoConnection from '../jsons/connectionSchemas/connections/database/prestoConnection.json';
import questdbConnection from '../jsons/connectionSchemas/connections/database/questdbConnection.json';
import redshiftConnection from '../jsons/connectionSchemas/connections/database/redshiftConnection.json';
import salesforceConnection from '../jsons/connectionSchemas/connections/database/salesforceConnection.json';
import sapErpConnection from '../jsons/connectionSchemas/connections/database/sapErpConnection.json';
import sapHanaConnection from '../jsons/connectionSchemas/connections/database/sapHanaConnection.json';
import sasConnection from '../jsons/connectionSchemas/connections/database/sasConnection.json';
import singleStoreConnection from '../jsons/connectionSchemas/connections/database/singleStoreConnection.json';
import snowflakeConnection from '../jsons/connectionSchemas/connections/database/snowflakeConnection.json';
import sqliteConnection from '../jsons/connectionSchemas/connections/database/sqliteConnection.json';
import starrocksConnection from '../jsons/connectionSchemas/connections/database/starrocksConnection.json';
import synapseConnection from '../jsons/connectionSchemas/connections/database/synapseConnection.json';
import teradataConnection from '../jsons/connectionSchemas/connections/database/teradataConnection.json';
import timescaleConnection from '../jsons/connectionSchemas/connections/database/timescaleConnection.json';
import trinoConnection from '../jsons/connectionSchemas/connections/database/trinoConnection.json';
import unityCatalogConnection from '../jsons/connectionSchemas/connections/database/unityCatalogConnection.json';
import verticaConnection from '../jsons/connectionSchemas/connections/database/verticaConnection.json';

const databaseSchemaMap: Partial<Record<DatabaseServiceType, object>> = {
  [DatabaseServiceType.Athena]: athenaConnection,
  [DatabaseServiceType.AzureSQL]: azureSQLConnection,
  [DatabaseServiceType.BigQuery]: bigQueryConnection,
  [DatabaseServiceType.BigTable]: bigTableConnection,
  [DatabaseServiceType.Clickhouse]: clickhouseConnection,
  [DatabaseServiceType.Cockroach]: cockroachConnection,
  [DatabaseServiceType.Databricks]: databricksConnection,
  [DatabaseServiceType.Datalake]: datalakeConnection,
  [DatabaseServiceType.Db2]: db2Connection,
  [DatabaseServiceType.DeltaLake]: deltaLakeConnection,
  [DatabaseServiceType.Doris]: dorisConnection,
  [DatabaseServiceType.StarRocks]: starrocksConnection,
  [DatabaseServiceType.Druid]: druidConnection,
  [DatabaseServiceType.DynamoDB]: dynamoDBConnection,
  [DatabaseServiceType.Exasol]: exasolConnection,
  [DatabaseServiceType.Glue]: glueConnection,
  [DatabaseServiceType.Hive]: hiveConnection,
  [DatabaseServiceType.Impala]: impalaConnection,
  [DatabaseServiceType.MariaDB]: mariaDBConnection,
  [DatabaseServiceType.Mssql]: mssqlConnection,
  [DatabaseServiceType.Mysql]: mysqlConnection,
  [DatabaseServiceType.Oracle]: oracleConnection,
  [DatabaseServiceType.Postgres]: postgresConnection,
  [DatabaseServiceType.Presto]: prestoConnection,
  [DatabaseServiceType.QuestDB]: questdbConnection,
  [DatabaseServiceType.Redshift]: redshiftConnection,
  [DatabaseServiceType.Salesforce]: salesforceConnection,
  [DatabaseServiceType.SingleStore]: singleStoreConnection,
  [DatabaseServiceType.Snowflake]: snowflakeConnection,
  [DatabaseServiceType.SQLite]: sqliteConnection,
  [DatabaseServiceType.Synapse]: synapseConnection,
  [DatabaseServiceType.Trino]: trinoConnection,
  [DatabaseServiceType.Vertica]: verticaConnection,
  [DatabaseServiceType.CustomDatabase]: customDatabaseConnection,
  [DatabaseServiceType.DomoDatabase]: domoDatabaseConnection,
  [DatabaseServiceType.SapHana]: sapHanaConnection,
  [DatabaseServiceType.SapERP]: sapErpConnection,
  [DatabaseServiceType.MongoDB]: mongoDBConnection,
  [DatabaseServiceType.Cassandra]: cassandraConnection,
  [DatabaseServiceType.Couchbase]: couchbaseConnection,
  [DatabaseServiceType.PinotDB]: pinotConnection,
  [DatabaseServiceType.Greenplum]: greenplumConnection,
  [DatabaseServiceType.UnityCatalog]: unityCatalogConnection,
  [DatabaseServiceType.SAS]: sasConnection,
  [DatabaseServiceType.Teradata]: teradataConnection,
  [DatabaseServiceType.Timescale]: timescaleConnection,
  [DatabaseServiceType.BurstIQ]: burstiqConnection,
  [DatabaseServiceType.MicrosoftFabric]: microsoftFabricConnection,
  [DatabaseServiceType.Iomete]: iometeConnection,
};

export const getDatabaseConfig = (type: DatabaseServiceType) => {
  const schema = databaseSchemaMap[type] ?? {};
  const uiSchema = { ...COMMON_UI_SCHEMA };

  return cloneDeep({ schema, uiSchema });
};
