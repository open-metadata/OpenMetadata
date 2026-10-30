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
 * SQL generated from a native concept's table bindings, optionally following search-around
 * hops. The request sends only hops; the response returns them with their labels and the
 * generated SQL. OpenMetadata generates the SQL and never runs it
 * (ADR:2026-10-21-ontology-live-data-execution-is-a-collate-extension).
 */
export interface OntologyConceptQuery {
    dialect?: Dialect;
    /**
     * Search-around hops in order, at most five.
     */
    hops?: Hop[];
    /**
     * Name of the database service that holds the bound tables. Set by the server.
     */
    service?: string;
    /**
     * Type of that database service. Set by the server.
     */
    serviceType?: string;
    /**
     * Generated SELECT with LIMIT 50. Set by the server.
     */
    sql?: string;
    /**
     * Fully qualified names of the tables the SQL reads, in join order. Set by the server.
     */
    tables?: string[];
}

/**
 * Identifier quoting family of the bound table's service.
 */
export enum Dialect {
    ANSI = "ansi",
    Bigquery = "bigquery",
    Mysql = "mysql",
    Snowflake = "snowflake",
    Spark = "spark",
    Tsql = "tsql",
}

/**
 * One step from the previous concept to a related concept through an object property.
 */
export interface Hop {
    direction: Direction;
    /**
     * Relation label written as the JOIN comment. Set by the server.
     */
    label?: string;
    /**
     * Id of the OBJECT property that relates the previous concept and the target.
     */
    property: string;
    /**
     * Id of the concept this hop reaches.
     */
    target: string;
}

/**
 * Which way the hop follows its property, as the Studio's chip shows it. `outgoing` follows
 * the property from its subject to its object, and `incoming` follows it back from its
 * object to its subject.
 */
export enum Direction {
    Incoming = "incoming",
    Outgoing = "outgoing",
}
