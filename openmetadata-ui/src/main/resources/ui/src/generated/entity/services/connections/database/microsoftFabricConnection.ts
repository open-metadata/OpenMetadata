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
 * Microsoft Fabric Warehouse and Lakehouse Connection Config
 */
export interface MicrosoftFabricConnection {
    /**
     * Azure Application (client) ID for Service Principal authentication.
     */
    clientId: string;
    /**
     * Azure Application client secret for Service Principal authentication.
     */
    clientSecret: string;
    /**
     * Database of the data source. This is the name of your Fabric Warehouse or Lakehouse. This
     * is optional parameter, if you would like to restrict the metadata reading to a single
     * database. When left blank, OpenMetadata Ingestion attempts to scan all the databases.
     */
    database?: string;
    /**
     * Regex to only include/exclude databases that matches the pattern.
     */
    databaseFilterPattern?: FilterPattern;
    /**
     * ODBC driver version in case of pyodbc connection.
     */
    driver?: string;
    /**
     * Host and port of the Microsoft Fabric SQL endpoint (e.g.,
     * your-workspace.datawarehouse.fabric.microsoft.com:1433).
     */
    hostPort: string;
    /**
     * Ingest data from all databases (Warehouses and Lakehouses) in Microsoft Fabric. You can
     * use databaseFilterPattern on top of this.
     */
    ingestAllDatabases?: boolean;
    /**
     * Regex to only include/exclude schemas that matches the pattern.
     */
    schemaFilterPattern?: FilterPattern;
    /**
     * SQLAlchemy driver scheme options.
     */
    scheme?:                     MicrosoftFabricScheme;
    supportsDatabase?:           boolean;
    supportsDBTExtraction?:      boolean;
    supportsMetadataExtraction?: boolean;
    /**
     * Regex to only include/exclude tables that matches the pattern.
     */
    tableFilterPattern?: FilterPattern;
    /**
     * Azure Directory (tenant) ID for Service Principal authentication.
     */
    tenantId: string;
    /**
     * Service Type
     */
    type?: MicrosoftFabricType;
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
 * SQLAlchemy driver scheme options.
 */
export enum MicrosoftFabricScheme {
    MssqlPyodbc = "mssql+pyodbc",
}

/**
 * Service Type
 *
 * Service type.
 */
export enum MicrosoftFabricType {
    MicrosoftFabric = "MicrosoftFabric",
}
