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
 * SAP S/4HANA Connection Config for Embedded Analytics
 */
export interface SapS4HanaConnection {
    /**
     * Choose Basic Auth (username/password) for on-premise or OAuth 2.0 Client Credentials for
     * SAP S/4HANA Cloud.
     */
    authType: AuthenticationType;
    /**
     * Regex exclude or include charts that matches the pattern.
     */
    chartFilterPattern?: FilterPattern;
    /**
     * SAP client number (Mandant), typically a 3-digit string (e.g. '100').
     */
    clientNumber?: string;
    /**
     * Regex to exclude or include dashboards that matches the pattern.
     */
    dashboardFilterPattern?: FilterPattern;
    /**
     * Regex exclude or include data models that matches the pattern.
     */
    dataModelFilterPattern?: FilterPattern;
    /**
     * Base URL of the SAP S/4HANA instance (e.g. https://s4hana.example.com).
     */
    hostPort: string;
    /**
     * CA certificate, client certificate, and private key for SSL validation. Required when
     * verifySSL is 'validate'.
     */
    sslConfig?:                  Config;
    supportsLineageExtraction?:  boolean;
    supportsMetadataExtraction?: boolean;
    /**
     * Service Type
     */
    type?: SapS4HanaType;
    /**
     * Client SSL verification. Use 'no-ssl' for plain HTTP, 'ignore' to skip certificate
     * validation, 'validate' to verify against a CA certificate.
     */
    verifySSL?: VerifySSL;
}

/**
 * Choose Basic Auth (username/password) for on-premise or OAuth 2.0 Client Credentials for
 * SAP S/4HANA Cloud.
 *
 * Username and password credentials for SAP S/4HANA.
 *
 * OAuth 2.0 client credentials for SAP S/4HANA Cloud.
 */
export interface AuthenticationType {
    /**
     * Authentication type identifier.
     */
    authType?: AuthType;
    /**
     * Password to authenticate with SAP S/4HANA.
     */
    password?: string;
    /**
     * Username to authenticate with SAP S/4HANA.
     */
    username?: string;
    /**
     * OAuth 2.0 client ID registered in SAP.
     */
    clientId?: string;
    /**
     * OAuth 2.0 client secret.
     */
    clientSecret?: string;
    /**
     * OAuth 2.0 token endpoint URL (e.g. /sap/bc/security/oauth2/token).
     */
    tokenEndpoint?: string;
}

/**
 * Authentication type identifier.
 */
export enum AuthType {
    Basic = "basic",
    Oauth2 = "oauth2",
}

/**
 * Regex exclude or include charts that matches the pattern.
 *
 * Regex to only fetch entities that matches the pattern.
 *
 * Regex to exclude or include dashboards that matches the pattern.
 *
 * Regex exclude or include data models that matches the pattern.
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
 * CA certificate, client certificate, and private key for SSL validation. Required when
 * verifySSL is 'validate'.
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
 * SAP S/4HANA service type
 */
export enum SapS4HanaType {
    SapS4Hana = "SapS4Hana",
}

/**
 * Client SSL verification. Use 'no-ssl' for plain HTTP, 'ignore' to skip certificate
 * validation, 'validate' to verify against a CA certificate.
 *
 * Client SSL verification. Make sure to configure the SSLConfig if enabled.
 */
export enum VerifySSL {
    Ignore = "ignore",
    NoSSL = "no-ssl",
    Validate = "validate",
}
