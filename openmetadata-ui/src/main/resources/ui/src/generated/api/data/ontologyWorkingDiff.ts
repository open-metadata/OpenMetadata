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
 * A paginated comparison of the current working ontology with its active release.
 */
export interface OntologyWorkingDiff {
    data: MemberChange[];
    /**
     * Changes grouped by concept, present when the request groups by concept. Data is then
     * empty and paging counts groups.
     */
    groups?: ConceptChange[];
    paging:  Paging;
    state:   OntologyState;
}

export interface MemberChange {
    /**
     * Release containing the proposed member. Absent for removals.
     */
    afterReleaseId?: string;
    /**
     * Release containing the previous member. Absent for additions.
     */
    beforeReleaseId?: string;
    changeType:       ChangeType;
    entity:           EntityReference;
    memberKind:       MemberKind;
    ontologyId:       string;
}

/**
 * Change type of the concept member, or CHANGED when only its axioms or properties changed.
 */
export enum ChangeType {
    Added = "ADDED",
    Changed = "CHANGED",
    Deprecated = "DEPRECATED",
    Removed = "REMOVED",
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
 * Release containing the proposed member. Absent for removals.
 *
 * Unique id used to identify an entity.
 *
 * Release containing the previous member. Absent for additions.
 *
 * Unique identifier that identifies an entity instance.
 *
 * Optional description of entity.
 *
 * Text in Markdown format.
 *
 * Link to the entity resource.
 *
 * URI that points to a resource.
 *
 * Semantic IRI of the concept.
 *
 * Absolute semantic IRI, preserved exactly without URL normalization, case folding, or
 * percent encoding.
 */
export enum MemberKind {
    Association = "ASSOCIATION",
    Axiom = "AXIOM",
    Concept = "CONCEPT",
    Ontology = "ONTOLOGY",
    Property = "PROPERTY",
    Shape = "SHAPE",
}

/**
 * Member changes grouped under the concept they define: the concept itself, axioms whose
 * subject is the concept, and properties whose first domain in this ontology is the
 * concept. A change that belongs to no concept forms its own group without a concept.
 */
export interface ConceptChange {
    changes: MemberChange[];
    /**
     * Change type of the concept member, or CHANGED when only its axioms or properties changed.
     */
    changeType: ChangeType;
    /**
     * Label of the concept: its display name, or its name when it has none.
     */
    concept?: string;
    /**
     * Semantic IRI of the concept.
     */
    iri?: string;
    /**
     * Labels of the named superclasses from the concept's SUBCLASS_OF axioms.
     */
    parents: string[];
    /**
     * Number of properties whose domain includes the concept.
     */
    propertyCount: number;
}

/**
 * Type used for cursor based pagination information in GET list responses.
 */
export interface Paging {
    /**
     * After cursor used for getting the next page (see API pagination for details).
     */
    after?: string;
    /**
     * Before cursor used for getting the previous page (see API pagination for details).
     */
    before?: string;
    /**
     * Limit used in case of offset based pagination.
     */
    limit?: number;
    /**
     * Offset used in case of offset based pagination.
     */
    offset?: number;
    /**
     * Total number of entries available to page through.
     */
    total: number;
}

/**
 * SQL concurrency revisions and the active immutable release of an ontology.
 */
export interface OntologyState {
    /**
     * Compare-and-set revision, advanced by both activation and rollback.
     */
    activationRevision:  number;
    activeReleaseId?:    string;
    lastReleaseRevision: number;
    ontologyId:          string;
    /**
     * Monotonic revision of committed working-model mutations.
     */
    workingRevision: number;
}
