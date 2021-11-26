/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Ingestion Config is used to setup a Airflow Ingestion pipeline.
 */
export interface CreateIngestion {
  /**
   * Concurrency of the Pipeline.
   */
  concurrency?: number;
  connectorConfig: ConnectorConfig;
  /**
   * Description of the workflow.
   */
  description?: string;
  /**
   * Display Name that identifies this Ingestion.
   */
  displayName?: string;
  /**
   * End Date of the workflow.
   */
  endDate?: Date;
  /**
   * Deploy the workflow by overwriting existing workflow with the same name.
   */
  forceDeploy?: boolean;
  ingestionType?: IngestionType;
  /**
   * Name that identifies this ingestion instance uniquely.
   */
  name: string;
  /**
   * Owner of this Ingestion.
   */
  owner?: EntityReference;
  /**
   * pause the workflow from running once the deploy is finished successfully.
   */
  pauseWorkflow?: boolean;
  /**
   * Retry workflow in case of failure
   */
  retries?: number;
  /**
   * Delay between retries in seconds.
   */
  retryDelay?: number;
  /**
   * Scheduler Interval for the Workflow in cron format.
   */
  scheduleInterval?: string;
  /**
   * Link to the database service where this database is hosted in.
   */
  service: EntityReference;
  /**
   * Start date of the workflow.
   */
  startDate: Date;
  /**
   * Tags associated with the Ingestion.
   */
  tags?: TagLabel[];
  /**
   * Workflow catchup for past executions.
   */
  workflowCatchup?: boolean;
  /**
   * Timeout for the workflow in seconds.
   */
  workflowTimeout?: number;
  /**
   * Timezone in which workflow going to be scheduled.
   */
  workflowTimezone?: string;
}

/**
 * This defines the configuration for connector.
 */
export interface ConnectorConfig {
  /**
   * Database of the data source.
   */
  database?: string;
  /**
   * Run data profiler as part of ingestion to get table profile data.
   */
  enableDataProfiler?: boolean;
  /**
   * Regex exclude tables or databases that matches the pattern.
   */
  excludeFilterPattern?:
    | string[]
    | boolean
    | number
    | number
    | { [key: string]: any }
    | null
    | string;
  /**
   * Host and port of the data source.
   */
  host?: string;
  /**
   * Regex to only fetch tables or databases that matches the pattern.
   */
  includeFilterPattern?: string[];
  /**
   * optional configuration to turn off fetching metadata for views.
   */
  includeViews?: boolean;
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
 * Type of Ingestion - Bigquery, Redshift, Snowflake etc...
 */
export enum IngestionType {
  Bigquery = 'bigquery',
  BigqueryUsage = 'bigquery-usage',
  Hive = 'hive',
  Mssql = 'mssql',
  Mysql = 'mysql',
  Postgres = 'postgres',
  Redshift = 'redshift',
  RedshiftUsage = 'redshift-usage',
  Snowflake = 'snowflake',
  SnowflakeUsage = 'snowflake-usage',
  Trino = 'trino',
  Vertica = 'vertica',
}

/**
 * Owner of this Ingestion.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Link to the database service where this database is hosted in.
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
   * Entity type/class name - Examples: `database`, `table`, `metrics`, `redshift`, `mysql`,
   * `bigquery`, `snowflake`...
   */
  type: string;
}

/**
 * This schema defines the type for labeling an entity with a Tag.
 */
export interface TagLabel {
  /**
   * Unique name of the tag category.
   */
  description?: string;
  /**
   * Link to the tag resource.
   */
  href?: string;
  /**
   * Label type describes how a tag label was applied. 'Manual' indicates the tag label was
   * applied by a person. 'Derived' indicates a tag label was derived using the associated tag
   * relationship (see TagCategory.json for more details). 'Propagated` indicates a tag label
   * was propagated from upstream based on lineage. 'Automated' is used when a tool was used
   * to determine the tag label.
   */
  labelType: LabelType;
  /**
   * 'Suggested' state is used when a tag label is suggested by users or tools. Owner of the
   * entity must confirm the suggested labels before it is marked as 'Confirmed'.
   */
  state: State;
  tagFQN: string;
}

/**
 * Label type describes how a tag label was applied. 'Manual' indicates the tag label was
 * applied by a person. 'Derived' indicates a tag label was derived using the associated tag
 * relationship (see TagCategory.json for more details). 'Propagated` indicates a tag label
 * was propagated from upstream based on lineage. 'Automated' is used when a tool was used
 * to determine the tag label.
 */
export enum LabelType {
  Automated = 'Automated',
  Derived = 'Derived',
  Manual = 'Manual',
  Propagated = 'Propagated',
}

/**
 * 'Suggested' state is used when a tag label is suggested by users or tools. Owner of the
 * entity must confirm the suggested labels before it is marked as 'Confirmed'.
 */
export enum State {
  Confirmed = 'Confirmed',
  Suggested = 'Suggested',
}
