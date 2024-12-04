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
 * Ingestion Pipeline Config is used to set up a DAG and deploy. This entity is used to
 * setup metadata/quality pipelines on Apache Airflow.
 */
export interface IngestionPipeline {
    airflowConfig: AirflowConfig;
    /**
     * Type of the application when pipelineType is 'application'.
     */
    applicationType?: string;
    /**
     * Change that led to this version of the entity.
     */
    changeDescription?: ChangeDescription;
    /**
     * When `true` indicates the entity has been soft deleted.
     */
    deleted?: boolean;
    /**
     * Indicates if the workflow has been successfully deployed to Airflow.
     */
    deployed?: boolean;
    /**
     * Description of the Pipeline.
     */
    description?: string;
    /**
     * Display Name that identifies this Pipeline.
     */
    displayName?: string;
    /**
     * Domain the asset belongs to. When not set, the asset inherits the domain from the parent
     * it belongs to.
     */
    domain?: EntityReference;
    /**
     * True if the pipeline is ready to be run in the next schedule. False if it is paused.
     */
    enabled?: boolean;
    /**
     * Name that uniquely identifies a Pipeline.
     */
    fullyQualifiedName?: string;
    /**
     * Link to this ingestion pipeline resource.
     */
    href?: string;
    /**
     * Unique identifier that identifies this pipeline.
     */
    id?: string;
    /**
     * Set the logging level for the workflow.
     */
    loggerLevel?: LogLevels;
    /**
     * Name that identifies this pipeline instance uniquely.
     */
    name:                          string;
    openMetadataServerConnection?: OpenMetadataConnection;
    /**
     * Owners of this Pipeline.
     */
    owners?: EntityReference[];
    /**
     * Last of executions and status for the Pipeline.
     */
    pipelineStatuses?: PipelineStatus;
    pipelineType:      PipelineType;
    provider?:         ProviderType;
    /**
     * Link to the service (such as database, messaging, storage services, etc. for which this
     * ingestion pipeline ingests the metadata from.
     */
    service?:     EntityReference;
    sourceConfig: SourceConfig;
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
    startDate?: Date;
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
 * Domain the asset belongs to. When not set, the asset inherits the domain from the parent
 * it belongs to.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Owners of this Pipeline.
 *
 * This schema defines the EntityReferenceList type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Link to the service (such as database, messaging, storage services, etc. for which this
 * ingestion pipeline ingests the metadata from.
 *
 * Domain to apply
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
     * If true the relationship indicated by this entity reference is inherited from the parent
     * entity.
     */
    inherited?: boolean;
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
 * Set the logging level for the workflow.
 *
 * Supported logging levels
 */
export enum LogLevels {
    Debug = "DEBUG",
    Error = "ERROR",
    Info = "INFO",
    Warn = "WARN",
}

/**
 * OpenMetadata Connection Config
 */
export interface OpenMetadataConnection {
    /**
     * OpenMetadata server API version to use.
     */
    apiVersion?: string;
    /**
     * OpenMetadata Server Authentication Provider.
     */
    authProvider?: AuthProvider;
    /**
     * Cluster name to differentiate OpenMetadata Server instance
     */
    clusterName?: string;
    /**
     * Configuration for Sink Component in the OpenMetadata Ingestion Framework.
     */
    elasticsSearch?: ElasticsSearch;
    /**
     * Validate Openmetadata Server & Client Version.
     */
    enableVersionValidation?: boolean;
    extraHeaders?:            { [key: string]: string };
    /**
     * Force the overwriting of any entity during the ingestion.
     */
    forceEntityOverwriting?: boolean;
    /**
     * OpenMetadata Server Config. Must include API end point ex: http://localhost:8585/api
     */
    hostPort: string;
    /**
     * Include Dashboards for Indexing
     */
    includeDashboards?: boolean;
    /**
     * Include Database Services for Indexing
     */
    includeDatabaseServices?: boolean;
    /**
     * Include Glossary Terms for Indexing
     */
    includeGlossaryTerms?: boolean;
    /**
     * Include Messaging Services for Indexing
     */
    includeMessagingServices?: boolean;
    /**
     * Include MlModels for Indexing
     */
    includeMlModels?: boolean;
    /**
     * Include Pipelines for Indexing
     */
    includePipelines?: boolean;
    /**
     * Include Pipeline Services for Indexing
     */
    includePipelineServices?: boolean;
    /**
     * Include Tags for Policy
     */
    includePolicy?: boolean;
    /**
     * Include Tables for Indexing
     */
    includeTables?: boolean;
    /**
     * Include Tags for Indexing
     */
    includeTags?: boolean;
    /**
     * Include Teams for Indexing
     */
    includeTeams?: boolean;
    /**
     * Include Topics for Indexing
     */
    includeTopics?: boolean;
    /**
     * Include Users for Indexing
     */
    includeUsers?: boolean;
    /**
     * Limit the number of records for Indexing.
     */
    limitRecords?: number;
    /**
     * Secrets Manager Loader for the Pipeline Service Client.
     */
    secretsManagerLoader?: SecretsManagerClientLoader;
    /**
     * Secrets Manager Provider for OpenMetadata Server.
     */
    secretsManagerProvider?: SecretsManagerProvider;
    /**
     * OpenMetadata Client security configuration.
     */
    securityConfig?: OpenMetadataJWTClientConfig;
    /**
     * SSL Configuration for OpenMetadata Server
     */
    sslConfig?: Config;
    /**
     * If set to true, when creating a service during the ingestion we will store its Service
     * Connection. Otherwise, the ingestion will create a bare service without connection
     * details.
     */
    storeServiceConnection?: boolean;
    /**
     * Flag to enable Data Insight Extraction
     */
    supportsDataInsightExtraction?: boolean;
    /**
     * Flag to enable ElasticSearch Reindexing Extraction
     */
    supportsElasticSearchReindexingExtraction?: boolean;
    /**
     * Service Type
     */
    type?: OpenmetadataType;
    /**
     * Flag to verify SSL Certificate for OpenMetadata Server.
     */
    verifySSL?: VerifySSL;
}

/**
 * OpenMetadata Server Authentication Provider.
 *
 * OpenMetadata Server Authentication Provider. Make sure configure same auth providers as
 * the one configured on OpenMetadata server.
 */
export enum AuthProvider {
    Auth0 = "auth0",
    AwsCognito = "aws-cognito",
    Azure = "azure",
    Basic = "basic",
    CustomOidc = "custom-oidc",
    Google = "google",
    LDAP = "ldap",
    Okta = "okta",
    Openmetadata = "openmetadata",
    Saml = "saml",
}

/**
 * Configuration for Sink Component in the OpenMetadata Ingestion Framework.
 */
export interface ElasticsSearch {
    config?: { [key: string]: any };
    /**
     * Type of sink component ex: metadata
     */
    type: string;
}

/**
 * Secrets Manager Loader for the Pipeline Service Client.
 *
 * OpenMetadata Secrets Manager Client Loader. Lets the client know how the Secrets Manager
 * Credentials should be loaded from the environment.
 */
export enum SecretsManagerClientLoader {
    Airflow = "airflow",
    Env = "env",
    Noop = "noop",
}

/**
 * Secrets Manager Provider for OpenMetadata Server.
 *
 * OpenMetadata Secrets Manager Provider. Make sure to configure the same secrets manager
 * providers as the ones configured on the OpenMetadata server.
 */
export enum SecretsManagerProvider {
    Aws = "aws",
    AwsSsm = "aws-ssm",
    AzureKv = "azure-kv",
    DB = "db",
    Gcp = "gcp",
    InMemory = "in-memory",
    ManagedAws = "managed-aws",
    ManagedAwsSsm = "managed-aws-ssm",
    ManagedAzureKv = "managed-azure-kv",
}

/**
 * OpenMetadata Client security configuration.
 *
 * openMetadataJWTClientConfig security configs.
 */
export interface OpenMetadataJWTClientConfig {
    /**
     * OpenMetadata generated JWT token.
     */
    jwtToken: string;
}

/**
 * SSL Configuration for OpenMetadata Server
 *
 * Client SSL configuration
 *
 * OpenMetadata Client configured to validate SSL certificates.
 */
export interface Config {
    /**
     * The CA certificate used for SSL validation.
     */
    caCertificate?: string;
    /**
     * The SSL certificate used for client authentication.
     */
    sslCertificate?: string;
    /**
     * The private key associated with the SSL certificate.
     */
    sslKey?: string;
}

/**
 * Service Type
 *
 * OpenMetadata service type
 */
export enum OpenmetadataType {
    OpenMetadata = "OpenMetadata",
}

/**
 * Flag to verify SSL Certificate for OpenMetadata Server.
 *
 * Client SSL verification. Make sure to configure the SSLConfig if enabled.
 */
export enum VerifySSL {
    Ignore = "ignore",
    NoSSL = "no-ssl",
    Validate = "validate",
}

/**
 * Last of executions and status for the Pipeline.
 *
 * This defines runtime status of Pipeline.
 */
export interface PipelineStatus {
    /**
     * endDate of the pipeline run for this particular execution.
     */
    endDate?: number;
    /**
     * Pipeline status denotes if its failed or succeeded.
     */
    pipelineState?: PipelineState;
    /**
     * Pipeline unique run ID.
     */
    runId?: string;
    /**
     * startDate of the pipeline run for this particular execution.
     */
    startDate?: number;
    /**
     * Ingestion Pipeline summary status. Informed at the end of the execution.
     */
    status?: StepSummary[];
    /**
     * executionDate of the pipeline run for this particular execution.
     */
    timestamp?: number;
}

/**
 * Pipeline status denotes if its failed or succeeded.
 */
export enum PipelineState {
    Failed = "failed",
    PartialSuccess = "partialSuccess",
    Queued = "queued",
    Running = "running",
    Success = "success",
}

/**
 * Ingestion Pipeline summary status. Informed at the end of the execution.
 *
 * Summary for each step of the ingestion pipeline
 *
 * Defines the summary status of each step executed in an Ingestion Pipeline.
 */
export interface StepSummary {
    /**
     * Number of records with errors.
     */
    errors?: number;
    /**
     * Sample of errors encountered in the step
     */
    failures?: StackTraceError[];
    /**
     * Number of filtered records.
     */
    filtered?: number;
    /**
     * Step name
     */
    name: string;
    /**
     * Number of successfully processed records.
     */
    records?: number;
    /**
     * Number of successfully updated records.
     */
    updated_records?: number;
    /**
     * Number of records raising warnings.
     */
    warnings?: number;
}

/**
 * Represents a failure status
 */
export interface StackTraceError {
    /**
     * Error being handled
     */
    error: string;
    /**
     * Name of the asset with the error
     */
    name: string;
    /**
     * Exception stack trace
     */
    stackTrace?: string;
}

/**
 * Type of Pipeline - metadata, usage
 */
export enum PipelineType {
    Application = "application",
    AutoClassification = "autoClassification",
    DataInsight = "dataInsight",
    Dbt = "dbt",
    ElasticSearchReindex = "elasticSearchReindex",
    Lineage = "lineage",
    Metadata = "metadata",
    Profiler = "profiler",
    TestSuite = "TestSuite",
    Usage = "usage",
}

/**
 * Type of provider of an entity. Some entities are provided by the `system`. Some are
 * entities created and provided by the `user`. Typically `system` provide entities can't be
 * deleted and can only be disabled.
 */
export enum ProviderType {
    System = "system",
    User = "user",
}

/**
 * Additional connection configuration.
 */
export interface SourceConfig {
    config?: Pipeline;
}

/**
 * DatabaseService Metadata Pipeline Configuration.
 *
 * DatabaseService Query Usage Pipeline Configuration.
 *
 * DatabaseService Query Lineage Pipeline Configuration.
 *
 * DashboardService Metadata Pipeline Configuration.
 *
 * MessagingService Metadata Pipeline Configuration.
 *
 * DatabaseService Profiler Pipeline Configuration.
 *
 * DatabaseService AutoClassification & Auto Classification Pipeline Configuration.
 *
 * PipelineService Metadata Pipeline Configuration.
 *
 * MlModelService Metadata Pipeline Configuration.
 *
 * StorageService Metadata Pipeline Configuration.
 *
 * SearchService Metadata Pipeline Configuration.
 *
 * TestSuite Pipeline Configuration.
 *
 * Data Insight Pipeline Configuration.
 *
 * DBT Pipeline Configuration.
 *
 * Application Pipeline Configuration.
 *
 * ApiService Metadata Pipeline Configuration.
 */
export interface Pipeline {
    /**
     * Regex to only fetch databases that matches the pattern.
     */
    databaseFilterPattern?: FilterPattern;
    /**
     * Optional configuration to toggle the DDL Statements ingestion.
     */
    includeDDL?: boolean;
    /**
     * Set the 'Include Owners' toggle to control whether to include owners to the ingested
     * entity if the owner email matches with a user stored in the OM server as part of metadata
     * ingestion. If the ingested entity already exists and has an owner, the owner will not be
     * overwritten.
     *
     * Enabling a flag will replace the current owner with a new owner from the source during
     * metadata ingestion, if the current owner is null. It is recommended to keep the flag
     * enabled to obtain the owner information during the first metadata ingestion.
     */
    includeOwners?: boolean;
    /**
     * Optional configuration to toggle the Stored Procedures ingestion.
     */
    includeStoredProcedures?: boolean;
    /**
     * Optional configuration to turn off fetching metadata for tables.
     */
    includeTables?: boolean;
    /**
     * Optional configuration to toggle the tags ingestion.
     */
    includeTags?: boolean;
    /**
     * Optional configuration to turn off fetching metadata for views.
     */
    includeViews?: boolean;
    /**
     * Use incremental Metadata extraction after the first execution. This is commonly done by
     * getting the changes from Audit tables on the supporting databases.
     */
    incremental?: IncrementalMetadataExtractionConfiguration;
    /**
     * Optional configuration to soft delete stored procedures in OpenMetadata if the source
     * stored procedures are deleted. Also, if the stored procedures is deleted, all the
     * associated entities like lineage, etc., with that stored procedures will be deleted
     */
    markDeletedStoredProcedures?: boolean;
    /**
     * This is an optional configuration for enabling soft deletion of tables. When this option
     * is enabled, only tables that have been deleted from the source will be soft deleted, and
     * this will apply solely to the schema that is currently being ingested via the pipeline.
     * Any related entities such as test suites or lineage information that were associated with
     * those tables will also be deleted.
     */
    markDeletedTables?: boolean;
    /**
     * Set the 'Override Metadata' toggle to control whether to override the existing metadata
     * in the OpenMetadata server with the metadata fetched from the source. If the toggle is
     * set to true, the metadata fetched from the source will override the existing metadata in
     * the OpenMetadata server. If the toggle is set to false, the metadata fetched from the
     * source will not override the existing metadata in the OpenMetadata server. This is
     * applicable for fields like description, tags, owner and displayName
     */
    overrideMetadata?: boolean;
    /**
     * Configuration to tune how far we want to look back in query logs to process Stored
     * Procedures results.
     *
     * Configuration to tune how far we want to look back in query logs to process usage data.
     *
     * Configuration to tune how far we want to look back in query logs to process lineage data.
     */
    queryLogDuration?: number;
    /**
     * Configuration to set the timeout for parsing the query in seconds.
     */
    queryParsingTimeoutLimit?: number;
    /**
     * Regex to only fetch tables or databases that matches the pattern.
     */
    schemaFilterPattern?: FilterPattern;
    /**
     * Regex exclude tables or databases that matches the pattern.
     */
    tableFilterPattern?: FilterPattern;
    /**
     * Number of Threads to use in order to parallelize Table ingestion.
     *
     * Number of Threads to use in order to parallelize lineage ingestion.
     */
    threads?: number;
    /**
     * Pipeline type
     */
    type?: ConfigType;
    /**
     * Regex will be applied on fully qualified name (e.g
     * service_name.db_name.schema_name.table_name) instead of raw name (e.g. table_name)
     */
    useFqnForFiltering?: boolean;
    /**
     * Configuration the condition to filter the query history.
     */
    filterCondition?: string;
    /**
     * Configuration to set the file path for query logs
     */
    queryLogFilePath?: string;
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
     * Set the 'Override View Lineage' toggle to control whether to override the existing view
     * lineage.
     */
    overrideViewLineage?: boolean;
    /**
     * Configuration to set the timeout for parsing the query in seconds.
     */
    parsingTimeoutLimit?: number;
    /**
     * Set the 'Process Query Lineage' toggle to control whether to process query lineage.
     */
    processQueryLineage?: boolean;
    /**
     * Set the 'Process Stored ProcedureLog Lineage' toggle to control whether to process stored
     * procedure lineage.
     */
    processStoredProcedureLineage?: boolean;
    /**
     * Set the 'Process View Lineage' toggle to control whether to process view lineage.
     */
    processViewLineage?: boolean;
    /**
     * Regex exclude or include charts that matches the pattern.
     */
    chartFilterPattern?: FilterPattern;
    /**
     * Regex to exclude or include dashboards that matches the pattern.
     */
    dashboardFilterPattern?: FilterPattern;
    /**
     * Regex exclude or include data models that matches the pattern.
     */
    dataModelFilterPattern?: FilterPattern;
    /**
     * Optional configuration to toggle the ingestion of data models.
     */
    includeDataModels?: boolean;
    /**
     * Optional Configuration to include/exclude draft dashboards. By default it will include
     * draft dashboards
     */
    includeDraftDashboard?: boolean;
    /**
     * Details required to generate Lineage
     */
    lineageInformation?: LineageInformation;
    /**
     * Optional configuration to soft delete dashboards in OpenMetadata if the source dashboards
     * are deleted. Also, if the dashboard is deleted, all the associated entities like lineage,
     * etc., with that dashboard will be deleted
     */
    markDeletedDashboards?: boolean;
    /**
     * Optional configuration to soft delete data models in OpenMetadata if the source data
     * models are deleted. Also, if the data models is deleted, all the associated entities like
     * lineage, etc., with that data models will be deleted
     */
    markDeletedDataModels?: boolean;
    /**
     * Set the 'Override Lineage' toggle to control whether to override the existing lineage.
     */
    overrideLineage?: boolean;
    /**
     * Regex to exclude or include projects that matches the pattern.
     */
    projectFilterPattern?: FilterPattern;
    /**
     * Option to turn on/off generating sample data during metadata extraction.
     */
    generateSampleData?: boolean;
    /**
     * Optional configuration to soft delete topics in OpenMetadata if the source topics are
     * deleted. Also, if the topic is deleted, all the associated entities like sample data,
     * lineage, etc., with that topic will be deleted
     */
    markDeletedTopics?: boolean;
    /**
     * Regex to only fetch topics that matches the pattern.
     */
    topicFilterPattern?: FilterPattern;
    /**
     * Regex to only compute metrics for table that matches the given tag, tiers, gloassary
     * pattern.
     */
    classificationFilterPattern?: FilterPattern;
    /**
     * Option to turn on/off column metric computation. If enabled, profiler will compute column
     * level metrics.
     */
    computeColumnMetrics?: boolean;
    /**
     * Option to turn on/off computing profiler metrics.
     */
    computeMetrics?: boolean;
    /**
     * Option to turn on/off table metric computation. If enabled, profiler will compute table
     * level metrics.
     */
    computeTableMetrics?: boolean;
    /**
     * Percentage of data or no. of rows used to compute the profiler metrics and run data
     * quality tests
     *
     * Percentage of data or no. of rows we want to execute the profiler and tests on
     */
    profileSample?:     number;
    profileSampleType?: ProfileSampleType;
    /**
     * Number of sample rows to ingest when 'Generate Sample Data' is enabled
     */
    sampleDataCount?:    number;
    samplingMethodType?: SamplingMethodType;
    /**
     * Number of threads to use during metric computations
     */
    threadCount?: number;
    /**
     * Profiler Timeout in Seconds
     */
    timeoutSeconds?: number;
    /**
     * Use system tables to extract metrics. Metrics that cannot be gathered from system tables
     * will use the default methods. Using system tables can be faster but requires gathering
     * statistics before running (for example using the ANALYZE procedure). More information can
     * be found in the documentation: https://docs.openmetadata.org/latest/profler
     */
    useStatistics?: boolean;
    /**
     * Set the Confidence value for which you want the column to be tagged as PII. Confidence
     * value ranges from 0 to 100. A higher number will yield less false positives but more
     * false negatives. A lower number will yield more false positives but less false negatives.
     */
    confidence?: number;
    /**
     * Optional configuration to automatically tag columns that might contain sensitive
     * information
     */
    enableAutoClassification?: boolean;
    /**
     * Option to turn on/off storing sample data. If enabled, we will ingest sample data for
     * each table.
     */
    storeSampleData?: boolean;
    /**
     * Optional configuration to turn off fetching lineage from pipelines.
     */
    includeLineage?: boolean;
    /**
     * Optional configuration to toggle whether the un-deployed pipelines should be ingested or
     * not. If set to false, only deployed pipelines will be ingested.
     */
    includeUnDeployedPipelines?: boolean;
    /**
     * Optional configuration to soft delete Pipelines in OpenMetadata if the source Pipelines
     * are deleted. Also, if the Pipeline is deleted, all the associated entities like lineage,
     * etc., with that Pipeline will be deleted
     */
    markDeletedPipelines?: boolean;
    /**
     * Regex exclude pipelines.
     */
    pipelineFilterPattern?: FilterPattern;
    /**
     * Optional configuration to soft delete MlModels in OpenMetadata if the source MlModels are
     * deleted. Also, if the MlModel is deleted, all the associated entities like lineage, etc.,
     * with that MlModels will be deleted
     */
    markDeletedMlModels?: boolean;
    /**
     * Regex to only fetch MlModels with names matching the pattern.
     */
    mlModelFilterPattern?: FilterPattern;
    /**
     * Regex to only fetch containers that matches the pattern.
     */
    containerFilterPattern?: FilterPattern;
    /**
     * Optional configuration to soft delete containers in OpenMetadata if the source containers
     * are deleted. Also, if the topic is deleted, all the associated entities with that
     * containers will be deleted
     */
    markDeletedContainers?:       boolean;
    storageMetadataConfigSource?: StorageMetadataConfigurationSource;
    /**
     * Enable the 'Include Index Template' toggle to manage the ingestion of index template data.
     */
    includeIndexTemplate?: boolean;
    /**
     * Optional configuration to turn off fetching sample data for search index.
     */
    includeSampleData?: boolean;
    /**
     * Optional configuration to soft delete search indexes in OpenMetadata if the source search
     * indexes are deleted. Also, if the search index is deleted, all the associated entities
     * like lineage, etc., with that search index will be deleted
     */
    markDeletedSearchIndexes?: boolean;
    /**
     * No. of records of sample data we want to ingest.
     */
    sampleSize?: number;
    /**
     * Regex to only fetch search indexes that matches the pattern.
     */
    searchIndexFilterPattern?: FilterPattern;
    /**
     * Fully qualified name of the entity to be tested.
     */
    entityFullyQualifiedName?: string;
    /**
     * List of test cases to be executed on the entity. If null, all test cases will be executed.
     */
    testCases?: string[];
    /**
     * Maximum number of events entities in a batch (Default 1000).
     */
    batchSize?: number;
    /**
     * Certificate path to be added in configuration. The path should be local in the Ingestion
     * Container.
     */
    caCerts?:       string;
    recreateIndex?: boolean;
    /**
     * Region name. Required when using AWS Credentials.
     */
    regionName?: string;
    /**
     * Recreate Indexes with updated Language
     */
    searchIndexMappingLanguage?: SearchIndexMappingLanguage;
    /**
     * Connection Timeout
     */
    timeout?: number;
    /**
     * Indicates whether to use aws credentials when connecting to OpenSearch in AWS.
     */
    useAwsCredentials?: boolean;
    /**
     * Indicates whether to use SSL when connecting to ElasticSearch. By default, we will ignore
     * SSL settings.
     */
    useSSL?: boolean;
    /**
     * Indicates whether to verify certificates when using SSL connection to ElasticSearch.
     * Ignored by default. Is set to true, make sure to send the certificates in the property
     * `CA Certificates`.
     */
    verifyCerts?: boolean;
    /**
     * Custom OpenMetadata Classification name for dbt tags.
     */
    dbtClassificationName?: string;
    /**
     * Available sources to fetch DBT catalog and manifest files.
     */
    dbtConfigSource?: DBTConfigurationSource;
    /**
     * Optional configuration to update the description from DBT or not
     */
    dbtUpdateDescriptions?: boolean;
    /**
     * Application configuration
     */
    appConfig?: any[] | boolean | CollateAIAppConfig | number | null | string;
    /**
     * Application private configuration
     */
    appPrivateConfig?: PrivateConfig;
    /**
     * Source Python Class Name to run the application
     */
    sourcePythonClass?: string;
    /**
     * Regex to only fetch api collections with names matching the pattern.
     */
    apiCollectionFilterPattern?: FilterPattern;
    /**
     * Optional configuration to soft delete api collections in OpenMetadata if the source
     * collections are deleted. Also, if the collection is deleted, all the associated entities
     * like endpoints, etc., with that collection will be deleted
     */
    markDeletedApiCollections?: boolean;
}

/**
 * Regex to only fetch databases that matches the pattern.
 *
 * Regex to only fetch dashboards or charts that matches the pattern.
 *
 * Regex to only fetch tables or databases that matches the pattern.
 *
 * Regex exclude tables or databases that matches the pattern.
 *
 * Regex exclude or include charts that matches the pattern.
 *
 * Regex to exclude or include dashboards that matches the pattern.
 *
 * Regex exclude or include data models that matches the pattern.
 *
 * Regex to exclude or include projects that matches the pattern.
 *
 * Regex to only fetch topics that matches the pattern.
 *
 * Regex to only compute metrics for table that matches the given tag, tiers, gloassary
 * pattern.
 *
 * Regex exclude pipelines.
 *
 * Regex to only fetch MlModels with names matching the pattern.
 *
 * Regex to only fetch containers that matches the pattern.
 *
 * Regex to only fetch search indexes that matches the pattern.
 *
 * Regex to only fetch api collections with names matching the pattern.
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
 * Configuration for the CollateAI External Application.
 *
 * Configuration for the Automator External Application.
 *
 * No configuration needed to instantiate the Data Insights Pipeline. The logic is handled
 * in the backend.
 *
 * Search Indexing App.
 *
 * This schema defines the Slack App Token Configuration
 */
export interface CollateAIAppConfig {
    /**
     * Query filter to be passed to ES. E.g.,
     * `{"query":{"bool":{"must":[{"bool":{"should":[{"term":{"domain.displayName.keyword":"DG
     * Anim"}}]}}]}}}`. This is the same payload as in the Explore page.
     */
    filter?: string;
    /**
     * Patch the description if it is empty, instead of raising a suggestion
     */
    patchIfEmpty?: boolean;
    /**
     * Application Type
     */
    type?: Type;
    /**
     * Action to take on those entities. E.g., propagate description through lineage, auto
     * tagging, etc.
     */
    actions?: Action[];
    /**
     * Entities selected to run the automation.
     */
    resources?:             Resource;
    backfillConfiguration?: BackfillConfiguration;
    /**
     * Maximum number of events processed at a time (Default 100).
     *
     * Maximum number of events sent in a batch (Default 100).
     */
    batchSize?: number;
    /**
     * Recreates the DataAssets index on DataInsights. Useful if you changed a Custom Property
     * Type and are facing errors. Bear in mind that recreating the index will delete your
     * DataAssets and a backfill will be needed.
     */
    recreateDataAssetsIndex?: boolean;
    sendToAdmins?:            boolean;
    sendToTeams?:             boolean;
    /**
     * Number of threads to use for reindexing
     */
    consumerThreads?: number;
    /**
     * List of Entities to Reindex
     */
    entities?: string[];
    /**
     * Initial backoff time in milliseconds
     */
    initialBackoff?: number;
    /**
     * Maximum backoff time in milliseconds
     */
    maxBackoff?: number;
    /**
     * Maximum number of concurrent requests to the search index
     */
    maxConcurrentRequests?: number;
    /**
     * Maximum number of retries for a failed request
     */
    maxRetries?: number;
    /**
     * Maximum number of events sent in a batch (Default 100).
     */
    payLoadSize?: number;
    /**
     * Number of threads to use for reindexing
     */
    producerThreads?: number;
    /**
     * Queue Size to user internally for reindexing.
     */
    queueSize?: number;
    /**
     * This schema publisher run modes.
     */
    recreateIndex?: boolean;
    /**
     * Recreate Indexes with updated Language
     */
    searchIndexMappingLanguage?: SearchIndexMappingLanguage;
    /**
     * Bot Token
     */
    botToken?: string;
    /**
     * User Token
     */
    userToken?: string;
}

/**
 * Action to take on those entities. E.g., propagate description through lineage, auto
 * tagging, etc.
 *
 * Apply Tags to the selected assets.
 *
 * Remove Tags Action Type
 *
 * Add an owner to the selected assets.
 *
 * Remove Owner Action Type
 *
 * Add owners to the selected assets.
 *
 * Propagate description, tags and glossary terms via lineage
 *
 * ML Tagging action configuration for external automator.
 */
export interface Action {
    /**
     * Apply tags to the children of the selected assets that match the criteria. E.g., columns,
     * tasks, topic fields,...
     *
     * Remove tags from all the children of the selected assets. E.g., columns, tasks, topic
     * fields,...
     *
     * Apply the description to the children of the selected assets that match the criteria.
     * E.g., columns, tasks, topic fields,...
     *
     * Remove descriptions from all children of the selected assets. E.g., columns, tasks, topic
     * fields,...
     */
    applyToChildren?: string[];
    /**
     * Update tags even if they are already defined in the asset. By default, incoming tags are
     * merged with the existing ones.
     *
     * Update the domain even if it is defined in the asset. By default, we will only apply the
     * domain to assets without domain.
     *
     * Update the description even if they are already defined in the asset. By default, we'll
     * only add the descriptions to assets without the description set.
     *
     * Update the tier even if it is defined in the asset. By default, we will only apply the
     * tier to assets without tier.
     *
     * Update the owners even if it is defined in the asset. By default, we will only apply the
     * owners to assets without owner.
     *
     * Update descriptions, tags and Glossary Terms via lineage even if they are already defined
     * in the asset. By default, descriptions are only updated if they are not already defined
     * in the asset, and incoming tags are merged with the existing ones.
     */
    overwriteMetadata?: boolean;
    /**
     * Tags to apply
     *
     * Tags to remove
     */
    tags?: TagLabel[];
    /**
     * Application Type
     */
    type: ActionType;
    /**
     * Domain to apply
     */
    domain?: EntityReference;
    /**
     * Description to apply
     */
    description?: string;
    /**
     * tier to apply
     */
    tier?: TagLabel;
    /**
     * Owners to apply
     */
    owners?: EntityReference[];
    /**
     * Propagate the metadata to columns via column-level lineage.
     */
    propagateColumnLevel?: boolean;
    /**
     * Propagate description through lineage
     */
    propagateDescription?: boolean;
    /**
     * Propagate glossary terms through lineage
     */
    propagateGlossaryTerms?: boolean;
    /**
     * Propagate owner from the parent
     */
    propagateOwner?: boolean;
    /**
     * Propagate the metadata to the parents (e.g., tables) via lineage.
     */
    propagateParent?: boolean;
    /**
     * Propagate tags through lineage
     */
    propagateTags?: boolean;
    /**
     * Propagate tier from the parent
     */
    propagateTier?: boolean;
}

/**
 * This schema defines the type for labeling an entity with a Tag.
 *
 * tier to apply
 */
export interface TagLabel {
    /**
     * Description for the tag label.
     */
    description?: string;
    /**
     * Display Name that identifies this tag.
     */
    displayName?: string;
    /**
     * Link to the tag resource.
     */
    href?: string;
    /**
     * Label type describes how a tag label was applied. 'Manual' indicates the tag label was
     * applied by a person. 'Derived' indicates a tag label was derived using the associated tag
     * relationship (see Classification.json for more details). 'Propagated` indicates a tag
     * label was propagated from upstream based on lineage. 'Automated' is used when a tool was
     * used to determine the tag label.
     */
    labelType: LabelType;
    /**
     * Name of the tag or glossary term.
     */
    name?: string;
    /**
     * Label is from Tags or Glossary.
     */
    source: TagSource;
    /**
     * 'Suggested' state is used when a tag label is suggested by users or tools. Owner of the
     * entity must confirm the suggested labels before it is marked as 'Confirmed'.
     */
    state:  State;
    style?: Style;
    tagFQN: string;
}

/**
 * Label type describes how a tag label was applied. 'Manual' indicates the tag label was
 * applied by a person. 'Derived' indicates a tag label was derived using the associated tag
 * relationship (see Classification.json for more details). 'Propagated` indicates a tag
 * label was propagated from upstream based on lineage. 'Automated' is used when a tool was
 * used to determine the tag label.
 */
export enum LabelType {
    Automated = "Automated",
    Derived = "Derived",
    Manual = "Manual",
    Propagated = "Propagated",
}

/**
 * Label is from Tags or Glossary.
 */
export enum TagSource {
    Classification = "Classification",
    Glossary = "Glossary",
}

/**
 * 'Suggested' state is used when a tag label is suggested by users or tools. Owner of the
 * entity must confirm the suggested labels before it is marked as 'Confirmed'.
 */
export enum State {
    Confirmed = "Confirmed",
    Suggested = "Suggested",
}

/**
 * UI Style is used to associate a color code and/or icon to entity to customize the look of
 * that entity in UI.
 */
export interface Style {
    /**
     * Hex Color Code to mark an entity such as GlossaryTerm, Tag, Domain or Data Product.
     */
    color?: string;
    /**
     * An icon to associate with GlossaryTerm, Tag, Domain or Data Product.
     */
    iconURL?: string;
}

/**
 * Application Type
 *
 * Add Tags action type.
 *
 * Remove Tags Action Type.
 *
 * Add Owner Action Type.
 *
 * Remove Domain Action Type
 *
 * Add Description Action Type.
 *
 * Remove Description Action Type
 *
 * Add Tier Action Type.
 *
 * Remove Tier Action Type
 *
 * Remove Owner Action Type
 *
 * Lineage propagation action type.
 *
 * ML PII Tagging action type.
 */
export enum ActionType {
    AddDescriptionAction = "AddDescriptionAction",
    AddDomainAction = "AddDomainAction",
    AddOwnerAction = "AddOwnerAction",
    AddTagsAction = "AddTagsAction",
    AddTierAction = "AddTierAction",
    LineagePropagationAction = "LineagePropagationAction",
    MLTaggingAction = "MLTaggingAction",
    RemoveDescriptionAction = "RemoveDescriptionAction",
    RemoveDomainAction = "RemoveDomainAction",
    RemoveOwnerAction = "RemoveOwnerAction",
    RemoveTagsAction = "RemoveTagsAction",
    RemoveTierAction = "RemoveTierAction",
}

/**
 * Backfill Configuration
 */
export interface BackfillConfiguration {
    /**
     * Enable Backfill for the configured dates
     */
    enabled?: boolean;
    /**
     * Date for which the backfill will end
     */
    endDate?: Date;
    /**
     * Date from which to start the backfill
     */
    startDate?: Date;
    [property: string]: any;
}

/**
 * Entities selected to run the automation.
 */
export interface Resource {
    /**
     * Query filter to be passed to ES. E.g.,
     * `{"query":{"bool":{"must":[{"bool":{"should":[{"term":{"domain.displayName.keyword":"DG
     * Anim"}}]}}]}}}`. This is the same payload as in the Explore page.
     */
    queryFilter?: string;
    /**
     * Type of the entity. E.g., 'table', 'chart',...
     */
    type?: string[];
    [property: string]: any;
}

/**
 * Recreate Indexes with updated Language
 *
 * This schema defines the language options available for search index mappings.
 */
export enum SearchIndexMappingLanguage {
    En = "EN",
    Jp = "JP",
    Zh = "ZH",
}

/**
 * Application Type
 *
 * Application type.
 */
export enum Type {
    Automator = "Automator",
    CollateAI = "CollateAI",
    DataInsights = "DataInsights",
    DataInsightsReport = "DataInsightsReport",
    SearchIndexing = "SearchIndexing",
}

/**
 * Application private configuration
 *
 * PRivate Configuration for the CollateAI External Application.
 */
export interface PrivateConfig {
    /**
     * Collate Server public URL. WAII will use this information to interact with the server.
     * E.g., https://sandbox.getcollate.io
     */
    collateURL: string;
    /**
     * Limits for the CollateAI Application.
     */
    limits: CollateAILimits;
    /**
     * WAII API Token
     */
    token: string;
    /**
     * WAII API host URL
     */
    waiiInstance: string;
}

/**
 * Limits for the CollateAI Application.
 */
export interface CollateAILimits {
    /**
     * Start of the billing cycle.
     */
    billingCycleStart?: Date;
    /**
     * Maximum number of descriptions generated by the CollateAI
     */
    descriptions?: number;
    /**
     * Maximum number of queries generated by CollateAI.
     */
    queries?: number;
    [property: string]: any;
}

/**
 * Available sources to fetch DBT catalog and manifest files.
 *
 * dbt Cloud configuration.
 *
 * DBT Catalog, Manifest and Run Results file path config.
 *
 * DBT Catalog, Manifest and Run Results HTTP path configuration.
 *
 * DBT Catalog, Manifest and Run Results files in S3 bucket. We will search for
 * catalog.json, manifest.json and run_results.json.
 *
 * DBT Catalog, Manifest and Run Results files in GCS storage. We will search for
 * catalog.json, manifest.json and run_results.json.
 *
 * DBT Catalog, Manifest and Run Results files in Azure bucket. We will search for
 * catalog.json, manifest.json and run_results.json.
 */
export interface DBTConfigurationSource {
    /**
     * dbt cloud account Id
     */
    dbtCloudAccountId?: string;
    /**
     * dbt cloud account authentication token
     */
    dbtCloudAuthToken?: string;
    /**
     * dbt cloud job id.
     */
    dbtCloudJobId?: string;
    /**
     * In case of multiple projects in a dbt cloud account, specify the project's id from which
     * you want to extract the dbt run artifacts
     */
    dbtCloudProjectId?: string;
    /**
     * URL to connect to your dbt cloud instance. E.g., https://cloud.getdbt.com or
     * https://emea.dbt.com/
     */
    dbtCloudUrl?: string;
    /**
     * dbt Configuration type
     */
    dbtConfigType: DbtConfigType;
    /**
     * DBT catalog file path to extract dbt models with their column schemas.
     */
    dbtCatalogFilePath?: string;
    /**
     * DBT manifest file path to extract dbt models and associate with tables.
     */
    dbtManifestFilePath?: string;
    /**
     * DBT run results file path to extract the test results information.
     */
    dbtRunResultsFilePath?: string;
    /**
     * DBT sources file path to extract the freshness test result.
     */
    dbtSourcesFilePath?: string;
    /**
     * DBT catalog http file path to extract dbt models with their column schemas.
     */
    dbtCatalogHttpPath?: string;
    /**
     * DBT manifest http file path to extract dbt models and associate with tables.
     */
    dbtManifestHttpPath?: string;
    /**
     * DBT run results http file path to extract the test results information.
     */
    dbtRunResultsHttpPath?: string;
    /**
     * DBT sources http file path to extract freshness test results information.
     */
    dbtSourcesHttpPath?: string;
    /**
     * Details of the bucket where the dbt files are stored
     */
    dbtPrefixConfig?:   DBTPrefixConfig;
    dbtSecurityConfig?: Credentials;
}

/**
 * dbt Configuration type
 */
export enum DbtConfigType {
    Azure = "azure",
    Cloud = "cloud",
    Gcs = "gcs",
    HTTP = "http",
    Local = "local",
    S3 = "s3",
}

/**
 * Details of the bucket where the dbt files are stored
 */
export interface DBTPrefixConfig {
    /**
     * Name of the bucket where the dbt files are stored
     */
    dbtBucketName?: string;
    /**
     * Path of the folder where the dbt files are stored
     */
    dbtObjectPrefix?: string;
}

/**
 * AWS credentials configs.
 *
 * Azure Cloud Credentials
 *
 * GCP credentials configs.
 */
export interface Credentials {
    /**
     * The Amazon Resource Name (ARN) of the role to assume. Required Field in case of Assume
     * Role
     */
    assumeRoleArn?: string;
    /**
     * An identifier for the assumed role session. Use the role session name to uniquely
     * identify a session when the same role is assumed by different principals or for different
     * reasons. Required Field in case of Assume Role
     */
    assumeRoleSessionName?: string;
    /**
     * The Amazon Resource Name (ARN) of the role to assume. Optional Field in case of Assume
     * Role
     */
    assumeRoleSourceIdentity?: string;
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
     * The name of a profile to use with the boto session.
     */
    profileName?: string;
    /**
     * Account Name of your storage account
     */
    accountName?: string;
    /**
     * Your Service Principal App ID (Client ID)
     */
    clientId?: string;
    /**
     * Your Service Principal Password (Client Secret)
     */
    clientSecret?: string;
    /**
     * Scopes to get access token, for e.g. api://6dfX33ab-XXXX-49df-XXXX-3459eX817d3e/.default
     */
    scopes?: string;
    /**
     * Tenant ID of your Azure Subscription
     */
    tenantId?: string;
    /**
     * Key Vault Name
     */
    vaultName?: string;
    /**
     * We support two ways of authenticating to GCP i.e via GCP Credentials Values or GCP
     * Credentials Path
     */
    gcpConfig?: GCPCredentialsConfiguration;
    /**
     * we enable the authenticated service account to impersonate another service account
     */
    gcpImpersonateServiceAccount?: GCPImpersonateServiceAccountValues;
}

/**
 * We support two ways of authenticating to GCP i.e via GCP Credentials Values or GCP
 * Credentials Path
 *
 * Pass the raw credential values provided by GCP
 *
 * Pass the path of file containing the GCP credentials info
 */
export interface GCPCredentialsConfiguration {
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
     * Project ID
     *
     * GCP Project ID to parse metadata from
     */
    projectId?: string[] | string;
    /**
     * Google Cloud token uri.
     */
    tokenUri?: string;
    /**
     * Google Cloud Platform account type.
     */
    type?: string;
    /**
     * Path of the file containing the GCP credentials info
     */
    path?: string;
    /**
     * Google Security Token Service audience which contains the resource name for the workload
     * identity pool and the provider identifier in that pool.
     */
    audience?: string;
    /**
     * This object defines the mechanism used to retrieve the external credential from the local
     * environment so that it can be exchanged for a GCP access token via the STS endpoint
     */
    credentialSource?: { [key: string]: string };
    /**
     * Google Cloud Platform account type.
     */
    externalType?: string;
    /**
     * Google Security Token Service subject token type based on the OAuth 2.0 token exchange
     * spec.
     */
    subjectTokenType?: string;
    /**
     * Google Security Token Service token exchange endpoint.
     */
    tokenURL?: string;
    [property: string]: any;
}

/**
 * we enable the authenticated service account to impersonate another service account
 *
 * Pass the values to impersonate a service account of Google Cloud
 */
export interface GCPImpersonateServiceAccountValues {
    /**
     * The impersonated service account email
     */
    impersonateServiceAccount?: string;
    /**
     * Number of seconds the delegated credential should be valid
     */
    lifetime?: number;
    [property: string]: any;
}

/**
 * Use incremental Metadata extraction after the first execution. This is commonly done by
 * getting the changes from Audit tables on the supporting databases.
 */
export interface IncrementalMetadataExtractionConfiguration {
    /**
     * If True, enables Metadata Extraction to be incremental
     */
    enabled: boolean;
    /**
     * Number os days to search back for a successful pipeline run. The timestamp of the last
     * found successful pipeline run will be used as a base to search for updated entities.
     */
    lookbackDays?: number;
    /**
     * Number of days to add to the last successful pipeline run timestamp to search for updated
     * entities.
     */
    safetyMarginDays?: number;
}

/**
 * Details required to generate Lineage
 */
export interface LineageInformation {
    /**
     * List of Database Service Names for creation of lineage
     */
    dbServiceNames?: string[];
    /**
     * List of Storage Service Names for creation of lineage
     */
    storageServiceNames?: string[];
    [property: string]: any;
}

/**
 * Type of Profile Sample (percentage or rows)
 */
export enum ProfileSampleType {
    Percentage = "PERCENTAGE",
    Rows = "ROWS",
}

/**
 * Type of Sampling Method (BERNOULLI or SYSTEM)
 */
export enum SamplingMethodType {
    Bernoulli = "BERNOULLI",
    System = "SYSTEM",
}

/**
 * No manifest file available. Ingestion would look for bucket-level metadata file instead
 *
 * Storage Metadata Manifest file path config.
 *
 * Storage Metadata Manifest file HTTP path config.
 *
 * Storage Metadata Manifest file S3 path config.
 *
 * Storage Metadata Manifest file ADLS path config.
 *
 * Storage Metadata Manifest file GCS path config.
 */
export interface StorageMetadataConfigurationSource {
    /**
     * Storage Metadata manifest file path to extract locations to ingest from.
     */
    manifestFilePath?: string;
    /**
     * Storage Metadata manifest http file path to extract locations to ingest from.
     */
    manifestHttpPath?: string;
    prefixConfig?:     StorageMetadataBucketDetails;
    securityConfig?:   Credentials;
}

/**
 * Details of the bucket where the storage metadata manifest file is stored
 */
export interface StorageMetadataBucketDetails {
    /**
     * Name of the top level container where the storage metadata file is stored
     */
    containerName: string;
    /**
     * Path of the folder where the storage metadata file is stored. If the file is at the root,
     * you can keep it empty.
     */
    objectPrefix?: string;
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
 *
 * Pipeline Source Config Metadata Pipeline type
 *
 * MlModel Source Config Metadata Pipeline type
 *
 * Object Store Source Config Metadata Pipeline type
 *
 * Search Source Config Metadata Pipeline type
 *
 * DBT Config Pipeline type
 *
 * Pipeline Source Config For Application Pipeline type. Nothing is required.
 *
 * Api Source Config Metadata Pipeline type
 */
export enum ConfigType {
    APIMetadata = "ApiMetadata",
    Application = "Application",
    AutoClassification = "AutoClassification",
    DashboardMetadata = "DashboardMetadata",
    DataInsight = "dataInsight",
    DatabaseLineage = "DatabaseLineage",
    DatabaseMetadata = "DatabaseMetadata",
    DatabaseUsage = "DatabaseUsage",
    Dbt = "DBT",
    MessagingMetadata = "MessagingMetadata",
    MetadataToElasticSearch = "MetadataToElasticSearch",
    MlModelMetadata = "MlModelMetadata",
    PipelineMetadata = "PipelineMetadata",
    Profiler = "Profiler",
    SearchMetadata = "SearchMetadata",
    StorageMetadata = "StorageMetadata",
    TestSuite = "TestSuite",
}
