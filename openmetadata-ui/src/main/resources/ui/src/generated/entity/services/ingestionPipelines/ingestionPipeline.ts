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
     * Domains the asset belongs to. When not set, the asset inherits the domain from the parent
     * it belongs to.
     */
    domains?: EntityReference[];
    /**
     * True if the pipeline is ready to be run in the next schedule. False if it is paused.
     */
    enabled?: boolean;
    /**
     * Followers of this entity.
     */
    followers?: EntityReference[];
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
     * Change that lead to this version of the entity.
     */
    incrementalChangeDescription?: ChangeDescription;
    /**
     * The ingestion agent responsible for executing the ingestion pipeline.
     */
    ingestionRunner?: EntityReference;
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
    /**
     * The processing engine responsible for executing the ingestion pipeline logic.
     */
    processingEngine?: EntityReference;
    provider?:         ProviderType;
    /**
     * Control if we want to flag the workflow as failed if we encounter any processing errors.
     */
    raiseOnError?: boolean;
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
 *
 * Change that lead to this version of the entity.
 */
export interface ChangeDescription {
    changeSummary?: { [key: string]: ChangeSummary };
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

export interface ChangeSummary {
    changedAt?: number;
    /**
     * Name of the user or bot who made this change
     */
    changedBy?:    string;
    changeSource?: ChangeSource;
    [property: string]: any;
}

/**
 * The source of the change. This will change based on the context of the change (example:
 * manual vs programmatic)
 */
export enum ChangeSource {
    Automated = "Automated",
    Derived = "Derived",
    Ingested = "Ingested",
    Manual = "Manual",
    Propagated = "Propagated",
    Suggested = "Suggested",
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
 * Domains the asset belongs to. When not set, the asset inherits the domain from the parent
 * it belongs to.
 *
 * This schema defines the EntityReferenceList type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * The ingestion agent responsible for executing the ingestion pipeline.
 *
 * The processing engine responsible for executing the ingestion pipeline logic.
 *
 * Link to the service (such as database, messaging, storage services, etc. for which this
 * ingestion pipeline ingests the metadata from.
 *
 * Service to be modified
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
     * Regex to only include/exclude databases that matches the pattern.
     */
    databaseFilterPattern?: FilterPattern;
    /**
     * Configuration for Sink Component in the OpenMetadata Ingestion Framework.
     */
    elasticsSearch?: OpenMetadataServerConnectionElasticsSearch;
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
     * Regex to only include/exclude schemas that matches the pattern.
     */
    schemaFilterPattern?: FilterPattern;
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
    sslConfig?: ConsumerConfigSSLClass;
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
     * Regex to only include/exclude tables that matches the pattern.
     */
    tableFilterPattern?: FilterPattern;
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
 * Regex to only include/exclude databases that matches the pattern.
 *
 * Regex to only fetch entities that matches the pattern.
 *
 * Regex to only include/exclude schemas that matches the pattern.
 *
 * Regex to only include/exclude tables that matches the pattern.
 *
 * Regex to only fetch databases that matches the pattern.
 *
 * Regex to only fetch tables or databases that matches the pattern.
 *
 * Regex to only fetch stored procedures that matches the pattern.
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
 *
 * Regex to include/exclude FHIR resource categories
 *
 * Regex to include/exclude FHIR resource types
 *
 * Regex to only fetch tags that matches the pattern.
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
 * Configuration for Sink Component in the OpenMetadata Ingestion Framework.
 */
export interface OpenMetadataServerConnectionElasticsSearch {
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
    Kubernetes = "kubernetes",
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
 * SSL Configuration details.
 *
 * Consumer Config SSL Config. Configuration for enabling SSL for the Consumer Config
 * connection.
 *
 * Schema Registry SSL Config. Configuration for enabling SSL for the Schema Registry
 * connection.
 *
 * OpenMetadata Client configured to validate SSL certificates.
 */
export interface ConsumerConfigSSLClass {
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
     * Pipeline configuration for this particular execution.
     */
    config?: { [key: string]: any };
    /**
     * endDate of the pipeline run for this particular execution.
     */
    endDate?: number;
    /**
     * Metadata for the pipeline status.
     */
    metadata?: { [key: string]: any };
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
 * deleted and can only be disabled. Some apps such as AutoPilot create entities with
 * `automation` provider type. These entities can be deleted by the user.
 */
export enum ProviderType {
    Automation = "automation",
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
 *
 * Apply a set of operations on a service
 */
export interface Pipeline {
    /**
     * Regex to only include/exclude databases that matches the pattern.
     *
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
     * Optional configuration to soft delete databases in OpenMetadata if the source databases
     * are deleted. Also, if the database is deleted, all the associated entities like schemas,
     * tables, views, stored procedures, lineage, etc., with that database will be deleted
     */
    markDeletedDatabases?: boolean;
    /**
     * Optional configuration to soft delete schemas in OpenMetadata if the source schemas are
     * deleted. Also, if the schema is deleted, all the associated entities like tables, views,
     * stored procedures, lineage, etc., with that schema will be deleted
     */
    markDeletedSchemas?: boolean;
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
     * Regex to only include/exclude schemas that matches the pattern.
     *
     * Regex to only fetch tables or databases that matches the pattern.
     */
    schemaFilterPattern?: FilterPattern;
    /**
     * Regex to only include/exclude tables that matches the pattern.
     *
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
     * Configuration to process query cost
     */
    processQueryCostAnalysis?: boolean;
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
     * Set 'Cross Database Service Names' to process lineage with the database.
     */
    crossDatabaseServiceNames?: string[];
    /**
     * Handle Lineage for Snowflake Temporary and Transient Tables.
     */
    enableTempTableLineage?: boolean;
    /**
     * Set the 'Incremental Lineage Processing' toggle to control whether to process lineage
     * incrementally.
     */
    incrementalLineageProcessing?: boolean;
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
     * Set the 'Process Cross Database Lineage' toggle to control whether to process table
     * lineage across different databases.
     */
    processCrossDatabaseLineage?: boolean;
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
     * Regex to only fetch stored procedures that matches the pattern.
     */
    storedProcedureFilterPattern?: FilterPattern;
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
    processingEngine?:    ProcessingEngine;
    /**
     * Percentage of data or no. of rows used to compute the profiler metrics and run data
     * quality tests
     *
     * Percentage of data or no. of rows we want to execute the profiler and tests on
     */
    profileSample?:     number;
    profileSampleType?: ProfileSampleType;
    /**
     * Whether to randomize the sample data or not.
     */
    randomizedSample?:   boolean;
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
     * Number of sample rows to ingest when 'Generate Sample Data' is enabled
     */
    sampleDataCount?: number;
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
     * Fully qualified name of the entity to be tested, if we're working with a basic suite.
     */
    entityFullyQualifiedName?: string;
    /**
     * Service connections to be used for the logical test suite.
     */
    serviceConnections?: ServiceConnections[];
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
     * Optional configuration to update the owners from DBT or not
     */
    dbtUpdateOwners?: boolean;
    /**
     * Optional configuration to search across databases for tables or not
     */
    searchAcrossDatabases?: boolean;
    /**
     * Regex to only fetch tags that matches the pattern.
     */
    tagFilterPattern?: FilterPattern;
    /**
     * Application configuration
     */
    appConfig?: any[] | boolean | number | null | CollateAIAppConfig | string;
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
    /**
     * Optional value of the ingestion runner name responsible for running the workflow
     */
    ingestionRunner?: string;
    /**
     * List of operations to be performed on the service
     */
    operations?: Operation[];
    /**
     * Service to be modified
     */
    service?: EntityReference;
}

/**
 * Configuration for the CollateAI External Application.
 *
 * Configuration for the Automator External Application.
 *
 * This schema defines the Slack App Token Configuration
 *
 * No configuration needed to instantiate the Data Insights Pipeline. The logic is handled
 * in the backend.
 *
 * Search Indexing App.
 *
 * Configuration for the Collate AI Quality Agent.
 *
 * Configuration for the AutoPilot Application.
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
    type?: CollateAIAppConfigType;
    /**
     * Action to take on those entities. E.g., propagate description through lineage, auto
     * tagging, etc.
     */
    actions?: Action[];
    /**
     * Entities selected to run the automation.
     */
    resources?: Resource;
    /**
     * Bot Token
     */
    botToken?: string;
    /**
     * User Token
     */
    userToken?:             string;
    backfillConfiguration?: BackfillConfiguration;
    /**
     * Maximum number of events processed at a time (Default 100).
     *
     * Maximum number of events sent in a batch (Default 100).
     */
    batchSize?:           number;
    moduleConfiguration?: ModuleConfiguration;
    /**
     * Recreates the DataAssets index on DataInsights. Useful if you changed a Custom Property
     * Type and are facing errors. Bear in mind that recreating the index will delete your
     * DataAssets and a backfill will be needed.
     */
    recreateDataAssetsIndex?: boolean;
    sendToAdmins?:            boolean;
    sendToTeams?:             boolean;
    /**
     * Enable automatic performance tuning based on cluster capabilities and database entity
     * count
     */
    autoTune?: boolean;
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
     * Whether the suggested tests should be active or not upon suggestion
     *
     * Whether the AutoPilot Workflow should be active or not.
     */
    active?: boolean;
    /**
     * Enter the retention period for Activity Threads of type = 'Conversation' records in days
     * (e.g., 30 for one month, 60 for two months).
     */
    activityThreadsRetentionPeriod?: number;
    /**
     * Enter the retention period for change event records in days (e.g., 7 for one week, 30 for
     * one month).
     */
    changeEventRetentionPeriod?: number;
    /**
     * Service Entity Link for which to trigger the application.
     */
    entityLink?: string;
    [property: string]: any;
}

/**
 * Action to take on those entities. E.g., propagate description through lineage, auto
 * tagging, etc.
 *
 * Apply Tags to the selected assets.
 *
 * Remove Tags Action Type
 *
 * Add domains to the selected assets.
 *
 * Remove domains from the selected assets.
 *
 * Add a Custom Property to the selected assets.
 *
 * Remove Owner Action Type
 *
 * Add an owner to the selected assets.
 *
 * Add Test Cases to the selected assets.
 *
 * Remove Test Cases Action Type
 *
 * Add owners to the selected assets.
 *
 * Remove Custom Properties Action Type
 *
 * Add a Data Product to the selected assets.
 *
 * Remove a Data Product to the selected assets.
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
     * Remove tags from the children of the selected assets. E.g., columns, tasks, topic
     * fields,...
     *
     * Apply the description to the children of the selected assets that match the criteria.
     * E.g., columns, tasks, topic fields,...
     *
     * Remove descriptions from the children of the selected assets. E.g., columns, tasks, topic
     * fields,...
     *
     * Add tests to the selected table columns
     *
     * Remove tests to the selected table columns
     */
    applyToChildren?: string[];
    /**
     * Update tags even if they are already defined in the asset. By default, incoming tags are
     * merged with the existing ones.
     *
     * Update the domains even if they are defined in the asset. By default, we will only apply
     * the domains to assets without domains.
     *
     * Update the description even if they are already defined in the asset. By default, we'll
     * only add the descriptions to assets without the description set.
     *
     * Update the Custom Property even if it is defined in the asset. By default, we will only
     * apply the owners to assets without the given Custom Property informed.
     *
     * Update the tier even if it is defined in the asset. By default, we will only apply the
     * tier to assets without tier.
     *
     * Update the test even if it is defined in the asset. By default, we will only apply the
     * test to assets without the existing test already existing.
     *
     * Update the owners even if it is defined in the asset. By default, we will only apply the
     * owners to assets without owner.
     *
     * Update the Data Product even if the asset belongs to a different Domain. By default, we
     * will only add the Data Product if the asset has no Domain, or it belongs to the same
     * domain as the Data Product.
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
    tags?: TierElement[];
    /**
     * Application Type
     */
    type: ActionType;
    /**
     * Remove tags from all the children and parent of the selected assets.
     *
     * Remove descriptions from all the children and parent of the selected assets.
     */
    applyToAll?: boolean;
    /**
     * Remove tags by its label type
     */
    labels?: LabelElement[];
    /**
     * Domains to apply
     */
    domains?: EntityReference[];
    /**
     * Description to apply
     */
    description?: string;
    /**
     * Owners to apply
     *
     * Custom Properties keys to remove
     */
    customProperties?: any;
    /**
     * tier to apply
     */
    tier?: TierElement;
    /**
     * Test Cases to apply
     */
    testCases?: TestCaseDefinitions[];
    /**
     * Remove all test cases
     */
    removeAll?: boolean;
    /**
     * Test Cases to remove
     */
    testCaseDefinitions?: string[];
    /**
     * Owners to apply
     */
    owners?: EntityReference[];
    /**
     * Data Products to apply
     *
     * Data Products to remove
     */
    dataProducts?: EntityReference[];
    /**
     * Propagate the metadata to columns via column-level lineage.
     */
    propagateColumnLevel?: boolean;
    /**
     * Propagate description through lineage
     */
    propagateDescription?: boolean;
    /**
     * Propagate domains from the parent through lineage
     */
    propagateDomains?: boolean;
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
    /**
     * Number of levels to propagate lineage. If not set, it will propagate to all levels.
     */
    propagationDepth?: number;
    /**
     * List of configurations to stop propagation based on conditions
     */
    propagationStopConfigs?: PropagationStopConfig[];
}

/**
 * Remove tags by its label type
 */
export enum LabelElement {
    Automated = "Automated",
    Manual = "Manual",
    Propagated = "Propagated",
}

/**
 * Configuration to stop lineage propagation based on conditions
 */
export interface PropagationStopConfig {
    /**
     * The metadata attribute to check for stopping propagation
     */
    metadataAttribute: MetadataAttribute;
    /**
     * List of attribute values that will stop propagation when any of them is matched
     */
    value: Array<TagLabel | string>;
}

/**
 * The metadata attribute to check for stopping propagation
 */
export enum MetadataAttribute {
    Description = "description",
    Domain = "domain",
    GlossaryTerms = "glossaryTerms",
    Owner = "owner",
    Tags = "tags",
    Tier = "tier",
}

/**
 * This schema defines the type for labeling an entity with a Tag.
 *
 * tier to apply
 *
 * Domains the asset belongs to. When not set, the asset inherits the domain from the parent
 * it belongs to.
 *
 * This schema defines the EntityReferenceList type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * The ingestion agent responsible for executing the ingestion pipeline.
 *
 * The processing engine responsible for executing the ingestion pipeline logic.
 *
 * Link to the service (such as database, messaging, storage services, etc. for which this
 * ingestion pipeline ingests the metadata from.
 *
 * Service to be modified
 */
export interface TagLabel {
    /**
     * Description for the tag label.
     *
     * Optional description of entity.
     */
    description?: string;
    /**
     * Display Name that identifies this tag.
     *
     * Display Name that identifies this entity.
     */
    displayName?: string;
    /**
     * Link to the tag resource.
     *
     * Link to the entity resource.
     */
    href?: string;
    /**
     * Label type describes how a tag label was applied. 'Manual' indicates the tag label was
     * applied by a person. 'Derived' indicates a tag label was derived using the associated tag
     * relationship (see Classification.json for more details). 'Propagated` indicates a tag
     * label was propagated from upstream based on lineage. 'Automated' is used when a tool was
     * used to determine the tag label.
     */
    labelType?: LabelTypeEnum;
    /**
     * Name of the tag or glossary term.
     *
     * Name of the entity instance.
     */
    name?: string;
    /**
     * Label is from Tags or Glossary.
     */
    source?: TagSource;
    /**
     * 'Suggested' state is used when a tag label is suggested by users or tools. Owner of the
     * entity must confirm the suggested labels before it is marked as 'Confirmed'.
     */
    state?:  State;
    style?:  Style;
    tagFQN?: string;
    /**
     * If true the entity referred to has been soft-deleted.
     */
    deleted?: boolean;
    /**
     * Fully qualified name of the entity instance. For entities such as tables, databases
     * fullyQualifiedName is returned in this field. For entities that don't have name hierarchy
     * such as `user` and `team` this will be same as the `name` field.
     */
    fullyQualifiedName?: string;
    /**
     * Unique identifier that identifies an entity instance.
     */
    id?: string;
    /**
     * If true the relationship indicated by this entity reference is inherited from the parent
     * entity.
     */
    inherited?: boolean;
    /**
     * Entity type/class name - Examples: `database`, `table`, `metrics`, `databaseService`,
     * `dashboardService`...
     */
    type?: string;
}

/**
 * Label type describes how a tag label was applied. 'Manual' indicates the tag label was
 * applied by a person. 'Derived' indicates a tag label was derived using the associated tag
 * relationship (see Classification.json for more details). 'Propagated` indicates a tag
 * label was propagated from upstream based on lineage. 'Automated' is used when a tool was
 * used to determine the tag label.
 */
export enum LabelTypeEnum {
    Automated = "Automated",
    Derived = "Derived",
    Generated = "Generated",
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
 * This schema defines the type for labeling an entity with a Tag.
 *
 * tier to apply
 */
export interface TierElement {
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
    labelType: LabelTypeEnum;
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
 * Minimum set of requirements to get a Test Case request ready
 */
export interface TestCaseDefinitions {
    /**
     * Compute the passed and failed row count for the test case.
     */
    computePassedFailedRowCount?: boolean;
    parameterValues?:             TestCaseParameterValue[];
    /**
     * Tags to apply
     */
    tags?: TierElement[];
    /**
     * Fully qualified name of the test definition.
     */
    testDefinition?: string;
    /**
     * If the test definition supports it, use dynamic assertion to evaluate the test case.
     */
    useDynamicAssertion?: boolean;
    [property: string]: any;
}

/**
 * This schema defines the parameter values that can be passed for a Test Case.
 */
export interface TestCaseParameterValue {
    /**
     * name of the parameter. Must match the parameter names in testCaseParameterDefinition
     */
    name?: string;
    /**
     * value to be passed for the Parameters. These are input from Users. We capture this in
     * string and convert during the runtime.
     */
    value?: string;
    [property: string]: any;
}

/**
 * Application Type
 *
 * Add Tags action type.
 *
 * Remove Tags Action Type.
 *
 * Add Domain Action Type.
 *
 * Remove Domain Action Type
 *
 * Add Description Action Type.
 *
 * Add Custom Properties Action Type.
 *
 * Remove Description Action Type
 *
 * Add Tier Action Type.
 *
 * Remove Tier Action Type
 *
 * Add Test Case Action Type.
 *
 * Remove Test Case Action Type
 *
 * Add Owner Action Type.
 *
 * Remove Owner Action Type
 *
 * Remove Custom Properties Action Type.
 *
 * Add Data Products Action Type.
 *
 * Remove Data Products Action Type.
 *
 * Lineage propagation action type.
 *
 * ML PII Tagging action type.
 */
export enum ActionType {
    AddCustomPropertiesAction = "AddCustomPropertiesAction",
    AddDataProductAction = "AddDataProductAction",
    AddDescriptionAction = "AddDescriptionAction",
    AddDomainAction = "AddDomainAction",
    AddOwnerAction = "AddOwnerAction",
    AddTagsAction = "AddTagsAction",
    AddTestCaseAction = "AddTestCaseAction",
    AddTierAction = "AddTierAction",
    LineagePropagationAction = "LineagePropagationAction",
    MLTaggingAction = "MLTaggingAction",
    RemoveCustomPropertiesAction = "RemoveCustomPropertiesAction",
    RemoveDataProductAction = "RemoveDataProductAction",
    RemoveDescriptionAction = "RemoveDescriptionAction",
    RemoveDomainAction = "RemoveDomainAction",
    RemoveOwnerAction = "RemoveOwnerAction",
    RemoveTagsAction = "RemoveTagsAction",
    RemoveTestCaseAction = "RemoveTestCaseAction",
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
 * Different Module Configurations
 */
export interface ModuleConfiguration {
    /**
     * App Analytics Module configuration
     */
    appAnalytics: AppAnalyticsConfig;
    /**
     * Cost Analysis Insights Module configuration
     */
    costAnalysis: CostAnalysisConfig;
    /**
     * Data Assets Insights Module configuration
     */
    dataAssets: DataAssetsConfig;
    /**
     * Data Quality Insights Module configuration
     */
    dataQuality: DataQualityConfig;
}

/**
 * App Analytics Module configuration
 */
export interface AppAnalyticsConfig {
    /**
     * If Enabled, App Analytics insights will be populated when the App runs.
     */
    enabled: boolean;
}

/**
 * Cost Analysis Insights Module configuration
 */
export interface CostAnalysisConfig {
    /**
     * If Enabled, Cost Analysis insights will be populated when the App runs.
     */
    enabled: boolean;
}

/**
 * Data Assets Insights Module configuration
 */
export interface DataAssetsConfig {
    /**
     * If Enabled, Data Asset insights will be populated when the App runs.
     */
    enabled: boolean;
    /**
     * List of Entities to Reindex
     */
    entities?: string[];
    /**
     * Defines the number of days the Data Assets Insights information will be kept. After it
     * they will be deleted.
     */
    retention?:     number;
    serviceFilter?: ServiceFilter;
}

export interface ServiceFilter {
    serviceName?: string;
    serviceType?: string;
}

/**
 * Data Quality Insights Module configuration
 */
export interface DataQualityConfig {
    /**
     * If Enabled, Data Quality insights will be populated when the App runs.
     */
    enabled: boolean;
}

/**
 * Entities selected to run the automation.
 */
export interface Resource {
    /**
     * Filter JSON tree to be used for rendering the filters in the UI. This comes from
     * Immutable Tree type of react-awesome-query-builder.
     */
    filterJsonTree?: string;
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
export enum CollateAIAppConfigType {
    AutoPilotApplication = "AutoPilotApplication",
    Automator = "Automator",
    CollateAI = "CollateAI",
    CollateAIQualityAgent = "CollateAIQualityAgent",
    DataInsights = "DataInsights",
    DataInsightsReport = "DataInsightsReport",
    SearchIndexing = "SearchIndexing",
}

/**
 * Application private configuration
 *
 * Private Configuration for the CollateAI External Application.
 */
export interface PrivateConfig {
    /**
     * Collate Server public URL. WAII will use this information to interact with the server.
     * E.g., https://sandbox.getcollate.io
     */
    collateURL?: string;
    /**
     * Limits for the CollateAI Application.
     */
    limits?: AppLimitsConfig;
    /**
     * WAII API Token
     */
    token?: string;
    /**
     * WAII API host URL
     */
    waiiInstance?: string;
    [property: string]: any;
}

/**
 * Limits for the CollateAI Application.
 *
 * Private Configuration for the App Limits.
 */
export interface AppLimitsConfig {
    /**
     * The records of the limits.
     */
    actions: { [key: string]: number };
    /**
     * The start of this limit cycle.
     */
    billingCycleStart: Date;
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
    dbtSecurityConfig?: DbtSecurityConfigClass;
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
 * Available sources to fetch metadata.
 *
 * Azure Credentials
 *
 * GCP credentials configs.
 *
 * GCP Credentials
 */
export interface DbtSecurityConfigClass {
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
 *
 * Use the application default credentials
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
     *
     * Google Cloud Platform ADC ( Application Default Credentials )
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
     * List of service path prefixes for lineage matching. Supported formats: DBServiceName,
     * DBServiceName.DatabaseName, DBServiceName.DatabaseName.SchemaName, or
     * DBServiceName.DatabaseName.SchemaName.TableName
     */
    dbServicePrefixes?: string[];
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
 * Operation to be performed on the entity
 */
export interface Operation {
    /**
     * Entity to be modified
     */
    entityLink: string;
    /**
     * The id of the operation
     */
    id: string;
    /**
     * The configuration for the operation to be applied
     */
    parameters: ReverseIngestionConfig;
    /**
     * Templated SQL command to be used for the operation. Context parameters will be populated
     * based on the event type.
     */
    SQLTemplate?: string;
    /**
     * Type of operation to perform
     */
    type: OperationType;
}

/**
 * The configuration for the operation to be applied
 *
 * Configuration for updating descriptions
 *
 * Configuration for updating owners
 *
 * Configuration for updating tags
 */
export interface ReverseIngestionConfig {
    /**
     * New description of the service
     */
    newDescription?: string;
    /**
     * Previous description of the service
     */
    previousDescription?: string;
    /**
     * Added owners to be applied
     */
    addedOwners?: EntityReference[];
    /**
     * Removed owners from the entity
     */
    removedOwners?: EntityReference[];
    /**
     * Added tags to be applied
     */
    addedTags?: TierElement[];
    /**
     * Removed tags of the entity
     */
    removedTags?: TierElement[];
}

/**
 * Type of operation to perform
 */
export enum OperationType {
    UpdateDescription = "UPDATE_DESCRIPTION",
    UpdateOwner = "UPDATE_OWNER",
    UpdateTags = "UPDATE_TAGS",
}

/**
 * Processing Engine Configuration. If not provided, the Native Engine will be used by
 * default.
 *
 * Configuration for the native metadata ingestion engine
 *
 * This schema defines the configuration for a Spark Engine runner.
 */
export interface ProcessingEngine {
    /**
     * The type of the engine configuration
     */
    type: ProcessingEngineType;
    /**
     * Additional Spark configuration properties as key-value pairs.
     */
    config?: { [key: string]: any };
    /**
     * Spark Connect Remote URL.
     */
    remote?: string;
}

/**
 * The type of the engine configuration
 */
export enum ProcessingEngineType {
    Native = "Native",
    Spark = "Spark",
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
 * Service connections available for the logical test suite.
 */
export interface ServiceConnections {
    /**
     * Connection configuration for the source. ex: mysql , tableau connection.
     */
    serviceConnection: ServiceConnection;
    serviceName:       string;
}

/**
 * Connection configuration for the source. ex: mysql , tableau connection.
 *
 * Supported services
 *
 * API Service Connection.
 *
 * Dashboard Connection.
 *
 * Database Connection.
 *
 * Metadata Service Connection.
 *
 * Pipeline Connection.
 *
 * MlModel Connection.
 *
 * Storage Connection.
 *
 * search Connection.
 */
export interface ServiceConnection {
    config?: ConfigClass;
}

/**
 * REST Connection Config
 *
 * Looker Connection Config
 *
 * Metabase Connection Config
 *
 * PowerBI Connection Config
 *
 * PowerBIReportServer Connection Config
 *
 * Redash Connection Config
 *
 * Superset Connection Config
 *
 * Tableau Connection Config
 *
 * Mode Connection Config
 *
 * Custom Dashboard Service connection to build a source that is not supported by
 * OpenMetadata yet.
 *
 * Domo Dashboard Connection Config
 *
 * QuickSight Connection Config
 *
 * Qlik Sense Connection Config
 *
 * Lightdash Connection Config
 *
 * MicroStrategy Connection Config
 *
 * Qlik Cloud Connection Config
 *
 * Sigma Connection Config
 *
 * ThoughtSpot Connection Config
 *
 * Google BigQuery Connection Config
 *
 * Google BigTable Connection Config
 *
 * AWS Athena Connection Config
 *
 * Azure SQL Connection Config
 *
 * Clickhouse Connection Config
 *
 * Databricks Connection Config
 *
 * Db2 Connection Config
 *
 * DeltaLake Database Connection Config
 *
 * Druid Connection Config
 *
 * DynamoDB Connection Config
 *
 * Glue Connection Config
 *
 * Hive SQL Connection Config
 *
 * Impala SQL Connection Config
 *
 * MariaDB Database Connection Config
 *
 * Mssql Database Connection Config
 *
 * Mysql Database Connection Config
 *
 * SQLite Database Connection Config
 *
 * Oracle Database Connection Config
 *
 * Postgres Database Connection Config
 *
 * Presto Database Connection Config
 *
 * Redshift  Connection Config
 *
 * Salesforce Connection Config
 *
 * SingleStore Database Connection Config
 *
 * Snowflake Connection Config
 *
 * Trino Connection Config
 *
 * Vertica Connection Config
 *
 * PinotDB Database Connection Config
 *
 * Datalake Connection Config
 *
 * Domo Database Connection Config
 *
 * Custom Database Service connection to build a source that is not supported by
 * OpenMetadata yet.
 *
 * Sap Hana Database Connection Config
 *
 * MongoDB Connection Config
 *
 * Cassandra Connection Config
 *
 * Couchbase Connection Config
 *
 * Greenplum Database Connection Config
 *
 * Doris Database Connection Config
 *
 * UnityCatalog Connection Config
 *
 * SAS Connection Config
 *
 * Iceberg Catalog Connection Config
 *
 * Teradata Database Connection Config
 *
 * Sap ERP Database Connection Config
 *
 * Synapse Database Connection Config
 *
 * Exasol Database Connection Config
 *
 * Cockroach Database Connection Config
 *
 * SSAS Metadata Database Connection Config
 *
 * Epic FHIR Connection Config
 *
 * Kafka Connection Config
 *
 * Redpanda Connection Config
 *
 * Kinesis Connection Config
 *
 * Custom Messaging Service Connection to build a source that is not supported by
 * OpenMetadata yet.
 *
 * Amundsen Connection Config
 *
 * Metadata to ElasticSearch Connection Config
 *
 * OpenMetadata Connection Config
 *
 * Atlas Connection Config
 *
 * Alation Connection Config
 *
 * Alation Sink Connection Config
 *
 * Airflow Metadata Database Connection Config
 *
 * Wherescape Metadata Database Connection Config
 *
 * SSIS Metadata Database Connection Config
 *
 * Glue Pipeline Connection Config
 *
 * Airbyte Metadata Database Connection Config
 *
 * Fivetran Metadata Database Connection Config
 *
 * Flink Metadata Connection Config
 *
 * Dagster Metadata Database Connection Config
 *
 * Nifi Metadata Pipeline Connection Config
 *
 * Domo Pipeline Connection Config
 *
 * Custom Pipeline Service connection to build a source that is not supported by
 * OpenMetadata yet.
 *
 * Spline Metadata Database Connection Config
 *
 * Spark Metadata Pipeline Connection Config
 *
 * OpenLineage Connection Config
 *
 * KafkaConnect Connection Config
 *
 * DBTCloud Connection Config
 *
 * Matillion Connection
 *
 * Azure Data Factory Connection Config
 *
 * Stitch Connection
 *
 * MlFlow Connection Config
 *
 * Sklearn Connection Config
 *
 * Custom MlModel Service connection to build a source that is not supported by OpenMetadata
 * yet.
 *
 * SageMaker Connection Config
 *
 * Google VertexAI Connection Config
 *
 * S3 Connection.
 *
 * ADLS Connection.
 *
 * GCS Connection.
 *
 * Custom Storage Service connection to build a source that is not supported by OpenMetadata
 * yet.
 *
 * ElasticSearch Connection.
 *
 * OpenSearch Connection Config
 *
 * Custom Search Service connection to build a source that is not supported by OpenMetadata
 * yet.
 */
export interface ConfigClass {
    /**
     * Regex to only fetch api collections with names matching the pattern.
     */
    apiCollectionFilterPattern?: FilterPattern;
    /**
     * Documentation URL for the schema.
     */
    docURL?: string;
    /**
     * Open API Schema URL.
     */
    openAPISchemaURL?: string;
    /**
     * Supports Metadata Extraction.
     */
    supportsMetadataExtraction?: boolean;
    /**
     * Generated Token to connect to OpenAPI Schema.
     *
     * token to connect to Qlik Cloud.
     *
     * Generated Token to connect to Databricks.
     *
     * To Connect to Dagster Cloud
     *
     * Generated Token to connect to DBTCloud.
     *
     * Token to connect to Stitch api doc
     */
    token?: string;
    /**
     * REST API Type
     *
     * Service Type
     *
     * Custom dashboard service type
     *
     * Custom database service type
     *
     * Custom messaging service type
     *
     * Custom pipeline service type
     *
     * Custom Ml model service type
     *
     * Custom storage service type
     *
     * ElasticSearch Type
     *
     * OpenSearch Type
     *
     * Custom search service type
     */
    type?: RESTType;
    /**
     * Regex exclude or include charts that matches the pattern.
     */
    chartFilterPattern?: FilterPattern;
    /**
     * User's Client ID. This user should have privileges to read all the metadata in Looker.
     *
     * client_id for PowerBI.
     *
     * Client ID for DOMO
     *
     * client_id for Sigma.
     *
     * Azure Application (client) ID for service principal authentication.
     */
    clientId?: string;
    /**
     * User's Client Secret.
     *
     * clientSecret for PowerBI.
     *
     * clientSecret for Sigma.
     *
     * Azure Application client secret for service principal authentication.
     */
    clientSecret?: string;
    /**
     * Regex to exclude or include dashboards that matches the pattern.
     */
    dashboardFilterPattern?: FilterPattern;
    /**
     * Regex exclude or include data models that matches the pattern.
     */
    dataModelFilterPattern?: FilterPattern;
    /**
     * Credentials to extract the .lkml files from a repository. This is required to get all the
     * lineage and definitions.
     */
    gitCredentials?: GitHubCredentials;
    /**
     * URL to the Looker instance.
     *
     * Host and Port of the Metabase instance.
     *
     * Dashboard URL for PowerBI service.
     *
     * Dashboard URL for PowerBI Report Server.
     *
     * URL for the Redash instance
     *
     * URL for the superset instance.
     *
     * Tableau Server url.
     *
     * URL for the mode instance.
     *
     * URL for the Qlik instance.
     *
     * Address for your running Lightdash instance
     *
     * Host and Port of the MicroStrategy instance.
     *
     * Host and Port of the Qlik Cloud instance.
     *
     * Sigma API url.
     *
     * ThoughtSpot instance URL. Example: https://my-company.thoughtspot.cloud
     *
     * BigQuery APIs URL.
     *
     * Host and port of the AzureSQL service.
     *
     * Host and port of the Clickhouse service.
     *
     * Host and port of the Databricks service.
     *
     * Host and port of the DB2 service.
     *
     * Host and port of the Druid service.
     *
     * Host and port of the Hive service.
     *
     * Host and port of the Impala service.
     *
     * Host and port of the MariaDB service.
     *
     * Host and port of the MSSQL service.
     *
     * Host and port of the MySQL service.
     *
     * Host and port of the SQLite service. Blank for in-memory database.
     *
     * Host and port of the Oracle service.
     *
     * Host and port of the source service.
     *
     * Host and port of the Presto service.
     *
     * Host and port of the Redshift service.
     *
     * Host and port of the SingleStore service.
     *
     * Host and port of the Trino service.
     *
     * Host and port of the Vertica service.
     *
     * Host and port of the PinotDB Broker service.
     *
     * Host and port of the MongoDB service when using the `mongodb` connection scheme. Only
     * host when using the `mongodb+srv` scheme.
     *
     * Host and port of the Cassandra service when using the `cassandra` connection scheme. Only
     * host when using the `cassandra+srv` scheme.
     *
     * Host and port of the Doris service.
     *
     * Host and port of the Teradata service.
     *
     * Host and Port of the SAP ERP instance.
     *
     * Host and port of the Azure Synapse service.
     *
     * Host and port of the Cockrooach service.
     *
     * Host and port of the Amundsen Neo4j Connection. This expect a URI format like:
     * bolt://localhost:7687.
     *
     * OpenMetadata Server Config. Must include API end point ex: http://localhost:8585/api
     *
     * Host and port of the Atlas service.
     *
     * Host and port of the Alation service.
     *
     * Pipeline Service Management/UI URI.
     *
     * Pipeline Service Management/UI URL.
     *
     * Spline REST Server Host & Port.
     *
     * KafkaConnect Service Management/UI URI.
     *
     * Host and port of the Stitch API host
     *
     * Host and port of the ElasticSearch service.
     *
     * Host and port of the OpenSearch service.
     */
    hostPort?: string;
    /**
     * Regex to exclude or include projects that matches the pattern.
     */
    projectFilterPattern?: FilterPattern;
    /**
     * Password to connect to Metabase.
     *
     * Password to connect to PowerBI report server.
     *
     * Password to connect to MicroStrategy.
     *
     * Password to connect to AzureSQL.
     *
     * Password to connect to Clickhouse.
     *
     * Password to connect to DB2.
     *
     * Password to connect to Druid.
     *
     * Password to connect to Hive.
     *
     * Password to connect to Impala.
     *
     * Password to connect to MariaDB.
     *
     * Password to connect to MSSQL.
     *
     * Password to connect to SQLite. Blank for in-memory database.
     *
     * Password to connect to Oracle.
     *
     * Password to connect to Presto.
     *
     * Password to connect to Redshift.
     *
     * Password to connect to the Salesforce.
     *
     * Password to connect to SingleStore.
     *
     * Password to connect to Snowflake.
     *
     * Password to connect to Vertica.
     *
     * password to connect to the PinotDB.
     *
     * Password to connect to MongoDB.
     *
     * Password to connect to Couchbase.
     *
     * Password to connect to Doris.
     *
     * Password to connect to SAS Viya
     *
     * Password to connect to Teradata.
     *
     * Password to connect to Azure Synapse.
     *
     * Password to connect to Exasol.
     *
     * Password
     *
     * password to connect to the Amundsen Neo4j Connection.
     *
     * password to connect  to the Atlas.
     *
     * Password to connect to Airbyte.
     */
    password?: string;
    /**
     * Username to connect to Metabase. This user should have privileges to read all the
     * metadata in Metabase.
     *
     * Username to connect to PowerBI report server.
     *
     * Username for Redash
     *
     * Username to connect to MicroStrategy. This user should have privileges to read all the
     * metadata in MicroStrategy.
     *
     * Username to connect to AzureSQL. This user should have privileges to read the metadata.
     *
     * Username to connect to Clickhouse. This user should have privileges to read all the
     * metadata in Clickhouse.
     *
     * Username to connect to DB2. This user should have privileges to read all the metadata in
     * DB2.
     *
     * Username to connect to Druid. This user should have privileges to read all the metadata
     * in Druid.
     *
     * Username to connect to Hive. This user should have privileges to read all the metadata in
     * Hive.
     *
     * Username to connect to Impala. This user should have privileges to read all the metadata
     * in Impala.
     *
     * Username to connect to MariaDB. This user should have privileges to read all the metadata
     * in MariaDB.
     *
     * Username to connect to MSSQL. This user should have privileges to read all the metadata
     * in MsSQL.
     *
     * Username to connect to MySQL. This user should have privileges to read all the metadata
     * in Mysql.
     *
     * Username to connect to SQLite. Blank for in-memory database.
     *
     * Username to connect to Oracle. This user should have privileges to read all the metadata
     * in Oracle.
     *
     * Username to connect to Postgres. This user should have privileges to read all the
     * metadata in Postgres.
     *
     * Username to connect to Presto. This user should have privileges to read all the metadata
     * in Postgres.
     *
     * Username to connect to Redshift. This user should have privileges to read all the
     * metadata in Redshift.
     *
     * Username to connect to the Salesforce. This user should have privileges to read all the
     * metadata in Redshift.
     *
     * Username to connect to SingleStore. This user should have privileges to read all the
     * metadata in MySQL.
     *
     * Username to connect to Snowflake. This user should have privileges to read all the
     * metadata in Snowflake.
     *
     * Username to connect to Trino. This user should have privileges to read all the metadata
     * in Trino.
     *
     * Username to connect to Vertica. This user should have privileges to read all the metadata
     * in Vertica.
     *
     * username to connect to the PinotDB. This user should have privileges to read all the
     * metadata in PinotDB.
     *
     * Username to connect to MongoDB. This user should have privileges to read all the metadata
     * in MongoDB.
     *
     * Username to connect to Cassandra. This user should have privileges to read all the
     * metadata in Cassandra.
     *
     * Username to connect to Couchbase. This user should have privileges to read all the
     * metadata in Couchbase.
     *
     * Username to connect to Greenplum. This user should have privileges to read all the
     * metadata in Greenplum.
     *
     * Username to connect to Doris. This user should have privileges to read all the metadata
     * in Doris.
     *
     * Username to connect to SAS Viya.
     *
     * Username to connect to Teradata. This user should have privileges to read all the
     * metadata in Teradata.
     *
     * Username to connect to Azure Synapse. This user should have privileges to read all the
     * metadata in Azure Synapse.
     *
     * Username to connect to Exasol. This user should have privileges to read all the metadata
     * in Exasol.
     *
     * Username to connect to Cockroach. This user should have privileges to read all the
     * metadata in Cockroach.
     *
     * Username
     *
     * username to connect to the Amundsen Neo4j Connection.
     *
     * username to connect  to the Atlas. This user should have privileges to read all the
     * metadata in Atlas.
     *
     * Username to connect to Airbyte.
     */
    username?: string;
    /**
     * Authority URI for the PowerBI service.
     */
    authorityURI?: string;
    /**
     * Display Table Name from source instead of renamed table name for datamodel tables
     */
    displayTableNameFromSource?: boolean;
    /**
     * Entity Limit set here will be used to paginate the PowerBi APIs
     */
    pagination_entity_per_page?: number;
    /**
     * Source to get the .pbit files to extract lineage information
     */
    pbitFilesSource?: PowerBIPbitFilesSource;
    /**
     * PowerBI secrets.
     */
    scope?: string[];
    /**
     * Tenant ID for PowerBI.
     *
     * Azure Directory (tenant) ID for service principal authentication.
     */
    tenantId?: string;
    /**
     * Fetch the PowerBI metadata using admin APIs
     */
    useAdminApis?: boolean;
    /**
     * Web Portal Virtual Directory Name.
     */
    webPortalVirtualDirectory?: string;
    /**
     * API key of the redash instance to access.
     *
     * The personal access token you can generate in the Lightdash app under the user settings
     *
     * API key to authenticate with the SAP ERP APIs.
     *
     * Fivetran API Secret.
     */
    apiKey?: string;
    /**
     * Version of the Redash instance
     */
    redashVersion?: string;
    /**
     * Choose between API or database connection fetch metadata from superset.
     *
     * Choose between Database connection or HDB User Store connection.
     *
     * Choose between mysql and postgres connection for alation database
     *
     * Underlying database connection. See
     * https://airflow.apache.org/docs/apache-airflow/stable/howto/set-up-database.html for
     * supported backends.
     *
     * Matillion Auth Configuration
     */
    connection?: ConfigConnection;
    /**
     * Tableau API version. If not provided, the version will be used from the tableau server.
     *
     * Sigma API version.
     *
     * ThoughtSpot API version to use
     *
     * OpenMetadata server API version to use.
     *
     * Airbyte API version.
     */
    apiVersion?: string;
    /**
     * Types of methods used to authenticate to the tableau instance
     *
     * Choose Auth Config Type.
     *
     * Types of methods used to authenticate to the alation instance
     */
    authType?: AuthenticationTypeForTableau | NoConfigAuthenticationTypes;
    /**
     * Pagination limit used while querying the tableau metadata API for getting data sources
     *
     * Pagination limit used while querying the SAP ERP API for fetching the entities
     *
     * Pagination limit used for Alation APIs pagination
     */
    paginationLimit?: number;
    /**
     * Proxy URL for the tableau server. If not provided, the hostPort will be used. This is
     * used to generate the dashboard & Chart URL.
     */
    proxyURL?: string;
    /**
     * Tableau Site Name.
     */
    siteName?: string;
    /**
     * SSL Configuration details.
     *
     * SSL Configuration for OpenMetadata Server
     */
    sslConfig?: SSLConfigObject;
    /**
     * Flag to verify SSL Certificate for OpenMetadata Server.
     *
     * Boolean marking if we need to verify the SSL certs for KafkaConnect REST API. True by
     * default.
     */
    verifySSL?: boolean | VerifySSL;
    /**
     * Access Token for Mode Dashboard
     *
     * Access token to connect to DOMO
     */
    accessToken?: string;
    /**
     * Access Token Password for Mode Dashboard
     */
    accessTokenPassword?: string;
    /**
     * Filter query parameter for some of the Mode API calls
     */
    filterQueryParam?: string;
    /**
     * Mode Workspace Name
     */
    workspaceName?:     string;
    connectionOptions?: { [key: string]: string };
    /**
     * Source Python Class Name to instantiated by the ingestion workflow
     */
    sourcePythonClass?: string;
    /**
     * API Host to connect to DOMO instance
     */
    apiHost?: string;
    /**
     * URL of your Domo instance, e.g., https://openmetadata.domo.com
     */
    instanceDomain?: string;
    /**
     * Secret Token to connect DOMO
     *
     * Secret token to connect to DOMO
     */
    secretToken?: string;
    /**
     * AWS Account ID
     */
    awsAccountId?: string;
    awsConfig?:    AWSCredentials;
    /**
     * The authentication method that the user uses to sign in.
     */
    identityType?: IdentityType;
    /**
     * The Amazon QuickSight namespace that contains the dashboard IDs in this request ( To be
     * provided when identityType is `ANONYMOUS` )
     */
    namespace?:    string;
    certificates?: QlikCertificatesBy;
    /**
     * Qlik Sense Base URL, used for genrating dashboard & chat url
     */
    displayUrl?: string;
    /**
     * User Directory.
     */
    userDirectory?: string;
    /**
     * User ID.
     */
    userId?: string;
    /**
     * Validate Host Name
     */
    validateHostName?: boolean;
    /**
     * The Project UUID for your Lightdash instance
     */
    projectUUID?: string;
    /**
     * Use if your Lightdash instance is behind a proxy like (Cloud IAP)
     */
    proxyAuthentication?: string;
    /**
     * The Space UUID for your Lightdash instance
     */
    spaceUUID?: string;
    /**
     * Login Mode for Microstrategy's REST API connection. You can authenticate with one of the
     * following authentication modes: `Standard (1)`, `Anonymous (8)`. Default will be
     * `Standard (1)`. If you're using demo account for Microstrategy, it will be needed to
     * authenticate through loginMode `8`.
     */
    loginMode?: string;
    /**
     * MicroStrategy Project Name
     *
     * Project name to create the refreshToken. Can be anything
     */
    projectName?: string;
    /**
     * Space types of Qlik Cloud to filter the dashboards ingested into the platform.
     */
    spaceTypes?: SpaceType[];
    /**
     * ThoughtSpot authentication configuration
     */
    authentication?: Authenticationation;
    /**
     * Org ID for multi-tenant ThoughtSpot instances. This is applicable for ThoughtSpot Cloud
     * only.
     */
    orgId?: string;
    /**
     * Billing Project ID
     */
    billingProjectId?: string;
    /**
     * If using Metastore, Key-Value pairs that will be used to add configs to the SparkSession.
     */
    connectionArguments?: { [key: string]: any };
    /**
     * Cost per TiB for BigQuery usage
     */
    costPerTB?: number;
    /**
     * GCP Credentials
     *
     * Azure Credentials
     */
    credentials?: GCPCredentials;
    /**
     * Regex to only include/exclude databases that matches the pattern.
     */
    databaseFilterPattern?:   FilterPattern;
    sampleDataStorageConfig?: SampleDataStorageConfig;
    /**
     * Regex to only include/exclude schemas that matches the pattern.
     *
     * Regex to include/exclude FHIR resource categories
     */
    schemaFilterPattern?: FilterPattern;
    /**
     * SQLAlchemy driver scheme options.
     *
     * Mongo connection scheme options.
     *
     * Couchbase driver scheme options.
     */
    scheme?:                                ConfigScheme;
    supportsDatabase?:                      boolean;
    supportsDataDiff?:                      boolean;
    supportsDBTExtraction?:                 boolean;
    supportsIncrementalMetadataExtraction?: boolean;
    /**
     * Supports Lineage Extraction.
     */
    supportsLineageExtraction?: boolean;
    supportsProfiler?:          boolean;
    supportsQueryComment?:      boolean;
    supportsSystemProfile?:     boolean;
    /**
     * Supports Usage Extraction.
     */
    supportsUsageExtraction?: boolean;
    /**
     * Regex to only include/exclude tables that matches the pattern.
     *
     * Regex to include/exclude FHIR resource types
     */
    tableFilterPattern?: FilterPattern;
    /**
     * Taxonomy location used to fetch policy tags
     */
    taxonomyLocation?: string;
    /**
     * Project IDs used to fetch policy tags
     */
    taxonomyProjectID?: string[];
    /**
     * Location used to query INFORMATION_SCHEMA.JOBS_BY_PROJECT to fetch usage data. You can
     * pass multi-regions, such as `us` or `eu`, or you specific region. Australia and Asia
     * multi-regions are not yet in GA.
     */
    usageLocation?: string;
    /**
     * Optional name to give to the database in OpenMetadata. If left blank, we will use default
     * as the database name.
     *
     * Optional name to give to the database in OpenMetadata. If left blank, we will use 'epic'
     * as the database name.
     */
    databaseName?: string;
    /**
     * S3 Staging Directory. Example: s3://postgres/input/
     */
    s3StagingDir?: string;
    /**
     * Athena workgroup.
     */
    workgroup?: string;
    /**
     * This parameter determines the mode of authentication for connecting to AzureSQL using
     * ODBC. If 'Active Directory Password' is selected, you need to provide the password. If
     * 'Active Directory Integrated' is selected, password is not required as it uses the
     * logged-in user's credentials. This mode is useful for establishing secure and seamless
     * connections with AzureSQL.
     *
     * This parameter determines the mode of authentication for connecting to Azure Synapse
     * using ODBC. If 'Active Directory Password' is selected, you need to provide the password.
     * If 'Active Directory Integrated' is selected, password is not required as it uses the
     * logged-in user's credentials. If 'Active Directory Service Principal' is selected, you
     * need to provide clientId, clientSecret and tenantId. This mode is useful for establishing
     * secure and seamless connections with Azure Synapse.
     */
    authenticationMode?: any[] | boolean | number | null | AuthenticationModeObject | string;
    /**
     * Database of the data source. This is optional parameter, if you would like to restrict
     * the metadata reading to a single database. When left blank, OpenMetadata Ingestion
     * attempts to scan all the databases.
     *
     * Database of the data source.
     *
     * Initial Redshift database to connect to. If you want to ingest all databases, set
     * ingestAllDatabases to true.
     *
     * Optional name to give to the database in OpenMetadata. If left blank, we will use default
     * as the database name.
     */
    database?: string;
    /**
     * SQLAlchemy driver for AzureSQL.
     *
     * ODBC driver version in case of pyodbc connection.
     */
    driver?: string;
    /**
     * Ingest data from all databases in Azuresql. You can use databaseFilterPattern on top of
     * this.
     *
     * Ingest data from all databases in Mssql. You can use databaseFilterPattern on top of
     * this.
     *
     * Ingest data from all databases in Postgres. You can use databaseFilterPattern on top of
     * this.
     *
     * Ingest data from all databases in Redshift. You can use databaseFilterPattern on top of
     * this.
     *
     * Ingest data from all databases in Greenplum. You can use databaseFilterPattern on top of
     * this.
     *
     * Ingest data from all databases in Azure Synapse. You can use databaseFilterPattern on top
     * of this.
     */
    ingestAllDatabases?: boolean;
    /**
     * Database Schema of the data source. This is optional parameter, if you would like to
     * restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion
     * attempts to scan all the schemas.
     *
     * databaseSchema of the data source. This is optional parameter, if you would like to
     * restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata
     * Ingestion attempts to scan all the databaseSchema.
     *
     * Optional name to give to the schema in OpenMetadata. If left blank, we will use default
     * as the schema name
     */
    databaseSchema?: string;
    /**
     * Clickhouse SQL connection duration.
     */
    duration?: number;
    /**
     * Use HTTPS Protocol for connection with clickhouse
     */
    https?: boolean;
    /**
     * Path to key file for establishing secure connection
     */
    keyfile?: string;
    /**
     * Establish secure connection with clickhouse
     */
    secure?: boolean;
    /**
     * Catalog of the data source(Example: hive_metastore). This is optional parameter, if you
     * would like to restrict the metadata reading to a single catalog. When left blank,
     * OpenMetadata Ingestion attempts to scan all the catalog.
     *
     * Presto catalog
     *
     * Catalog of the data source.
     */
    catalog?: IcebergCatalog | string;
    /**
     * The maximum amount of time (in seconds) to wait for a successful connection to the data
     * source. If the connection attempt takes longer than this timeout period, an error will be
     * returned.
     *
     * Connection timeout in seconds.
     */
    connectionTimeout?: number | number;
    /**
     * Databricks compute resources URL.
     */
    httpPath?: string;
    /**
     * Table name to fetch the query history.
     */
    queryHistoryTable?: string;
    /**
     * CLI Driver version to connect to DB2. If not provided, the latest version will be used.
     */
    clidriverVersion?: string;
    /**
     * License to connect to DB2.
     */
    license?: string;
    /**
     * License file name to connect to DB2.
     */
    licenseFileName?:               string;
    supportsViewLineageExtraction?: boolean;
    /**
     * Available sources to fetch the metadata.
     *
     * Available sources to fetch files.
     *
     * Available sources to fetch metadata.
     */
    configSource?: DeltaLakeConfigurationSource;
    /**
     * Authentication mode to connect to hive.
     */
    auth?: AuthEnum;
    /**
     * Authentication options to pass to Hive connector. These options are based on SQLAlchemy.
     *
     * Authentication options to pass to Impala connector. These options are based on SQLAlchemy.
     */
    authOptions?: string;
    /**
     * If authenticating with Kerberos specify the Kerberos service name
     */
    kerberosServiceName?: string;
    /**
     * Hive Metastore Connection Details
     */
    metastoreConnection?: HiveMetastoreConnectionDetails;
    /**
     * Authentication mode to connect to Impala.
     */
    authMechanism?: AuthMechanismEnum;
    /**
     * Establish secure connection with Impala
     */
    useSSL?: boolean;
    /**
     * Use slow logs to extract lineage.
     */
    useSlowLogs?: boolean;
    /**
     * How to run the SQLite database. :memory: by default.
     */
    databaseMode?: string;
    /**
     * This directory will be used to set the LD_LIBRARY_PATH env variable. It is required if
     * you need to enable thick connection mode. By default, we bring instant client 19 and
     * point to /instantclient.
     */
    instantClientDirectory?: string;
    /**
     * Connect with oracle by either passing service name or database schema name.
     */
    oracleConnectionType?: OracleConnectionType;
    /**
     * Custom OpenMetadata Classification name for Postgres policy tags.
     */
    classificationName?: string;
    sslMode?:            SSLMode;
    /**
     * Protocol ( Connection Argument ) to connect to Presto.
     */
    protocol?: string;
    /**
     * Verify ( Connection Argument for SSL ) to connect to Presto.
     *
     * Verify ( Connection Argument for SSL ) to connect to Trino.
     */
    verify?: string;
    /**
     * Salesforce Organization ID is the unique identifier for your Salesforce identity
     */
    organizationId?: string;
    /**
     * API version of the Salesforce instance
     */
    salesforceApiVersion?: string;
    /**
     * Domain of Salesforce instance
     */
    salesforceDomain?: string;
    /**
     * Salesforce Security Token.
     */
    securityToken?: string;
    /**
     * Salesforce Object Name.
     */
    sobjectName?: string;
    /**
     * If the Snowflake URL is https://xyz1234.us-east-1.gcp.snowflakecomputing.com, then the
     * account is xyz1234.us-east-1.gcp
     *
     * Specifies an account string to override the default account string defined for the
     * database user. Accounts are used by the database for workload management and resource
     * usage monitoring.
     */
    account?: string;
    /**
     * Full name of the schema where the account usage data is stored.
     */
    accountUsageSchema?: string;
    /**
     * Optional configuration for ingestion to keep the client session active in case the
     * ingestion process runs for longer durations.
     */
    clientSessionKeepAlive?: boolean;
    /**
     * Cost of credit for the Snowflake account.
     */
    creditCost?: number;
    /**
     * Optional configuration for ingestion of streams, By default, it will skip the streams.
     */
    includeStreams?: boolean;
    /**
     * Optional configuration for ingestion of TRANSIENT tables, By default, it will skip the
     * TRANSIENT tables.
     */
    includeTransientTables?: boolean;
    /**
     * Connection to Snowflake instance via Private Key
     */
    privateKey?: string;
    /**
     * Session query tag used to monitor usage on snowflake. To use a query tag snowflake user
     * should have enough privileges to alter the session.
     */
    queryTag?: string;
    /**
     * Snowflake Role.
     */
    role?: string;
    /**
     * Snowflake Passphrase Key used with Private Key
     */
    snowflakePrivatekeyPassphrase?: string;
    /**
     * Snowflake warehouse.
     */
    warehouse?: string;
    /**
     * Proxies for the connection to Trino data source
     */
    proxies?: { [key: string]: string };
    /**
     * Pinot Controller Host and Port of the data source.
     */
    pinotControllerHost?: string;
    /**
     * Bucket Name of the data source.
     */
    bucketName?: string;
    /**
     * Prefix of the data source.
     */
    prefix?: string;
    /**
     * Couchbase connection Bucket options.
     */
    bucket?: string;
    /**
     * Hostname of the Couchbase service.
     */
    hostport?: string;
    /**
     * Enable dataflow for ingestion
     */
    dataflows?: boolean;
    /**
     * Custom filter for dataflows
     */
    dataflowsCustomFilter?: { [key: string]: any } | string;
    /**
     * Enable datatables for ingestion
     */
    datatables?: boolean;
    /**
     * Custom filter for datatables
     */
    dataTablesCustomFilter?: { [key: string]: any } | string;
    /**
     * Enable report for ingestion
     */
    reports?: boolean;
    /**
     * Custom filter for reports
     */
    reportsCustomFilter?: { [key: string]: any } | string;
    /**
     * Hostname of SAS Viya deployment.
     */
    serverHost?: string;
    /**
     * Table property to look for the Owner.
     */
    ownershipProperty?: string;
    /**
     * Specifies additional data needed by a logon mechanism, such as a secure token,
     * Distinguished Name, or a domain/realm name. LOGDATA values are specific to each logon
     * mechanism.
     */
    logdata?: string;
    /**
     * Specifies the logon authentication method. Possible values are TD2 (the default), JWT,
     * LDAP, KRB5 for Kerberos, or TDNEGO
     */
    logmech?: Logmech;
    /**
     * Specifies the transaction mode for the connection
     */
    tmode?: TransactionMode;
    /**
     * Client SSL/TLS settings.
     */
    tls?: SSLTLSSettings;
    /**
     * HTTP Link for SSAS ACCESS
     */
    httpConnection?: string;
    /**
     * Base URL of the Epic FHIR server
     */
    fhirServerUrl?: string;
    /**
     * FHIR specification version (R4, STU3, DSTU2)
     */
    fhirVersion?: FHIRVersion;
    /**
     * basic.auth.user.info schema registry config property, Client HTTP credentials in the form
     * of username:password.
     */
    basicAuthUserInfo?: string;
    /**
     * Kafka bootstrap servers. add them in comma separated values ex: host1:9092,host2:9092
     *
     * Redpanda bootstrap servers. add them in comma separated values ex: host1:9092,host2:9092
     */
    bootstrapServers?: string;
    /**
     * Confluent Kafka Consumer Config. From
     * https://github.com/edenhill/librdkafka/blob/master/CONFIGURATION.md
     *
     * Confluent Redpanda Consumer Config
     */
    consumerConfig?: { [key: string]: any };
    /**
     * Consumer Config SSL Config. Configuration for enabling SSL for the Consumer Config
     * connection.
     */
    consumerConfigSSL?: ConsumerConfigSSLClass;
    /**
     * sasl.mechanism Consumer Config property
     */
    saslMechanism?: SaslMechanismType;
    /**
     * sasl.password consumer config property
     */
    saslPassword?: string;
    /**
     * sasl.username consumer config property
     */
    saslUsername?: string;
    /**
     * Confluent Kafka Schema Registry Config. From
     * https://docs.confluent.io/5.5.1/clients/confluent-kafka-python/index.html#confluent_kafka.schema_registry.SchemaRegistryClient
     *
     * Confluent Redpanda Schema Registry Config.
     */
    schemaRegistryConfig?: { [key: string]: any };
    /**
     * Schema Registry SSL Config. Configuration for enabling SSL for the Schema Registry
     * connection.
     */
    schemaRegistrySSL?: ConsumerConfigSSLClass;
    /**
     * Schema Registry Topic Suffix Name. The suffix to be appended to the topic name to get
     * topic schema from registry.
     */
    schemaRegistryTopicSuffixName?: string;
    /**
     * Confluent Kafka Schema Registry URL.
     *
     * Confluent Redpanda Schema Registry URL.
     */
    schemaRegistryURL?: string;
    /**
     * security.protocol consumer config property
     *
     * Kafka security protocol config
     */
    securityProtocol?: KafkaSecurityProtocol;
    /**
     * Regex to only fetch topics that matches the pattern.
     */
    topicFilterPattern?: FilterPattern;
    /**
     * Enable encryption for the Amundsen Neo4j Connection.
     */
    encrypted?: boolean;
    /**
     * Maximum connection lifetime for the Amundsen Neo4j Connection.
     */
    maxConnectionLifeTime?: number;
    /**
     * Enable SSL validation for the Amundsen Neo4j Connection.
     */
    validateSSL?: boolean;
    /**
     * Maximum number of events sent in a batch (Default 100).
     */
    batchSize?: number;
    /**
     * List of entities that you need to reindex
     */
    entities?:      string[];
    recreateIndex?: boolean;
    runMode?:       RunMode;
    /**
     * Recreate Indexes with updated Language
     */
    searchIndexMappingLanguage?: SearchIndexMappingLanguage;
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
    elasticsSearch?: ConfigElasticsSearch;
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
     * service type of the data source.
     */
    databaseServiceName?: string[];
    /**
     * Name of the Entity Type available in Atlas.
     */
    entity_type?: string;
    /**
     * service type of the messaging source
     *
     * Name of the Kafka Messaging Service associated with this KafkaConnect Pipeline Service.
     * e.g. local_kafka
     */
    messagingServiceName?: string[] | string;
    /**
     * Custom OpenMetadata Classification name for alation tags.
     */
    alationTagClassificationName?: string;
    /**
     * Specifies if hidden datasources should be included while ingesting.
     */
    includeHiddenDatasources?: boolean;
    /**
     * Specifies if undeployed datasources should be included while ingesting.
     */
    includeUndeployedDatasources?: boolean;
    /**
     * Specifies if Dashboards are to be ingested while running the ingestion job.
     */
    ingestDashboards?: boolean;
    /**
     * Specifies if Datasources are to be ingested while running the ingestion job.
     */
    ingestDatasources?: boolean;
    /**
     * Specifies if Domains are to be ingested while running the ingestion job.
     */
    ingestDomains?: boolean;
    /**
     * Specifies if Knowledge Articles are to be ingested while running the ingestion job.
     */
    ingestKnowledgeArticles?: boolean;
    /**
     * Specifies if Users and Groups are to be ingested while running the ingestion job.
     */
    ingestUsersAndGroups?: boolean;
    datasourceLinks?:      { [key: string]: string };
    /**
     * Pipeline Service Number Of Status
     */
    numberOfStatus?: number;
    /**
     * Regex exclude pipelines.
     */
    pipelineFilterPattern?: FilterPattern;
    /**
     * Underlying database connection
     */
    databaseConnection?: DatabaseConnectionClass;
    /**
     * Underlying storage connection
     */
    packageConnection?: S3Connection | string;
    /**
     * Fivetran API Secret.
     */
    apiSecret?: string;
    /**
     * Fivetran API Limit For Pagination.
     */
    limit?: number;
    /**
     * URL to the Dagster instance
     *
     * DBT cloud Access URL.
     */
    host?: string;
    /**
     * Connection Time Limit Between OM and Dagster Graphql API in second
     */
    timeout?: number;
    /**
     * We support username/password or client certificate authentication
     */
    nifiConfig?: NifiCredentialsConfiguration;
    /**
     * Spline UI Host & Port.
     */
    uiHostPort?: string;
    /**
     * service type of the messaging source
     */
    brokersUrl?: string;
    /**
     * consumer group name
     */
    consumerGroupName?: string;
    /**
     * initial Kafka consumer offset
     */
    consumerOffsets?: InitialConsumerOffsets;
    /**
     * max allowed wait time
     */
    poolTimeout?: number;
    /**
     * SASL Configuration details.
     */
    saslConfig?: SASLClientConfig;
    /**
     * max allowed inactivity time
     */
    sessionTimeout?: number;
    /**
     * topic from where Open lineage events will be pulled
     */
    topicName?: string;
    /**
     * We support username/password or No Authentication
     */
    KafkaConnectConfig?: UsernamePasswordAuthentication;
    /**
     * ID of your DBT cloud account
     */
    accountId?: string;
    /**
     * DBT cloud Metadata API URL.
     */
    discoveryAPI?: string;
    /**
     * List of IDs of your DBT cloud jobs seperated by comma `,`
     */
    jobIds?: string[];
    /**
     * Number of runs to fetch from DBT cloud
     */
    numberOfRuns?: number;
    /**
     * List of IDs of your DBT cloud projects seperated by comma `,`
     */
    projectIds?: string[];
    /**
     * The name of your azure data factory.
     */
    factory_name?: string;
    /**
     * The name of your resource group the data factory is associated with.
     */
    resource_group_name?: string;
    /**
     * Number of days in the past to filter pipeline runs.
     */
    run_filter_days?: number;
    /**
     * The azure subscription identifier.
     */
    subscription_id?: string;
    /**
     * Regex to only fetch MlModels with names matching the pattern.
     */
    mlModelFilterPattern?: FilterPattern;
    /**
     * Mlflow Model registry backend. E.g.,
     * mysql+pymysql://mlflow:password@localhost:3307/experiments
     */
    registryUri?: string;
    /**
     * Mlflow Experiment tracking URI. E.g., http://localhost:5000
     */
    trackingUri?: string;
    /**
     * location/region of google cloud project
     */
    location?: string;
    /**
     * Bucket Names of the data source.
     */
    bucketNames?: string[];
    /**
     * Regex to only fetch containers that matches the pattern.
     */
    containerFilterPattern?: FilterPattern;
    /**
     * Connection Timeout in Seconds
     */
    connectionTimeoutSecs?: number;
    /**
     * Regex to only fetch search indexes that matches the pattern.
     */
    searchIndexFilterPattern?: FilterPattern;
}

/**
 * We support username/password or No Authentication
 *
 * username/password auth
 */
export interface UsernamePasswordAuthentication {
    /**
     * KafkaConnect password to authenticate to the API.
     */
    password?: string;
    /**
     * KafkaConnect user to authenticate to the API.
     */
    username?: string;
}

/**
 * Authentication mode to connect to hive.
 */
export enum AuthEnum {
    Basic = "BASIC",
    Custom = "CUSTOM",
    Gssapi = "GSSAPI",
    Jwt = "JWT",
    Kerberos = "KERBEROS",
    LDAP = "LDAP",
    None = "NONE",
    Nosasl = "NOSASL",
    Plain = "PLAIN",
}

/**
 * Authentication mode to connect to Impala.
 */
export enum AuthMechanismEnum {
    Gssapi = "GSSAPI",
    Jwt = "JWT",
    LDAP = "LDAP",
    Nosasl = "NOSASL",
    Plain = "PLAIN",
}

/**
 * Types of methods used to authenticate to the tableau instance
 *
 * Basic Auth Credentials
 *
 * Access Token Auth Credentials
 *
 * Choose Auth Config Type.
 *
 * Common Database Connection Config
 *
 * IAM Auth Database Connection Config
 *
 * Azure Database Connection Config
 *
 * Configuration for connecting to DataStax Astra DB in the cloud.
 *
 * ThoughtSpot authentication configuration
 *
 * Types of methods used to authenticate to the alation instance
 *
 * API Access Token Auth Credentials
 *
 * Basic Auth Configuration for ElasticSearch
 *
 * SSL Certificates By Path
 *
 * AWS credentials configs.
 */
export interface AuthenticationTypeForTableau {
    /**
     * Password to access the service.
     *
     * Password to connect to source.
     *
     * Elastic Search Password for Login
     */
    password?: string;
    /**
     * Username to access the service.
     *
     * Elastic Search Username for Login
     */
    username?: string;
    /**
     * Personal Access Token Name.
     */
    personalAccessTokenName?: string;
    /**
     * Personal Access Token Secret.
     */
    personalAccessTokenSecret?: string;
    awsConfig?:                 AWSCredentials;
    azureConfig?:               AzureCredentials;
    /**
     * JWT to connect to source.
     */
    jwt?: string;
    /**
     * Configuration for connecting to DataStax Astra DB in the cloud.
     */
    cloudConfig?: DataStaxAstraDBConfiguration;
    /**
     * Access Token for the API
     */
    accessToken?: string;
    /**
     * CA Certificate Path
     */
    caCertPath?: string;
    /**
     * Client Certificate Path
     */
    clientCertPath?: string;
    /**
     * Private Key Path
     */
    privateKeyPath?: string;
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
}

/**
 * AWS credentials configs.
 */
export interface AWSCredentials {
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
    awsRegion: string;
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
}

/**
 * Azure Cloud Credentials
 *
 * Available sources to fetch metadata.
 *
 * Azure Credentials
 */
export interface AzureCredentials {
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
}

/**
 * Configuration for connecting to DataStax Astra DB in the cloud.
 */
export interface DataStaxAstraDBConfiguration {
    /**
     * Timeout in seconds for establishing new connections to Cassandra.
     */
    connectTimeout?: number;
    /**
     * Timeout in seconds for individual Cassandra requests.
     */
    requestTimeout?: number;
    /**
     * File path to the Secure Connect Bundle (.zip) used for a secure connection to DataStax
     * Astra DB.
     */
    secureConnectBundle?: string;
    /**
     * The Astra DB application token used for authentication.
     */
    token?: string;
    [property: string]: any;
}

/**
 * Database Authentication types not requiring config.
 */
export enum NoConfigAuthenticationTypes {
    OAuth2 = "OAuth2",
}

/**
 * ThoughtSpot authentication configuration
 *
 * Types of methods used to authenticate to the alation instance
 *
 * Basic Auth Credentials
 *
 * API Access Token Auth Credentials
 */
export interface Authenticationation {
    /**
     * Password to access the service.
     */
    password?: string;
    /**
     * Username to access the service.
     */
    username?: string;
    /**
     * Access Token for the API
     */
    accessToken?: string;
}

export interface AuthenticationModeObject {
    /**
     * Authentication from Connection String for AzureSQL.
     *
     * Authentication from Connection String for Azure Synapse.
     */
    authentication?: Authentication;
    /**
     * Connection Timeout from Connection String for AzureSQL.
     *
     * Connection Timeout from Connection String for Azure Synapse.
     */
    connectionTimeout?: number;
    /**
     * Encrypt from Connection String for AzureSQL.
     *
     * Encrypt from Connection String for Azure Synapse.
     */
    encrypt?: boolean;
    /**
     * Trust Server Certificate from Connection String for AzureSQL.
     *
     * Trust Server Certificate from Connection String for Azure Synapse.
     */
    trustServerCertificate?: boolean;
    [property: string]: any;
}

/**
 * Authentication from Connection String for AzureSQL.
 *
 * Authentication from Connection String for Azure Synapse.
 */
export enum Authentication {
    ActiveDirectoryIntegrated = "ActiveDirectoryIntegrated",
    ActiveDirectoryPassword = "ActiveDirectoryPassword",
    ActiveDirectoryServicePrincipal = "ActiveDirectoryServicePrincipal",
}

/**
 * Iceberg Catalog configuration.
 */
export interface IcebergCatalog {
    /**
     * Catalog connection configuration, depending on your catalog type.
     */
    connection: Connection;
    /**
     * Custom Database Name for your Iceberg Service. If not set it will be 'default'.
     */
    databaseName?: string;
    /**
     * Catalog Name.
     */
    name: string;
    /**
     * Warehouse Location. Used to specify a custom warehouse location if needed.
     */
    warehouseLocation?: string;
}

/**
 * Catalog connection configuration, depending on your catalog type.
 *
 * Iceberg Hive Catalog configuration.
 *
 * Iceberg REST Catalog configuration.
 *
 * Iceberg Glue Catalog configuration.
 *
 * Iceberg DynamoDB Catalog configuration.
 */
export interface Connection {
    fileSystem?: IcebergFileSystem;
    /**
     * Uri to the Hive Metastore. Example: 'thrift://localhost:9083'
     *
     * Uri to the REST catalog. Example: 'http://rest-catalog/ws/'
     */
    uri?: string;
    /**
     * OAuth2 credential to use when initializing the catalog.
     */
    credential?: OAuth2Credential;
    /**
     * Sign requests to the REST Server using AWS SigV4 protocol.
     */
    sigv4?: Sigv4;
    /**
     * SSL Configuration details.
     */
    ssl?: SSLCertificatesByPath;
    /**
     * Berarer token to use for the 'Authorization' header.
     */
    token?:     string;
    awsConfig?: AWSCredentials;
    /**
     * DynamoDB table name.
     */
    tableName?: string;
}

/**
 * OAuth2 credential to use when initializing the catalog.
 */
export interface OAuth2Credential {
    /**
     * OAuth2 Client ID.
     */
    clientId?: string;
    /**
     * OAuth2 Client Secret
     */
    clientSecret?: string;
}

/**
 * Iceberg File System configuration, based on where the Iceberg Warehouse is located.
 */
export interface IcebergFileSystem {
    type?: Credentials | null;
}

/**
 * AWS credentials configs.
 *
 * Azure Cloud Credentials
 *
 * Available sources to fetch metadata.
 *
 * Azure Credentials
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
}

/**
 * Sign requests to the REST Server using AWS SigV4 protocol.
 */
export interface Sigv4 {
    /**
     * The service signing name to use when SigV4 signs a request.
     */
    signingName?: string;
    /**
     * AWS Region to use when SigV4 signs a request.
     */
    signingRegion?: string;
    [property: string]: any;
}

/**
 * SSL Configuration details.
 *
 * SSL Certificates By Path
 */
export interface SSLCertificatesByPath {
    /**
     * CA Certificate Path
     */
    caCertPath?: string;
    /**
     * Client Certificate Path
     */
    clientCertPath?: string;
    /**
     * Private Key Path
     */
    privateKeyPath?: string;
}

/**
 * Qlik Authentication Certificate By Values
 *
 * Qlik Authentication Certificate File Path
 */
export interface QlikCertificatesBy {
    sslConfig?: ConsumerConfigSSLClass;
    /**
     * Client Certificate
     */
    clientCertificate?: string;
    /**
     * Client Key Certificate.
     */
    clientKeyCertificate?: string;
    /**
     * Root Certificate.
     */
    rootCertificate?: string;
    [property: string]: any;
}

/**
 * Available sources to fetch the metadata.
 *
 * Deltalake Metastore configuration.
 *
 * DeltaLake Storage Connection Config
 *
 * Available sources to fetch files.
 *
 * Local config source where no extra information needs to be sent.
 *
 * Azure Datalake Storage will ingest files in container
 *
 * DataLake GCS storage will ingest metadata of files
 *
 * DataLake S3 bucket will ingest metadata of files in bucket
 *
 * Azure Cloud Credentials
 *
 * Available sources to fetch metadata.
 *
 * Azure Credentials
 */
export interface DeltaLakeConfigurationSource {
    /**
     * pySpark App Name.
     */
    appName?: string;
    /**
     * Metastore connection configuration, depending on your metastore type.
     *
     * Available sources to fetch files.
     */
    connection?: ConfigSourceConnection;
    /**
     * Bucket Name of the data source.
     */
    bucketName?: string;
    /**
     * Prefix of the data source.
     */
    prefix?:         string;
    securityConfig?: DbtSecurityConfigClass;
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
}

/**
 * Metastore connection configuration, depending on your metastore type.
 *
 * Available sources to fetch files.
 *
 * DataLake S3 bucket will ingest metadata of files in bucket
 */
export interface ConfigSourceConnection {
    /**
     * Thrift connection to the metastore service. E.g., localhost:9083
     */
    metastoreHostPort?: string;
    /**
     * Driver class name for JDBC metastore. The value will be mapped as
     * spark.hadoop.javax.jdo.option.ConnectionDriverName sparks property. E.g.,
     * org.mariadb.jdbc.Driver
     */
    driverName?: string;
    /**
     * Class path to JDBC driver required for JDBC connection. The value will be mapped as
     * spark.driver.extraClassPath sparks property.
     */
    jdbcDriverClassPath?: string;
    /**
     * JDBC connection to the metastore database. E.g., jdbc:mysql://localhost:3306/demo_hive
     */
    metastoreDb?: string;
    /**
     * Password to use against metastore database. The value will be mapped as
     * spark.hadoop.javax.jdo.option.ConnectionPassword sparks property.
     */
    password?: string;
    /**
     * Username to use against metastore database. The value will be mapped as
     * spark.hadoop.javax.jdo.option.ConnectionUserName sparks property.
     */
    username?: string;
    /**
     * Local path for the local file with metastore data. E.g., /tmp/metastore.db
     */
    metastoreFilePath?: string;
    securityConfig?:    AWSCredentials;
}

/**
 * Choose between API or database connection fetch metadata from superset.
 *
 * Superset API Connection Config
 *
 * Postgres Database Connection Config
 *
 * Mysql Database Connection Config
 *
 * Choose between Database connection or HDB User Store connection.
 *
 * Sap Hana Database SQL Connection Config
 *
 * Sap Hana Database HDB User Store Connection Config
 *
 * Choose between mysql and postgres connection for alation database
 *
 * Underlying database connection. See
 * https://airflow.apache.org/docs/apache-airflow/stable/howto/set-up-database.html for
 * supported backends.
 *
 * Lineage Backend Connection Config
 *
 * SQLite Database Connection Config
 *
 * Matillion Auth Configuration
 *
 * Matillion ETL Auth Config.
 */
export interface ConfigConnection {
    /**
     * Password for Superset.
     *
     * Password to connect to Hana.
     *
     * Password to connect to SQLite. Blank for in-memory database.
     *
     * Password to connect to the Matillion.
     */
    password?: string;
    /**
     * Authentication provider for the Superset service. For basic user/password authentication,
     * the default value `db` can be used. This parameter is used internally to connect to
     * Superset's REST API.
     */
    provider?: Provider;
    /**
     * SSL Configuration details.
     */
    sslConfig?: ConnectionSSLConfig;
    /**
     * Username for Superset.
     *
     * Username to connect to Postgres. This user should have privileges to read all the
     * metadata in Postgres.
     *
     * Username to connect to MySQL. This user should have privileges to read all the metadata
     * in Mysql.
     *
     * Username to connect to Hana. This user should have privileges to read all the metadata.
     *
     * Username to connect to SQLite. Blank for in-memory database.
     *
     * Username to connect to the Matillion. This user should have privileges to read all the
     * metadata in Matillion.
     */
    username?:  string;
    verifySSL?: VerifySSL;
    /**
     * Choose Auth Config Type.
     */
    authType?: AuthConfigurationType;
    /**
     * Custom OpenMetadata Classification name for Postgres policy tags.
     */
    classificationName?:  string;
    connectionArguments?: { [key: string]: any };
    connectionOptions?:   { [key: string]: string };
    /**
     * Database of the data source. This is optional parameter, if you would like to restrict
     * the metadata reading to a single database. When left blank, OpenMetadata Ingestion
     * attempts to scan all the databases.
     *
     * Database of the data source.
     */
    database?: string;
    /**
     * Regex to only include/exclude databases that matches the pattern.
     */
    databaseFilterPattern?: FilterPattern;
    /**
     * Host and port of the source service.
     *
     * Host and port of the MySQL service.
     *
     * Host and port of the Hana service.
     *
     * Host and port of the SQLite service. Blank for in-memory database.
     *
     * Matillion Host
     */
    hostPort?: string;
    /**
     * Ingest data from all databases in Postgres. You can use databaseFilterPattern on top of
     * this.
     */
    ingestAllDatabases?:      boolean;
    sampleDataStorageConfig?: SampleDataStorageConfig;
    /**
     * Regex to only include/exclude schemas that matches the pattern.
     */
    schemaFilterPattern?: FilterPattern;
    /**
     * SQLAlchemy driver scheme options.
     */
    scheme?:                     ConnectionScheme;
    sslMode?:                    SSLMode;
    supportsDatabase?:           boolean;
    supportsDataDiff?:           boolean;
    supportsDBTExtraction?:      boolean;
    supportsLineageExtraction?:  boolean;
    supportsMetadataExtraction?: boolean;
    supportsProfiler?:           boolean;
    supportsQueryComment?:       boolean;
    supportsUsageExtraction?:    boolean;
    /**
     * Regex to only include/exclude tables that matches the pattern.
     */
    tableFilterPattern?: FilterPattern;
    /**
     * Service Type
     */
    type?: ConnectionType;
    /**
     * Optional name to give to the database in OpenMetadata. If left blank, we will use default
     * as the database name.
     */
    databaseName?: string;
    /**
     * Database Schema of the data source. This is optional parameter, if you would like to
     * restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion
     * attempts to scan all the schemas.
     *
     * Database Schema of the data source. This is an optional parameter, if you would like to
     * restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion
     * attempts to scan all the schemas.
     */
    databaseSchema?: string;
    /**
     * Use slow logs to extract lineage.
     */
    useSlowLogs?: boolean;
    /**
     * HDB Store User Key generated from the command `hdbuserstore SET <KEY> <host:port>
     * <USERNAME> <PASSWORD>`
     */
    userKey?: string;
    /**
     * Regex exclude pipelines.
     */
    pipelineFilterPattern?: FilterPattern;
    /**
     * How to run the SQLite database. :memory: by default.
     */
    databaseMode?:                  string;
    supportsViewLineageExtraction?: boolean;
}

/**
 * Choose Auth Config Type.
 *
 * Common Database Connection Config
 *
 * IAM Auth Database Connection Config
 *
 * Azure Database Connection Config
 */
export interface AuthConfigurationType {
    /**
     * Password to connect to source.
     */
    password?:    string;
    awsConfig?:   AWSCredentials;
    azureConfig?: AzureCredentials;
}

/**
 * Authentication provider for the Superset service. For basic user/password authentication,
 * the default value `db` can be used. This parameter is used internally to connect to
 * Superset's REST API.
 */
export enum Provider {
    DB = "db",
    LDAP = "ldap",
}

/**
 * Storage config to store sample data
 */
export interface SampleDataStorageConfig {
    config?: DataStorageConfig;
}

/**
 * Storage config to store sample data
 */
export interface DataStorageConfig {
    /**
     * Bucket Name
     */
    bucketName?: string;
    /**
     * Provide the pattern of the path where the generated sample data file needs to be stored.
     */
    filePathPattern?: string;
    /**
     * When this field enabled a single parquet file will be created to store sample data,
     * otherwise we will create a new file per day
     */
    overwriteData?: boolean;
    /**
     * Prefix of the data source.
     */
    prefix?:        string;
    storageConfig?: AwsCredentials;
    [property: string]: any;
}

/**
 * AWS credentials configs.
 */
export interface AwsCredentials {
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
}

/**
 * SQLAlchemy driver scheme options.
 */
export enum ConnectionScheme {
    MysqlPymysql = "mysql+pymysql",
    PgspiderPsycopg2 = "pgspider+psycopg2",
    PostgresqlPsycopg2 = "postgresql+psycopg2",
    SqlitePysqlite = "sqlite+pysqlite",
}

/**
 * Client SSL configuration
 *
 * OpenMetadata Client configured to validate SSL certificates.
 *
 * SSL Configuration for OpenMetadata Server
 *
 * SSL Configuration details.
 *
 * Consumer Config SSL Config. Configuration for enabling SSL for the Consumer Config
 * connection.
 *
 * Schema Registry SSL Config. Configuration for enabling SSL for the Schema Registry
 * connection.
 */
export interface ConnectionSSLConfig {
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
 * SSL Mode to connect to database.
 */
export enum SSLMode {
    Allow = "allow",
    Disable = "disable",
    Prefer = "prefer",
    Require = "require",
    VerifyCA = "verify-ca",
    VerifyFull = "verify-full",
}

/**
 * Service Type
 *
 * Service type.
 */
export enum ConnectionType {
    Backend = "Backend",
    MatillionETL = "MatillionETL",
    Mysql = "Mysql",
    Postgres = "Postgres",
    SQLite = "SQLite",
}

/**
 * initial Kafka consumer offset
 */
export enum InitialConsumerOffsets {
    Earliest = "earliest",
    Latest = "latest",
}

/**
 * GCP credentials configs.
 *
 * GCP Credentials
 *
 * Azure Cloud Credentials
 *
 * Available sources to fetch metadata.
 *
 * Azure Credentials
 */
export interface GCPCredentials {
    /**
     * We support two ways of authenticating to GCP i.e via GCP Credentials Values or GCP
     * Credentials Path
     */
    gcpConfig?: GCPCredentialsConfiguration;
    /**
     * we enable the authenticated service account to impersonate another service account
     */
    gcpImpersonateServiceAccount?: GCPImpersonateServiceAccountValues;
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
}

/**
 * Underlying database connection
 *
 * Mssql Database Connection Config
 */
export interface DatabaseConnectionClass {
    connectionArguments?: { [key: string]: any };
    connectionOptions?:   { [key: string]: string };
    /**
     * Database of the data source. This is optional parameter, if you would like to restrict
     * the metadata reading to a single database. When left blank, OpenMetadata Ingestion
     * attempts to scan all the databases.
     */
    database: string;
    /**
     * Regex to only include/exclude databases that matches the pattern.
     */
    databaseFilterPattern?: FilterPattern;
    /**
     * ODBC driver version in case of pyodbc connection.
     */
    driver?: string;
    /**
     * Host and port of the MSSQL service.
     */
    hostPort?: string;
    /**
     * Ingest data from all databases in Mssql. You can use databaseFilterPattern on top of this.
     */
    ingestAllDatabases?: boolean;
    /**
     * Password to connect to MSSQL.
     */
    password?:                string;
    sampleDataStorageConfig?: SampleDataStorageConfig;
    /**
     * Regex to only include/exclude schemas that matches the pattern.
     */
    schemaFilterPattern?: FilterPattern;
    /**
     * SQLAlchemy driver scheme options.
     */
    scheme?:                     MssqlScheme;
    supportsDatabase?:           boolean;
    supportsDataDiff?:           boolean;
    supportsDBTExtraction?:      boolean;
    supportsLineageExtraction?:  boolean;
    supportsMetadataExtraction?: boolean;
    supportsProfiler?:           boolean;
    supportsQueryComment?:       boolean;
    supportsUsageExtraction?:    boolean;
    /**
     * Regex to only include/exclude tables that matches the pattern.
     */
    tableFilterPattern?: FilterPattern;
    /**
     * Service Type
     */
    type?: MssqlType;
    /**
     * Username to connect to MSSQL. This user should have privileges to read all the metadata
     * in MsSQL.
     */
    username?: string;
}

/**
 * SQLAlchemy driver scheme options.
 */
export enum MssqlScheme {
    MssqlPymssql = "mssql+pymssql",
    MssqlPyodbc = "mssql+pyodbc",
    MssqlPytds = "mssql+pytds",
}

/**
 * Service Type
 *
 * Service type.
 */
export enum MssqlType {
    Mssql = "Mssql",
}

/**
 * Configuration for Sink Component in the OpenMetadata Ingestion Framework.
 */
export interface ConfigElasticsSearch {
    config?: { [key: string]: any };
    /**
     * Type of sink component ex: metadata
     */
    type: string;
}

/**
 * FHIR specification version (R4, STU3, DSTU2)
 */
export enum FHIRVersion {
    Dstu2 = "DSTU2",
    R4 = "R4",
    Stu3 = "STU3",
}

/**
 * Credentials to extract the .lkml files from a repository. This is required to get all the
 * lineage and definitions.
 *
 * Do not set any credentials. Note that credentials are required to extract .lkml views and
 * their lineage.
 *
 * Credentials for a GitHub repository
 *
 * Credentials for a BitBucket repository
 *
 * Credentials for a Gitlab repository
 */
export interface GitHubCredentials {
    repositoryName?:  string;
    repositoryOwner?: string;
    token?:           string;
    /**
     * Credentials Type
     */
    type?: GitHubCredentialsType;
    /**
     * Main production branch of the repository. E.g., `main`
     */
    branch?: string;
}

/**
 * Credentials Type
 *
 * GitHub Credentials type
 *
 * BitBucket Credentials type
 *
 * Gitlab Credentials type
 */
export enum GitHubCredentialsType {
    BitBucket = "BitBucket",
    GitHub = "GitHub",
    Gitlab = "Gitlab",
}

/**
 * The authentication method that the user uses to sign in.
 */
export enum IdentityType {
    Anonymous = "ANONYMOUS",
    Iam = "IAM",
    Quicksight = "QUICKSIGHT",
}

/**
 * Specifies the logon authentication method. Possible values are TD2 (the default), JWT,
 * LDAP, KRB5 for Kerberos, or TDNEGO
 */
export enum Logmech {
    Custom = "CUSTOM",
    Jwt = "JWT",
    Krb5 = "KRB5",
    LDAP = "LDAP",
    Td2 = "TD2",
    Tdnego = "TDNEGO",
}

/**
 * Hive Metastore Connection Details
 *
 * Postgres Database Connection Config
 *
 * Mysql Database Connection Config
 */
export interface HiveMetastoreConnectionDetails {
    /**
     * Choose Auth Config Type.
     */
    authType?: AuthConfigurationType;
    /**
     * Custom OpenMetadata Classification name for Postgres policy tags.
     */
    classificationName?:  string;
    connectionArguments?: { [key: string]: any };
    connectionOptions?:   { [key: string]: string };
    /**
     * Database of the data source. This is optional parameter, if you would like to restrict
     * the metadata reading to a single database. When left blank, OpenMetadata Ingestion
     * attempts to scan all the databases.
     */
    database?: string;
    /**
     * Regex to only include/exclude databases that matches the pattern.
     */
    databaseFilterPattern?: FilterPattern;
    /**
     * Host and port of the source service.
     *
     * Host and port of the MySQL service.
     */
    hostPort?: string;
    /**
     * Ingest data from all databases in Postgres. You can use databaseFilterPattern on top of
     * this.
     */
    ingestAllDatabases?:      boolean;
    sampleDataStorageConfig?: SampleDataStorageConfig;
    /**
     * Regex to only include/exclude schemas that matches the pattern.
     */
    schemaFilterPattern?: FilterPattern;
    /**
     * SQLAlchemy driver scheme options.
     */
    scheme?: HiveMetastoreConnectionDetailsScheme;
    /**
     * SSL Configuration details.
     */
    sslConfig?:                  ConsumerConfigSSLClass;
    sslMode?:                    SSLMode;
    supportsDatabase?:           boolean;
    supportsDataDiff?:           boolean;
    supportsDBTExtraction?:      boolean;
    supportsLineageExtraction?:  boolean;
    supportsMetadataExtraction?: boolean;
    supportsProfiler?:           boolean;
    supportsQueryComment?:       boolean;
    supportsUsageExtraction?:    boolean;
    /**
     * Regex to only include/exclude tables that matches the pattern.
     */
    tableFilterPattern?: FilterPattern;
    /**
     * Service Type
     */
    type?: HiveMetastoreConnectionDetailsType;
    /**
     * Username to connect to Postgres. This user should have privileges to read all the
     * metadata in Postgres.
     *
     * Username to connect to MySQL. This user should have privileges to read all the metadata
     * in Mysql.
     */
    username?: string;
    /**
     * Optional name to give to the database in OpenMetadata. If left blank, we will use default
     * as the database name.
     */
    databaseName?: string;
    /**
     * Database Schema of the data source. This is optional parameter, if you would like to
     * restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion
     * attempts to scan all the schemas.
     */
    databaseSchema?: string;
    /**
     * Use slow logs to extract lineage.
     */
    useSlowLogs?: boolean;
}

/**
 * SQLAlchemy driver scheme options.
 */
export enum HiveMetastoreConnectionDetailsScheme {
    MysqlPymysql = "mysql+pymysql",
    PgspiderPsycopg2 = "pgspider+psycopg2",
    PostgresqlPsycopg2 = "postgresql+psycopg2",
}

/**
 * Service Type
 *
 * Service type.
 */
export enum HiveMetastoreConnectionDetailsType {
    Mysql = "Mysql",
    Postgres = "Postgres",
}

/**
 * We support username/password or client certificate authentication
 *
 * Configuration for connecting to Nifi Basic Auth.
 *
 * Configuration for connecting to Nifi Client Certificate Auth.
 */
export interface NifiCredentialsConfiguration {
    /**
     * Nifi password to authenticate to the API.
     */
    password?: string;
    /**
     * Nifi user to authenticate to the API.
     */
    username?: string;
    /**
     * Boolean marking if we need to verify the SSL certs for Nifi. False by default.
     */
    verifySSL?: boolean;
    /**
     * Path to the root CA certificate
     */
    certificateAuthorityPath?: string;
    /**
     * Path to the client certificate
     */
    clientCertificatePath?: string;
    /**
     * Path to the client key
     */
    clientkeyPath?: string;
}

/**
 * Connect with oracle by either passing service name or database schema name.
 */
export interface OracleConnectionType {
    /**
     * databaseSchema of the data source. This is optional parameter, if you would like to
     * restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata
     * Ingestion attempts to scan all the databaseSchema.
     */
    databaseSchema?: string;
    /**
     * The Oracle Service name is the TNS alias that you give when you remotely connect to your
     * database.
     */
    oracleServiceName?: string;
    /**
     * Pass the full constructed TNS string, e.g.,
     * (DESCRIPTION=(ADDRESS_LIST=(ADDRESS=(PROTOCOL=TCP)(HOST=myhost)(PORT=1530)))(CONNECT_DATA=(SID=MYSERVICENAME))).
     */
    oracleTNSConnection?: string;
    [property: string]: any;
}

/**
 * S3 Connection.
 */
export interface S3Connection {
    awsConfig: AWSCredentials;
    /**
     * Bucket Names of the data source.
     */
    bucketNames?:         string[];
    connectionArguments?: { [key: string]: any };
    connectionOptions?:   { [key: string]: string };
    /**
     * Regex to only fetch containers that matches the pattern.
     */
    containerFilterPattern?:     FilterPattern;
    supportsMetadataExtraction?: boolean;
    /**
     * Service Type
     */
    type?: S3Type;
}

/**
 * Service Type
 *
 * S3 service type
 */
export enum S3Type {
    S3 = "S3",
}

/**
 * Source to get the .pbit files to extract lineage information
 *
 * Local config source where no extra information needs to be sent.
 *
 * Azure storage config for pbit files
 *
 * GCS storage config for pbit files
 *
 * S3 storage config for pbit files
 */
export interface PowerBIPbitFilesSource {
    /**
     * Directory path for the pbit files
     */
    path?: string;
    /**
     * pbit File Configuration type
     */
    pbitFileConfigType?: PbitFileConfigType;
    /**
     * Path of the folder where the .pbit files will be unzipped and datamodel schema will be
     * extracted
     */
    pbitFilesExtractDir?: string;
    prefixConfig?:        BucketDetails;
    securityConfig?:      DbtSecurityConfigClass;
}

/**
 * pbit File Configuration type
 */
export enum PbitFileConfigType {
    Azure = "azure",
    Gcs = "gcs",
    Local = "local",
    S3 = "s3",
}

/**
 * Details of the bucket where the .pbit files are stored
 */
export interface BucketDetails {
    /**
     * Name of the bucket where the .pbit files are stored
     */
    bucketName?: string;
    /**
     * Path of the folder where the .pbit files are stored
     */
    objectPrefix?: string;
}

/**
 * This schema publisher run modes.
 */
export enum RunMode {
    Batch = "batch",
    Stream = "stream",
}

/**
 * SASL Configuration details.
 *
 * SASL client configuration.
 */
export interface SASLClientConfig {
    /**
     * SASL security mechanism
     */
    saslMechanism?: SaslMechanismType;
    /**
     * The SASL authentication password.
     */
    saslPassword?: string;
    /**
     * The SASL authentication username.
     */
    saslUsername?: string;
}

/**
 * sasl.mechanism Consumer Config property
 *
 * SASL Mechanism consumer config property
 *
 * SASL security mechanism
 */
export enum SaslMechanismType {
    Gssapi = "GSSAPI",
    Oauthbearer = "OAUTHBEARER",
    Plain = "PLAIN",
    ScramSHA256 = "SCRAM-SHA-256",
    ScramSHA512 = "SCRAM-SHA-512",
}

/**
 * SQLAlchemy driver scheme options.
 *
 * Mongo connection scheme options.
 *
 * Couchbase driver scheme options.
 */
export enum ConfigScheme {
    AwsathenaREST = "awsathena+rest",
    Bigquery = "bigquery",
    ClickhouseHTTP = "clickhouse+http",
    ClickhouseNative = "clickhouse+native",
    CockroachdbPsycopg2 = "cockroachdb+psycopg2",
    Couchbase = "couchbase",
    DatabricksConnector = "databricks+connector",
    Db2IBMDB = "db2+ibm_db",
    Doris = "doris",
    Druid = "druid",
    ExaWebsocket = "exa+websocket",
    Hana = "hana",
    Hive = "hive",
    HiveHTTP = "hive+http",
    HiveHTTPS = "hive+https",
    Ibmi = "ibmi",
    Impala = "impala",
    Impala4 = "impala4",
    Mongodb = "mongodb",
    MongodbSrv = "mongodb+srv",
    MssqlPymssql = "mssql+pymssql",
    MssqlPyodbc = "mssql+pyodbc",
    MssqlPytds = "mssql+pytds",
    MysqlPymysql = "mysql+pymysql",
    OracleCxOracle = "oracle+cx_oracle",
    PgspiderPsycopg2 = "pgspider+psycopg2",
    Pinot = "pinot",
    PinotHTTP = "pinot+http",
    PinotHTTPS = "pinot+https",
    PostgresqlPsycopg2 = "postgresql+psycopg2",
    Presto = "presto",
    RedshiftPsycopg2 = "redshift+psycopg2",
    Snowflake = "snowflake",
    SqlitePysqlite = "sqlite+pysqlite",
    Teradatasql = "teradatasql",
    Trino = "trino",
    VerticaVerticaPython = "vertica+vertica_python",
}

/**
 * security.protocol consumer config property
 *
 * Kafka security protocol config
 */
export enum KafkaSecurityProtocol {
    Plaintext = "PLAINTEXT",
    SSL = "SSL",
    SaslPlaintext = "SASL_PLAINTEXT",
    SaslSSL = "SASL_SSL",
}

export enum SpaceType {
    Data = "Data",
    Managed = "Managed",
    Personal = "Personal",
    Shared = "Shared",
}

/**
 * SSL Configuration for OpenMetadata Server
 *
 * Client SSL configuration
 *
 * SSL Configuration details.
 *
 * Consumer Config SSL Config. Configuration for enabling SSL for the Consumer Config
 * connection.
 *
 * Schema Registry SSL Config. Configuration for enabling SSL for the Schema Registry
 * connection.
 *
 * OpenMetadata Client configured to validate SSL certificates.
 *
 * SSL Config
 */
export interface SSLConfigObject {
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
    /**
     * SSL Certificates
     */
    certificates?: SSLCertificates;
    [property: string]: any;
}

/**
 * SSL Certificates
 *
 * SSL Configuration details.
 *
 * SSL Certificates By Path
 *
 * SSL Certificates By Values
 */
export interface SSLCertificates {
    /**
     * CA Certificate Path
     */
    caCertPath?: string;
    /**
     * Client Certificate Path
     */
    clientCertPath?: string;
    /**
     * Private Key Path
     */
    privateKeyPath?: string;
    /**
     * CA Certificate Value
     */
    caCertValue?: string;
    /**
     * Client Certificate Value
     */
    clientCertValue?: string;
    /**
     * Private Key Value
     */
    privateKeyValue?: string;
    /**
     * Staging Directory Path
     */
    stagingDir?: string;
}

/**
 * Client SSL/TLS settings.
 */
export enum SSLTLSSettings {
    DisableTLS = "disable-tls",
    IgnoreCertificate = "ignore-certificate",
    ValidateCertificate = "validate-certificate",
}

/**
 * Specifies the transaction mode for the connection
 */
export enum TransactionMode {
    ANSI = "ANSI",
    Default = "DEFAULT",
    Tera = "TERA",
}

/**
 * REST API Type
 *
 * REST API type
 *
 * Service Type
 *
 * Looker service type
 *
 * Metabase service type
 *
 * PowerBI service type
 *
 * PowerBIReportServer service type
 *
 * Redash service type
 *
 * Superset service type
 *
 * Tableau service type
 *
 * Mode service type
 *
 * Custom dashboard service type
 *
 * service type
 *
 * QuickSight service type
 *
 * Qlik sense service type
 *
 * Lightdash service type
 *
 * MicroStrategy service type
 *
 * Qlik Cloud service type
 *
 * Sigma service type
 *
 * ThoughtSpot service type
 *
 * Service type.
 *
 * Custom database service type
 *
 * Kafka service type
 *
 * Redpanda service type
 *
 * Custom messaging service type
 *
 * Amundsen service type
 *
 * Metadata to Elastic Search type
 *
 * OpenMetadata service type
 *
 * Custom pipeline service type
 *
 * Custom Ml model service type
 *
 * S3 service type
 *
 * ADLS service type
 *
 * Gcs service type
 *
 * Custom storage service type
 *
 * ElasticSearch Type
 *
 * ElasticSearch service type
 *
 * OpenSearch Type
 *
 * OpenSearch service type
 *
 * Custom search service type
 */
export enum RESTType {
    Adls = "ADLS",
    Airbyte = "Airbyte",
    Airflow = "Airflow",
    Alation = "Alation",
    AlationSink = "AlationSink",
    Amundsen = "Amundsen",
    Athena = "Athena",
    Atlas = "Atlas",
    AzureSQL = "AzureSQL",
    BigQuery = "BigQuery",
    BigTable = "BigTable",
    Cassandra = "Cassandra",
    Clickhouse = "Clickhouse",
    Cockroach = "Cockroach",
    Couchbase = "Couchbase",
    CustomDashboard = "CustomDashboard",
    CustomDatabase = "CustomDatabase",
    CustomMessaging = "CustomMessaging",
    CustomMlModel = "CustomMlModel",
    CustomPipeline = "CustomPipeline",
    CustomSearch = "CustomSearch",
    CustomStorage = "CustomStorage",
    DBTCloud = "DBTCloud",
    Dagster = "Dagster",
    DataFactory = "DataFactory",
    Databricks = "Databricks",
    DatabricksPipeline = "DatabricksPipeline",
    Datalake = "Datalake",
    Db2 = "Db2",
    DeltaLake = "DeltaLake",
    DomoDashboard = "DomoDashboard",
    DomoDatabase = "DomoDatabase",
    DomoPipeline = "DomoPipeline",
    Doris = "Doris",
    Druid = "Druid",
    DynamoDB = "DynamoDB",
    ElasticSearch = "ElasticSearch",
    Epic = "Epic",
    Exasol = "Exasol",
    Fivetran = "Fivetran",
    Flink = "Flink",
    Gcs = "GCS",
    Glue = "Glue",
    GluePipeline = "GluePipeline",
    Greenplum = "Greenplum",
    Hive = "Hive",
    Iceberg = "Iceberg",
    Impala = "Impala",
    Kafka = "Kafka",
    KafkaConnect = "KafkaConnect",
    Kinesis = "Kinesis",
    Lightdash = "Lightdash",
    Looker = "Looker",
    MariaDB = "MariaDB",
    Matillion = "Matillion",
    Metabase = "Metabase",
    MetadataES = "MetadataES",
    MicroStrategy = "MicroStrategy",
    Mlflow = "Mlflow",
    Mode = "Mode",
    MongoDB = "MongoDB",
    Mssql = "Mssql",
    Mysql = "Mysql",
    Nifi = "Nifi",
    OpenLineage = "OpenLineage",
    OpenMetadata = "OpenMetadata",
    OpenSearch = "OpenSearch",
    Oracle = "Oracle",
    PinotDB = "PinotDB",
    Postgres = "Postgres",
    PowerBI = "PowerBI",
    PowerBIReportServer = "PowerBIReportServer",
    Presto = "Presto",
    QlikCloud = "QlikCloud",
    QlikSense = "QlikSense",
    QuickSight = "QuickSight",
    REST = "Rest",
    Redash = "Redash",
    Redpanda = "Redpanda",
    Redshift = "Redshift",
    S3 = "S3",
    SAS = "SAS",
    SQLite = "SQLite",
    SageMaker = "SageMaker",
    Salesforce = "Salesforce",
    SapERP = "SapErp",
    SapHana = "SapHana",
    Sigma = "Sigma",
    SingleStore = "SingleStore",
    Sklearn = "Sklearn",
    Snowflake = "Snowflake",
    Spark = "Spark",
    Spline = "Spline",
    Ssas = "SSAS",
    Ssis = "SSIS",
    Stitch = "Stitch",
    Superset = "Superset",
    Synapse = "Synapse",
    Tableau = "Tableau",
    Teradata = "Teradata",
    ThoughtSpot = "ThoughtSpot",
    Trino = "Trino",
    UnityCatalog = "UnityCatalog",
    VertexAI = "VertexAI",
    Vertica = "Vertica",
    Wherescape = "Wherescape",
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
    securityConfig?:   DbtSecurityConfigClass;
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
 *
 * Reverse Ingestion Config Pipeline type
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
    ReverseIngestion = "ReverseIngestion",
    SearchMetadata = "SearchMetadata",
    StorageMetadata = "StorageMetadata",
    TestSuite = "TestSuite",
}
