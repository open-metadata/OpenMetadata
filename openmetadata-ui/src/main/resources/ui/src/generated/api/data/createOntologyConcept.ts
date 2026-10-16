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
 * Create or update an independent ontologyConcept. Approval is managed through existing
 * approval workflows.
 */
export interface CreateOntologyConcept {
    conceptMappings?: ConceptMapping[];
    conceptType:      OntologyConceptType;
    description?:     string;
    displayName?:     string;
    /**
     * Semantic IRI preserved for imported definitions. If omitted, creation mints an IRI from
     * the ontology namespace and entity UUID; updates preserve the stored IRI.
     */
    iri?: string;
    name: string;
    /**
     * Fully qualified name of the owning ontology.
     */
    ontology:   string;
    owners?:    EntityReference[];
    provider?:  ProviderType;
    reviewers?: EntityReference[];
    synonyms?:  string[];
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
 * Vocabulary a source ontology used to assert a concept. Preserved so imported ontologies
 * round-trip with the typing they were authored with.
 */
export enum OntologyConceptType {
    Both = "BOTH",
    OwlClass = "OWL_CLASS",
    SkosConcept = "SKOS_CONCEPT",
}

/**
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
 * Type of provider of an entity. Some entities are provided by the `system`. Some are
 * entities created and provided by the `user`. Typically `system` provide entities can't be
 * deleted and can only be disabled. Some apps such as AutoPilot create entities with
 * `automation` provider type. These entities can be deleted by the user.
 */
export enum ProviderType {
    Automation = "automation",
    System = "system",
    User = "user",
}
