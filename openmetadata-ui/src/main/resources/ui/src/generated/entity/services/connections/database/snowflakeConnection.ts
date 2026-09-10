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
 * Snowflake Connection Config
 */
export interface SnowflakeConnection {
    /**
     * Number of days of ACCESS_HISTORY scanned per query when 'Use Access History for Lineage'
     * is enabled. The lineage time window is split into chunks of this many days to keep each
     * Snowflake query bounded and avoid client/server timeouts over long windows. Lower this
     * value if queries still time out on very busy accounts.
     */
    accessHistoryChunkSize?: number;
    /**
     * If the Snowflake URL is https://xyz1234.us-east-1.gcp.snowflakecomputing.com, then the
     * account is xyz1234.us-east-1.gcp
     */
    account: string;
    /**
     * Full name of the schema where the account usage data is stored.
     */
    accountUsageSchema?: string;
    /**
     * Keep the session alive for long-running scans.
     */
    clientSessionKeepAlive?: boolean;
    connectionArguments?:    { [key: string]: any };
    connectionOptions?:      { [key: string]: string };
    /**
     * Cost of credit for the Snowflake account.
     */
    creditCost?: number;
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
     * Ingest Snowflake semantic views as data assets.
     */
    includeSemanticViews?: boolean;
    /**
     * Ingest external and internal stages.
     */
    includeStages?: boolean;
    /**
     * Ingest Snowflake streams as data assets.
     */
    includeStreams?: boolean;
    /**
     * Ingest transient tables alongside permanent ones.
     */
    includeTransientTables?: boolean;
    /**
     * Password to connect to Snowflake.
     */
    password?: string;
    /**
     * Policy agent configuration for access control extraction.
     */
    policyAgentConfig?: PolicyAgentConfig;
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
    role?:                    string;
    sampleDataStorageConfig?: SampleDataStorageConfig;
    /**
     * Regex to only include/exclude schemas that matches the pattern.
     */
    schemaFilterPattern?: FilterPattern;
    /**
     * SQLAlchemy driver scheme options.
     */
    scheme?: SnowflakeScheme;
    /**
     * Snowflake Passphrase Key used with Private Key
     */
    snowflakePrivatekeyPassphrase?: string;
    /**
     * Snowflake source host for the Snowflake account.
     */
    snowflakeSourceHost?: string;
    /**
     * Regex to only include/exclude stored procedures that matches the pattern.
     */
    storedProcedureFilterPattern?:          FilterPattern;
    supportsDatabase?:                      boolean;
    supportsDataDiff?:                      boolean;
    supportsDBTExtraction?:                 boolean;
    supportsIncrementalMetadataExtraction?: boolean;
    supportsLineageExtraction?:             boolean;
    supportsMetadataExtraction?:            boolean;
    supportsProfiler?:                      boolean;
    supportsQueryComment?:                  boolean;
    supportsSystemProfile?:                 boolean;
    supportsUsageExtraction?:               boolean;
    /**
     * Regex to only include/exclude tables that matches the pattern.
     */
    tableFilterPattern?: FilterPattern;
    /**
     * Service Type
     */
    type?: SnowflakeType;
    /**
     * Use Snowflake's ACCOUNT_USAGE.ACCESS_HISTORY view as the source of query lineage.
     * ACCESS_HISTORY provides Snowflake-computed table- and column-level lineage, including for
     * queries OpenMetadata cannot parse. Enabled by default; if the configured role cannot read
     * ACCESS_HISTORY, ingestion automatically falls back to the legacy query-log parser.
     */
    useAccessHistory?: boolean;
    /**
     * Username to connect to Snowflake. This user should have privileges to read all the
     * metadata in Snowflake.
     */
    username: string;
    /**
     * Snowflake warehouse.
     */
    warehouse: string;
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
 * Policy agent configuration for access control extraction.
 */
export interface PolicyAgentConfig {
    /**
     * Enable policy agent extraction.
     */
    enabled?: boolean;
    /**
     * Supports column-level access policy extraction.
     */
    supportsColumnAccess?: boolean;
    /**
     * Supports full access policy extraction.
     */
    supportsFullAccess?: boolean;
    /**
     * Supports masked access policy extraction.
     */
    supportsMaskedAccess?: boolean;
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
    storageConfig?: OpenMetadataStorage;
    [property: string]: any;
}

export interface OpenMetadataStorage {
}

/**
 * SQLAlchemy driver scheme options.
 */
export enum SnowflakeScheme {
    Snowflake = "snowflake",
}

/**
 * Service Type
 *
 * Service type.
 */
export enum SnowflakeType {
    Snowflake = "Snowflake",
}
