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
import { loadConnectionSchema } from './loadConnectionSchema';

type SchemaModule =
  | { default: Record<string, unknown> }
  | Record<string, unknown>;
type SchemaLoader = () => Promise<SchemaModule>;

const databaseSchemaLoaders: Partial<
  Record<DatabaseServiceType, SchemaLoader>
> = {
  [DatabaseServiceType.Athena]: () =>
    loadConnectionSchema('connections/database/athenaConnection.json'),
  [DatabaseServiceType.AzureSQL]: () =>
    loadConnectionSchema('connections/database/azureSQLConnection.json'),
  [DatabaseServiceType.BigQuery]: () =>
    loadConnectionSchema('connections/database/bigQueryConnection.json'),
  [DatabaseServiceType.BigTable]: () =>
    loadConnectionSchema('connections/database/bigTableConnection.json'),
  [DatabaseServiceType.Clickhouse]: () =>
    loadConnectionSchema('connections/database/clickhouseConnection.json'),
  [DatabaseServiceType.Clickzetta]: () =>
    loadConnectionSchema('connections/database/clickzettaConnection.json'),
  [DatabaseServiceType.Cockroach]: () =>
    loadConnectionSchema('connections/database/cockroachConnection.json'),
  [DatabaseServiceType.Databricks]: () =>
    loadConnectionSchema('connections/database/databricksConnection.json'),
  [DatabaseServiceType.Datalake]: () =>
    loadConnectionSchema('connections/database/datalakeConnection.json'),
  [DatabaseServiceType.Db2]: () =>
    loadConnectionSchema('connections/database/db2Connection.json'),
  [DatabaseServiceType.DeltaLake]: () =>
    loadConnectionSchema('connections/database/deltaLakeConnection.json'),
  [DatabaseServiceType.Doris]: () =>
    loadConnectionSchema('connections/database/dorisConnection.json'),
  [DatabaseServiceType.StarRocks]: () =>
    loadConnectionSchema('connections/database/starrocksConnection.json'),
  [DatabaseServiceType.Druid]: () =>
    loadConnectionSchema('connections/database/druidConnection.json'),
  [DatabaseServiceType.DynamoDB]: () =>
    loadConnectionSchema('connections/database/dynamoDBConnection.json'),
  [DatabaseServiceType.Exasol]: () =>
    loadConnectionSchema('connections/database/exasolConnection.json'),
  [DatabaseServiceType.Glue]: () =>
    loadConnectionSchema('connections/database/glueConnection.json'),
  [DatabaseServiceType.Hive]: () =>
    loadConnectionSchema('connections/database/hiveConnection.json'),
  [DatabaseServiceType.Impala]: () =>
    loadConnectionSchema('connections/database/impalaConnection.json'),
  [DatabaseServiceType.MariaDB]: () =>
    loadConnectionSchema('connections/database/mariaDBConnection.json'),
  [DatabaseServiceType.Mssql]: () =>
    loadConnectionSchema('connections/database/mssqlConnection.json'),
  [DatabaseServiceType.Mysql]: () =>
    loadConnectionSchema('connections/database/mysqlConnection.json'),
  [DatabaseServiceType.Oracle]: () =>
    loadConnectionSchema('connections/database/oracleConnection.json'),
  [DatabaseServiceType.Postgres]: () =>
    loadConnectionSchema('connections/database/postgresConnection.json'),
  [DatabaseServiceType.Presto]: () =>
    loadConnectionSchema('connections/database/prestoConnection.json'),
  [DatabaseServiceType.QuestDB]: () =>
    loadConnectionSchema('connections/database/questdbConnection.json'),
  [DatabaseServiceType.Redshift]: () =>
    loadConnectionSchema('connections/database/redshiftConnection.json'),
  [DatabaseServiceType.Salesforce]: () =>
    loadConnectionSchema('connections/database/salesforceConnection.json'),
  [DatabaseServiceType.SingleStore]: () =>
    loadConnectionSchema('connections/database/singleStoreConnection.json'),
  [DatabaseServiceType.Snowflake]: () =>
    loadConnectionSchema('connections/database/snowflakeConnection.json'),
  [DatabaseServiceType.SQLite]: () =>
    loadConnectionSchema('connections/database/sqliteConnection.json'),
  [DatabaseServiceType.Synapse]: () =>
    loadConnectionSchema('connections/database/synapseConnection.json'),
  [DatabaseServiceType.Trino]: () =>
    loadConnectionSchema('connections/database/trinoConnection.json'),
  [DatabaseServiceType.Vertica]: () =>
    loadConnectionSchema('connections/database/verticaConnection.json'),
  [DatabaseServiceType.CustomDatabase]: () =>
    loadConnectionSchema('connections/database/customDatabaseConnection.json'),
  [DatabaseServiceType.DomoDatabase]: () =>
    loadConnectionSchema('connections/database/domoDatabaseConnection.json'),
  [DatabaseServiceType.SapHana]: () =>
    loadConnectionSchema('connections/database/sapHanaConnection.json'),
  [DatabaseServiceType.SapERP]: () =>
    loadConnectionSchema('connections/database/sapErpConnection.json'),
  [DatabaseServiceType.MongoDB]: () =>
    loadConnectionSchema('connections/database/mongoDBConnection.json'),
  [DatabaseServiceType.Cassandra]: () =>
    loadConnectionSchema('connections/database/cassandraConnection.json'),
  [DatabaseServiceType.Couchbase]: () =>
    loadConnectionSchema('connections/database/couchbaseConnection.json'),
  [DatabaseServiceType.PinotDB]: () =>
    loadConnectionSchema('connections/database/pinotDBConnection.json'),
  [DatabaseServiceType.Greenplum]: () =>
    loadConnectionSchema('connections/database/greenplumConnection.json'),
  [DatabaseServiceType.UnityCatalog]: () =>
    loadConnectionSchema('connections/database/unityCatalogConnection.json'),
  [DatabaseServiceType.SAS]: () =>
    loadConnectionSchema('connections/database/sasConnection.json'),
  [DatabaseServiceType.Teradata]: () =>
    loadConnectionSchema('connections/database/teradataConnection.json'),
  [DatabaseServiceType.Timescale]: () =>
    loadConnectionSchema('connections/database/timescaleConnection.json'),
  [DatabaseServiceType.BurstIQ]: () =>
    loadConnectionSchema('connections/database/burstIQConnection.json'),
  [DatabaseServiceType.MicrosoftFabric]: () =>
    loadConnectionSchema('connections/database/microsoftFabricConnection.json'),
  [DatabaseServiceType.Iomete]: () =>
    loadConnectionSchema('connections/database/iometeConnection.json'),
};

const resolveSchemaModule = (mod: SchemaModule): Record<string, unknown> => {
  const maybeDefault = (mod as { default?: Record<string, unknown> }).default;

  return maybeDefault ?? (mod as Record<string, unknown>);
};

export const getDatabaseConfig = async (type: DatabaseServiceType) => {
  const loader = databaseSchemaLoaders[type];
  let schema: Record<string, unknown> = {};
  const uiSchema = { ...COMMON_UI_SCHEMA };

  if (loader) {
    const mod = await loader();
    schema = resolveSchemaModule(mod);
  }

  return cloneDeep({ schema, uiSchema });
};
