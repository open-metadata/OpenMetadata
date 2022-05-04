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
 * Ingestion Pipeline Config is used to setup a Airflow DAG.
 */
export interface CreateIngestionPipeline {
  airflowConfig: AirflowConfig;
  /**
   * Description of the pipeline.
   */
  description?: string;
  /**
   * Display Name that identifies this pipeline.
   */
  displayName?: string;
  /**
   * Set the logging level for the workflow.
   */
  loggerLevel?: LogLevels;
  /**
   * Name that identifies this pipeline instance uniquely.
   */
  name: string;
  /**
   * Owner of this Pipeline.
   */
  owner?: EntityReference;
  pipelineType: PipelineType;
  /**
   * Link to the database service where this database is hosted in.
   */
  service: EntityReference;
  sourceConfig: SourceConfig;
}

/**
 * Properties to configure the Airflow pipeline that will run the workflow.
 */
export interface AirflowConfig {
  /**
   * Concurrency of the Pipeline.
   */
  concurrency?: number;
  /**
   * Email to notify workflow status.
   */
  email?: string;
  /**
   * End Date of the pipeline.
   */
  endDate?: Date;
  /**
   * Deploy the pipeline by overwriting existing pipeline with the same name.
   */
  forceDeploy?: boolean;
  /**
   * Maximum Number of active runs.
   */
  maxActiveRuns?: number;
  /**
   * pause the pipeline from running once the deploy is finished successfully.
   */
  pausePipeline?: boolean;
  /**
   * Run past executions if the start date is in the past.
   */
  pipelineCatchup?: boolean;
  /**
   * Timezone in which pipeline going to be scheduled.
   */
  pipelineTimezone?: string;
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
   * Start date of the pipeline.
   */
  startDate: Date;
  /**
   * Default view in Airflow.
   */
  workflowDefaultView?: string;
  /**
   * Default view Orientation in Airflow.
   */
  workflowDefaultViewOrientation?: string;
  /**
   * Timeout for the workflow in seconds.
   */
  workflowTimeout?: number;
}

/**
 * Set the logging level for the workflow.
 *
 * Supported logging levels
 */
export enum LogLevels {
  Debug = 'DEBUG',
  Error = 'ERROR',
  Info = 'INFO',
  Warn = 'WARN',
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
   * Fully qualified name of the entity instance. For entities such as tables, databases
   * fullyQualifiedName is returned in this field. For entities that don't have name hierarchy
   * such as `user` and `team` this will be same as the `name` field.
   */
  fullyQualifiedName?: string;
  /**
   * Link to the entity resource.
   */
  href?: string;
  /**
   * Unique identifier that identifies an entity instance.
   */
  id: string;
  /**
   * Name of the entity instance.
   */
  name?: string;
  /**
   * Entity type/class name - Examples: `database`, `table`, `metrics`, `databaseService`,
   * `dashboardService`...
   */
  type: string;
}

/**
 * Type of Pipeline - metadata, usage
 */
export enum PipelineType {
  Metadata = 'metadata',
  Profiler = 'profiler',
  Usage = 'usage',
}

/**
 * Additional connection configuration.
 */
export interface SourceConfig {
  config?: any[] | boolean | ConfigClass | number | null | string;
}

