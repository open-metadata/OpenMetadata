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
 * Typed, versioned catalogue manifest for an Ontology Studio library pack.
 */
export interface OntologyPackManifest {
    abbreviation: string;
    /**
     * Whether every selected module can be installed from verified classpath content.
     */
    bundled:     boolean;
    description: string;
    id:          string;
    license:     string;
    licenseUrl:  string;
    modules:     OntologyPackModule[];
    name:        string;
    sourceUrl:   string;
    standard:    string;
    version:     string;
}

/**
 * One independently selectable module in an ontology library pack.
 */
export interface OntologyPackModule {
    conceptCount: number;
    dependencies: string[];
    description:  string;
    format:       Format;
    /**
     * Stable module key within the pack.
     */
    id:                string;
    name:              string;
    relationshipCount: number;
    /**
     * Classpath resource used for redistributable bundled modules.
     */
    resourcePath?:     string;
    selectedByDefault: boolean;
    /**
     * Lowercase SHA-256 of the exact bundled payload.
     */
    sha256?: string;
    /**
     * Authoritative external source for catalogue-only modules.
     */
    sourceUrl?: string;
}

export enum Format {
    Jsonld = "jsonld",
    Ntriples = "ntriples",
    Rdfxml = "rdfxml",
    Turtle = "turtle",
}
