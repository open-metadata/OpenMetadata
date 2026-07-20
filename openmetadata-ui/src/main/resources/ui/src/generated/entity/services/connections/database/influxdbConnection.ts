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
 * InfluxDB 3 Connection Config
 */
export interface InfluxdbConnection {
    connectionArguments?: { [key: string]: any };
    connectionOptions?:   { [key: string]: string };
    /**
     * Regex to only fetch databases that matches the pattern.
     */
    databaseFilterPattern?: FilterPattern;
    /**
     * Optional name to give to the database in OpenMetadata. If left blank, we will use default
     * as the database name.
     */
    databaseName?: string;
    /**
     * Database Schema of the data source. This is optional parameter, if you would like to
     * restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion
     * attempts to scan all the schemas.
     */
    databaseSchema?: string;
    /**
     * InfluxDB 3 HTTP API URL (e.g. https://cluster.influxdata.com or http://localhost:8086).
     */
    hostPort: string;
    /**
     * Regex to only fetch tables or databases that matches the pattern.
     */
    schemaFilterPattern?:        FilterPattern;
    supportsMetadataExtraction?: boolean;
    /**
     * Regex exclude tables or databases that matches the pattern.
     */
    tableFilterPattern?: FilterPattern;
    /**
     * InfluxDB 3 API token for authentication.
     */
    token: string;
    /**
     * Service Type
     */
    type?: InfluxDBType;
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
 * Service Type
 *
 * Service type.
 */
export enum InfluxDBType {
    InfluxDB = "InfluxDB",
}
