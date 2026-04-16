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
 * Hive SQL Connection Config
 */
export interface HiveConnection {
    /**
     * Authentication mode to connect to hive.
     */
    auth?: AuthenticationMode;
    /**
     * Authentication options to pass to Hive connector. These options are based on SQLAlchemy.
     */
    authOptions?:         string;
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
     * Host and port of the Hive service.
     */
    hostPort: string;
    /**
     * If authenticating with Kerberos specify the Kerberos service name
     */
    kerberosServiceName?: string;
    /**
     * Hive Metastore Connection Details
     */
    metastoreConnection?: HiveMetastoreConnectionDetails;
    /**
     * Password to connect to Hive.
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
    scheme?: HiveScheme;
    /**
     * SSL Configuration details.
     */
    sslConfig?:                     Config;
    supportsDBTExtraction?:         boolean;
    supportsMetadataExtraction?:    boolean;
    supportsProfiler?:              boolean;
    supportsViewLineageExtraction?: boolean;
    /**
     * Regex to only include/exclude tables that matches the pattern.
     */
    tableFilterPattern?: FilterPattern;
    /**
     * Service Type
     */
    type?: HiveType;
    /**
     * Username to connect to Hive. This user should have privileges to read all the metadata in
     * Hive.
     */
    username?: string;
    /**
     * Enable SSL connection to Hive server. When enabled, SSL transport will be used for secure
     * communication.
     */
    useSSL?: boolean;
}

/**
 * Authentication mode to connect to hive.
 */
export enum AuthenticationMode {
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
 * Regex to only include/exclude databases that matches the pattern.
 *
 * Regex to only fetch entities that matches the pattern.
 *
 * Regex to only include/exclude schemas that matches the pattern.
 *
 * Regex to only include/exclude stored procedures that matches the pattern.
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
 * Hive Metastore Connection Details
 *
 * Postgres Database Connection Config
 *
 * Mysql Database Connection Config
 *
 * Mssql Database Connection Config
 *
 * Oracle Database Connection Config
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
     * Host and port of the MySQL service. For GCP CloudSQL, use the instance connection name in
     * the format 'project_id:region:instance_name'.
     *
     * Host and port of the MSSQL service.
     *
     * Host and port of the Oracle service.
     */
    hostPort?: string;
    /**
     * Ingest data from all databases in Postgres. You can use databaseFilterPattern on top of
     * this.
     *
     * Ingest data from all databases in Mssql. You can use databaseFilterPattern on top of this.
     */
    ingestAllDatabases?: boolean;
    /**
     * Fully qualified name of the view or table to use for query logs. If not provided,
     * defaults to pg_stat_statements. Use this to configure a custom view (e.g.,
     * my_schema.custom_pg_stat_statements) when direct access to pg_stat_statements is
     * restricted.
     */
    queryStatementSource?:    string;
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
     *
     * SSL/TLS certificate configuration for client authentication. Provide CA certificate,
     * client certificate, and private key for mutual TLS authentication.
     */
    sslConfig?: Config;
    sslMode?:   SSLMode;
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
     * Service Type
     */
    type?: Type;
    /**
     * Username to connect to Postgres. This user should have privileges to read all the
     * metadata in Postgres.
     *
     * Username to connect to MySQL. This user should have privileges to read all the metadata
     * in Mysql.
     *
     * Username to connect to MSSQL. This user should have privileges to read all the metadata
     * in MsSQL.
     *
     * Username to connect to Oracle. This user should have privileges to read all the metadata
     * in Oracle.
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
     * Password to connect to MSSQL.
     *
     * Password to connect to Oracle.
     */
    password?: string;
    /**
     * Trust the server certificate without validation. Set to false in production to validate
     * server certificates against the certificate authority.
     */
    trustServerCertificate?: boolean;
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
     * Controls how Oracle identifier names (tables, columns, schemas) are stored in
     * OpenMetadata. When disabled (default), Oracle's UPPERCASE unquoted identifiers (e.g.
     * EMPLOYEES) are not guaranteed to be stored as-is — identifiers with the same letters but
     * different case (e.g. unquoted EMPLOYEES and quoted 'employees') will collide into the
     * same name. When enabled, names are stored exactly as Oracle persists them, which solves
     * same-name collisions between quoted and unquoted identifiers. WARNING: enabling this
     * after data has already been ingested with the default setting will change the stored
     * names of all existing tables, columns, schemas, and constraints — breaking attached tags,
     * descriptions, lineage, data quality tests, and any other metadata associated with those
     * entities. If you must switch, soft-delete all previously ingested entities before
     * re-ingesting.
     */
    preserveIdentifierCase?: boolean;
    /**
     * Use Oracle DBA_* tables instead of ALL_* tables for metadata ingestion. Requires DBA
     * privileges.
     */
    useDBATable?: boolean;
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
 * GCP CloudSQL Database Connection Config. Uses the Google Cloud SQL Python Connector.
 */
export interface AuthConfigurationType {
    /**
     * Password to connect to source.
     *
     * Database user password. Leave empty if using IAM database authentication.
     */
    password?:    string;
    awsConfig?:   AWSCredentials;
    azureConfig?: AzureCredentials;
    /**
     * Use GCP IAM for database authentication instead of a password.
     */
    enableIamAuth?: boolean;
    /**
     * GCP credentials to use. If not provided, Application Default Credentials will be used.
     */
    gcpConfig?: GCPCredentials;
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
 * GCP credentials to use. If not provided, Application Default Credentials will be used.
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
    MssqlPymssql = "mssql+pymssql",
    MssqlPyodbc = "mssql+pyodbc",
    MssqlPytds = "mssql+pytds",
    MysqlPymysql = "mysql+pymysql",
    OracleCxOracle = "oracle+cx_oracle",
    PgspiderPsycopg2 = "pgspider+psycopg2",
    PostgresqlPsycopg2 = "postgresql+psycopg2",
}

/**
 * Client SSL configuration
 *
 * SSL Configuration details.
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
    Mssql = "Mssql",
    Mysql = "Mysql",
    Oracle = "Oracle",
    Postgres = "Postgres",
}

/**
 * SQLAlchemy driver scheme options.
 */
export enum HiveScheme {
    Hive = "hive",
    HiveHTTP = "hive+http",
    HiveHTTPS = "hive+https",
}

/**
 * Service Type
 *
 * Service type.
 */
export enum HiveType {
    Hive = "Hive",
}
