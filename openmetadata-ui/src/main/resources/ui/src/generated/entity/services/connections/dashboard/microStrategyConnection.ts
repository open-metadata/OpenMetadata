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
 * MicroStrategy Connection Config
 */
export interface MicroStrategyConnection {
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
     * Host and Port of the MicroStrategy instance.
     */
    hostPort: string;
    /**
     * Login Mode for Microstrategy's REST API connection. You can authenticate with one of the
     * following authentication modes: `Standard (1)`, `Anonymous (8)`. Default will be
     * `Standard (1)`. If you're using demo account for Microstrategy, it will be needed to
     * authenticate through loginMode `8`.
     */
    loginMode?: string;
    /**
     * Password to connect to MicroStrategy.
     */
    password: string;
    /**
     * Regex to exclude or include projects that matches the pattern.
     */
    projectFilterPattern?: FilterPattern;
    /**
     * MicroStrategy Project Name
     */
    projectName?:                string;
    supportsMetadataExtraction?: boolean;
    /**
     * Service Type
     */
    type?: MicroStrategyType;
    /**
     * Username to connect to MicroStrategy. This user should have privileges to read all the
     * metadata in MicroStrategy.
     */
    username: string;
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

/**
 * Service Type
 *
 * MicroStrategy service type
 */
export enum MicroStrategyType {
    MicroStrategy = "MicroStrategy",
}
