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
 * MuleSoft Anypoint Platform Connection Config
 */
export interface MulesoftConnection {
    /**
     * Choose between Connected App (OAuth 2.0) or Basic Authentication.
     */
    authentication: MulesoftAuthentication;
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
 * Authentication method for MuleSoft Anypoint Platform.
 *
 * OAuth 2.0 client credentials authentication using Connected App.
 *
 * Username and password authentication for Anypoint Platform.
 */
export interface MulesoftAuthentication {
    /**
     * Authentication type (ConnectedApp).
     *
     * Authentication type (Basic).
     */
    authType?: AuthenticationType;
    /**
     * Connected App Client ID from Anypoint Platform.
     */
    clientId?: string;
    /**
     * Connected App Client Secret from Anypoint Platform.
     */
    clientSecret?: string;
    /**
     * Anypoint Platform password.
     */
    password?: string;
    /**
     * Anypoint Platform username.
     */
    username?: string;
}

/**
 * Authentication type (ConnectedApp).
 *
 * Authentication type (Basic).
 */
export enum AuthenticationType {
    Basic = "Basic",
    ConnectedApp = "ConnectedApp",
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
