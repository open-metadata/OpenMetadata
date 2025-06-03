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
 * Metadata to ElasticSearch Connection Config
 */
export interface MetadataESConnection {
    /**
     * Maximum number of events sent in a batch (Default 100).
     */
    batchSize?: number;
    /**
     * Regex to only include/exclude databases that matches the pattern.
     */
    databaseFilterPattern?: FilterPattern;
    /**
     * List of entities that you need to reindex
     */
    entities?:      string[];
    recreateIndex?: boolean;
    runMode?:       RunMode;
    /**
     * Regex to only include/exclude schemas that matches the pattern.
     */
    schemaFilterPattern?: FilterPattern;
    /**
     * Recreate Indexes with updated Language
     */
    searchIndexMappingLanguage?: SearchIndexMappingLanguage;
    supportsMetadataExtraction?: boolean;
    /**
     * Regex to only include/exclude tables that matches the pattern.
     */
    tableFilterPattern?: FilterPattern;
    /**
     * Service Type
     */
    type?: MetadataESType;
}

/**
 * Regex to only include/exclude databases that matches the pattern.
 *
 * Regex to only fetch entities that matches the pattern.
 *
 * Regex to only include/exclude schemas that matches the pattern.
 *
 * Regex to only include/exclude tables that matches the pattern.
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
 * This schema publisher run modes.
 */
export enum RunMode {
    Batch = "batch",
    Stream = "stream",
}

/**
 * Recreate Indexes with updated Language
 *
 * This schema defines the language options available for search index mappings.
 */
export enum SearchIndexMappingLanguage {
    En = "EN",
    Jp = "JP",
    Zh = "ZH",
}

/**
 * Service Type
 *
 * Metadata to Elastic Search type
 */
export enum MetadataESType {
    MetadataES = "MetadataES",
}
