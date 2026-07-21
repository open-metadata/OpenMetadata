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
 * A durable Draft change set and pinned provenance for an application ontology subset.
 */
export interface OntologySubsetResult {
    changeSet:             EntityReference;
    relationships:         OntologyRelationship[];
    sourceGlossary:        EntityReference;
    sourceGlossaryVersion: number;
    sources:               OntologySourceProvenance[];
    targetGlossary:        EntityReference;
    terms:                 EntityReference[];
}

/**
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
 * A stable, directed semantic relationship between two glossary terms.
 */
export interface OntologyRelationship {
    createdAt: number;
    /**
     * User who first authored or imported the relationship.
     */
    createdBy:        string;
    fromTerm:         EntityReference;
    id:               string;
    provenance:       Provenance;
    relationshipType: EntityReference;
    status:           EntityStatus;
    toTerm:           EntityReference;
}

/**
 * How this relation edge originated.
 */
export enum Provenance {
    AISuggested = "AiSuggested",
    Imported = "Imported",
    Inferred = "Inferred",
    Manual = "Manual",
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

/**
 * Pinned source identity and versions for a concept materialized into an application
 * ontology subset.
 */
export interface OntologySourceProvenance {
    capturedAt: number;
    capturedBy: string;
    /**
     * Whether the modeler selected this term or it was included as a descendant.
     */
    selectedDirectly:      boolean;
    sourceGlossary:        EntityReference;
    sourceGlossaryVersion: number;
    /**
     * Canonical source concept IRI used for exact-match traceability.
     */
    sourceIri?: string;
    /**
     * Structural merge base captured at sourceTermVersion.
     */
    sourceSnapshot:    OntologyTermStructure;
    sourceTerm:        EntityReference;
    sourceTermVersion: number;
}

/**
 * Structural merge base captured at sourceTermVersion.
 *
 * Typed structural state used for application ontology three-way comparison.
 */
export interface OntologyTermStructure {
    attributes:          OntologyAttribute[];
    conceptMappings:     ConceptMapping[];
    description:         string;
    displayName?:        string;
    entityStatus?:       EntityStatus;
    name:                string;
    parentSourceTermId?: string;
    relationships:       Relationship[];
}

/**
 * A typed attribute governed by an ontology concept.
 */
export interface OntologyAttribute {
    dataType: DataType;
    /**
     * Exact RDF datatype IRI preserved for ontology round trips.
     */
    datatypeIri?: string;
    /**
     * Human-readable meaning of the attribute.
     */
    description?: string;
    /**
     * Allowed values when dataType is ENUM.
     */
    enumValues?: string[];
    /**
     * Stable identifier used by drafts and version diffs.
     */
    id: string;
    /**
     * Canonical IRI of the OWL datatype property.
     */
    iri?: string;
    /**
     * Whether the attribute identifies instances of the concept.
     */
    isIdentifier: boolean;
    /**
     * Name of the attribute within its concept.
     */
    name: string;
    /**
     * Optional unit IRI or display symbol.
     */
    unit?: string;
}

/**
 * Supported value type for an ontology attribute.
 */
export enum DataType {
    Boolean = "BOOLEAN",
    Date = "DATE",
    Decimal = "DECIMAL",
    Enum = "ENUM",
    Integer = "INTEGER",
    String = "STRING",
}

/**
 * Mapping from an ontology term to an external concept.
 */
export interface ConceptMapping {
    /**
     * External concept IRI to map this ontology term to.
     */
    conceptIri: string;
    /**
     * Type of mapping used for the external concept alignment.
     */
    mappingType: ConceptMappingType;
    /**
     * Optional external concept scheme IRI for the mapped concept.
     */
    schemeIri?: string;
    /**
     * Optional source label or catalog for the external concept.
     */
    source?: string;
}

/**
 * Type of mapping used for the external concept alignment.
 *
 * Type of mapping used to align this term with an external concept.
 */
export enum ConceptMappingType {
    BroadMatch = "BROAD_MATCH",
    CloseMatch = "CLOSE_MATCH",
    ExactMatch = "EXACT_MATCH",
    NarrowMatch = "NARROW_MATCH",
    RelatedMatch = "RELATED_MATCH",
    SameAs = "SAME_AS",
}

export interface Relationship {
    relationshipType:   EntityReference;
    targetSourceTermId: string;
}
