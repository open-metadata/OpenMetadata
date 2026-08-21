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
 * ClickZetta Database Connection Config
 */
export interface ClickzettaConnection {
    /**
     * Choose the ClickZetta authentication configuration.
     */
    authType:             AuthConfigurationType;
    connectionArguments?: { [key: string]: any };
    connectionOptions?:   { [key: string]: string };
    /**
     * Regex to only include or exclude matching databases.
     */
    databaseFilterPattern?: FilterPattern;
    /**
     * ClickZetta workspace to ingest.
     */
    databaseName: string;
    /**
     * Optional schema restriction. When omitted, OpenMetadata attempts to scan all schemas.
     */
    databaseSchema?: string;
    /**
     * Complete ClickZetta instance and service host, with an optional port.
     */
    hostPort: string;
    /**
     * Protocol used to connect to ClickZetta.
     */
    protocol?: Protocol;
    /**
     * Optional ClickZetta table or view used for usage and query-lineage extraction. Set this
     * to information_schema.job_history for workspace-local native history or
     * sys.information_schema.job_history for cross-workspace native history; the connector maps
     * their native columns and scopes them to the configured workspace and schema. Custom
     * tables or views must expose query_text, query_type, user_name, database_name,
     * schema_name, start_time, end_time, duration, aborted, and cost columns.
     */
    queryHistoryTable?: string;
    /**
     * Regex to only include or exclude matching schemas.
     */
    schemaFilterPattern?: FilterPattern;
    /**
     * SQLAlchemy driver scheme options.
     */
    scheme?:                     ClickzettaScheme;
    supportsDataDiff?:           boolean;
    supportsDBTExtraction?:      boolean;
    supportsLineageExtraction?:  boolean;
    supportsMetadataExtraction?: boolean;
    supportsProfiler?:           boolean;
    supportsUsageExtraction?:    boolean;
    /**
     * Regex to only include or exclude matching tables.
     */
    tableFilterPattern?: FilterPattern;
    /**
     * Service Type
     */
    type?: ClickzettaType;
    /**
     * Username to connect to ClickZetta.
     */
    username: string;
    /**
     * ClickZetta virtual cluster used for metadata extraction.
     */
    virtualCluster: string;
}

/**
 * Choose the ClickZetta authentication configuration.
 *
 * Common Database Connection Config
 */
export interface AuthConfigurationType {
    /**
     * Password to connect to source.
     */
    password?: string;
}

/**
 * Regex to only include or exclude matching databases.
 *
 * Regex to only fetch entities that matches the pattern.
 *
 * Regex to only include or exclude matching schemas.
 *
 * Regex to only include or exclude matching tables.
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
 * Protocol used to connect to ClickZetta.
 */
export enum Protocol {
    HTTP = "http",
    HTTPS = "https",
}

/**
 * SQLAlchemy driver scheme options.
 */
export enum ClickzettaScheme {
    Clickzetta = "clickzetta",
}

/**
 * Service Type
 *
 * Service type.
 */
export enum ClickzettaType {
    Clickzetta = "Clickzetta",
}
