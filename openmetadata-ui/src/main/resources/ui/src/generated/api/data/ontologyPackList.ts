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
 * Ontology library catalogue.
 */
export interface OntologyPackList {
    /**
     * Native ontologies the caller may view that installed a listed pack, one record per
     * ontology and pack.
     */
    installations?: OntologyPackInstallationRecord[];
    packs:          OntologyPackManifest[];
}

/**
 * A verified library pack installed into one native ontology, as the library catalogue
 * reports it.
 */
export interface OntologyPackInstallationRecord {
    /**
     * Installation entry stored in the ontology's installedPacks.
     */
    installation: OntologyPackInstallation;
    /**
     * Native ontology that holds the installation.
     */
    ontology: EntityReference;
}

/**
 * Installation entry stored in the ontology's installedPacks.
 *
 * Durable provenance and version state for an installed ontology library pack.
 */
export interface OntologyPackInstallation {
    installedAt: number;
    installedBy: string;
    license:     string;
    licenseUrl:  string;
    modules:     OntologyPackModuleInstallation[];
    packId:      string;
    sourceUrl:   string;
    version:     string;
}

/**
 * Verified ontology pack module recorded as installation provenance.
 */
export interface OntologyPackModuleInstallation {
    moduleId: string;
    sha256:   string;
}

/**
 * Native ontology that holds the installation.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 */
export interface EntityReference {
    /**
     * If true the entity referred to has been soft-deleted.
     */
    deleted?: boolean;
    /**
     * Optional description of entity.
     */
    description?: string;
    /**
     * Display Name that identifies this entity.
     */
    displayName?: string;
    /**
     * Fully qualified name of the entity instance. For entities such as tables, databases
     * fullyQualifiedName is returned in this field. For entities that don't have name hierarchy
     * such as `user` and `team` this will be same as the `name` field.
     */
    fullyQualifiedName?: string;
    /**
     * Link to the entity resource.
     */
    href?: string;
    /**
     * Unique identifier that identifies an entity instance.
     */
    id: string;
    /**
     * If true the relationship indicated by this entity reference is inherited from the parent
     * entity.
     */
    inherited?: boolean;
    /**
     * Name of the entity instance.
     */
    name?: string;
    /**
     * Entity type/class name - Examples: `database`, `table`, `metrics`, `databaseService`,
     * `dashboardService`...
     */
    type: string;
}

/**
 * Typed, versioned catalogue manifest for an Ontology library pack.
 */
export interface OntologyPackManifest {
    abbreviation: string;
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
    sourceUrl:  string;
    standard:   string;
    version:    string;
}

/**
 * Industry the pack models. The library catalogue filters packs by it.
 */
export enum Industry {
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
