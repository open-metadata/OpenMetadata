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
 * Azure Data Factory Connection Config
 */
export interface DatafactoryConnection {
    /**
     * Available sources to fetch metadata.
     */
    configSource?: AzureCredentials;
    /**
     * The name of your azure data factory.
     */
    factory_name: string;
    /**
     * Regex exclude pipelines.
     */
    pipelineFilterPattern?: FilterPattern;
    /**
     * The name of your resource group the data factory is associated with.
     */
    resource_group_name: string;
    /**
     * Number of days in the past to filter pipeline runs.
     */
    run_filter_days?: number;
    /**
     * The azure subscription identifier.
     */
    subscription_id: string;
    /**
     * Service Type
     */
    type?: DataFactoryType;
}

/**
 * Available sources to fetch metadata.
 *
 * Azure Cloud Credentials
 */
export interface AzureCredentials {
    /**
     * Account Name of your storage account
     */
    accountName?: string;
    /**
     * Your Service Principal App ID (Client ID)
     */
    clientId?: string;
    /**
     * Your Service Principal Password (Client Secret)
     */
    clientSecret?: string;
    /**
     * Scopes to get access token, for e.g. api://6dfX33ab-XXXX-49df-XXXX-3459eX817d3e/.default
     */
    scopes?: string;
    /**
     * Tenant ID of your Azure Subscription
     */
    tenantId?: string;
    /**
     * Key Vault Name
     */
    vaultName?: string;
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
export enum DataFactoryType {
    DataFactory = "DataFactory",
}
