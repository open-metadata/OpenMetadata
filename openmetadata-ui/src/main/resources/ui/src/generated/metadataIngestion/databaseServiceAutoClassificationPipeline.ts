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
 * DatabaseService AutoClassification & Auto Classification Pipeline Configuration.
 */
export interface DatabaseServiceAutoClassificationPipeline {
    /**
     * Regex to only compute metrics for table that matches the given tag, tiers, gloassary
     * pattern.
     */
    classificationFilterPattern?: FilterPattern;
    /**
     * Set the Confidence value for which you want the column to be tagged as PII. Confidence
     * value ranges from 0 to 100. A higher number will yield less false positives but more
     * false negatives. A lower number will yield more false positives but less false negatives.
     */
    confidence?: number;
    /**
     * Regex to only fetch databases that matches the pattern.
     */
    databaseFilterPattern?: FilterPattern;
    /**
     * Optional configuration to automatically tag columns that might contain sensitive
     * information
     */
    enableAutoClassification?: boolean;
    /**
     * Optional configuration to turn off fetching metadata for views.
     */
    includeViews?: boolean;
    /**
     * Number of sample rows to ingest when 'Generate Sample Data' is enabled
     */
    sampleDataCount?: number;
    /**
     * Regex to only fetch tables or databases that matches the pattern.
     */
    schemaFilterPattern?: FilterPattern;
    /**
     * Option to turn on/off storing sample data. If enabled, we will ingest sample data for
     * each table.
     */
    storeSampleData?: boolean;
    /**
     * Regex exclude tables or databases that matches the pattern.
     */
    tableFilterPattern?: FilterPattern;
    /**
     * Pipeline type
     */
    type?: AutoClassificationConfigType;
    /**
     * Regex will be applied on fully qualified name (e.g
     * service_name.db_name.schema_name.table_name) instead of raw name (e.g. table_name)
     */
    useFqnForFiltering?: boolean;
}

/**
 * Regex to only compute metrics for table that matches the given tag, tiers, gloassary
 * pattern.
 *
 * Regex to only fetch entities that matches the pattern.
 *
 * Regex to only fetch databases that matches the pattern.
 *
 * Regex to only fetch tables or databases that matches the pattern.
 *
 * Regex exclude tables or databases that matches the pattern.
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
 * Pipeline type
 *
 * Profiler Source Config Pipeline type
 */
export enum AutoClassificationConfigType {
    AutoClassification = "AutoClassification",
}
