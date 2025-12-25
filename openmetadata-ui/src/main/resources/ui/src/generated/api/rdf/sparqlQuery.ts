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
 * SPARQL query request
 */
export interface SparqlQuery {
    /**
     * Default graph URI for the query
     */
    defaultGraphUri?: string;
    /**
     * Response format for the query results
     */
    format?: Format;
    /**
     * Inference/reasoning level to apply
     */
    inference?: Inference;
    /**
     * Named graph URIs for the query
     */
    namedGraphUri?: string[];
    /**
     * The SPARQL query string
     */
    query: string;
    /**
     * Query timeout in milliseconds
     */
    timeout?: number;
}

/**
 * Response format for the query results
 */
export enum Format {
    CSV = "csv",
    JSON = "json",
    Jsonld = "jsonld",
    Ntriples = "ntriples",
    Rdfxml = "rdfxml",
    Tsv = "tsv",
    Turtle = "turtle",
    XML = "xml",
}

/**
 * Inference/reasoning level to apply
 */
export enum Inference {
    Custom = "custom",
    None = "none",
    Owl = "owl",
    Rdfs = "rdfs",
}
