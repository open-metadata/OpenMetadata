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
 * This schema defines the Dashboard Service entity, such as Looker and Superset.
 */
export interface DashboardService {
    /**
     * Change that lead to this version of the entity.
     */
    changeDescription?: ChangeDescription;
    connection?:        DashboardConnection;
    /**
     * List of data products this entity is part of.
     */
    dataProducts?: EntityReference[];
    /**
     * When `true` indicates the entity has been soft deleted.
     */
    deleted?: boolean;
    /**
     * Description of a dashboard service instance.
     */
    description?: string;
    /**
     * Display Name that identifies this dashboard service.
     */
    displayName?: string;
    /**
     * Domain the Dashboard service belongs to.
     */
    domain?: EntityReference;
    /**
     * Followers of this entity.
     */
    followers?: EntityReference[];
    /**
     * FullyQualifiedName same as `name`.
     */
    fullyQualifiedName?: string;
    /**
     * Link to the resource corresponding to this dashboard service.
     */
    href?: string;
    /**
     * Unique identifier of this dashboard service instance.
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
     * Name that identifies this dashboard service.
     */
    name: string;
    /**
     * Owners of this dashboard service.
     */
    owners?: EntityReference[];
    /**
     * References to pipelines deployed for this dashboard service.
     */
    pipelines?: EntityReference[];
    /**
     * Type of dashboard service such as Looker or Superset...
     */
    serviceType: DashboardServiceType;
    /**
     * Tags for this Dashboard Service.
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
 * Dashboard Connection.
 */
export interface DashboardConnection {
    config?: Connection;
}

/**
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
 */
export interface Connection {
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
     */
    clientId?: string;
    /**
     * User's Client Secret.
     *
     * clientSecret for PowerBI.
     *
     * clientSecret for Sigma.
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
     */
    hostPort?: string;
    /**
     * Regex to exclude or include projects that matches the pattern.
     */
    projectFilterPattern?:       FilterPattern;
    supportsMetadataExtraction?: boolean;
    /**
     * Service Type
     *
     * Custom dashboard service type
     */
    type?: DashboardServiceType;
    /**
     * Password to connect to Metabase.
     *
     * Password to connect to PowerBI report server.
     *
     * Password to connect to MicroStrategy.
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
     */
    apiKey?: string;
    /**
     * Version of the Redash instance
     */
    redashVersion?: string;
    /**
     * Choose between API or database connection fetch metadata from superset.
     */
    connection?: SupersetConnection;
    /**
     * Tableau API version. If not provided, the version will be used from the tableau server.
     *
     * Sigma API version.
     */
    apiVersion?: string;
    /**
     * Types of methods used to authenticate to the tableau instance
     */
    authType?: AuthenticationTypeForTableau;
    /**
     * Pagination limit used while querying the tableau metadata API for getting data sources
     */
    paginationLimit?: number;
    /**
     * Tableau Site Name.
     */
    siteName?:  string;
    sslConfig?: CertificatesSSLConfig;
    verifySSL?: VerifySSL;
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
     */
    projectName?: string;
    /**
     * Space types of Qlik Cloud to filter the dashboards ingested into the platform.
     */
    spaceTypes?: SpaceType[];
    /**
     * token to connect to Qlik Cloud.
     */
    token?: string;
}

/**
 * Types of methods used to authenticate to the tableau instance
 *
 * Basic Auth Credentials
 *
 * Access Token Auth Credentials
 */
export interface AuthenticationTypeForTableau {
    /**
     * Password to access the service.
     */
    password?: string;
    /**
     * Username to access the service.
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
 * Qlik Authentication Certificate By Values
 *
 * Qlik Authentication Certificate File Path
 */
export interface QlikCertificatesBy {
    sslConfig?: CertificatesSSLConfig;
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
 * Client SSL configuration
 *
 * SSL Configuration details.
 *
 * OpenMetadata Client configured to validate SSL certificates.
 */
export interface CertificatesSSLConfig {
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
 * Regex exclude or include charts that matches the pattern.
 *
 * Regex to only fetch entities that matches the pattern.
 *
 * Regex to exclude or include dashboards that matches the pattern.
 *
 * Regex exclude or include data models that matches the pattern.
 *
 * Regex to exclude or include projects that matches the pattern.
 *
 * Regex to only include/exclude databases that matches the pattern.
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
 * Choose between API or database connection fetch metadata from superset.
 *
 * Superset API Connection Config
 *
 * Postgres Database Connection Config
 *
 * Mysql Database Connection Config
 */
export interface SupersetConnection {
    /**
     * Password for Superset.
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
    sslConfig?: SupersetConnectionSSLConfig;
    /**
     * Username for Superset.
     *
     * Username to connect to Postgres. This user should have privileges to read all the
     * metadata in Postgres.
     *
     * Username to connect to MySQL. This user should have privileges to read all the metadata
     * in Mysql.
     */
    username:   string;
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
    scheme?:                     Scheme;
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
    type?: SupersetConnectionType;
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
export enum Scheme {
    MysqlPymysql = "mysql+pymysql",
    PgspiderPsycopg2 = "pgspider+psycopg2",
    PostgresqlPsycopg2 = "postgresql+psycopg2",
}

/**
 * Client SSL configuration
 *
 * OpenMetadata Client configured to validate SSL certificates.
 *
 * SSL Configuration details.
 */
export interface SupersetConnectionSSLConfig {
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
export enum SupersetConnectionType {
    Mysql = "Mysql",
    Postgres = "Postgres",
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
    securityConfig?:      Credentials;
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
 * Azure Cloud Credentials
 *
 * GCP credentials configs.
 *
 * AWS credentials configs.
 */
export interface Credentials {
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

export enum SpaceType {
    Data = "Data",
    Managed = "Managed",
    Personal = "Personal",
    Shared = "Shared",
}

/**
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
 * Type of dashboard service such as Looker or Superset...
 *
 * Type of Dashboard service - Superset, Looker, Redash, Tableau, Metabase, PowerBi, Mode,
 * or Lightdash
 */
export enum DashboardServiceType {
    CustomDashboard = "CustomDashboard",
    DomoDashboard = "DomoDashboard",
    Lightdash = "Lightdash",
    Looker = "Looker",
    Metabase = "Metabase",
    MicroStrategy = "MicroStrategy",
    Mode = "Mode",
    PowerBI = "PowerBI",
    PowerBIReportServer = "PowerBIReportServer",
    QlikCloud = "QlikCloud",
    QlikSense = "QlikSense",
    QuickSight = "QuickSight",
    Redash = "Redash",
    Sigma = "Sigma",
    Superset = "Superset",
    Tableau = "Tableau",
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
 * Domain the Dashboard service belongs to.
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
