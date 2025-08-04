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
 * Epic FHIR Connection Config
 */
export interface EpicConnection {
    /**
     * Optional name to give to the database in OpenMetadata. If left blank, we will use 'epic'
     * as the database name.
     */
    databaseName?: string;
    /**
     * Base URL of the Epic FHIR server
     */
    fhirServerUrl?: string;
    /**
     * FHIR specification version (R4, STU3, DSTU2)
     */
    fhirVersion?: FHIRVersion;
    /**
     * Regex to include/exclude FHIR resource categories
     */
    schemaFilterPattern?:        FilterPattern;
    supportsMetadataExtraction?: boolean;
    /**
     * Regex to include/exclude FHIR resource types
     */
    tableFilterPattern?: FilterPattern;
    /**
     * Service Type
     */
    type?: EpicType;
}

/**
 * FHIR specification version (R4, STU3, DSTU2)
 */
export enum FHIRVersion {
    Dstu2 = "DSTU2",
    R4 = "R4",
    Stu3 = "STU3",
}

/**
 * Regex to include/exclude FHIR resource categories
 *
 * Regex to only fetch entities that matches the pattern.
 *
 * Regex to include/exclude FHIR resource types
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
export enum EpicType {
    Epic = "Epic",
}
