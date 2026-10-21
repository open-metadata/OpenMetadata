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
     * Credential the service principal uses to obtain Microsoft Entra ID access tokens for the
     * Fabric SQL endpoint.
     */
    authType: AuthenticationType;
    /**
     * Azure Application (client) ID for Service Principal authentication.
     */
    clientId:             string;
    connectionArguments?: { [key: string]: any };
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
    supportsLineageExtraction?:  boolean;
    supportsMetadataExtraction?: boolean;
    supportsProfiler?:           boolean;
    supportsUsageExtraction?:    boolean;
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
 * Credential the service principal uses to obtain Microsoft Entra ID access tokens for the
 * Fabric SQL endpoint.
 *
 * Authenticate the service principal with a client secret of its Microsoft Entra ID
 * application.
 *
 * Authenticate the service principal with an X.509 certificate registered on its Microsoft
 * Entra ID application.
 */
export interface AuthenticationType {
    /**
     * Client secret value (not the secret ID) from the application's Certificates & secrets
     * page in Microsoft Entra ID.
     */
    clientSecret?: string;
    /**
     * PEM-encoded X.509 certificate uploaded to the application's Certificates & secrets page
     * in Microsoft Entra ID. It may be followed by its issuing certificate chain.
     */
    certificate?: string;
    /**
     * PEM-encoded private key of the certificate, as PKCS#8 (`BEGIN PRIVATE KEY` or `BEGIN
     * ENCRYPTED PRIVATE KEY`) or PKCS#1 (`BEGIN RSA PRIVATE KEY`). A single PEM file holding
     * both the key and the certificate can be supplied in both fields.
     */
    privateKey?: string;
    /**
     * Passphrase of an encrypted private key. Leave empty when the private key is not encrypted.
     */
    privateKeyPassphrase?: string;
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
