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
 * SAP SuccessFactors Connection Config
 */
export interface SapSuccessFactorsConnection {
    /**
     * SAP SuccessFactors OData API version.
     */
    apiVersion?: string;
    /**
     * Choose how to authenticate with SAP SuccessFactors OData API.
     */
    authType?: AuthType;
    /**
     * SAP SuccessFactors OData API base URL. For example: https://api4.successfactors.com
     */
    baseUrl: string;
    /**
     * OAuth2 Client ID. Required when authType is OAuth2Credentials.
     */
    clientId?: string;
    /**
     * SAP SuccessFactors Company ID (tenant identifier). Required for all API calls.
     */
    companyId:            string;
    connectionArguments?: { [key: string]: any };
    connectionOptions?:   { [key: string]: string };
    /**
     * Optional name to give to the database in OpenMetadata. If left blank, we will use default
     * as the database name.
     */
    databaseName?: string;
    /**
     * Password for BasicAuth authentication. Required when authType is BasicAuth.
     */
    password?: string;
    /**
     * PEM-encoded RSA private key used to sign SAML assertions for OAuth2 SAML Bearer flow.
     * Required when authType is OAuth2Credentials.
     */
    privateKey?: string;
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
     * OAuth2 Token endpoint URL. Required when authType is OAuth2Credentials. For example:
     * https://api4.successfactors.com/oauth/token
     */
    tokenUrl?: string;
    /**
     * Service Type
     */
    type?: SapSuccessFactorsType;
    /**
     * SAP SuccessFactors user login name. For BasicAuth: used as the credential username. For
     * OAuth2Credentials: used as the SAML NameID — the user on whose behalf the token is
     * requested. The user must exist in the SF system and be permitted to use the OAuth2
     * application.
     */
    username: string;
    /**
     * Client SSL verification.
     */
    verifySSL?: VerifySSL;
}

/**
 * Choose how to authenticate with SAP SuccessFactors OData API.
 *
 * Authentication type to connect to SAP SuccessFactors.
 */
export enum AuthType {
    BasicAuth = "BasicAuth",
    OAuth2Credentials = "OAuth2Credentials",
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
 * Regex to only include/exclude tables that matches the pattern.
 *
 * Regex to only fetch entities that matches the pattern.
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
 * Service Type
 *
 * Service type.
 */
export enum SapSuccessFactorsType {
    SapSuccessFactors = "SapSuccessFactors",
}

/**
 * Client SSL verification.
 *
 * Client SSL verification. Make sure to configure the SSLConfig if enabled.
 */
export enum VerifySSL {
    Ignore = "ignore",
    NoSSL = "no-ssl",
    Validate = "validate",
}
