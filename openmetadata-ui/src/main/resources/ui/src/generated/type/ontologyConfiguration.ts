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
 * Ontology modeling and namespace settings inherited by every term in a glossary.
 */
export interface OntologyConfiguration {
    /**
     * Absolute base IRI used when minting governed concepts.
     */
    baseIri?: string;
    /**
     * Ontology models this model depends on. Dependencies must point to the same or a more
     * foundational layer.
     */
    imports?: EntityReference[];
    /**
     * Verified ontology library packs installed into this model, keyed by stable pack ID.
     */
    installedPacks: OntologyPackInstallation[];
    /**
     * IRI suffix pattern. Supported placeholders are {glossary}, {term}, and {uuid}.
     */
    iriMintingPattern: string;
    layer:             Layer;
    /**
     * Prefix registry used for display, authoring, import, and export.
     */
    prefixes: Prefix[];
    /**
     * Whether the model is an installed reference model that cannot be edited directly.
     */
    readOnly: boolean;
}

/**
 * Ontology models this model depends on. Dependencies must point to the same or a more
 * foundational layer.
 *
 * This schema defines the EntityReferenceList type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
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
 * Governance layer of an ontology model.
 */
export enum Layer {
    L1 = "L1",
    L2 = "L2",
    L3 = "L3",
}

/**
 * A compact IRI prefix and its absolute namespace.
 */
export interface Prefix {
    namespace: string;
    prefix:    string;
}
