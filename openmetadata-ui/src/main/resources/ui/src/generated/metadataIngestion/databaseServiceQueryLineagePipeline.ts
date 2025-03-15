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
 * DatabaseService Query Lineage Pipeline Configuration.
 */
export interface DatabaseServiceQueryLineagePipeline {
    /**
     * Set 'Cross Database Service Names' to process lineage with the database.
     */
    crossDatabaseServiceNames?: string[];
    /**
     * Regex to only fetch databases that matches the pattern.
     */
    databaseFilterPattern?: FilterPattern;
    /**
     * Handle Lineage for Snowflake Temporary and Transient Tables.
     */
    enableTempTableLineage?: boolean;
    /**
     * Configuration the condition to filter the query history.
     */
    filterCondition?: string;
    /**
     * Set the 'Incremental Lineage Processing' toggle to control whether to process lineage
     * incrementally.
     */
    incrementalLineageProcessing?: boolean;
    /**
     * Set the 'Override View Lineage' toggle to control whether to override the existing view
     * lineage.
     */
    overrideViewLineage?: boolean;
    /**
     * Configuration to set the timeout for parsing the query in seconds.
     */
    parsingTimeoutLimit?: number;
    /**
     * Set the 'Process Cross Database Lineage' toggle to control whether to process table
     * lineage across different databases.
     */
    processCrossDatabaseLineage?: boolean;
    /**
     * Set the 'Process Query Lineage' toggle to control whether to process query lineage.
     */
    processQueryLineage?: boolean;
    /**
     * Set the 'Process Stored ProcedureLog Lineage' toggle to control whether to process stored
     * procedure lineage.
     */
    processStoredProcedureLineage?: boolean;
    /**
     * Set the 'Process View Lineage' toggle to control whether to process view lineage.
     */
    processViewLineage?: boolean;
    /**
     * Configuration to tune how far we want to look back in query logs to process lineage data.
     */
    queryLogDuration?: number;
    /**
     * Configuration to set the file path for query logs
     */
    queryLogFilePath?: string;
    /**
     * Configuration to set the limit for query logs
     */
    resultLimit?: number;
    /**
     * Regex to only fetch tables or databases that matches the pattern.
     */
    schemaFilterPattern?: FilterPattern;
    /**
     * Regex exclude tables or databases that matches the pattern.
     */
    tableFilterPattern?: FilterPattern;
    /**
     * Number of Threads to use in order to parallelize lineage ingestion.
     */
    threads?: number;
    /**
     * Pipeline type
     */
    type?: DatabaseLineageConfigType;
}

/**
 * Regex to only fetch databases that matches the pattern.
 *
 * Regex to only fetch entities that matches the pattern.
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
 * Database Source Config Usage Pipeline type
 */
export enum DatabaseLineageConfigType {
    DatabaseLineage = "DatabaseLineage",
}
