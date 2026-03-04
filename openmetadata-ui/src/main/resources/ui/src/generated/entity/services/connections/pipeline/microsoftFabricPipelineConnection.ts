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
 * Microsoft Fabric Data Factory Pipeline Connection Config
 */
export interface MicrosoftFabricPipelineConnection {
    /**
     * Azure Active Directory authority URI. Defaults to https://login.microsoftonline.com/
     */
    authorityUri?: string;
    /**
     * Azure Application (client) ID for Service Principal authentication.
     */
    clientId: string;
    /**
     * Azure Application client secret for Service Principal authentication.
     */
    clientSecret: string;
    /**
     * Regex to only include/exclude pipelines that matches the pattern.
     */
    pipelineFilterPattern?:      FilterPattern;
    supportsMetadataExtraction?: boolean;
    /**
     * Azure Directory (tenant) ID for Service Principal authentication.
     */
    tenantId: string;
    /**
     * Service Type
     */
    type?: MicrosoftFabricPipelineType;
    /**
     * The Microsoft Fabric workspace ID where the pipelines are located.
     */
    workspaceId: string;
}

/**
 * Regex to only include/exclude pipelines that matches the pattern.
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
export enum MicrosoftFabricPipelineType {
    MicrosoftFabricPipeline = "MicrosoftFabricPipeline",
}
