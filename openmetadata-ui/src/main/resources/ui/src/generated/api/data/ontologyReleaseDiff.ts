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
 * A paginated comparison of asserted definitions in two immutable releases. An omitted base
 * compares with an empty ontology. Operational changes are excluded; this is not a
 * logical-equivalence result.
 */
export interface OntologyReleaseDiff {
    baseContentDigest?: string;
    baseReleaseId?:     string;
    contentDigest:      string;
    /**
     * Changed members ordered by member kind and entity UUID. References identify the exact
     * snapshots to inspect.
     */
    data:      MemberChange[];
    paging:    Paging;
    releaseId: string;
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

export enum ChangeType {
    Added = "ADDED",
    Changed = "CHANGED",
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
 * Unique id used to identify an entity.
 *
 * Release containing the proposed member. Absent for removals.
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
