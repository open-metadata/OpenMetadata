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
 * This schema defines the Database Service entity, such as MySQL, BigQuery, Redshift,
 * Postgres, or Snowflake. Alternative terms such as Database Cluster, Database Server
 * instance are also used for database service.
 */
export interface DatabaseService {
  /**
   * References to airflow pipelines deployed for this database service.
   */
  airflowPipelines?: EntityReference[];
  /**
   * Change that lead to this version of the entity.
   */
  changeDescription?: ChangeDescription;
  databaseConnection: DatabaseConnection;
  /**
   * When `true` indicates the entity has been soft deleted.
   */
  deleted?: boolean;
  /**
   * Description of a database service instance.
   */
  description?: string;
  /**
   * Display Name that identifies this database service.
   */
  displayName?: string;
  /**
   * Link to the resource corresponding to this database service.
   */
  href: string;
  /**
   * Unique identifier of this database service instance.
   */
  id: string;
  /**
   * Name that identifies this database service.
   */
  name: string;
  /**
   * Owner of this database service.
   */
  owner?: EntityReference;
  /**
   * Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres...
   */
  serviceType: DatabaseServiceType;
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
   * Metadata version of the entity.
   */
  version?: number;
}

/**
 * References to airflow pipelines deployed for this database service.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Owner of this database service.
 */
export interface EntityReference {
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
 * Database Connection.
 */
export interface DatabaseConnection {
  /**
   * Additional connection arguments such as security or protocol configs that can be sent to
   * service during connection.
   */
  connectionArguments?: { [key: string]: any };
  /**
   * Additional connection options that can be sent to service during the connection.
   */
  connectionOptions?: { [key: string]: any };
  /**
   * Database of the data source.
   */
  database?: string;
  /**
   * Host and port of the data source.
   */
  hostPort?: string;
  /**
   * password to connect  to the data source.
   */
  password?: string;
  /**
   * username to connect  to the data source.
   */
  username?: string;
}

/**
 * Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres...
 */
export enum DatabaseServiceType {
  Athena = 'Athena',
  AzureSQL = 'AzureSQL',
  BigQuery = 'BigQuery',
  ClickHouse = 'ClickHouse',
  Databricks = 'Databricks',
  Db2 = 'Db2',
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
  SingleStore = 'SingleStore',
  Snowflake = 'Snowflake',
  Trino = 'Trino',
  Vertica = 'Vertica',
}
