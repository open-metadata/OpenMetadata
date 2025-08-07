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
 * A unit of work that will be triggered as an API call to the OpenMetadata server.
 */
export interface Workflow {
    /**
     * Change that lead to this version of the entity.
     */
    changeDescription?: ChangeDescription;
    /**
     * List of data products this entity is part of.
     */
    dataProducts?: EntityReference[];
    /**
     * When `true` indicates the entity has been soft deleted.
     */
    deleted?: boolean;
    /**
     * Description of the test connection def.
     */
    description?: string;
    /**
     * Display Name that identifies this workflow definition.
     */
    displayName?: string;
    /**
     * Domains the asset belongs to. When not set, the asset inherits the domain from the parent
     * it belongs to.
     */
    domains?: EntityReference[];
    /**
     * FullyQualifiedName same as `name`.
     */
    fullyQualifiedName?: string;
    /**
     * Link to the resource corresponding to this entity.
     */
    href?: string;
    /**
     * Unique identifier of this workflow instance.
     */
    id: string;
    /**
     * Change that lead to this version of the entity.
     */
    incrementalChangeDescription?: ChangeDescription;
    /**
     * Name of the workflow.
     */
    name:                          string;
    openMetadataServerConnection?: OpenMetadataConnection;
    /**
     * Owners of this workflow.
     */
    owners?: EntityReference[];
    /**
     * Request body for a specific workflow type
     */
    request: TestServiceConnectionRequest;
    /**
     * Response to the request.
     */
    response?: TestConnectionResult;
    /**
     * Workflow computation status.
     */
    status?: WorkflowStatus;
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
    /**
     * Type of the workflow.
     */
    workflowType: WorkflowType;
}

/**
 * Change that lead to this version of the entity.
 *
 * Description of the change.
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
 * List of data products this entity is part of.
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
 * Regex to only fetch api collections with names matching the pattern.
 *
 * Regex to include/exclude FHIR resource categories
 *
 * Regex to include/exclude FHIR resource types
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
 * Regex exclude pipelines.
 *
 * Regex to only fetch containers that matches the pattern.
 *
 * Regex to only fetch MlModels with names matching the pattern.
 *
 * Regex to only fetch search indexes that matches the pattern.
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
 *
 * Secrets Manager Provider to use for fetching secrets.
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
 * Request body for a specific workflow type
 *
 * Test Service Connection to test user provided configuration is valid or not.
 *
 * Apply a set of operations on a service
 */
export interface TestServiceConnectionRequest {
    /**
     * Connection object.
     */
    connection?: RequestConnection;
    /**
     * Type of the connection to test such as Snowflake, MySQL, Looker, etc.
     */
    connectionType?: string;
    /**
     * Optional value of the ingestion runner name responsible for running the test
     *
     * Optional value of the ingestion runner name responsible for running the workflow
     */
    ingestionRunner?: string;
    /**
     * Secrets Manager Provider to use for fetching secrets.
     */
    secretsManagerProvider?: SecretsManagerProvider;
    /**
     * Optional value that identifies this service name.
     */
    serviceName?: string;
    /**
     * Type of service such as Database, Dashboard, Messaging, etc.
     */
    serviceType?: ServiceType;
    /**
     * List of operations to be performed on the service
     */
    operations?: Operation[];
    /**
     * Service to be modified
     */
    service?: EntityReference;
    /**
     * Pipeline type
     */
    type?: ReverseIngestionType;
}

/**
 * Connection object.
 *
 * API Service Connection.
 *
 * Database Connection.
 *
 * Dashboard Connection.
 *
 * Pipeline Connection.
 *
 * MlModel Connection.
 *
 * Metadata Service Connection.
 *
 * Storage Connection.
 *
 * search Connection.
 *
 * Security Connection.
 */
export interface RequestConnection {
    config?: ConfigClass;
}

