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
 * Create Database service entity request
 */
export interface CreateDatabaseService {
    connection?: DatabaseConnection;
    /**
     * List of fully qualified names of data products this entity is part of.
     */
    dataProducts?: string[];
    /**
     * Description of Database entity.
     */
    description?: string;
    /**
     * Display Name that identifies this database service.
     */
    displayName?: string;
    /**
     * Fully qualified name of the domain the Database Service belongs to.
     */
    domain?: string;
    /**
     * The ingestion agent responsible for executing the ingestion pipeline. It will be defined
     * at runtime based on the Ingestion Agent of the service.
     */
    ingestionRunner?: EntityReference;
    /**
     * Name that identifies the this entity instance uniquely
     */
    name: string;
    /**
     * Owners of this database service.
     */
    owners?:     EntityReference[];
    serviceType: DatabaseServiceType;
    /**
     * Tags for this Database Service.
     */
    tags?: TagLabel[];
}

/**
 * Database Connection.
 */
export interface DatabaseConnection {
    config?: ConfigClass;
}

/**
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
 */
export interface ConfigClass {
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
     */
    hostPort?:                string;
    sampleDataStorageConfig?: SampleDataStorageConfig;
    /**
     * Regex to only include/exclude schemas that matches the pattern.
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
    supportsLineageExtraction?:  boolean;
    supportsMetadataExtraction?: boolean;
    supportsProfiler?:           boolean;
    supportsQueryComment?:       boolean;
    supportsSystemProfile?:      boolean;
    /**
     * Supports Usage Extraction.
     */
    supportsUsageExtraction?: boolean;
    /**
     * Regex to only include/exclude tables that matches the pattern.
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
     * Service Type
     *
     * Custom database service type
     */
    type?: ConfigType;
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
     * logged-in user's credentials. This mode is useful for establishing secure and seamless
     * connections with Azure Synapse.
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
     */
    connectionTimeout?: number;
    /**
     * Databricks compute resources URL.
     */
    httpPath?: string;
    /**
     * Table name to fetch the query history.
     */
    queryHistoryTable?: string;
    /**
     * Generated Token to connect to Databricks.
     */
    token?: string;
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
     */
    configSource?: TaLakeConfigurationSource;
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
     */
    authType?: AuthConfigurationType | NoConfigAuthenticationTypes;
    /**
     * SSL Configuration details.
     */
    sslConfig?: Config;
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
     */
    accessToken?: string;
    /**
     * API Host to connect to DOMO instance
     */
    apiHost?: string;
    /**
     * Client ID for DOMO
     */
    clientId?: string;
    /**
     * URL of your Domo instance, e.g., https://openmetadata.domo.com
     */
    instanceDomain?: string;
    /**
     * Secret Token to connect DOMO
     */
    secretToken?: string;
    /**
     * Source Python Class Name to instantiated by the ingestion workflow
     */
    sourcePythonClass?: string;
    /**
     * Choose between Database connection or HDB User Store connection.
     */
    connection?: SAPHanaConnection;
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
     */
    apiKey?: string;
    /**
     * Pagination limit used while querying the SAP ERP API for fetching the entities
     */
    paginationLimit?: number;
    verifySSL?:       VerifySSL;
    /**
     * Client SSL/TLS settings.
     */
    tls?: SSLTLSSettings;
    /**
     * HTTP Link for SSAS ACCESS
     */
    httpConnection?: string;
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
 */
export interface AuthConfigurationType {
    /**
     * Password to connect to source.
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
 */
export interface TaLakeConfigurationSource {
    /**
     * pySpark App Name.
     */
    appName?: string;
    /**
     * Metastore connection configuration, depending on your metastore type.
     *
     * Available sources to fetch files.
     */
    connection?: ConnectionClass;
    /**
     * Bucket Name of the data source.
     */
    bucketName?: string;
    /**
     * Prefix of the data source.
     */
    prefix?:         string;
    securityConfig?: SecurityConfigClass;
}

/**
 * Metastore connection configuration, depending on your metastore type.
 *
 * Available sources to fetch files.
 *
 * DataLake S3 bucket will ingest metadata of files in bucket
 */
export interface ConnectionClass {
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
 */
export interface SAPHanaConnection {
    /**
     * Database of the data source.
     */
    database?: string;
    /**
     * Database Schema of the data source. This is an optional parameter, if you would like to
     * restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion
     * attempts to scan all the schemas.
     */
    databaseSchema?: string;
    /**
     * Host and port of the Hana service.
     */
    hostPort?: string;
    /**
     * Password to connect to Hana.
     */
    password?: string;
    /**
     * Username to connect to Hana. This user should have privileges to read all the metadata.
     */
    username?: string;
    /**
     * HDB Store User Key generated from the command `hdbuserstore SET <KEY> <host:port>
     * <USERNAME> <PASSWORD>`
     */
    userKey?: string;
}

/**
 * GCP Credentials
 *
 * GCP credentials configs.
 */
export interface GCPCredentials {
    /**
     * We support two ways of authenticating to GCP i.e via GCP Credentials Values or GCP
     * Credentials Path
     */
    gcpConfig: GCPCredentialsConfiguration;
    /**
     * we enable the authenticated service account to impersonate another service account
     */
    gcpImpersonateServiceAccount?: GCPImpersonateServiceAccountValues;
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
    authType?: HiveMetastoreConnectionDetailsAuthConfigurationType;
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
 * Choose Auth Config Type.
 *
 * Common Database Connection Config
 *
 * IAM Auth Database Connection Config
 *
 * Azure Database Connection Config
 */
export interface HiveMetastoreConnectionDetailsAuthConfigurationType {
    /**
     * Password to connect to source.
     */
    password?:    string;
    awsConfig?:   AWSCredentials;
    azureConfig?: AzureCredentials;
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
export enum HiveMetastoreConnectionDetailsScheme {
    MysqlPymysql = "mysql+pymysql",
    PgspiderPsycopg2 = "pgspider+psycopg2",
    PostgresqlPsycopg2 = "postgresql+psycopg2",
}

/**
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
export enum HiveMetastoreConnectionDetailsType {
    Mysql = "Mysql",
    Postgres = "Postgres",
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
 * Service Type
 *
 * Service type.
 *
 * service type
 *
 * Custom database service type
 */
export enum ConfigType {
    Athena = "Athena",
    AzureSQL = "AzureSQL",
    BigQuery = "BigQuery",
    BigTable = "BigTable",
    Cassandra = "Cassandra",
    Clickhouse = "Clickhouse",
    Cockroach = "Cockroach",
    Couchbase = "Couchbase",
    CustomDatabase = "CustomDatabase",
    Databricks = "Databricks",
    Datalake = "Datalake",
    Db2 = "Db2",
    DeltaLake = "DeltaLake",
    DomoDatabase = "DomoDatabase",
    Doris = "Doris",
    Druid = "Druid",
    DynamoDB = "DynamoDB",
    Exasol = "Exasol",
    Glue = "Glue",
    Greenplum = "Greenplum",
    Hive = "Hive",
    Iceberg = "Iceberg",
    Impala = "Impala",
    MariaDB = "MariaDB",
    MongoDB = "MongoDB",
    Mssql = "Mssql",
    Mysql = "Mysql",
    Oracle = "Oracle",
    PinotDB = "PinotDB",
    Postgres = "Postgres",
    Presto = "Presto",
    Redshift = "Redshift",
    SAS = "SAS",
    SQLite = "SQLite",
    Salesforce = "Salesforce",
    SapERP = "SapErp",
    SapHana = "SapHana",
    SingleStore = "SingleStore",
    Snowflake = "Snowflake",
    Ssas = "SSAS",
    Synapse = "Synapse",
    Teradata = "Teradata",
    Trino = "Trino",
    UnityCatalog = "UnityCatalog",
    Vertica = "Vertica",
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
 * The ingestion agent responsible for executing the ingestion pipeline. It will be defined
 * at runtime based on the Ingestion Agent of the service.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Owners of this database service.
 *
 * This schema defines the EntityReferenceList type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
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
 * Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres...
 */
export enum DatabaseServiceType {
    Athena = "Athena",
    AzureSQL = "AzureSQL",
    BigQuery = "BigQuery",
    BigTable = "BigTable",
    Cassandra = "Cassandra",
    Clickhouse = "Clickhouse",
    Cockroach = "Cockroach",
    Couchbase = "Couchbase",
    CustomDatabase = "CustomDatabase",
    Databricks = "Databricks",
    Datalake = "Datalake",
    Db2 = "Db2",
    Dbt = "Dbt",
    DeltaLake = "DeltaLake",
    DomoDatabase = "DomoDatabase",
    Doris = "Doris",
    Druid = "Druid",
    DynamoDB = "DynamoDB",
    Exasol = "Exasol",
    Glue = "Glue",
    Greenplum = "Greenplum",
    Hive = "Hive",
    Iceberg = "Iceberg",
    Impala = "Impala",
    MariaDB = "MariaDB",
    MongoDB = "MongoDB",
    Mssql = "Mssql",
    Mysql = "Mysql",
    Oracle = "Oracle",
    PinotDB = "PinotDB",
    Postgres = "Postgres",
    Presto = "Presto",
    QueryLog = "QueryLog",
    Redshift = "Redshift",
    SAS = "SAS",
    SQLite = "SQLite",
    Salesforce = "Salesforce",
    SapERP = "SapErp",
    SapHana = "SapHana",
    SingleStore = "SingleStore",
    Snowflake = "Snowflake",
    Ssas = "SSAS",
    Synapse = "Synapse",
    Teradata = "Teradata",
    Trino = "Trino",
    UnityCatalog = "UnityCatalog",
    Vertica = "Vertica",
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
