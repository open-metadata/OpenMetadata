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
 * Collibra Connection Config
 */
export interface CollibraConnection {
    connectionArguments?: { [key: string]: any };
    connectionOptions?:   { [key: string]: string };
    /**
     * Regex to only include/exclude domains that match the pattern.
     */
    domainFilterPattern?: FilterPattern;
    /**
     * Enable enrichment of existing OpenMetadata assets with Collibra metadata (descriptions,
     * tags, owners). When enabled, the connector will match Collibra assets to OpenMetadata
     * entities and apply metadata without creating new assets.
     */
    enableEnrichment?: boolean;
    /**
     * Regex to only include/exclude glossaries that match the pattern.
     */
    glossaryFilterPattern?: FilterPattern;
    /**
     * Host and port of the Collibra service.
     */
    hostPort: string;
    /**
     * Password to connect to the Collibra.
     */
    password:                    string;
    supportsMetadataExtraction?: boolean;
    /**
     * Service Type
     */
    type?: CollibraType;
    /**
     * Username to connect to the Collibra. This user should have privileges to read all the
     * metadata in Collibra.
     */
    username: string;
}

/**
 * Regex to only include/exclude domains that match the pattern.
 *
 * Regex to only fetch entities that matches the pattern.
 *
 * Regex to only include/exclude glossaries that match the pattern.
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
 * Collibra service type
 */
export enum CollibraType {
    Collibra = "Collibra",
}