/**
 * REST Connection Config
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
 * Kafka Connection Config
 *
 * Redpanda Connection Config
 *
 * Kinesis Connection Config
 *
 * Custom Messaging Service Connection to build a source that is not supported by
 * OpenMetadata yet.
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
 *
 * Apache Ranger Connection Config
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
     * Generated Token to connect to Databricks.
     *
     * token to connect to Qlik Cloud.
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
     * Custom database service type
     *
     * Custom dashboard service type
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
    type?: ConfigType;
    /**
     * Billing Project ID
     */
    billingProjectId?: string;
    /**
     * If using Metastore, Key-Value pairs that will be used to add configs to the SparkSession.
     */
    connectionArguments?: { [key: string]: any };
    connectionOptions?:   { [key: string]: string };
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
    databaseFilterPattern?: FilterPattern;
    /**
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
     * Host and port of the Amundsen Neo4j Connection. This expect a URI format like:
     * bolt://localhost:7687.
     *
     * OpenMetadata Server Config. Must include API end point ex: http://localhost:8585/api
     *
     * Host and port of the Atlas service.
     *
     * Host and port of the Alation service.
     *
     * Host and port of the ElasticSearch service.
     *
     * Host and port of the OpenSearch service.
     *
     * Apache Ranger Admin URL.
     */
    hostPort?:                string;
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
    awsConfig?:     AWSCredentials;
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
     * Password to connect to Metabase.
     *
     * Password to connect to PowerBI report server.
     *
     * Password to connect to MicroStrategy.
     *
     * Password to connect to Airbyte.
     *
     * password to connect to the Amundsen Neo4j Connection.
     *
     * password to connect  to the Atlas.
     */
    password?: string;
    /**
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
     * Username to connect to Airbyte.
     *
     * username to connect to the Amundsen Neo4j Connection.
     *
     * username to connect  to the Atlas. This user should have privileges to read all the
     * metadata in Atlas.
     */
    username?: string;
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
     * Choose Auth Config Type.
     *
     * Types of methods used to authenticate to the tableau instance
     *
     * Types of methods used to authenticate to the alation instance
     *
     * Authentication type to connect to Apache Ranger.
     */
    authType?: AuthConfigurationType | NoConfigAuthenticationTypes;
    /**
     * SSL Configuration details.
     *
     * SSL Configuration for OpenMetadata Server
     */
    sslConfig?: SSLConfigObject;
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
     * Access token to connect to DOMO
     *
     * Access Token for Mode Dashboard
     */
    accessToken?: string;
    /**
     * API Host to connect to DOMO instance
     */
    apiHost?: string;
    /**
     * Client ID for DOMO
     *
     * Azure Application (client) ID for service principal authentication.
     *
     * User's Client ID. This user should have privileges to read all the metadata in Looker.
     *
     * client_id for PowerBI.
     *
     * client_id for Sigma.
     */
    clientId?: string;
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
     * Source Python Class Name to instantiated by the ingestion workflow
     */
    sourcePythonClass?: string;
    /**
     * Choose between Database connection or HDB User Store connection.
     *
     * Choose between API or database connection fetch metadata from superset.
     *
     * Underlying database connection. See
     * https://airflow.apache.org/docs/apache-airflow/stable/howto/set-up-database.html for
     * supported backends.
     *
     * Matillion Auth Configuration
     *
     * Choose between mysql and postgres connection for alation database
     */
    connection?: ConfigConnection;
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
     * API key to authenticate with the SAP ERP APIs.
     *
     * API key of the redash instance to access.
     *
     * The personal access token you can generate in the Lightdash app under the user settings
     *
     * Fivetran API Secret.
     */
    apiKey?: string;
    /**
     * Pagination limit used while querying the SAP ERP API for fetching the entities
     *
     * Pagination limit used while querying the tableau metadata API for getting data sources
     *
     * Pagination limit used for Alation APIs pagination
     */
    paginationLimit?: number;
    /**
     * Boolean marking if we need to verify the SSL certs for KafkaConnect REST API. True by
     * default.
     *
     * Flag to verify SSL Certificate for OpenMetadata Server.
     */
    verifySSL?: boolean | VerifySSL;
    /**
     * Azure Application client secret for service principal authentication.
     *
     * User's Client Secret.
     *
     * clientSecret for PowerBI.
     *
     * clientSecret for Sigma.
     */
    clientSecret?: string;
    /**
     * Azure Directory (tenant) ID for service principal authentication.
     *
     * Tenant ID for PowerBI.
     */
    tenantId?: string;
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
     * Credentials to extract the .lkml files from a repository. This is required to get all the
     * lineage and definitions.
     */
    gitCredentials?: GitHubCredentials;
    /**
     * Regex to exclude or include projects that matches the pattern.
     */
    projectFilterPattern?: FilterPattern;
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
     * Fetch the PowerBI metadata using admin APIs
     */
    useAdminApis?: boolean;
    /**
     * Web Portal Virtual Directory Name.
     */
    webPortalVirtualDirectory?: string;
    /**
     * Version of the Redash instance
     */
    redashVersion?: string;
    /**
     * Tableau API version. If not provided, the version will be used from the tableau server.
     *
     * Sigma API version.
     *
     * ThoughtSpot API version to use
     *
     * Airbyte API version.
     *
     * OpenMetadata server API version to use.
     */
    apiVersion?: string;
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
    workspaceName?: string;
    /**
     * AWS Account ID
     */
    awsAccountId?: string;
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
     * Name of the Kafka Messaging Service associated with this KafkaConnect Pipeline Service.
     * e.g. local_kafka
     *
     * service type of the messaging source
     */
    messagingServiceName?: string[] | string;
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
 * Types of methods used to authenticate to the tableau instance
 *
 * Basic Auth Credentials
 *
 * Access Token Auth Credentials
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
 *
 * Authentication type to connect to Apache Ranger.
 *
 * Configuration for connecting to Ranger Basic Auth.
 */
