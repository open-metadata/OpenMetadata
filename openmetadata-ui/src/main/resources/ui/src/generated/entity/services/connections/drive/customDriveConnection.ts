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
 * Custom Drive Connection to build a source that is not supported.
 */
export interface CustomDriveConnection {
    connectionArguments?: { [key: string]: any };
    connectionOptions?:   { [key: string]: string };
    /**
     * Regex to only include/exclude directories that matches the pattern.
     */
    directoryFilterPattern?: FilterPattern;
    /**
     * Regex to only include/exclude files that matches the pattern.
     */
    fileFilterPattern?: FilterPattern;
    /**
     * Regex to only include/exclude spreadsheets that matches the pattern.
     */
    spreadsheetFilterPattern?:   FilterPattern;
    supportsMetadataExtraction?: boolean;
    /**
     * Service Type
     */
    type?: CustomDriveType;
    /**
     * Regex to only include/exclude worksheets that matches the pattern.
     */
    worksheetFilterPattern?: FilterPattern;
    [property: string]: any;
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
 * Service Type
 *
 * Custom Drive service type
 */
export enum CustomDriveType {
    CustomDrive = "CustomDrive",
}
