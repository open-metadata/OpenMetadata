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
 * Create or update a governed semantic relationship type.
 */
export interface CreateRelationshipType {
    cardinality?:          Cardinality;
    category:              Category;
    characteristics?:      Characteristic[];
    crossGlossaryAllowed?: boolean;
    description:           string;
    disjointWith?:         string[];
    displayName:           string;
    domain?:               SemanticReference[];
    entityStatus?:         EntityStatus;
    /**
     * Fully qualified name of the inverse relationship type.
     */
    inverse?:       string;
    iri?:           string;
    name:           string;
    owners?:        EntityReference[];
    paletteKey:     PaletteKey;
    propertyChain?: string[];
    range?:         SemanticReference[];
    rdfPredicate:   string;
    /**
     * Fully qualified name of the replacement relationship type.
     */
    replacedBy?: string;
    reviewers?:  EntityReference[];
}

export interface Cardinality {
    sourceMax?: number;
    targetMax?: number;
}

export enum Category {
    Core = "CORE",
    Custom = "CUSTOM",
    OwlSkos = "OWL_SKOS",
}

export enum Characteristic {
    Asymmetric = "ASYMMETRIC",
    Functional = "FUNCTIONAL",
    InverseFunctional = "INVERSE_FUNCTIONAL",
    Irreflexive = "IRREFLEXIVE",
    Reflexive = "REFLEXIVE",
    Symmetric = "SYMMETRIC",
    Transitive = "TRANSITIVE",
}

/**
 * Reference to a governed glossary term or an external semantic resource.
 */
export interface SemanticReference {
    /**
     * Canonical IRI of the referenced semantic resource.
     */
    iri: string;
    /**
     * Resolved glossary term when the referenced resource is governed locally.
     */
    term?: EntityReference;
}

/**
 * Resolved glossary term when the referenced resource is governed locally.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * This schema defines the EntityReferenceList type used for referencing an entity.
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
 * Status of an entity. It is used for governance and is applied to all the entities in the
 * catalog.
 */
export enum EntityStatus {
    Approved = "Approved",
    Archived = "Archived",
    Deprecated = "Deprecated",
    Draft = "Draft",
    InReview = "In Review",
    Rejected = "Rejected",
    Unprocessed = "Unprocessed",
}

export enum PaletteKey {
    Amber = "AMBER",
    Blue = "BLUE",
    Gray = "GRAY",
    Green = "GREEN",
    Indigo = "INDIGO",
    Pink = "PINK",
    Purple = "PURPLE",
    Rose = "ROSE",
    Teal = "TEAL",
    Violet = "VIOLET",
}
