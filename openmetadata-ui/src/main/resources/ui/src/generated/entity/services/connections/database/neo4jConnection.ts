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
 * Neo4j Connection Config
 */
export interface Neo4JConnection {
    /**
     * Regex to only include/exclude databases that matches the pattern.
     */
    databaseFilterPattern?: FilterPattern;
    /**
     * Neo4j database to extract metadata from. If left blank, the user's home database is used.
     */
    databaseName?: string;
    /**
     * Host and port of the Neo4j server, e.g. `localhost:7687`. The port can be omitted to use
     * 7687.
     */
    hostPort: string;
    /**
     * Also ingest relationship types as tables in the `relationships` schema, with their
     * properties as columns.
     */
    includeRelationships?: boolean;
    /**
     * Password to connect to Neo4j.
     */
    password: string;
    /**
     * Regex to only include/exclude node and relationship properties (columns) that match the
     * pattern, e.g. properties written back by graph algorithms.
     */
    propertyFilterPattern?: FilterPattern;
    /**
     * Regex to only include/exclude schemas that matches the pattern.
     */
    schemaFilterPattern?: FilterPattern;
    /**
     * Neo4j driver URI scheme. Use `neo4j+s` for Neo4j Aura.
     */
    scheme?:                     Neo4JScheme;
    supportsMetadataExtraction?: boolean;
    /**
     * Regex to only include/exclude tables that matches the pattern.
     */
    tableFilterPattern?: FilterPattern;
    /**
     * Service Type
     */
    type?: Neo4JType;
    /**
     * Username to connect to Neo4j. The user needs read access to the graph schema of the
     * database.
     */
    username: string;
}

/**
 * Regex to only include/exclude databases that matches the pattern.
 *
 * Regex to only fetch entities that matches the pattern.
 *
 * Regex to only include/exclude node and relationship properties (columns) that match the
 * pattern, e.g. properties written back by graph algorithms.
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
 * Neo4j driver URI scheme. Use `neo4j+s` for Neo4j Aura.
 *
 * Neo4j driver URI scheme. `+s` encrypts with full certificate validation; `+ssc` encrypts
 * and accepts self-signed certificates.
 */
export enum Neo4JScheme {
    Bolt = "bolt",
    BoltS = "bolt+s",
    BoltSsc = "bolt+ssc",
    Neo4J = "neo4j",
    Neo4JS = "neo4j+s",
    Neo4JSsc = "neo4j+ssc",
}

/**
 * Service Type
 *
 * Service type.
 */
export enum Neo4JType {
    Neo4J = "Neo4j",
}
