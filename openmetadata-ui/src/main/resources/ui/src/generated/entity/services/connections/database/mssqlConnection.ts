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
 * Mssql Database Connection Config
 */
export interface MssqlConnection {
    connectionArguments?: { [key: string]: any };
    connectionOptions?:   { [key: string]: string };
    /**
     * Initial database to connect to. Metadata reading is restricted to this database unless
     * Ingest All Databases is enabled, in which case this database is used as the entry point
     * to discover and scan all databases.
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
     * Discover SQL Server synonyms and record them as alternate names (aliases) on the table
     * they resolve to. Also enables alias resolution when building lineage.
     */
    includeSynonyms?: boolean;
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
export enum MssqlScheme {
    MssqlPymssql = "mssql+pymssql",
    MssqlPyodbc = "mssql+pyodbc",
    MssqlPytds = "mssql+pytds",
}

/**
 * SSL/TLS certificate configuration for client authentication. Provide CA certificate,
 * client certificate, and private key for mutual TLS authentication.
 *
 * Client SSL configuration
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
 * Service Type
 *
 * Service type.
 */
export enum MssqlType {
    Mssql = "Mssql",
}
