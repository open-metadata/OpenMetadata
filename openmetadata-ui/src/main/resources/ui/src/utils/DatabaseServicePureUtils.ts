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

type SchemaModule =
  | { default: Record<string, unknown> }
  | Record<string, unknown>;
type SchemaLoader = () => Promise<SchemaModule>;

const databaseSchemaLoaders: Partial<
  Record<DatabaseServiceType, SchemaLoader>
> = {
  [DatabaseServiceType.Athena]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/athenaConnection.json'
    ),
  [DatabaseServiceType.AzureSQL]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/azureSQLConnection.json'
    ),
  [DatabaseServiceType.BigQuery]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/bigQueryConnection.json'
    ),
  [DatabaseServiceType.BigTable]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/bigTableConnection.json'
    ),
  [DatabaseServiceType.Clickhouse]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/clickhouseConnection.json'
    ),
  [DatabaseServiceType.Cockroach]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/cockroachConnection.json'
    ),
  [DatabaseServiceType.Databricks]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/databricksConnection.json'
    ),
  [DatabaseServiceType.Datalake]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/datalakeConnection.json'
    ),
  [DatabaseServiceType.Db2]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/db2Connection.json'
    ),
  [DatabaseServiceType.DeltaLake]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/deltaLakeConnection.json'
    ),
  [DatabaseServiceType.Doris]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/dorisConnection.json'
    ),
  [DatabaseServiceType.StarRocks]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/starrocksConnection.json'
    ),
  [DatabaseServiceType.Druid]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/druidConnection.json'
    ),
  [DatabaseServiceType.DynamoDB]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/dynamoDBConnection.json'
    ),
  [DatabaseServiceType.Exasol]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/exasolConnection.json'
    ),
  [DatabaseServiceType.Glue]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/glueConnection.json'
    ),
  [DatabaseServiceType.Hive]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/hiveConnection.json'
    ),
  [DatabaseServiceType.Impala]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/impalaConnection.json'
    ),
  [DatabaseServiceType.MariaDB]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/mariaDBConnection.json'
    ),
  [DatabaseServiceType.Mssql]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/mssqlConnection.json'
    ),
  [DatabaseServiceType.Mysql]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/mysqlConnection.json'
    ),
  [DatabaseServiceType.Oracle]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/oracleConnection.json'
    ),
  [DatabaseServiceType.Postgres]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/postgresConnection.json'
    ),
  [DatabaseServiceType.Presto]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/prestoConnection.json'
    ),
  [DatabaseServiceType.QuestDB]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/questdbConnection.json'
    ),
  [DatabaseServiceType.Redshift]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/redshiftConnection.json'
    ),
  [DatabaseServiceType.Salesforce]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/salesforceConnection.json'
    ),
  [DatabaseServiceType.SingleStore]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/singleStoreConnection.json'
    ),
  [DatabaseServiceType.Snowflake]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/snowflakeConnection.json'
    ),
  [DatabaseServiceType.SQLite]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/sqliteConnection.json'
    ),
  [DatabaseServiceType.Synapse]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/synapseConnection.json'
    ),
  [DatabaseServiceType.Trino]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/trinoConnection.json'
    ),
  [DatabaseServiceType.Vertica]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/verticaConnection.json'
    ),
  [DatabaseServiceType.CustomDatabase]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/customDatabaseConnection.json'
    ),
  [DatabaseServiceType.DomoDatabase]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/domoDatabaseConnection.json'
    ),
  [DatabaseServiceType.SapHana]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/sapHanaConnection.json'
    ),
  [DatabaseServiceType.SapERP]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/sapErpConnection.json'
    ),
  [DatabaseServiceType.MongoDB]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/mongoDBConnection.json'
    ),
  [DatabaseServiceType.Cassandra]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/cassandraConnection.json'
    ),
  [DatabaseServiceType.Couchbase]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/couchbaseConnection.json'
    ),
  [DatabaseServiceType.PinotDB]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/pinotDBConnection.json'
    ),
  [DatabaseServiceType.Greenplum]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/greenplumConnection.json'
    ),
  [DatabaseServiceType.UnityCatalog]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/unityCatalogConnection.json'
    ),
  [DatabaseServiceType.SAS]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/sasConnection.json'
    ),
  [DatabaseServiceType.Teradata]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/teradataConnection.json'
    ),
  [DatabaseServiceType.Timescale]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/timescaleConnection.json'
    ),
  [DatabaseServiceType.BurstIQ]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/burstIQConnection.json'
    ),
  [DatabaseServiceType.MicrosoftFabric]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/microsoftFabricConnection.json'
    ),
  [DatabaseServiceType.Iomete]: () =>
    import(
      '../jsons/connectionSchemas/connections/database/iometeConnection.json'
    ),
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
