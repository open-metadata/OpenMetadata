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
 * Administrator-managed SPARQL query templates available across the installation.
 */
export interface SparqlQuerySettings {
    /**
     * Installation query templates visible to SPARQL console users.
     */
    queryTemplates: SavedSparqlQuery[];
}

/**
 * A SPARQL query saved by a user or curated as an installation query template.
 */
export interface SavedSparqlQuery {
    /**
     * Preferred result serialization.
     */
    format: Format;
    /**
     * Stable identifier for the saved query.
     */
    id: string;
    /**
     * Preferred inference level.
     */
    inference: Inference;
    /**
     * Display name for the saved query.
     */
    name: string;
    /**
     * SPARQL query body.
     */
    query: string;
    /**
     * Time the query was last saved, in Unix epoch milliseconds.
     */
    savedAt: number;
}

/**
 * Preferred result serialization.
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
 * Preferred inference level.
 */
export enum Inference {
    Custom = "custom",
    None = "none",
    Owl = "owl",
    Rdfs = "rdfs",
}
