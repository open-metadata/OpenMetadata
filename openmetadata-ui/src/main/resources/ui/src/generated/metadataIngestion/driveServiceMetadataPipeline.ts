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
 * DriveService Metadata Pipeline Configuration.
 */
export interface DriveServiceMetadataPipeline {
    /**
     * Regex to only include/exclude directories that matches the pattern.
     */
    directoryFilterPattern?: FilterPattern;
    /**
     * Regex to only include/exclude files that matches the pattern.
     */
    fileFilterPattern?: FilterPattern;
    /**
     * Optional configuration to turn off fetching metadata for directories.
     */
    includeDirectories?: boolean;
    /**
     * Optional configuration to turn off fetching metadata for files.
     */
    includeFiles?: boolean;
    /**
     * Set the 'Include Owners' toggle to control whether to include owners to the ingested
     * entity if the owner email matches with a user stored in the OM server as part of metadata
     * ingestion. If the ingested entity already exists and has an owner, the owner will not be
     * overwritten.
     */
    includeOwners?: boolean;
    /**
     * Optional configuration to turn off fetching metadata for spreadsheets.
     */
    includeSpreadsheets?: boolean;
    /**
     * Optional configuration to toggle the tags ingestion.
     */
    includeTags?: boolean;
    /**
     * Optional configuration to turn off fetching metadata for worksheets.
     */
    includeWorksheets?: boolean;
    /**
     * Optional configuration to soft delete directories in OpenMetadata if the source
     * directories are deleted. Also, if the directory is deleted, all the associated entities
     * like files, spreadsheets, worksheets, lineage, etc., with that directory will be deleted
     */
    markDeletedDirectories?: boolean;
    /**
     * Optional configuration to soft delete files in OpenMetadata if the source files are
     * deleted. Also, if the file is deleted, all the associated entities like lineage, etc.,
     * with that file will be deleted
     */
    markDeletedFiles?: boolean;
    /**
     * Optional configuration to soft delete spreadsheets in OpenMetadata if the source
     * spreadsheets are deleted. Also, if the spreadsheet is deleted, all the associated
     * entities like worksheets, lineage, etc., with that spreadsheet will be deleted
     */
    markDeletedSpreadsheets?: boolean;
    /**
     * Optional configuration to soft delete worksheets in OpenMetadata if the source worksheets
     * are deleted. Also, if the worksheet is deleted, all the associated entities like lineage,
     * etc., with that worksheet will be deleted
     */
    markDeletedWorksheets?: boolean;
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
     * Regex to only include/exclude spreadsheets that matches the pattern.
     */
    spreadsheetFilterPattern?: FilterPattern;
    /**
     * Number of Threads to use in order to parallelize Drive ingestion.
     */
    threads?: number;
    /**
     * Pipeline type
     */
    type?: DriveMetadataConfigType;
    /**
     * Regex will be applied on fully qualified name (e.g service_name.directory_name.file_name)
     * instead of raw name (e.g. file_name)
     */
    useFqnForFiltering?: boolean;
    /**
     * Regex to only include/exclude worksheets that matches the pattern.
     */
    worksheetFilterPattern?: FilterPattern;
}

/**
 * Regex to only include/exclude directories that matches the pattern.
 *
 * Regex to only fetch entities that matches the pattern.
 *
 * Regex to only include/exclude files that matches the pattern.
 *
 * Regex to only include/exclude spreadsheets that matches the pattern.
 *
 * Regex to only include/exclude worksheets that matches the pattern.
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
 * Drive Source Config Metadata Pipeline type
 */
export enum DriveMetadataConfigType {
    DriveMetadata = "DriveMetadata",
}
