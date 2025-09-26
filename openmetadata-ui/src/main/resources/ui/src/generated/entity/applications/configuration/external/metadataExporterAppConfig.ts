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
     */
    username?: string;
    /**
     * Snowflake warehouse.
     */
    warehouse?: string;
    /**
     * Choose between different authentication types for Databricks.
     */
    authType?: AuthenticationType;
    /**
     * Catalog of the data source(Example: hive_metastore). This is optional parameter, if you
     * would like to restrict the metadata reading to a single catalog. When left blank,
     * OpenMetadata Ingestion attempts to scan all the catalog.
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
     */
    databaseSchema?: string;
    /**
     * Host and port of the Databricks service.
     */
    hostPort?: string;
    /**
     * Databricks compute resources URL.
     */
    httpPath?: string;
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
}

/**
 * SQLAlchemy driver scheme options.
 */
export enum Scheme {
    DatabricksConnector = "databricks+connector",
    Snowflake = "snowflake",
}

/**
 * Service Type
 *
 * Service type.
 */
export enum Type {
    Databricks = "Databricks",
    Snowflake = "Snowflake",
}

export enum EventType {
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
