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
 * IBM Informix Database Connection Config
 */
export interface InformixConnection {
    connectionArguments?: { [key: string]: any };
    connectionOptions?:   { [key: string]: string };
    /**
     * Database of the data source. This is an optional parameter, if you would like to restrict
     * the metadata reading to a single database. If left blank, OpenMetadata ingestion attempts
     * to scan all the databases.
     */
    database?: string;
    /**
     * Regex to only include/exclude databases that matches the pattern.
     */
    databaseFilterPattern?: FilterPattern;
    /**
     * Host and port of the Informix service.
     */
    hostPort: string;
    /**
     * Password to connect to Informix.
     */
    password: string;
    /**
     * Regex to only include/exclude schemas that matches the pattern.
     */
    schemaFilterPattern?: FilterPattern;
    /**
     * SQLAlchemy driver scheme options.
     */
    scheme?: InformixScheme;
    /**
     * Informix server name as defined in the sqlhosts file or INFORMIXSERVER environment
     * variable.
     */
    serverName: string;
    /**
     * SSL Configuration details. Provide the CA certificate to validate the Informix server
     * certificate. Paste the PEM content directly or upload the certificate file.
     */
    sslConfig?: Config;
    /**
     * SSL Mode to connect to Informix. Use 'disable' for no SSL, 'require' for encrypted SSL
     * without certificate verification, or 'verify-ca' to validate the server certificate
     * against the provided CA certificate.
     */
    sslMode?: SSLMode;
    /**
     * Regex to only include/exclude stored procedures that matches the pattern.
     */
    storedProcedureFilterPattern?: FilterPattern;
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
    type?: InformixType;
    /**
     * Username to connect to Informix. This user should have privileges to read all the
     * metadata in Informix.
     */
    username: string;
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
 * SQLAlchemy driver scheme options.
 */
export enum InformixScheme {
    Informix = "informix",
}

/**
 * SSL Configuration details. Provide the CA certificate to validate the Informix server
 * certificate. Paste the PEM content directly or upload the certificate file.
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
 * SSL Mode to connect to Informix. Use 'disable' for no SSL, 'require' for encrypted SSL
 * without certificate verification, or 'verify-ca' to validate the server certificate
 * against the provided CA certificate.
 *
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
export enum InformixType {
    Informix = "Informix",
}
