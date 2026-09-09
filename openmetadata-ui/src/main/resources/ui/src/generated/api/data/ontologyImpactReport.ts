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
 * A version-bound impact preview for a governed ontology operation.
 */
export interface OntologyImpactReport {
    baseVersion: number;
    /**
     * Total number of assets bound to the concept.
     */
    boundAssetCount: number;
    /**
     * Bound assets included in the preview, capped by the service preview limit.
     */
    boundAssets: EntityReference[];
    /**
     * Whether the bound-assets sample omits additional assets.
     */
    boundAssetsTruncated: boolean;
    /**
     * Immediate child concepts that must be reassigned or explicitly cascaded.
     */
    children: EntityReference[];
    /**
     * External crosswalks removed with the concept.
     */
    conceptMappings: ConceptMapping[];
    expiresAt:       number;
    generatedAt:     number;
    /**
     * Short-lived signed token bound to the principal and exact impact snapshot.
     */
    impactToken: string;
    /**
     * Governed operation evaluated by this report.
     */
    operation: Operation;
    /**
     * Typed semantic relationships removed with the resource.
     */
    relationships: TermRelation[];
    resource:      EntityReference;
    /**
     * Whether the resulting ontology projection must be revalidated after application.
     */
    shaclRecheckRequired: boolean;
}

/**
 * Bound assets included in the preview, capped by the service preview limit.
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
 *
 * Resolved first-class relationship type.
 *
 * Reference to the related glossary term.
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

/**
 * Governed operation evaluated by this report.
 */
export enum Operation {
    Change = "CHANGE",
    Delete = "DELETE",
}

/**
 * This schema defines the TermRelation type used for establishing typed semantic
 * relationships between glossary terms.
 */
export interface TermRelation {
    /**
     * Time the relationship was first persisted.
     */
    createdAt?: number;
    /**
     * User who first authored or imported the relationship.
     */
    createdBy?: string;
    /**
     * Unique identifier of this relation edge.
     */
    id?: string;
    /**
     * How this relation edge originated. Defaults to 'Manual'.
     */
    provenance?: Provenance;
    /**
     * Resolved first-class relationship type.
     */
    relationshipType?: EntityReference;
    /**
     * Type of the relation (e.g., 'broader', 'narrower', 'synonym', 'relatedTo'). Defaults to
     * 'relatedTo' for backward compatibility.
     */
    relationType?: string;
    /**
     * Approval status of this relation edge.
     */
    status?: EntityStatus;
    /**
     * Reference to the related glossary term.
     */
    term: EntityReference;
}

/**
 * How this relation edge originated. Defaults to 'Manual'.
 *
 * How this relation edge originated.
 */
export enum Provenance {
    AISuggested = "AiSuggested",
    Imported = "Imported",
    Inferred = "Inferred",
    Manual = "Manual",
}

/**
 * Approval status of this relation edge.
 *
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
