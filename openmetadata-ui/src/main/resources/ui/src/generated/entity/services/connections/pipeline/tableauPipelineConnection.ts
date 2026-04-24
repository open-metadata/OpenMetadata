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
 * Tableau Pipeline Connection Config
 */
export interface TableauPipelineConnection {
    /**
     * Tableau API version. If not provided, the version will be used from the tableau server.
     */
    apiVersion?: string;
    /**
     * Types of methods used to authenticate to the tableau instance
     */
    authType: AuthenticationTypeForTableau;
    /**
     * Tableau Server URL.
     */
    hostPort: string;
    /**
     * Number of recent flow runs to fetch per flow.
     */
    numberOfStatus?: number;
    /**
     * Regex exclude or include pipelines that match the pattern.
     */
    pipelineFilterPattern?: FilterPattern;
    /**
     * Tableau Site Name.
     */
    siteName?:                   string;
    sslConfig?:                  Config;
    supportsLineageExtraction?:  boolean;
    supportsMetadataExtraction?: boolean;
    /**
     * Service Type
     */
    type?:      TableauPipelineType;
    verifySSL?: VerifySSL;
}

/**
 * Types of methods used to authenticate to the tableau instance
 *
 * Basic Auth Credentials
 *
 * Access Token Auth Credentials
 */
export interface AuthenticationTypeForTableau {
    /**
     * Password to access the service.
     */
    password?: string;
    /**
     * Username to access the service.
     */
    username?: string;
    /**
     * Personal Access Token Name.
     */
    personalAccessTokenName?: string;
    /**
     * Personal Access Token Secret.
     */
    personalAccessTokenSecret?: string;
}

/**
 * Regex exclude or include pipelines that match the pattern.
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
export enum TableauPipelineType {
    TableauPipeline = "TableauPipeline",
}

/**
 * Client SSL verification. Make sure to configure the SSLConfig if enabled.
 */
export enum VerifySSL {
    Ignore = "ignore",
    NoSSL = "no-ssl",
    Validate = "validate",
}
