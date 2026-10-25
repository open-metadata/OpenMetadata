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
 * What a native ontology import would change, counted from one parse of the source. Nothing
 * is persisted.
 */
export interface NativeOntologyImportSummary {
    counts: Counts;
    /**
     * Format the server parsed: the requested format, or the detected one when the request
     * omits it.
     */
    detectedFormat: Format;
    /**
     * Label of the source ontology, when the source declares exactly one ontology header with a
     * label.
     */
    ontologyLabel?: string;
}

/**
 * Every parsed concept, property, and axiom is counted once as new, updated, or skipped.
 * `newMappings` counts mappings inside new and updated concepts, so it overlaps the concept
 * counts.
 */
export interface Counts {
    newConcepts: number;
    /**
     * Concept mappings the target does not hold yet.
     */
    newMappings:   number;
    newProperties: number;
    /**
     * Parsed axioms the target does not hold yet.
     */
    newRelations: number;
    /**
     * Parsed concepts and properties identical to the stored ones.
     */
    skippedDefinitions: number;
    /**
     * Parsed axioms the target already holds.
     */
    skippedRelations:  number;
    updatedConcepts:   number;
    updatedProperties: number;
}

/**
 * Format the server parsed: the requested format, or the detected one when the request
 * omits it.
 *
 * Serialization of a native ontology import source.
 */
export enum Format {
    CSV = "csv",
    Jsonld = "jsonld",
    Ntriples = "ntriples",
    Rdfxml = "rdfxml",
    Turtle = "turtle",
}
