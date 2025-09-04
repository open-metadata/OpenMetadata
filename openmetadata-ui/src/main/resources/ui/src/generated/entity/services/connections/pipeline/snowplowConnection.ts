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
 * Snowplow Pipeline Connection Config
 */
export interface SnowplowConnection {
    /**
     * API Key for Snowplow Console API
     */
    apiKey?: string;
    /**
     * Cloud provider where Snowplow is deployed
     */
    cloudProvider?: CloudProvider;
    /**
     * Path to pipeline configuration files for Community deployment
     */
    configPath?: string;
    /**
     * Snowplow Console URL for BDP deployment
     */
    consoleUrl?: string;
    /**
     * Snowplow deployment type (BDP for managed or Community for self-hosted)
     */
    deployment: SnowplowDeployment;
    /**
     * Snowplow BDP Organization ID
     */
    organizationId?: string;
    /**
     * Regex exclude pipelines.
     */
    pipelineFilterPattern?:      FilterPattern;
    supportsMetadataExtraction?: boolean;
    /**
     * Service Type
     */
    type: SnowplowType;
}

/**
 * Cloud provider where Snowplow is deployed
 */
export enum CloudProvider {
    Aws = "AWS",
    Azure = "Azure",
    Gcp = "GCP",
}

/**
 * Snowplow deployment type (BDP for managed or Community for self-hosted)
 *
 * Snowplow deployment type
 */
export enum SnowplowDeployment {
    Bdp = "BDP",
    Community = "Community",
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
export enum SnowplowType {
    Snowplow = "Snowplow",
}
