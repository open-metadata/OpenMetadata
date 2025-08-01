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
 * ThoughtSpot Connection Config
 */
export interface ThoughtSpotConnection {
    /**
     * ThoughtSpot API version to use
     */
    apiVersion?: APIVersion;
    /**
     * ThoughtSpot authentication configuration
     */
    authentication: Authentication;
    /**
     * ThoughtSpot instance URL. Example: https://my-company.thoughtspot.cloud
     */
    hostPort: string;
    /**
     * Org ID for multi-tenant ThoughtSpot instances. This is applicable for ThoughtSpot Cloud
     * only.
     */
    orgId?: string;
    /**
     * Supports Metadata Extraction.
     */
    supportsMetadataExtraction?: boolean;
    /**
     * Service Type
     */
    type?: ThoughtSpotType;
}

/**
 * ThoughtSpot API version to use
 */
export enum APIVersion {
    V1 = "v1",
    V2 = "v2",
}

/**
 * ThoughtSpot authentication configuration
 *
 * Basic Auth Credentials
 *
 * API Access Token Auth Credentials
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
     * Access Token for the API
     */
    accessToken?: string;
}

/**
 * Service Type
 *
 * ThoughtSpot service type
 */
export enum ThoughtSpotType {
    ThoughtSpot = "ThoughtSpot",
}
