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
 * Salesforce Connection Config
 */
export interface SalesforceConnection {
    connectionArguments?: { [key: string]: any };
    connectionOptions?:   { [key: string]: string };
    /**
     * Salesforce Consumer Key (Client ID) for OAuth 2.0 authentication. This is obtained from
     * your Salesforce Connected App configuration. Required along with Consumer Secret for
     * OAuth authentication.
     */
    consumerKey?: string;
    /**
     * Salesforce Consumer Secret (Client Secret) for OAuth 2.0 authentication. This is obtained
     * from your Salesforce Connected App configuration. Required along with Consumer Key for
     * OAuth authentication.
     */
    consumerSecret?: string;
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
     * Salesforce Organization ID is the unique identifier for your Salesforce identity
     */
    organizationId?: string;
    /**
     * Password to connect to Salesforce.
     */
    password?: string;
    /**
     * API version of the Salesforce instance
     */
    salesforceApiVersion?: string;
    /**
     * Domain of Salesforce instance
     */
    salesforceDomain?: string;
    /**
     * Regex to only include/exclude schemas that matches the pattern.
     */
    schemaFilterPattern?: FilterPattern;
    /**
     * Salesforce Security Token for username/password authentication.
     */
    securityToken?: string;
    /**
     * List of Salesforce Object Names to ingest. If specified, only these objects will be
     * fetched. Leave empty to fetch all objects (subject to tableFilterPattern).
     */
    sobjectNames?: string[];
    /**
     * SSL Configuration details.
     */
    sslConfig?:                  Config;
    supportsMetadataExtraction?: boolean;
    /**
     * Regex to only include/exclude tables that matches the pattern.
     */
    tableFilterPattern?: FilterPattern;
    /**
     * Service Type
     */
    type?: SalesforceType;
    /**
     * Username to connect to Salesforce. This user should have privileges to read all the
     * metadata in Salesforce.
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
 * Service Type
 *
 * Service type.
 */
export enum SalesforceType {
    Salesforce = "Salesforce",
}
