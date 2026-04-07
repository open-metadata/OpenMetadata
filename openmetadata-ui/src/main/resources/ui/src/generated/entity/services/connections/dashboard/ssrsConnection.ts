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
 * SQL Server Reporting Services (SSRS) provides a set of on-premises tools and services to
 * create, deploy, and manage paginated reports
 */
export interface SsrsConnection {
    /**
     * Regex to exclude or include charts that matches the pattern.
     */
    chartFilterPattern?: FilterPattern;
    /**
     * Regex to exclude or include dashboards that matches the pattern.
     */
    dashboardFilterPattern?: FilterPattern;
    /**
     * Host and Port of the Ssrs instance.
     */
    hostPort: string;
    /**
     * Password to connect to Ssrs.
     */
    password: string;
    /**
     * Regex to exclude or include projects that matches the pattern.
     */
    projectFilterPattern?: FilterPattern;
    /**
     * SSL Configuration details.
     */
    sslConfig?:                  Config;
    supportsMetadataExtraction?: boolean;
    /**
     * Service Type
     */
    type?: SsrsType;
    /**
     * Username to connect to Ssrs.
     */
    username: string;
    /**
     * Client SSL verification.
     */
    verifySSL?: VerifySSL;
}

/**
 * Regex to exclude or include charts that matches the pattern.
 *
 * Regex to only fetch entities that matches the pattern.
 *
 * Regex to exclude or include dashboards that matches the pattern.
 *
 * Regex to exclude or include projects that matches the pattern.
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
export enum SsrsType {
    Ssrs = "Ssrs",
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
