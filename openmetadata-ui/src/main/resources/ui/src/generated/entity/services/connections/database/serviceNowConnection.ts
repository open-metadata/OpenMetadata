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
 * ServiceNow Connection Config
 */
export interface ServiceNowConnection {
    connectionArguments?: { [key: string]: any };
    connectionOptions?:   { [key: string]: string };
    /**
     * ServiceNow instance URL (e.g., https://your-instance.service-now.com)
     */
    hostPort: string;
    /**
     * If true, ServiceNow application scopes will be imported as database schemas. Otherwise, a
     * single default schema will be used.
     */
    includeScopes?: boolean;
    /**
     * If true, both admin and system tables (sys_* tables) will be fetched. If false, only
     * admin tables will be fetched.
     */
    includeSystemTables?: boolean;
    /**
     * Password to connect to ServiceNow.
     */
    password:                    string;
    supportsLineageExtraction?:  boolean;
    supportsMetadataExtraction?: boolean;
    /**
     * Regex to only include/exclude tables that matches the pattern.
     */
    tableFilterPattern?: FilterPattern;
    /**
     * Service Type
     */
    type?: ServiceNowType;
    /**
     * Username to connect to ServiceNow. This user should have read access to sys_db_object and
     * sys_dictionary tables.
     */
    username: string;
}

/**
 * Regex to only include/exclude tables that matches the pattern.
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

/**
 * Service Type
 *
 * Service type.
 */
export enum ServiceNowType {
    ServiceNow = "ServiceNow",
}