export interface AuthConfigurationType {
    /**
     * Password to connect to source.
     *
     * Password to access the service.
     *
     * Elastic Search Password for Login
     *
     * Ranger password to authenticate to the API.
     */
    password?:    string;
    awsConfig?:   AWSCredentials;
    azureConfig?: AzureCredentials;
    /**
     * JWT to connect to source.
     */
    jwt?: string;
    /**
     * Configuration for connecting to DataStax Astra DB in the cloud.
     */
    cloudConfig?: DataStaxAstraDBConfiguration;
    /**
     * Username to access the service.
     *
     * Elastic Search Username for Login
     *
     * Ranger user to authenticate to the API.
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
    securityConfig?: SecurityConfigClass;
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
 * Azure Cloud Credentials
 *
 * Available sources to fetch metadata.
 *
 * Azure Credentials
 *
 * GCP Credentials
 *
 * GCP credentials configs.
 *
 * AWS credentials configs.
 */
export interface SecurityConfigClass {
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
 * Choose between Database connection or HDB User Store connection.
 *
 * Sap Hana Database SQL Connection Config
 *
 * Sap Hana Database HDB User Store Connection Config
 *
 * Choose between API or database connection fetch metadata from superset.
 *
 * Superset API Connection Config
 *
 * Postgres Database Connection Config
 *
 * Mysql Database Connection Config
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
 *
 * Choose between mysql and postgres connection for alation database
 */
export interface ConfigConnection {
    /**
     * Database of the data source.
     *
     * Database of the data source. This is optional parameter, if you would like to restrict
     * the metadata reading to a single database. When left blank, OpenMetadata Ingestion
     * attempts to scan all the databases.
     */
    database?: string;
    /**
     * Database Schema of the data source. This is an optional parameter, if you would like to
     * restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion
     * attempts to scan all the schemas.
     *
     * Database Schema of the data source. This is optional parameter, if you would like to
     * restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion
     * attempts to scan all the schemas.
     */
    databaseSchema?: string;
    /**
     * Host and port of the Hana service.
     *
     * Host and port of the source service.
     *
     * Host and port of the MySQL service.
     *
     * Host and port of the SQLite service. Blank for in-memory database.
     *
     * Matillion Host
     */
    hostPort?: string;
    /**
     * Password to connect to Hana.
     *
     * Password for Superset.
     *
     * Password to connect to SQLite. Blank for in-memory database.
     *
     * Password to connect to the Matillion.
     */
    password?: string;
    /**
     * Username to connect to Hana. This user should have privileges to read all the metadata.
     *
     * Username for Superset.
     *
     * Username to connect to Postgres. This user should have privileges to read all the
     * metadata in Postgres.
     *
     * Username to connect to MySQL. This user should have privileges to read all the metadata
     * in Mysql.
     *
     * Username to connect to SQLite. Blank for in-memory database.
     *
     * Username to connect to the Matillion. This user should have privileges to read all the
     * metadata in Matillion.
     */
    username?: string;
    /**
     * HDB Store User Key generated from the command `hdbuserstore SET <KEY> <host:port>
     * <USERNAME> <PASSWORD>`
     */
    userKey?: string;
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
    verifySSL?: VerifySSL;
    /**
     * Choose Auth Config Type.
     */
    authType?: ConnectionAuthConfigurationType;
    /**
     * Custom OpenMetadata Classification name for Postgres policy tags.
     */
    classificationName?:  string;
    connectionArguments?: { [key: string]: any };
    connectionOptions?:   { [key: string]: string };
    /**
     * Regex to only include/exclude databases that matches the pattern.
     */
    databaseFilterPattern?: FilterPattern;
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
     * Use slow logs to extract lineage.
     */
    useSlowLogs?: boolean;
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
export interface ConnectionAuthConfigurationType {
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
 * GCP Credentials
 *
 * GCP credentials configs.
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
    authType?: ConnectionAuthConfigurationType;
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
    securityConfig?:      SecurityConfigClass;
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
 * Service type.
 *
 * service type
 *
 * Custom database service type
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
 * Kafka service type
 *
 * Redpanda service type
 *
 * Custom messaging service type
 *
 * Custom pipeline service type
 *
 * Custom Ml model service type
 *
 * Amundsen service type
 *
 * Metadata to Elastic Search type
 *
 * OpenMetadata service type
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
 *
 * Apache Ranger service type
 */
export enum ConfigType {
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
    Ranger = "Ranger",
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
    type: Type;
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
    addedTags?: TagLabel[];
    /**
     * Removed tags of the entity
     */
    removedTags?: TagLabel[];
}

/**
 * This schema defines the type for labeling an entity with a Tag.
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
 * Type of operation to perform
 */
export enum Type {
    UpdateDescription = "UPDATE_DESCRIPTION",
    UpdateOwner = "UPDATE_OWNER",
    UpdateTags = "UPDATE_TAGS",
}

/**
 * Type of service such as Database, Dashboard, Messaging, etc.
 *
 * This schema defines the service types entities which requires a connection.
 */
export enum ServiceType {
    API = "Api",
    Dashboard = "Dashboard",
    Database = "Database",
    Drive = "Drive",
    Messaging = "Messaging",
    Metadata = "Metadata",
    MlModel = "MlModel",
    Pipeline = "Pipeline",
    Search = "Search",
    Security = "Security",
    Storage = "Storage",
}

/**
 * Pipeline type
 *
 * Reverse Ingestion Config Pipeline type
 */
export enum ReverseIngestionType {
    ReverseIngestion = "ReverseIngestion",
}

/**
 * Response to the request.
 *
 * TestConnectionResult is the definition that will encapsulate result of running the test
 * connection steps.
 *
 * Apply a set of operations on a service
 */
export interface TestConnectionResult {
    /**
     * Last time that the test connection was executed
     */
    lastUpdatedAt?: number;
    /**
     * Test Connection Result computation status.
     */
    status?: StatusType;
    /**
     * Steps to test the connection. Order matters.
     */
    steps?: TestConnectionStepResult[];
    /**
     * Error message in case of failure
     */
    message?: string;
    /**
     * List of operations to be performed on the service
     */
    results?: ReverseIngestionOperationResult[];
    /**
     * The id of the service to be modified
     */
    serviceId?: string;
    /**
     * Whether the workflow was successful. Failure indicates a critical failure such as
     * connection issues.
     */
    success?: boolean;
}

export interface ReverseIngestionOperationResult {
    /**
     * The id of the operation
     */
    id: string;
    /**
     * Error message in case of failure
     */
    message?: string;
    /**
     * Whether the specific operation was successful
     */
    success: boolean;
    [property: string]: any;
}

/**
 * Test Connection Result computation status.
 *
 * Enum defining possible Test Connection Result status
 */
export enum StatusType {
    Failed = "Failed",
    Running = "Running",
    Successful = "Successful",
}

/**
 * Function that tests one specific element of the service. E.g., listing schemas, lineage,
 * or tags.
 */
export interface TestConnectionStepResult {
    /**
     * In case of failed step, this field would contain the actual error faced during the step.
     */
    errorLog?: string;
    /**
     * Is this step mandatory to be passed?
     */
    mandatory: boolean;
    /**
     * Results or exceptions to be shared after running the test. This message comes from the
     * test connection definition
     */
    message?: string;
    /**
     * Name of the step being tested
     */
    name: string;
    /**
     * Did the step pass successfully?
     */
    passed: boolean;
}

/**
 * Workflow computation status.
 *
 * Enum defining possible Workflow status
 */
export enum WorkflowStatus {
    Failed = "Failed",
    Pending = "Pending",
    Running = "Running",
    Successful = "Successful",
}

/**
 * Type of the workflow.
 *
 * This enum defines the type for which this workflow applies to.
 */
export enum WorkflowType {
    ReverseIngestion = "REVERSE_INGESTION",
    TestConnection = "TEST_CONNECTION",
}
