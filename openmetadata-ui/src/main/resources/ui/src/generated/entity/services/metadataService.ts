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
 * This schema defines the Metadata Service entity, such as Amundsen, Atlas etc.
 */
export interface MetadataService {
    /**
     * Change that lead to this version of the entity.
     */
    changeDescription?: ChangeDescription;
    connection?:        MetadataConnection;
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
     * Domains the asset belongs to. When not set, the asset inherits the domain from the parent
     * it belongs to.
     */
    domains?: EntityReference[];
    /**
     * Followers of this entity.
     */
    followers?: EntityReference[];
    /**
     * FullyQualifiedName same as `name`.
     */
    fullyQualifiedName?: string;
    /**
     * Link to the resource corresponding to this database service.
     */
    href?: string;
    /**
     * Unique identifier of this database service instance.
     */
    id: string;
    /**
     * Change that lead to this version of the entity.
     */
    incrementalChangeDescription?: ChangeDescription;
    /**
     * The ingestion agent responsible for executing the ingestion pipeline.
     */
    ingestionRunner?: EntityReference;
    /**
     * Name that identifies this database service.
     */
    name: string;
    /**
     * Owners of this database service.
     */
    owners?: EntityReference[];
    /**
     * References to pipelines deployed for this database service to extract metadata, usage,
     * lineage etc..
     */
    pipelines?: EntityReference[];
    provider?:  ProviderType;
    /**
     * Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres...
     */
    serviceType: MetadataServiceType;
    /**
     * Tags for this Metadata Service.
     */
    tags?: TagLabel[];
    /**
     * Last test connection results for this service
     */
    testConnectionResult?: TestConnectionResult;
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
 * Metadata Service Connection.
 */
export interface MetadataConnection {
    config?: Connection;
}

/**
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
 */
export interface Connection {
    /**
     * Regex to only include/exclude databases that matches the pattern.
     */
    databaseFilterPattern?: FilterPattern;
    /**
     * Enable encryption for the Amundsen Neo4j Connection.
     */
    encrypted?: boolean;
    /**
     * Host and port of the Amundsen Neo4j Connection. This expect a URI format like:
     * bolt://localhost:7687.
     *
     * OpenMetadata Server Config. Must include API end point ex: http://localhost:8585/api
     *
     * Host and port of the Atlas service.
     *
     * Host and port of the Alation service.
     */
    hostPort?: string;
    /**
     * Maximum connection lifetime for the Amundsen Neo4j Connection.
     */
    maxConnectionLifeTime?: number;
    /**
     * password to connect to the Amundsen Neo4j Connection.
     *
     * password to connect  to the Atlas.
     */
    password?: string;
    /**
     * Regex to only include/exclude schemas that matches the pattern.
     */
    schemaFilterPattern?:        FilterPattern;
    supportsMetadataExtraction?: boolean;
    /**
     * Regex to only include/exclude tables that matches the pattern.
     */
    tableFilterPattern?: FilterPattern;
    /**
     * Service Type
     */
    type?: MetadataServiceType;
    /**
     * username to connect to the Amundsen Neo4j Connection.
     *
     * username to connect  to the Atlas. This user should have privileges to read all the
     * metadata in Atlas.
     */
    username?: string;
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
     * Flag to verify SSL Certificate for OpenMetadata Server.
     */
    verifySSL?:           VerifySSL;
    connectionArguments?: { [key: string]: any };
    connectionOptions?:   { [key: string]: string };
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
     */
    messagingServiceName?: string[];
    /**
     * Custom OpenMetadata Classification name for alation tags.
     */
    alationTagClassificationName?: string;
    /**
     * Types of methods used to authenticate to the alation instance
     */
    authType?: AuthenticationTypeForAlation;
    /**
     * Choose between mysql and postgres connection for alation database
     */
    connection?: AlationDatabaseConnection;
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
    /**
     * Pagination limit used for Alation APIs pagination
     */
    paginationLimit?: number;
    /**
     * Project name to create the refreshToken. Can be anything
     */
    projectName?:     string;
    datasourceLinks?: { [key: string]: string };
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
 * Types of methods used to authenticate to the alation instance
 *
 * Basic Auth Credentials
 *
 * API Access Token Auth Credentials
 */
export interface AuthenticationTypeForAlation {
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

/**
 * Choose between mysql and postgres connection for alation database
 *
 * Postgres Database Connection Config
 *
 * Mysql Database Connection Config
 */
export interface AlationDatabaseConnection {
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
    scheme?: Scheme;
    /**
     * SSL Configuration details.
     */
    sslConfig?:                  Config;
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
    type?: Type;
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
 * Regex to only include/exclude databases that matches the pattern.
 *
 * Regex to only fetch entities that matches the pattern.
 *
 * Regex to only include/exclude schemas that matches the pattern.
 *
 * Regex to only include/exclude tables that matches the pattern.
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
export enum Scheme {
    MysqlPymysql = "mysql+pymysql",
    PgspiderPsycopg2 = "pgspider+psycopg2",
    PostgresqlPsycopg2 = "postgresql+psycopg2",
}

/**
 * SSL Configuration for OpenMetadata Server
 *
 * Client SSL configuration
 *
 * SSL Configuration details.
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
export enum Type {
    Mysql = "Mysql",
    Postgres = "Postgres",
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
 * This schema publisher run modes.
 */
export enum RunMode {
    Batch = "batch",
    Stream = "stream",
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
 * Service Type
 *
 * Amundsen service type
 *
 * Metadata to Elastic Search type
 *
 * OpenMetadata service type
 *
 * Service type.
 *
 * Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres...
 *
 * Type of database service such as Amundsen, Atlas...
 */
export enum MetadataServiceType {
    Alation = "Alation",
    AlationSink = "AlationSink",
    Amundsen = "Amundsen",
    Atlas = "Atlas",
    MetadataES = "MetadataES",
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
 * Last test connection results for this service
 *
 * TestConnectionResult is the definition that will encapsulate result of running the test
 * connection steps.
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
    steps: TestConnectionStepResult[];
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
