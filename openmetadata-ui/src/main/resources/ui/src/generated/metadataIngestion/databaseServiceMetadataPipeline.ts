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
 * DatabaseService Metadata Pipeline Configuration.
 */
export interface DatabaseServiceMetadataPipeline {
    /**
     * Regex to only include/exclude databases that matches the pattern.
     */
    databaseFilterPattern?: FilterPattern;
    /**
     * Optional configuration to toggle the DDL Statements ingestion.
     */
    includeDDL?: boolean;
    /**
     * Set the 'Include Owners' toggle to control whether to include owners to the ingested
     * entity if the owner email matches with a user stored in the OM server as part of metadata
     * ingestion. If the ingested entity already exists and has an owner, the owner will not be
     * overwritten.
     */
    includeOwners?: boolean;
    /**
     * Optional configuration to toggle the Stored Procedures ingestion.
     */
    includeStoredProcedures?: boolean;
    /**
     * Optional configuration to turn off fetching metadata for tables.
     */
    includeTables?: boolean;
    /**
     * Optional configuration to toggle the tags ingestion.
     */
    includeTags?: boolean;
    /**
     * Optional configuration to turn off fetching metadata for views.
     */
    includeViews?: boolean;
    /**
     * Use incremental Metadata extraction after the first execution. This is commonly done by
     * getting the changes from Audit tables on the supporting databases.
     */
    incremental?: IncrementalMetadataExtractionConfiguration;
    /**
     * Optional configuration to soft delete databases in OpenMetadata if the source databases
     * are deleted. Also, if the database is deleted, all the associated entities like schemas,
     * tables, views, stored procedures, lineage, etc., with that database will be deleted
     */
    markDeletedDatabases?: boolean;
    /**
     * Optional configuration to soft delete schemas in OpenMetadata if the source schemas are
     * deleted. Also, if the schema is deleted, all the associated entities like tables, views,
     * stored procedures, lineage, etc., with that schema will be deleted
     */
    markDeletedSchemas?: boolean;
    /**
     * Optional configuration to soft delete stored procedures in OpenMetadata if the source
     * stored procedures are deleted. Also, if the stored procedures is deleted, all the
     * associated entities like lineage, etc., with that stored procedures will be deleted
     */
    markDeletedStoredProcedures?: boolean;
    /**
     * This is an optional configuration for enabling soft deletion of tables. When this option
     * is enabled, only tables that have been deleted from the source will be soft deleted, and
     * this will apply solely to the schema that is currently being ingested via the pipeline.
     * Any related entities such as test suites or lineage information that were associated with
     * those tables will also be deleted.
     */
    markDeletedTables?: boolean;
    /**
     * Set the 'Override Metadata' toggle to control whether to override the existing metadata
     * in the OpenMetadata server with the metadata fetched from the source. If the toggle is
     * set to true, the metadata fetched from the source will override the existing metadata in
     * the OpenMetadata server. If the toggle is set to false, the metadata fetched from the
     * source will not override the existing metadata in the OpenMetadata server. This is
     * applicable for fields like description, tags, owner and displayName
     */
    overrideMetadata?: boolean;
    /**
     * Configuration to tune how far we want to look back in query logs to process Stored
     * Procedures results.
     */
    queryLogDuration?: number;
    /**
     * Configuration to set the timeout for parsing the query in seconds.
     */
    queryParsingTimeoutLimit?: number;
    /**
     * Regex to only include/exclude schemas that matches the pattern.
     */
    schemaFilterPattern?: FilterPattern;
    /**
     * Regex to only include/exclude tables that matches the pattern.
     */
    tableFilterPattern?: FilterPattern;
    /**
     * Number of Threads to use in order to parallelize Table ingestion.
     */
    threads?: number;
    /**
     * Pipeline type
     */
    type?: DatabaseMetadataConfigType;
    /**
     * Regex will be applied on fully qualified name (e.g
     * service_name.db_name.schema_name.table_name) instead of raw name (e.g. table_name)
     */
    useFqnForFiltering?: boolean;
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
 * Use incremental Metadata extraction after the first execution. This is commonly done by
 * getting the changes from Audit tables on the supporting databases.
 */
export interface IncrementalMetadataExtractionConfiguration {
    /**
     * If True, enables Metadata Extraction to be incremental
     */
    enabled: boolean;
    /**
     * Number os days to search back for a successful pipeline run. The timestamp of the last
     * found successful pipeline run will be used as a base to search for updated entities.
     */
    lookbackDays?: number;
    /**
     * Number of days to add to the last successful pipeline run timestamp to search for updated
     * entities.
     */
    safetyMarginDays?: number;
}

/**
 * Pipeline type
 *
 * Database Source Config Metadata Pipeline type
 */
export enum DatabaseMetadataConfigType {
    DatabaseMetadata = "DatabaseMetadata",
}
