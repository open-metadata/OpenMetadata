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
 * Cassandra Connection Config
 */
export interface CassandraConnection {
    /**
     * Choose Auth Config Type.
     */
    authType?:            AuthConfigurationType;
    connectionArguments?: { [key: string]: any };
    /**
     * Regex to only include/exclude databases that matches the pattern.
     */
    databaseFilterPattern?: FilterPattern;
    /**
     * Optional name to give to the database in OpenMetadata. If left blank, we will use default
     * as the database name.
     */
    databaseName?: string;
    /**
     * Host and port of the Cassandra service when using the `cassandra` connection scheme. Only
     * host when using the `cassandra+srv` scheme.
     */
    hostPort?: string;
    /**
     * Regex to only include/exclude schemas that matches the pattern.
     */
    schemaFilterPattern?:        FilterPattern;
    sslConfig?:                  Config;
    sslMode?:                    SSLMode;
    supportsMetadataExtraction?: boolean;
    /**
     * Regex to only include/exclude tables that matches the pattern.
     */
    tableFilterPattern?: FilterPattern;
    /**
     * Service Type
     */
    type?: CassandraType;
    /**
     * Username to connect to Cassandra. This user should have privileges to read all the
     * metadata in Cassandra.
     */
    username?: string;
}

/**
 * Choose Auth Config Type.
 *
 * Common Database Connection Config
 *
 * Configuration for connecting to DataStax Astra DB in the cloud.
 */
export interface AuthConfigurationType {
    /**
     * Password to connect to source.
     */
    password?: string;
    /**
     * Configuration for connecting to DataStax Astra DB in the cloud.
     */
    cloudConfig?: DataStaxAstraDBConfiguration;
}

/**
 * Configuration for connecting to DataStax Astra DB in the cloud.
 */
export interface DataStaxAstraDBConfiguration {
    /**
     * Timeout in seconds for establishing new connections to Cassandra.
     */
    connectTimeout?: number;
    /**
     * Timeout in seconds for individual Cassandra requests.
     */
    requestTimeout?: number;
    /**
     * File path to the Secure Connect Bundle (.zip) used for a secure connection to DataStax
     * Astra DB.
     */
    secureConnectBundle?: string;
    /**
     * The Astra DB application token used for authentication.
     */
    token?: string;
    [property: string]: any;
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
export enum CassandraType {
    Cassandra = "Cassandra",
}
