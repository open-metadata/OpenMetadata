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
 * Airflow Pipeline is used to setup a DAG and deploy. This entity is used to setup
 * metadata/quality pipelines on Apache Airflow.
 */
export interface AirflowPipeline {
  /**
   * Change that led to this version of the entity.
   */
  changeDescription?: ChangeDescription;
  /**
   * Concurrency of the Pipeline.
   */
  concurrency?: number;
  /**
   * When `true` indicates the entity has been soft deleted.
   */
  deleted?: boolean;
  /**
   * Description of the Pipeline.
   */
  description?: string;
  /**
   * Display Name that identifies this Pipeline.
   */
  displayName?: string;
  /**
   * End Date of the pipeline.
   */
  endDate?: Date;
  /**
   * Deploy the pipeline by overwriting existing pipeline with the same name.
   */
  forceDeploy?: boolean;
  /**
   * Name that uniquely identifies a Pipeline.
   */
  fullyQualifiedName?: string;
  /**
   * Link to this pipeline resource.
   */
  href?: string;
  /**
   * Unique identifier that identifies this pipeline.
   */
  id?: string;
  /**
   * Name that identifies this pipeline instance uniquely.
   */
  name: string;
  /**
   * Next execution date from the underlying pipeline platform once the pipeline scheduled.
   */
  nextExecutionDate?: Date;
  /**
   * Owner of this Pipeline.
   */
  owner?: EntityReference;
  /**
   * pause the pipeline from running once the deploy is finished successfully.
   */
  pausePipeline?: boolean;
  /**
   * Run past executions if the start date is in the past.
   */
  pipelineCatchup?: boolean;
  pipelineConfig: PipelineConfig;
  /**
   * List of executions and status for the Pipeline.
   */
  pipelineStatuses?: PipelineStatus[];
  /**
   * Timeout for the pipeline in seconds.
   */
  pipelineTimeout?: number;
  /**
   * Timezone in which pipeline going to be scheduled.
   */
  pipelineTimezone?: string;
  pipelineType: PipelineType;
  /**
   * Retry pipeline in case of failure.
   */
  retries?: number;
  /**
   * Delay between retries in seconds.
   */
  retryDelay?: number;
  /**
   * Scheduler Interval for the pipeline in cron format.
   */
  scheduleInterval?: string;
  /**
   * Link to the database service where this database is hosted in.
   */
  service: EntityReference;
  /**
   * Start date of the pipeline.
   */
  startDate: Date;
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
 * Change that led to this version of the entity.
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
 * Owner of this Pipeline.
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
   * Entity type/class name - Examples: `database`, `table`, `metrics`, `databaseService`,
   * `dashboardService`...
   */
  type: string;
}

/**
 * OpenMetadata Pipeline Config.
 */
export interface PipelineConfig {
  config?: any[] | boolean | ConfigClass | number | null | string;
  schema?: Schema;
}

export interface ConfigClass {
  /**
   * Sample data extraction query.
   */
  account?: string;
  /**
   * DBT catalog file to extract dbt models with their column schemas.
   */
  dbtCatalogFilePath?: string;
  /**
   * DBT manifest file path to extract dbt models and associate with tables.
   */
  dbtManifestFilePath?: string;
  /**
   * Run data profiler as part of this metadata ingestion to get table profile data.
   */
  enableDataProfiler?: boolean;
  /**
   * Option to turn on/off generating sample data during metadata extraction.
   */
  generateSampleData?: boolean;
  /**
   * Optional configuration to turn off fetching metadata for views.
   */
  includeViews?: boolean;
  /**
   * Optional configuration to soft delete tables in OpenMetadata if the source tables are
   * deleted.
   */
  markDeletedTables?: boolean;
  /**
   * Sample data extraction query.
   */
  sampleDataQuery?: string;
  /**
   * Regex to only fetch tables or databases that matches the pattern.
   */
  schemaFilterPattern?: FilterPattern;
  /**
   * Regex exclude tables or databases that matches the pattern.
   */
  tableFilterPattern?: FilterPattern;
  /**
   * Sample data extraction query.
   */
  warehouse?: string;
  /**
   * Configuration to tune how far we want to look back in query logs to process usage data.
   */
  queryLogDuration?: number;
  /**
   * Temporary file name to store the query logs before processing. Absolute file path
   * required.
   */
  stageFileLocation?: string;
}

/**
 * Regex to only fetch tables or databases that matches the pattern.
 *
 * Regex exclude tables or databases that matches the pattern.
 */
export interface FilterPattern {
  /**
   * List of strings/regex patterns to match and exclude only database entities that match.
   */
  excludes?: string[];
  /**
   * List of strings/regex patterns to match and include only database entities that match.
   */
  includes?: string[];
}

export enum Schema {
  DatabaseServiceMetadataPipeline = 'databaseServiceMetadataPipeline',
  DatabaseServiceQueryUsagePipeline = 'databaseServiceQueryUsagePipeline',
}

/**
 * This defines the runtime status of Pipeline.
 */
export interface PipelineStatus {
  /**
   * endDate of the pipeline run for this particular execution.
   */
  endDate?: string;
  /**
   * startDate of the Pipeline run for this particular execution.
   */
  startDate?: string;
  /**
   * Pipeline status denotes if its failed or succeeded.
   */
  state?: string;
}

/**
 * Type of Pipeline - metadata, query-usage
 */
export enum PipelineType {
  Metadata = 'metadata',
  QueryUsage = 'queryUsage',
}
