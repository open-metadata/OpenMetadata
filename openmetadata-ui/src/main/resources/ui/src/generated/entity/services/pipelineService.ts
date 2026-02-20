/*
 *  Copyright 2026 Collate.
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
 * This schema defines the Pipeline Service entity, such as Airflow and Prefect.
 */
export interface PipelineService {
    /**
     * Change that lead to this version of the entity.
     */
    changeDescription?: ChangeDescription;
    connection?:        PipelineConnection;
    /**
     * List of data products this entity is part of.
     */
    dataProducts?: EntityReference[];
    /**
     * When `true` indicates the entity has been soft deleted.
     */
    deleted?: boolean;
    /**
     * Description of a pipeline service instance.
     */
    description?: string;
    /**
     * Display Name that identifies this pipeline service. It could be title or label from the
     * source services.
     */
    displayName?: string;
    /**
     * Domains the Pipeline service belongs to.
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
     * Link to the resource corresponding to this pipeline service.
     */
    href?: string;
    /**
     * Unique identifier of this pipeline service instance.
     */
    id: string;
    /**
     * Bot user that performed the action on behalf of the actual user.
     */
    impersonatedBy?: string;
    /**
     * Change that lead to this version of the entity.
     */
    incrementalChangeDescription?: ChangeDescription;
    /**
     * The ingestion agent responsible for executing the ingestion pipeline.
     */
    ingestionRunner?: EntityReference;
    /**
     * Name that identifies this pipeline service.
     */
    name: string;
    /**
     * Owners of this pipeline service.
     */
    owners?: EntityReference[];
    /**
     * References to pipelines deployed for this pipeline service to extract metadata
     */
    pipelines?: EntityReference[];
    /**
     * Type of pipeline service such as Airflow or Prefect...
     */
    serviceType: PipelineServiceType;
    /**
     * Tags for this Pipeline Service.
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
 * Pipeline Connection.
 */
export interface PipelineConnection {
    config?: ConfigObject;
}

/**
 * Airflow Metadata Database Connection Config
 *
 * Wherescape Metadata Database Connection Config
 *
 * SSIS Metadata Database Connection Config
 *
 * Glue Pipeline Connection Config
 *
 * AWS Kinesis Firehose Pipeline Connection Config
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
 * Databricks Connection Config
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
 * Snowplow Pipeline Connection Config
 *
 * MuleSoft Anypoint Platform Connection Config
 *
 * Microsoft Fabric Data Factory Pipeline Connection Config
 */
export interface ConfigObject {
    /**
     * Underlying database connection. See
     * https://airflow.apache.org/docs/apache-airflow/stable/howto/set-up-database.html for
     * supported backends.
     *
     * Matillion Auth Configuration
     */
    connection?: MetadataDatabaseConnection;
    /**
     * Pipeline Service Management/UI URI.
     *
     * Pipeline Service Management/UI URL.
     *
     * Host and port of the Databricks service.
     *
     * Spline REST Server Host & Port.
     *
     * KafkaConnect Service Management/UI URI.
     *
     * Host and port of the Stitch API host
     *
     * MuleSoft Anypoint Platform URL. Use https://anypoint.mulesoft.com for US cloud,
     * https://eu1.anypoint.mulesoft.com for EU cloud, or your on-premises URL.
     */
    hostPort?: string;
    /**
     * Pipeline Service Number Of Status
     */
    numberOfStatus?: number;
    /**
     * Regex exclude pipelines.
     *
     * Regex to filter MuleSoft applications by name.
     *
     * Regex to only include/exclude pipelines that matches the pattern.
     */
    pipelineFilterPattern?:      FilterPattern;
    supportsMetadataExtraction?: boolean;
    /**
     * Service Type
     *
     * Custom pipeline service type
     */
    type?: PipelineServiceType;
    /**
     * Underlying database connection
     */
    databaseConnection?: DatabaseConnectionClass;
    /**
     * Underlying storage connection
     */
    packageConnection?: S3Connection | string;
    awsConfig?:         AWSCredentials;
    /**
     * Name of the Kafka Messaging Service associated with this Firehose Pipeline Service. e.g.
     * local_kafka
     *
     * Name of the Kafka Messaging Service associated with this KafkaConnect Pipeline Service.
     * e.g. local_kafka
     */
    messagingServiceName?: string;
    /**
     * Airbyte API version.
     */
    apiVersion?: string;
    /**
     * Choose between Basic authentication (for self-hosted) or OAuth 2.0 client credentials
     * (for Airbyte Cloud)
     */
    auth?: PurpleAuthentication;
    /**
     * Fivetran API Key.
     *
     * API Key for Snowplow Console API
     */
    apiKey?: string;
    /**
     * Fivetran API Secret.
     */
    apiSecret?: string;
    /**
     * Fivetran API Limit For Pagination.
     */
    limit?: number;
    /**
     * SSL Configuration details.
     */
    sslConfig?: Config;
    /**
     * Boolean marking if we need to verify the SSL certs for KafkaConnect REST API. True by
     * default.
     */
    verifySSL?: boolean | VerifySSL;
    /**
     * URL to the Dagster instance
     *
     * DBT cloud Access URL.
     */
    host?: string;
    /**
     * Number of leading segments to remove from asset key paths before resolving to tables. For
     * example, if your asset keys follow the pattern 'project/environment/schema/table' but you
     * only need 'schema/table', set this to 2.
     */
    stripAssetKeyPrefixLength?: number;
    /**
     * Connection Time Limit Between OM and Dagster Graphql API in second
     */
    timeout?: number;
    /**
     * To Connect to Dagster Cloud
     *
     * Generated Token to connect to Databricks.
     *
     * Generated Token to connect to DBTCloud.
     *
     * Token to connect to Stitch api doc
     */
    token?: string;
    /**
     * We support username/password or client certificate authentication
     */
    nifiConfig?: NifiCredentialsConfiguration;
    /**
     * Access token to connect to DOMO
     */
    accessToken?: string;
    /**
     * API Host to connect to DOMO instance
     */
    apiHost?: string;
    /**
     * Client ID for DOMO
     *
     * Azure Application (client) ID for Service Principal authentication.
     */
    clientId?: string;
    /**
     * URL of your Domo instance, e.g., https://openmetadata.domo.com
     */
    instanceDomain?: string;
    /**
     * Secret token to connect to DOMO
     */
    secretToken?:       string;
    connectionOptions?: { [key: string]: string };
    /**
     * Source Python Class Name to instantiated by the ingestion workflow
     */
    sourcePythonClass?:   string;
    connectionArguments?: { [key: string]: any };
    /**
     * Connection timeout in seconds.
     */
    connectionTimeout?: number;
    /**
     * Databricks compute resources URL.
     */
    httpPath?: string;
    /**
     * Number of days to look back when fetching lineage data from Databricks system tables
     * (system.access.table_lineage and system.access.column_lineage). Default is 90 days.
     */
    lineageLookBackDays?: number;
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
     * Kafka security protocol config
     */
    securityProtocol?: KafkaSecurityProtocol;
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
     * List of IDs of your DBT cloud environments separated by comma `,`
     */
    environmentIds?: string[];
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
     * Available sources to fetch metadata.
     */
    configSource?: AzureCredentials;
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
     * Cloud provider where Snowplow is deployed
     */
    cloudProvider?: CloudProvider;
    /**
     * Path to pipeline configuration files for Community deployment
     */
    configPath?: string;
    /**
     * Snowplow Console URL for BDP deployment
     */
    consoleUrl?: string;
    /**
     * Snowplow deployment type (BDP for managed or Community for self-hosted)
     */
    deployment?: SnowplowDeployment;
    /**
     * Snowplow BDP Organization ID
     *
     * Anypoint Platform Organization ID. If not provided, the connector will use the user's
     * default organization.
     */
    organizationId?: string;
    /**
     * Choose between Connected App (OAuth 2.0) or Basic Authentication.
     */
    authentication?: FluffyAuthentication;
    /**
     * Anypoint Platform Environment ID. If not provided, the connector will discover all
     * accessible environments.
     */
    environmentId?: string;
    /**
     * Azure Active Directory authority URI. Defaults to https://login.microsoftonline.com/
     */
    authorityUri?: string;
    /**
     * Azure Application client secret for Service Principal authentication.
     */
    clientSecret?: string;
    /**
     * Azure Directory (tenant) ID for Service Principal authentication.
     */
    tenantId?: string;
    /**
     * The Microsoft Fabric workspace ID where the pipelines are located.
     */
    workspaceId?: string;
    [property: string]: any;
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
 * Choose between Basic authentication (for self-hosted) or OAuth 2.0 client credentials
 * (for Airbyte Cloud)
 *
 * Username and password authentication
 *
 * OAuth 2.0 client credentials authentication for Airbyte Cloud
 */
export interface PurpleAuthentication {
    /**
     * Password to connect to Airbyte.
     */
    password?: string;
    /**
     * Username to connect to Airbyte.
     */
    username?: string;
    /**
     * Client ID for the application registered in Airbyte.
     */
    clientId?: string;
    /**
     * Client Secret for the application registered in Airbyte.
     */
    clientSecret?: string;
}

/**
 * Choose between Connected App (OAuth 2.0) or Basic Authentication.
 *
 * Basic Auth Credentials
 *
 * OAuth 2.0 client credentials authentication for Airbyte Cloud
 */
export interface FluffyAuthentication {
    /**
     * Password to access the service.
     */
    password?: string;
    /**
     * Username to access the service.
     */
    username?: string;
    /**
     * Client ID for the application registered in Airbyte.
     */
    clientId?: string;
    /**
     * Client Secret for the application registered in Airbyte.
     */
    clientSecret?: string;
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
     * Enable AWS IAM authentication. When enabled, uses the default credential provider chain
     * (environment variables, instance profile, etc.). Defaults to false for backward
     * compatibility.
     */
    enabled?: boolean;
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
 * Cloud provider where Snowplow is deployed
 */
export enum CloudProvider {
    Aws = "AWS",
    Azure = "Azure",
    Gcp = "GCP",
}

/**
 * Azure Cloud Credentials
 *
 * Available sources to fetch metadata.
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
 * Underlying database connection. See
 * https://airflow.apache.org/docs/apache-airflow/stable/howto/set-up-database.html for
 * supported backends.
 *
 * Lineage Backend Connection Config
 *
 * Mysql Database Connection Config
 *
 * Postgres Database Connection Config
 *
 * SQLite Database Connection Config
 *
 * Matillion Auth Configuration
 *
 * Matillion ETL Auth Config.
 */
export interface MetadataDatabaseConnection {
    /**
     * Regex exclude pipelines.
     */
    pipelineFilterPattern?: FilterPattern;
    /**
     * Service Type
     */
    type?: Type;
    /**
     * Choose Auth Config Type.
     */
    authType?:            AuthConfigurationType;
    connectionArguments?: { [key: string]: any };
    connectionOptions?:   { [key: string]: string };
    /**
     * Regex to only include/exclude databases that matches the pattern.
     */
    databaseFilterPattern?: FilterPattern;
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
     * Host and port of the MySQL service.
     *
     * Host and port of the source service.
     *
     * Host and port of the SQLite service. Blank for in-memory database.
     *
     * Matillion Host
     */
    hostPort?:                string;
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
    sslConfig?: Config;
    /**
     * Regex to only include/exclude stored procedures that matches the pattern.
     */
    storedProcedureFilterPattern?: FilterPattern;
    supportsDataDiff?:             boolean;
    supportsDBTExtraction?:        boolean;
    supportsLineageExtraction?:    boolean;
    supportsMetadataExtraction?:   boolean;
    supportsProfiler?:             boolean;
    supportsQueryComment?:         boolean;
    supportsUsageExtraction?:      boolean;
    /**
     * Regex to only include/exclude tables that matches the pattern.
     */
    tableFilterPattern?: FilterPattern;
    /**
     * Username to connect to MySQL. This user should have privileges to read all the metadata
     * in Mysql.
     *
     * Username to connect to Postgres. This user should have privileges to read all the
     * metadata in Postgres.
     *
     * Username to connect to SQLite. Blank for in-memory database.
     *
     * Username to connect to the Matillion. This user should have privileges to read all the
     * metadata in Matillion.
     */
    username?: string;
    /**
     * Use slow logs to extract lineage.
     */
    useSlowLogs?: boolean;
    /**
     * Custom OpenMetadata Classification name for Postgres policy tags.
     */
    classificationName?: string;
    /**
     * Database of the data source. This is optional parameter, if you would like to restrict
     * the metadata reading to a single database. When left blank, OpenMetadata Ingestion
     * attempts to scan all the databases.
     */
    database?: string;
    /**
     * Ingest data from all databases in Postgres. You can use databaseFilterPattern on top of
     * this.
     */
    ingestAllDatabases?: boolean;
    /**
     * Fully qualified name of the view or table to use for query logs. If not provided,
     * defaults to pg_stat_statements. Use this to configure a custom view (e.g.,
     * my_schema.custom_pg_stat_statements) when direct access to pg_stat_statements is
     * restricted.
     */
    queryStatementSource?: string;
    sslMode?:              SSLMode;
    supportsDatabase?:     boolean;
    /**
     * How to run the SQLite database. :memory: by default.
     */
    databaseMode?: string;
    /**
     * Password to connect to SQLite. Blank for in-memory database.
     *
     * Password to connect to the Matillion.
     */
    password?:                      string;
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
 * Regex exclude pipelines.
 *
 * Regex to only fetch entities that matches the pattern.
 *
 * Regex to only include/exclude databases that matches the pattern.
 *
 * Regex to only include/exclude schemas that matches the pattern.
 *
 * Regex to only include/exclude stored procedures that matches the pattern.
 *
 * Regex to only include/exclude tables that matches the pattern.
 *
 * Regex to only fetch containers that matches the pattern.
 *
 * Regex to filter MuleSoft applications by name.
 *
 * Regex to only include/exclude pipelines that matches the pattern.
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
     * Enable AWS IAM authentication. When enabled, uses the default credential provider chain
     * (environment variables, instance profile, etc.). Defaults to false for backward
     * compatibility.
     */
    enabled?: boolean;
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
    SqlitePysqlite = "sqlite+pysqlite",
}

/**
 * SSL Configuration details.
 *
 * Client SSL configuration
 *
 * SSL/TLS certificate configuration for client authentication. Provide CA certificate,
 * client certificate, and private key for mutual TLS authentication.
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
     * Enable SSL/TLS encryption for the MSSQL connection. When enabled, all data transmitted
     * between the client and server will be encrypted.
     */
    encrypt?: boolean;
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
    scheme?: MssqlScheme;
    /**
     * SSL/TLS certificate configuration for client authentication. Provide CA certificate,
     * client certificate, and private key for mutual TLS authentication.
     */
    sslConfig?: Config;
    /**
     * Regex to only include/exclude stored procedures that matches the pattern.
     */
    storedProcedureFilterPattern?: FilterPattern;
    supportsDatabase?:             boolean;
    supportsDataDiff?:             boolean;
    supportsDBTExtraction?:        boolean;
    supportsLineageExtraction?:    boolean;
    supportsMetadataExtraction?:   boolean;
    supportsProfiler?:             boolean;
    supportsQueryComment?:         boolean;
    supportsUsageExtraction?:      boolean;
    /**
     * Regex to only include/exclude tables that matches the pattern.
     */
    tableFilterPattern?: FilterPattern;
    /**
     * Trust the server certificate without validation. Set to false in production to validate
     * server certificates against the certificate authority.
     */
    trustServerCertificate?: boolean;
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
 * Snowplow deployment type (BDP for managed or Community for self-hosted)
 *
 * Snowplow deployment type
 */
export enum SnowplowDeployment {
    Bdp = "BDP",
    Community = "Community",
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
     * Console EndPoint URL for S3-compatible services
     */
    consoleEndpointURL?: string;
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
 * SASL security mechanism
 *
 * SASL Mechanism consumer config property
 */
export enum SaslMechanismType {
    Gssapi = "GSSAPI",
    Oauthbearer = "OAUTHBEARER",
    Plain = "PLAIN",
    ScramSHA256 = "SCRAM-SHA-256",
    ScramSHA512 = "SCRAM-SHA-512",
}

/**
 * Kafka security protocol config
 */
export enum KafkaSecurityProtocol {
    Plaintext = "PLAINTEXT",
    SSL = "SSL",
    SaslPlaintext = "SASL_PLAINTEXT",
    SaslSSL = "SASL_SSL",
}

/**
 * Service Type
 *
 * Service type.
 *
 * Custom pipeline service type
 *
 * Type of pipeline service such as Airflow or Prefect...
 *
 * Type of pipeline service - Airflow or Prefect.
 */
export enum PipelineServiceType {
    Airbyte = "Airbyte",
    Airflow = "Airflow",
    CustomPipeline = "CustomPipeline",
    DBTCloud = "DBTCloud",
    Dagster = "Dagster",
    DataFactory = "DataFactory",
    DatabricksPipeline = "DatabricksPipeline",
    DomoPipeline = "DomoPipeline",
    Fivetran = "Fivetran",
    Flink = "Flink",
    GluePipeline = "GluePipeline",
    KafkaConnect = "KafkaConnect",
    KinesisFirehose = "KinesisFirehose",
    Matillion = "Matillion",
    MicrosoftFabricPipeline = "MicrosoftFabricPipeline",
    Mulesoft = "Mulesoft",
    Nifi = "Nifi",
    OpenLineage = "OpenLineage",
    Snowplow = "Snowplow",
    Spark = "Spark",
    Spline = "Spline",
    Ssis = "SSIS",
    Stitch = "Stitch",
    Wherescape = "Wherescape",
}

/**
 * Client SSL verification. Make sure to configure the SSLConfig if enabled.
 */
export enum VerifySSL {
    Ignore = "ignore",
    NoSSL = "no-ssl",
    Validate = "validate",
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
 * This schema defines the type for labeling an entity with a Tag.
 */
export interface TagLabel {
    /**
     * Timestamp when this tag was applied in ISO 8601 format
     */
    appliedAt?: Date;
    /**
     * Who it is that applied this tag (e.g: a bot, AI or a human)
     */
    appliedBy?: string;
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
     * Additional metadata associated with this tag label, such as recognizer information for
     * automatically applied tags.
     */
    metadata?: TagLabelMetadata;
    /**
     * Name of the tag or glossary term.
     */
    name?: string;
    /**
     * An explanation of why this tag was proposed, specially for autoclassification tags
     */
    reason?: string;
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
 * Additional metadata associated with this tag label, such as recognizer information for
 * automatically applied tags.
 *
 * Additional metadata associated with a tag label, including information about how the tag
 * was applied.
 */
export interface TagLabelMetadata {
    /**
     * Metadata about the recognizer that automatically applied this tag
     */
    recognizer?: TagLabelRecognizerMetadata;
}

/**
 * Metadata about the recognizer that automatically applied this tag
 *
 * Metadata about the recognizer that applied a tag, including scoring and pattern
 * information.
 */
export interface TagLabelRecognizerMetadata {
    /**
     * Details of patterns that matched during recognition
     */
    patterns?: PatternMatch[];
    /**
     * Unique identifier of the recognizer that applied this tag
     */
    recognizerId: string;
    /**
     * Human-readable name of the recognizer
     */
    recognizerName: string;
    /**
     * Confidence score assigned by the recognizer (0.0 to 1.0)
     */
    score: number;
    /**
     * What the recognizer analyzed to apply this tag
     */
    target?: Target;
}

/**
 * Information about a pattern that matched during recognition
 */
export interface PatternMatch {
    /**
     * Name of the pattern that matched
     */
    name: string;
    /**
     * Regular expression or pattern definition
     */
    regex?: string;
    /**
     * Confidence score for this specific pattern match
     */
    score: number;
}

/**
 * What the recognizer analyzed to apply this tag
 */
export enum Target {
    ColumnName = "column_name",
    Content = "content",
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
     * Cover image configuration for the entity.
     */
    coverImage?: CoverImage;
    /**
     * An icon to associate with GlossaryTerm, Tag, Domain or Data Product.
     */
    iconURL?: string;
}

/**
 * Cover image configuration for the entity.
 *
 * Cover image configuration for an entity. This is used to display a banner or header image
 * for entities like Domain, Glossary, Data Product, etc.
 */
export interface CoverImage {
    /**
     * Position of the cover image in CSS background-position format. Supports keywords (top,
     * center, bottom) or pixel values (e.g., '20px 30px').
     */
    position?: string;
    /**
     * URL of the cover image.
     */
    url?: string;
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
