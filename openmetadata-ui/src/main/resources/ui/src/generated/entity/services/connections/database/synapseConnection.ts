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
 * Synapse Database Connection Config
 */
export interface SynapseConnection {
    /**
     * This parameter determines the mode of authentication for connecting to Azure Synapse
     * using ODBC. If 'Active Directory Password' is selected, you need to provide the password.
     * If 'Active Directory Integrated' is selected, password is not required as it uses the
     * logged-in user's credentials. If 'Active Directory Service Principal' is selected, you
     * need to provide clientId, clientSecret and tenantId. This mode is useful for establishing
     * secure and seamless connections with Azure Synapse.
     */
    authenticationMode?: any[] | boolean | number | number | null | AuthenticationModeObject | string;
    /**
     * Azure Application (client) ID for service principal authentication.
     */
    clientId?: string;
    /**
     * Azure Application client secret for service principal authentication.
     */
    clientSecret?:        string;
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
     * Host and port of the Azure Synapse service.
     */
    hostPort: string;
    /**
     * Ingest data from all databases in Azure Synapse. You can use databaseFilterPattern on top
     * of this.
     */
    ingestAllDatabases?: boolean;
    /**
     * Password to connect to Azure Synapse.
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
    scheme?: SynapseScheme;
    /**
     * Regex to only include/exclude stored procedures that matches the pattern.
     */
    storedProcedureFilterPattern?: FilterPattern;
    supportsDatabase?:             boolean;
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
     * Azure Directory (tenant) ID for service principal authentication.
     */
    tenantId?: string;
    /**
     * Service Type
     */
    type?: SynapseType;
    /**
     * Username to connect to Azure Synapse. This user should have privileges to read all the
     * metadata in Azure Synapse.
     */
    username?: string;
}

export interface AuthenticationModeObject {
    /**
     * Authentication from Connection String for Azure Synapse.
     */
    authentication?: Authentication;
    /**
     * Connection Timeout from Connection String for Azure Synapse.
     */
    connectionTimeout?: number;
    /**
     * Encrypt from Connection String for Azure Synapse.
     */
    encrypt?: boolean;
    /**
     * Trust Server Certificate from Connection String for Azure Synapse.
     */
    trustServerCertificate?: boolean;
    [property: string]: any;
}

/**
 * Authentication from Connection String for Azure Synapse.
 */
export enum Authentication {
    ActiveDirectoryIntegrated = "ActiveDirectoryIntegrated",
    ActiveDirectoryPassword = "ActiveDirectoryPassword",
    ActiveDirectoryServicePrincipal = "ActiveDirectoryServicePrincipal",
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
export enum SynapseScheme {
    MssqlPyodbc = "mssql+pyodbc",
}

/**
 * Service Type
 *
 * Service type.
 */
export enum SynapseType {
    Synapse = "Synapse",
}
