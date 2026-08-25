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
 * MuleSoft Anypoint Platform Connection Config
 */
export interface MulesoftConnection {
    /**
     * Choose between Connected App (OAuth 2.0) or Basic Authentication.
     */
    authentication: Authentication;
    /**
     * Anypoint Platform Environment ID. If not provided, the connector will discover all
     * accessible environments.
     */
    environmentId?: string;
    /**
     * MuleSoft Anypoint Platform URL. Use https://anypoint.mulesoft.com for US cloud,
     * https://eu1.anypoint.mulesoft.com for EU cloud, or your on-premises URL.
     */
    hostPort?: string;
    /**
     * Anypoint Platform Organization ID. If not provided, the connector will use the user's
     * default organization.
     */
    organizationId?: string;
    /**
     * Regex to filter MuleSoft applications by name.
     */
    pipelineFilterPattern?:      FilterPattern;
    supportsMetadataExtraction?: boolean;
    /**
     * Service Type
     */
    type?: MulesoftType;
}

/**
 * Choose between Connected App (OAuth 2.0) or Basic Authentication.
 *
 * Basic Auth Credentials
 *
 * OAuth 2.0 client credentials authentication for Airbyte Cloud
 */
export interface Authentication {
    /**
     * Password to access the service.
     */
    password?: string;
    /**
     * Username to access the service.
     */
    username?: string;
    /**
     * Client ID for the application registered in Airbyte.
     */
    clientId?: string;
    /**
     * Client Secret for the application registered in Airbyte.
     */
    clientSecret?: string;
}

/**
 * Regex to filter MuleSoft applications by name.
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
export enum MulesoftType {
    Mulesoft = "Mulesoft",
}
