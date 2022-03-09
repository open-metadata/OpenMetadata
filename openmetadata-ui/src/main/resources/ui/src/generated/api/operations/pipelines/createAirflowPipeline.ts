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
 * Pipeline Config is used to setup a Airflow DAG.
 */
export interface CreateAirflowPipeline {
  /**
   * Concurrency of the Pipeline.
   */
  concurrency?: number;
  /**
   * Description of the pipeline.
   */
  description?: string;
  /**
   * Display Name that identifies this pipeline.
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
   * Name that identifies this pipeline instance uniquely.
   */
  name: string;
  /**
   * Owner of this Pipeline.
   */
  owner?: EntityReference;
  /**
   * pause the pipeline from running once the deploy is finished successfully.
   */
  pausePipeline?: boolean;
  /**
   * pipeline catchup for past executions.
   */
  pipelineCatchup?: boolean;
  pipelineConfig: PipelineConfig;
  /**
   * Timeout for the pipeline in seconds.
   */
  pipelineTimeout?: number;
  /**
   * Timezone in which pipeline going to be scheduled.
   */
  pipelineTimezone?: string;
  pipelineType?: PipelineType;
  /**
   * Retry pipeline in case of failure
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
 * Type of Pipeline - metadata, query-usage
 */
export enum PipelineType {
  Metadata = 'metadata',
  QueryUsage = 'queryUsage',
}
