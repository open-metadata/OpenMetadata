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
export interface PrefectConnectionClass {
    /**
     * Choose between Prefect Cloud or a self-hosted Prefect Server.
     */
    authType: Authentication;
    /**
     * Prefect API base URL. Use https://api.prefect.cloud for Prefect Cloud, or your
     * self-hosted server's URL, e.g. http://localhost:4200.
     */
    hostPort: string;
    /**
     * Number of past flow run statuses to ingest per flow.
     */
    numberOfStatus?: number;
    /**
     * Regex exclude pipelines.
     */
    pipelineFilterPattern?: FilterPattern;
    /**
     * SSL Configuration for Prefect API connection.
     */
    sslConfig?:                  Config;
    supportsMetadataExtraction?: boolean;
    /**
     * Service Type
     */
    type?: PrefectType;
    /**
     * Client SSL verification. Make sure to configure the SSLConfig if enabled.
     */
    verifySSL?: VerifySSL;
}

/**
 * Choose between Prefect Cloud or a self-hosted Prefect Server.
 *
 * Authentication configuration for Prefect Cloud.
 *
 * Authentication configuration for a self-hosted Prefect Server. Leave Basic Auth String
 * empty if the server has no auth enabled.
 */
export interface Authentication {
    /**
     * Prefect Cloud Account ID. Found in the URL: app.prefect.cloud/account/{accountId}.
     */
    accountId?: string;
    /**
     * Prefect Cloud API key for authentication.
     */
    apiKey?: string;
    /**
     * Prefect Cloud Workspace ID. Found in the URL after /workspaces/{workspaceId}.
     */
    workspaceId?: string;
    /**
     * Self-hosted Prefect Server Basic Auth credential (PREFECT_SERVER_API_AUTH_STRING), format
     * 'user:password'. Leave empty if the server has no auth enabled.
     */
    authString?: string;
}

/**
 * Regex exclude pipelines.
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
 * SSL Configuration for Prefect API connection.
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
export enum PrefectType {
    Prefect = "Prefect",
}

/**
 * Client SSL verification. Make sure to configure the SSLConfig if enabled.
 */
export enum VerifySSL {
    Ignore = "ignore",
    NoSSL = "no-ssl",
    Validate = "validate",
}
