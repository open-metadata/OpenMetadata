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
 * Qlik Cloud Connection Config
 */
export interface QlikCloudConnection {
    /**
     * Regex exclude or include charts that matches the pattern.
     */
    chartFilterPattern?: FilterPattern;
    /**
     * Regex to exclude or include dashboards that matches the pattern.
     */
    dashboardFilterPattern?: FilterPattern;
    /**
     * Regex exclude or include data models that matches the pattern.
     */
    dataModelFilterPattern?: FilterPattern;
    /**
     * Host and Port of the Qlik Cloud instance.
     */
    hostPort: string;
    /**
     * Regex to exclude or include projects that matches the pattern.
     */
    projectFilterPattern?: FilterPattern;
    /**
     * Space types of Qlik Cloud to filter the dashboards ingested into the platform.
     */
    spaceTypes?:                 SpaceType[];
    supportsMetadataExtraction?: boolean;
    /**
     * token to connect to Qlik Cloud.
     */
    token: string;
    /**
     * Service Type
     */
    type?: QlikCloudType;
}

/**
 * Regex exclude or include charts that matches the pattern.
 *
 * Regex to only fetch entities that matches the pattern.
 *
 * Regex to exclude or include dashboards that matches the pattern.
 *
 * Regex exclude or include data models that matches the pattern.
 *
 * Regex to exclude or include projects that matches the pattern.
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

export enum SpaceType {
    Data = "Data",
    Managed = "Managed",
    Personal = "Personal",
    Shared = "Shared",
}

/**
 * Service Type
 *
 * Qlik Cloud service type
 */
export enum QlikCloudType {
    QlikCloud = "QlikCloud",
}
