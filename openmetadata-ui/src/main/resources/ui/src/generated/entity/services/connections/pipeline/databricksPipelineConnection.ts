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
 * Databricks Connection Config
 */
export interface DatabricksPipelineConnection {
    /**
     * Choose between different authentication types for Databricks.
     */
    authType:             AuthenticationType;
    connectionArguments?: { [key: string]: any };
    /**
     * Connection timeout in seconds.
     */
    connectionTimeout?: number;
    /**
     * Host and port of the Databricks service.
     */
    hostPort: string;
    /**
     * Databricks compute resources URL.
     */
    httpPath?: string;
    /**
     * Number of days to look back when fetching lineage data from Databricks system tables
     * (system.access.table_lineage and system.access.column_lineage). Default is 90 days.
     */
    lineageLookBackDays?: number;
    /**
     * Regex exclude pipelines.
     */
    pipelineFilterPattern?:      FilterPattern;
    supportsMetadataExtraction?: boolean;
    /**
     * Service Type
     */
    type?: DatabricksType;
}

/**
 * Choose between different authentication types for Databricks.
 *
 * Personal Access Token authentication for Databricks.
 *
 * OAuth2 Machine-to-Machine authentication using Service Principal credentials for
 * Databricks.
 *
 * Azure Active Directory authentication for Azure Databricks workspaces using Service
 * Principal.
 */
export interface AuthenticationType {
    /**
     * Generated Personal Access Token for Databricks workspace authentication. This token is
     * created from User Settings -> Developer -> Access Tokens in your Databricks workspace.
     */
    token?: string;
    /**
     * Service Principal Application ID created in your Databricks Account Console for OAuth
     * Machine-to-Machine authentication.
     */
    clientId?: string;
    /**
     * OAuth Secret generated for the Service Principal in Databricks Account Console. Used for
     * secure OAuth2 authentication.
     */
    clientSecret?: string;
    /**
     * Azure Service Principal Application (client) ID registered in your Azure Active Directory.
     */
    azureClientId?: string;
    /**
     * Azure Service Principal client secret created in Azure AD for authentication.
     */
    azureClientSecret?: string;
    /**
     * Azure Active Directory Tenant ID where your Service Principal is registered.
     */
    azureTenantId?: string;
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
 * Service Type
 *
 * Service type.
 */
export enum DatabricksType {
    DatabricksPipeline = "DatabricksPipeline",
}