export interface ConfigClass {
  /**
   * Available sources to fetch DBT catalog and manifest files.
   */
  dbtConfigSource?: any[] | boolean | number | null | DbtConfigSource | string;
  /**
   * Run data profiler as part of this metadata ingestion to get table profile data.
   */
  enableDataProfiler?: boolean;
  /**
   * Option to turn on/off generating sample data during metadata extraction.
   */
  generateSampleData?: boolean;
  /**
   * Optional configuration to turn off fetching metadata for tables.
   */
  includeTables?: boolean;
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
   * Pipeline type
   */
  type?: ConfigType;
  /**
   * Configuration to tune how far we want to look back in query logs to process usage data.
   */
  queryLogDuration?: number;
  /**
   * Configuration to set the limit for query logs
   */
  resultLimit?: number;
  /**
   * Temporary file name to store the query logs before processing. Absolute file path
   * required.
   */
  stageFileLocation?: string;
  /**
   * Regex exclude tables or databases that matches the pattern.
   */
  chartFilterPattern?: FilterPattern;
  /**
   * Regex to only fetch tables or databases that matches the pattern.
   */
  dashboardFilterPattern?: FilterPattern;
  /**
   * Regex to only fetch topics that matches the pattern.
   */
  topicFilterPattern?: FilterPattern;
  /**
   * Regex to only fetch tables with FQN matching the pattern.
   */
  fqnFilterPattern?: FilterPattern;
}

/**
 * Regex to only fetch tables or databases that matches the pattern.
 *
 * Regex to only fetch dashboards or charts that matches the pattern.
 *
 * Regex exclude tables or databases that matches the pattern.
 *
 * Regex to only fetch topics that matches the pattern.
 *
 * Regex to only fetch tables with FQN matching the pattern.
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

/**
 * DBT Catalog and Manifest file path config.
 *
 * DBT Catalog and Manifest HTTP path configuration.
 */
export interface DbtConfigSource {
  /**
   * DBT catalog file path to extract dbt models with their column schemas.
   */
  dbtCatalogFilePath?: string;
  /**
   * DBT manifest file path to extract dbt models and associate with tables.
   */
  dbtManifestFilePath?: string;
  /**
   * DBT catalog http file path to extract dbt models with their column schemas.
   */
  dbtCatalogHttpPath?: string;
  /**
   * DBT manifest http file path to extract dbt models and associate with tables.
   */
  dbtManifestHttpPath?: string;
  dbtSecurityConfig?: SCredentials;
}

/**
 * AWS credentials configs.
 *
 * GCS credentials configs.
 */
export interface SCredentials {
  /**
   * AWS Access key ID.
   */
  awsAccessKeyId?: string;
  /**
   * AWS Region
   */
  awsRegion?: string;
  /**
   * AWS Secret Access Key.
   */
  awsSecretAccessKey?: string;
  /**
   * AWS Session Token.
   */
  awsSessionToken?: string;
  /**
   * EndPoint URL for the AWS
   */
  endPointURL?: string;
  /**
   * GCS configs.
   */
  gcsConfig?: GCSCredentialsValues | string;
}

/**
 * GCS Credentials.
 */
export interface GCSCredentialsValues {
  /**
   * Google Cloud auth provider certificate.
   */
  authProviderX509CertUrl?: string;
  /**
   * Google Cloud auth uri.
   */
  authUri?: string;
  /**
   * Google Cloud email.
   */
  clientEmail?: string;
  /**
   * Google Cloud Client ID.
   */
  clientId?: string;
  /**
   * Google Cloud client certificate uri.
   */
  clientX509CertUrl?: string;
  /**
   * Google Cloud private key.
   */
  privateKey?: string;
  /**
   * Google Cloud private key id.
   */
  privateKeyId?: string;
  /**
   * Google Cloud project id.
   */
  projectId?: string;
  /**
   * Google Cloud token uri.
   */
  tokenUri?: string;
  /**
   * Google Cloud service account type.
   */
  type?: string;
}

/**
 * Pipeline type
 *
 * Database Source Config Metadata Pipeline type
 *
 * Database Source Config Usage Pipeline type
 *
 * Dashboard Source Config Metadata Pipeline type
 *
 * Messaging Source Config Metadata Pipeline type
 *
 * Profiler Source Config Pipeline type
 */
export enum ConfigType {
  DashboardMetadata = 'DashboardMetadata',
  DatabaseMetadata = 'DatabaseMetadata',
  DatabaseUsage = 'DatabaseUsage',
  MessagingMetadata = 'MessagingMetadata',
  Profiler = 'Profiler',
}
