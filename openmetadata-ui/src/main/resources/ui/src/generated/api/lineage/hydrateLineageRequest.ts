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
 * Batch-hydrate a set of lineage nodes into full entity objects. Replaces N per-node entity
 * GETs with one round-trip. Response groups hydrated entities by entityType. Each
 * EntityReference in `entities` only requires `type` and `id`; other reference fields are
 * ignored.
 */
export interface HydrateLineageRequest {
    /**
     * Lineage nodes to hydrate. Each item identifies a single entity by (type, id).
     */
    entities: EntityReference[];
    /**
     * Comma-separated list of relationship fields to include on every returned entity (e.g.
     * 'tags,owners,domains'). Applied uniformly across all entity types — fields not applicable
     * to a given type are silently skipped by that type's repository.
     */
    fields?: string;
    /**
     * Whether to include deleted entities. Defaults to non-deleted.
     */
    include?: Include;
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
 * Whether to include deleted entities. Defaults to non-deleted.
 *
 * GET entity by id, GET entity by name, and LIST entities can include deleted or
 * non-deleted entities using the parameter include.
 */
export enum Include {
    All = "all",
    Deleted = "deleted",
    NonDeleted = "non-deleted",
}
