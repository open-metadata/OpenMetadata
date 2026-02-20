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
 * Configuration for the Metadata Exporter Application.
 */
export interface MetadataExporterAppConfig {
    /**
     * Enable backfill for the exporter to process historical data. This will only work on the
     * very first run of the exporter.
     */
    backfill?: boolean;
    /**
     * Connection details for the Metadata Exporter Application.
     */
    connectionConfig: Connection;
    /**
     * List of event types to export.
     */
    eventTypes?: EventType[];
    /**
     * Range of data to export. Options are 'ALL' for all data, 'LATEST' for the latest data, or
     * a specific date range.
     */
    exportRange: ExportRangeConfiguration;
    /**
     * Configuration for the table to export the data to.
     */
    tableConfiguration: ConfigurationForTheTableToExportTheDataTo;
    /**
     * Application Type
     */
    type?: MetadataExporterAppType;
}

/**
 * Connection details for the Metadata Exporter Application.
 *
 * Snowflake Connection Config
 *
 * Databricks Connection Config
 *
 * Google BigQuery Connection Config
 *
 * Trino Connection Config
 */
export interface Connection {
    /**
     * If the Snowflake URL is https://xyz1234.us-east-1.gcp.snowflakecomputing.com, then the
     * account is xyz1234.us-east-1.gcp
     */
    account?: string;
    /**
     * Optional configuration for ingestion to keep the client session active in case the
     * ingestion process runs for longer durations.
     */
    clientSessionKeepAlive?: boolean;
    connectionArguments?:    { [key: string]: any };
    connectionOptions?:      { [key: string]: string };
    /**
     * Database of the data source. This is optional parameter, if you would like to restrict
     * the metadata reading to a single database. When left blank, OpenMetadata Ingestion
     * attempts to scan all the databases.
     */
    database?: string;
    /**
     * Password to connect to Snowflake.
     */
    password?: string;
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
     * SQLAlchemy driver scheme options.
     */
    scheme?: Scheme;
    /**
     * Snowflake Passphrase Key used with Private Key
     */
    snowflakePrivatekeyPassphrase?: string;
    /**
     * Service Type
     */
    type?: Type;
    /**
     * Username to connect to Snowflake. This user should have privileges to read all the
     * metadata in Snowflake.
     *
     * Username to connect to Trino.
     */
    username?: string;
    /**
     * Snowflake warehouse.
     */
    warehouse?: string;
    /**
     * Choose between different authentication types for Databricks.
     *
     * Choose Auth Config Type.
     */
    authType?: AuthenticationType | NoConfigAuthenticationTypes;
    /**
     * Catalog of the data source(Example: hive_metastore). This is optional parameter, if you
     * would like to restrict the metadata reading to a single catalog. When left blank,
     * OpenMetadata Ingestion attempts to scan all the catalog.
     *
     * Catalog of the data source.
     */
    catalog?: string;
    /**
     * The maximum amount of time (in seconds) to wait for a successful connection to the data
     * source. If the connection attempt takes longer than this timeout period, an error will be
     * returned.
     */
    connectionTimeout?: number;
    /**
     * Database Schema of the data source. This is optional parameter, if you would like to
     * restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion
     * attempts to scan all the schemas.
     *
     * Database Schema of the data source.
     */
    databaseSchema?: string;
    /**
     * Host and port of the Databricks service.
     *
     * BigQuery APIs URL.
     *
     * Host and port of the Trino service.
     */
    hostPort?: string;
    /**
     * Databricks compute resources URL.
     */
    httpPath?: string;
    /**
     * Billing Project ID
     */
    billingProjectId?: string;
    /**
     * GCP Credentials
     */
    credentials?: GCPCredentials;
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
}

/**
 * Choose between different authentication types for Databricks.
 *
 * Personal Access Token authentication for Databricks.
 *
 * OAuth2 Machine-to-Machine authentication using Service Principal credentials for
 * Databricks.
 *
 * Azure Active Directory authentication for Azure Databricks workspaces using Service
 * Principal.
 *
 * Common Database Connection Config
 *
 * Azure Database Connection Config
 */
export interface AuthenticationType {
    /**
     * Generated Personal Access Token for Databricks workspace authentication. This token is
     * created from User Settings -> Developer -> Access Tokens in your Databricks workspace.
     */
    token?: string;
    /**
     * Service Principal Application ID created in your Databricks Account Console for OAuth
     * Machine-to-Machine authentication.
     */
    clientId?: string;
    /**
     * OAuth Secret generated for the Service Principal in Databricks Account Console. Used for
     * secure OAuth2 authentication.
     */
    clientSecret?: string;
    /**
     * Azure Service Principal Application (client) ID registered in your Azure Active Directory.
     */
    azureClientId?: string;
    /**
     * Azure Service Principal client secret created in Azure AD for authentication.
     */
    azureClientSecret?: string;
    /**
     * Azure Active Directory Tenant ID where your Service Principal is registered.
     */
    azureTenantId?: string;
    /**
     * Password to connect to source.
     */
    password?: string;
    /**
     * JWT to connect to source.
     */
    jwt?:         string;
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
 * Database Authentication types not requiring config.
 */
export enum NoConfigAuthenticationTypes {
    OAuth2 = "OAuth2",
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
 * SQLAlchemy driver scheme options.
 */
export enum Scheme {
    Bigquery = "bigquery",
    DatabricksConnector = "databricks+connector",
    Snowflake = "snowflake",
    Trino = "trino",
}

/**
 * Service Type
 *
 * Service type.
 */
export enum Type {
    BigQuery = "BigQuery",
    Databricks = "Databricks",
    Snowflake = "Snowflake",
    Trino = "Trino",
}

export enum EventType {
    EntityHistory = "ENTITY_HISTORY",
    Profile = "PROFILE",
    TestCaseResults = "TEST_CASE_RESULTS",
}

/**
 * Range of data to export. Options are 'ALL' for all data, 'LATEST' for the latest data, or
 * a specific date range.
 *
 * Configuration for the export range of data.
 */
export interface ExportRangeConfiguration {
    /**
     * Interval for the export range, applicable when rangeType is 'DATE_RANGE'.
     */
    interval?: number;
    /**
     * Type of range for data export.
     */
    rangeType: RangeType;
    /**
     * Unit of time for the export range.
     */
    unit?: Unit;
    [property: string]: any;
}

/**
 * Type of range for data export.
 */
export enum RangeType {
    All = "ALL",
    DateRange = "DATE_RANGE",
    Latest = "LATEST",
}

/**
 * Unit of time for the export range.
 */
export enum Unit {
    Days = "DAYS",
    Hours = "HOURS",
}

/**
 * Configuration for the table to export the data to.
 */
export interface ConfigurationForTheTableToExportTheDataTo {
    databaseName: string;
    schemaName:   string;
    tableName:    string;
    [property: string]: any;
}

/**
 * Application Type
 *
 * Application type.
 */
export enum MetadataExporterAppType {
    MetadataExporter = "MetadataExporter",
}
