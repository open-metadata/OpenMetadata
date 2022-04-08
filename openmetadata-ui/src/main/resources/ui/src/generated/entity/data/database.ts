/* eslint-disable @typescript-eslint/no-explicit-any */
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

/**
 * This schema defines the Database entity. A database also referred to as Database Catalog
 * is a collection of schemas.
 */
export interface Database {
  /**
   * Change that lead to this version of the entity.
   */
  changeDescription?: ChangeDescription;
  /**
   * References to schemas in the database.
   */
  databaseSchemas?: EntityReference[];
  /**
   * Some databases don't support a database/catalog in the hierarchy and use default
   * database. For example, `MySql`. For such databases, set this flag to true to indicate
   * that this is a default database.
   */
  default?: boolean;
  /**
   * When `true` indicates the entity has been soft deleted.
   */
  deleted?: boolean;
  /**
   * Description of the database instance.
   */
  description?: string;
  /**
   * Display Name that identifies this database.
   */
  displayName?: string;
  /**
   * Name that uniquely identifies a database in the format 'ServiceName.DatabaseName'.
   */
  fullyQualifiedName?: string;
  /**
   * Link to the resource corresponding to this entity.
   */
  href?: string;
  /**
   * Unique identifier that identifies this database instance.
   */
  id?: string;
  /**
   * Reference to the Location that contains this database.
   */
  location?: EntityReference;
  /**
   * Name that identifies the database.
   */
  name: string;
  /**
   * Owner of this database.
   */
  owner?: EntityReference;
  /**
   * Link to the database cluster/service where this database is hosted in.
   */
  service: EntityReference;
  /**
   * Service type where this database is hosted in.
   */
  serviceType?: DatabaseServiceType;
  /**
   * Last update time corresponding to the new version of the entity in Unix epoch time
   * milliseconds.
   */
  updatedAt?: number;
  /**
   * User who made the update.
   */
  updatedBy?: string;
  /**
   * Latest usage information for this database.
   */
  usageSummary?: TypeUsedToReturnUsageDetailsOfAnEntity;
  /**
   * Metadata version of the entity.
   */
  version?: number;
}

/**
 * Change that lead to this version of the entity.
 *
 * Description of the change.
 */
export interface ChangeDescription {
  /**
   * Names of fields added during the version changes.
   */
  fieldsAdded?: FieldChange[];
  /**
   * Fields deleted during the version changes with old value before deleted.
   */
  fieldsDeleted?: FieldChange[];
  /**
   * Fields modified during the version changes with old and new values.
   */
  fieldsUpdated?: FieldChange[];
  /**
   * When a change did not result in change, this could be same as the current version.
   */
  previousVersion?: number;
}

export interface FieldChange {
  /**
   * Name of the entity field that changed.
   */
  name?: string;
  /**
   * New value of the field. Note that this is a JSON string and use the corresponding field
   * type to deserialize it.
   */
  newValue?: any;
  /**
   * Previous value of the field. Note that this is a JSON string and use the corresponding
   * field type to deserialize it.
   */
  oldValue?: any;
}

/**
 * References to schemas in the database.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Reference to the Location that contains this database.
 *
 * Owner of this database.
 *
 * Link to the database cluster/service where this database is hosted in.
 */
export interface EntityReference {
  /**
   * If true the entity referred to has been soft-deleted.
   */
  deleted?: boolean;
  /**
   * Optional description of entity.
   */
  description?: string;
  /**
   * Display Name that identifies this entity.
   */
  displayName?: string;
  /**
   * Link to the entity resource.
   */
  href?: string;
  /**
   * Unique identifier that identifies an entity instance.
   */
  id: string;
  /**
   * Name of the entity instance. For entities such as tables, databases where the name is not
   * unique, fullyQualifiedName is returned in this field.
   */
  name?: string;
  /**
   * Entity type/class name - Examples: `database`, `table`, `metrics`, `databaseService`,
   * `dashboardService`...
   */
  type: string;
}

/**
 * Service type where this database is hosted in.
 *
 * Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres...
 */
export enum DatabaseServiceType {
  Athena = 'Athena',
  AzureSQL = 'AzureSQL',
  BigQuery = 'BigQuery',
  ClickHouse = 'ClickHouse',
  Databricks = 'Databricks',
  Db2 = 'Db2',
  DeltaLake = 'DeltaLake',
  Druid = 'Druid',
  DynamoDB = 'DynamoDB',
  Glue = 'Glue',
  Hive = 'Hive',
  MariaDB = 'MariaDB',
  Mssql = 'MSSQL',
  MySQL = 'MySQL',
  Oracle = 'Oracle',
  Postgres = 'Postgres',
  Presto = 'Presto',
  Redshift = 'Redshift',
  SQLite = 'SQLite',
  Salesforce = 'Salesforce',
  SingleStore = 'SingleStore',
  Snowflake = 'Snowflake',
  Trino = 'Trino',
  Vertica = 'Vertica',
}

/**
 * Latest usage information for this database.
 *
 * This schema defines the type for usage details. Daily, weekly, and monthly aggregation of
 * usage is computed along with the percentile rank based on the usage for a given day.
 */
export interface TypeUsedToReturnUsageDetailsOfAnEntity {
  /**
   * Daily usage stats of a data asset on the start date.
   */
  dailyStats: UsageStats;
  /**
   * Date in UTC.
   */
  date: Date;
  /**
   * Monthly (last 30 days) rolling usage stats of a data asset on the start date.
   */
  monthlyStats?: UsageStats;
  /**
   * Weekly (last 7 days) rolling usage stats of a data asset on the start date.
   */
  weeklyStats?: UsageStats;
}

/**
 * Daily usage stats of a data asset on the start date.
 *
 * Type used to return usage statistics.
 *
 * Monthly (last 30 days) rolling usage stats of a data asset on the start date.
 *
 * Weekly (last 7 days) rolling usage stats of a data asset on the start date.
 */
export interface UsageStats {
  /**
   * Usage count of a data asset on the start date.
   */
  count: number;
  /**
   * Optional daily percentile rank data asset use when relevant.
   */
  percentileRank?: number;
}
