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
 * Cockroach Database Connection Config
 */
export interface CockroachConnection {
    /**
     * Choose Auth Config Type.
     */
    authType?:            AuthConfigurationType;
    connectionArguments?: { [key: string]: any };
    connectionOptions?:   { [key: string]: string };
    /**
     * Optional name to give to the database in OpenMetadata. If left blank, we will use default
     * as the database name.
     */
    database: string;
    /**
     * Regex to only include/exclude databases that matches the pattern.
     */
    databaseFilterPattern?: FilterPattern;
    /**
     * Database Schema of the data source. This is optional parameter, if you would like to
     * restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion
     * attempts to scan all the schemas.
     */
    databaseSchema?: string;
    /**
     * Host and port of the Cockrooach service.
     */
    hostPort: string;
    /**
     * Ingest data from all databases in Postgres. You can use databaseFilterPattern on top of
     * this.
     */
    ingestAllDatabases?: boolean;
    /**
     * Regex to only include/exclude schemas that matches the pattern.
     */
    schemaFilterPattern?: FilterPattern;
    /**
     * SQLAlchemy driver scheme options.
     */
    scheme?: CockroachScheme;
    /**
     * SSL Configuration details.
     */
    sslConfig?:                  Config;
    sslMode?:                    SSLMode;
    supportsMetadataExtraction?: boolean;
    supportsProfiler?:           boolean;
    /**
     * Regex to only include/exclude tables that matches the pattern.
     */
    tableFilterPattern?: FilterPattern;
    /**
     * Service Type
     */
    type?: CockroachType;
    /**
     * Username to connect to Cockroach. This user should have privileges to read all the
     * metadata in Cockroach.
     */
    username: string;
}

/**
 * Choose Auth Config Type.
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
export enum CockroachScheme {
    CockroachdbPsycopg2 = "cockroachdb+psycopg2",
}

/**
 * SSL Configuration details.
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
export enum CockroachType {
    Cockroach = "Cockroach",
}
