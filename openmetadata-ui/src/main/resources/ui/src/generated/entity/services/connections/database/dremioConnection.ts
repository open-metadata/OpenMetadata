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
 * Dremio Connection Config supporting both Dremio Cloud (SaaS) and Dremio Software
 * (self-hosted)
 */
export interface DremioConnection {
    /**
     * Choose between Dremio Cloud (SaaS) or Dremio Software (self-hosted) authentication.
     */
    authType: AuthenticationType;
    /**
     * Optional: Restrict metadata ingestion to a specific namespace (source/space). When left
     * blank, all namespaces will be ingested.
     */
    database?: string;
    /**
     * Regex to only include/exclude namespaces (sources/spaces) that match the pattern. In
     * Dremio Cloud, namespaces are mapped as databases.
     */
    databaseFilterPattern?: FilterPattern;
    /**
     * Regex to only include/exclude folders that match the pattern. In Dremio Cloud, folders
     * are mapped as schemas.
     */
    schemaFilterPattern?:        FilterPattern;
    supportsDatabase?:           boolean;
    supportsLineageExtraction?:  boolean;
    supportsMetadataExtraction?: boolean;
    supportsUsageExtraction?:    boolean;
    /**
     * Regex to only include/exclude tables that match the pattern.
     */
    tableFilterPattern?: FilterPattern;
    /**
     * Service Type
     */
    type?: DremioType;
}

/**
 * Choose between Dremio Cloud (SaaS) or Dremio Software (self-hosted) authentication.
 *
 * Authentication configuration for Dremio Cloud using Personal Access Token (PAT). Dremio
 * Cloud is a fully managed SaaS platform.
 *
 * Authentication configuration for self-hosted Dremio Software using username and password.
 * Dremio Software is deployed on-premises or in your own cloud infrastructure.
 */
export interface AuthenticationType {
    /**
     * Personal Access Token for authenticating with Dremio Cloud. Generate this token from your
     * Dremio Cloud account settings under Settings -> Personal Access Tokens.
     */
    personalAccessToken?: string;
    /**
     * Dremio Cloud Project ID (required). This unique identifier can be found in your Dremio
     * Cloud project URL or project settings.
     */
    projectId?: string;
    /**
     * Dremio Cloud region where your organization is hosted. Choose 'US' for United States
     * region or 'EU' for European region.
     */
    region?: CloudRegion;
    /**
     * URL to your self-hosted Dremio Software instance, including protocol and port (e.g.,
     * http://localhost:9047 or https://dremio.example.com:9047).
     */
    hostPort?: string;
    /**
     * Password for the Dremio Software user account.
     */
    password?: string;
    /**
     * Username for authenticating with Dremio Software. This user should have appropriate
     * permissions to access metadata.
     */
    username?: string;
}

/**
 * Dremio Cloud region where your organization is hosted. Choose 'US' for United States
 * region or 'EU' for European region.
 */
export enum CloudRegion {
    Eu = "EU",
    Us = "US",
}

/**
 * Regex to only include/exclude namespaces (sources/spaces) that match the pattern. In
 * Dremio Cloud, namespaces are mapped as databases.
 *
 * Regex to only fetch entities that matches the pattern.
 *
 * Regex to only include/exclude folders that match the pattern. In Dremio Cloud, folders
 * are mapped as schemas.
 *
 * Regex to only include/exclude tables that match the pattern.
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
export enum DremioType {
    Dremio = "Dremio",
}
