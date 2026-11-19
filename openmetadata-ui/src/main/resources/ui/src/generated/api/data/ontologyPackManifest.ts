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
 * Typed, versioned catalogue manifest for an Ontology library pack.
 */
export interface OntologyPackManifest {
    abbreviation: string;
    /**
     * Copyright and license notice the license requires us to show wherever the pack is
     * redistributed.
     */
    attribution?: string;
    /**
     * Whether every selected module can be installed from verified classpath content.
     */
    bundled:     boolean;
    description: string;
    id:          string;
    /**
     * Industry the pack models. The library catalogue filters packs by it.
     */
    industry: Industry;
    /**
     * Governance layer of a new ontology created to hold this pack.
     */
    layer:      Layer;
    license:    string;
    licenseUrl: string;
    modules:    OntologyPackModule[];
    name:       string;
    /**
     * Organization that publishes the standard, or OpenMetadata for an authored starter.
     */
    publisher?: string;
    sourceUrl:  string;
    standard:   string;
    version:    string;
}

/**
 * Industry the pack models. The library catalogue filters packs by it.
 */
export enum Industry {
    BuildingsAndEnergy = "buildings-and-energy",
    CrossIndustry = "cross-industry",
    Finance = "finance",
    Healthcare = "healthcare",
    HumanResources = "human-resources",
    Manufacturing = "manufacturing",
    Retail = "retail",
    SupplyChain = "supply-chain",
}

/**
 * Governance layer of a new ontology created to hold this pack.
 *
 * Governance layer of an ontology model.
 */
export enum Layer {
    L1 = "L1",
    L2 = "L2",
    L3 = "L3",
}

/**
 * One independently selectable module in an ontology library pack.
 */
export interface OntologyPackModule {
    /**
     * Distinct IRIs typed owl:Class, rdfs:Class or skos:Concept in the payload.
     */
    conceptCount: number;
    dependencies: string[];
    description:  string;
    format:       Format;
    /**
     * Stable module key within the pack.
     */
    id:   string;
    name: string;
    /**
     * Distinct IRI-to-IRI rdfs:subClassOf, rdfs:subPropertyOf, skos:broader, skos:narrower and
     * skos:related statements in the payload.
     */
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
     * Lowercase SHA-256 of the published file, recorded only when the generator converted it to
     * the bundled Turtle payload.
     */
    sourceSha256?: string;
    /**
     * Authoritative external source: where a catalogue-only module is obtained, or where a
     * bundled module was published.
     */
    sourceUrl?: string;
}

export enum Format {
    Jsonld = "jsonld",
    Ntriples = "ntriples",
    Rdfxml = "rdfxml",
    Turtle = "turtle",
}
