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
 * Configuration to ingest AWS Glue Data Quality results as OpenMetadata test cases and test
 * case results.
 */
export interface GlueDataQualityConfig {
    /**
     * Table mappings for results produced by Glue ETL jobs that are not attached to a Data
     * Catalog table.
     */
    etlJobMappings?: ETLJobMapping[];
    /**
     * Ingest AWS Glue Data Quality rules as test cases and their evaluation runs as test case
     * results.
     */
    includeDataQuality?: boolean;
    /**
     * Only ingest Data Quality results whose run started within this number of days.
     */
    lookbackDays?: number;
    /**
     * Regex to only include/exclude Data Quality rulesets (or ETL evaluation contexts) that
     * match the pattern.
     */
    rulesetFilterPattern?: FilterPattern;
    /**
     * Database of the target database service that holds the evaluated tables (e.g.
     * awsdatacatalog for Athena). Only used with targetServiceName. Leave empty to search every
     * database of that service.
     */
    targetDatabaseName?: string;
    /**
     * OpenMetadata database service holding the evaluated tables (e.g. an Athena service).
     * Defaults to this Glue service.
     */
    targetServiceName?: string;
}

/**
 * Maps Data Quality results produced by a Glue ETL job, which carry no catalog table, to an
 * OpenMetadata table.
 */
export interface ETLJobMapping {
    /**
     * Name of the Evaluate Data Quality node in the job. Leave empty to match every node of the
     * job.
     */
    evaluationContext?: string;
    /**
     * Name of the Glue ETL job that evaluates the ruleset.
     */
    jobName: string;
    /**
     * Fully qualified name of the OpenMetadata table the results belong to.
     */
    tableFQN: string;
}

/**
 * Regex to only include/exclude Data Quality rulesets (or ETL evaluation contexts) that
 * match the pattern.
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
