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
 * Optional presentation metadata for guided lifecycle workflows. Executable nodes and edges
 * remain authoritative; editors must verify that the metadata compiles to the saved graph
 * before editing it as stages.
 */
export interface LifecycleConfiguration {
    entityType: EntityType;
    gates:      LifecycleGate[];
    version:    number;
}

export enum EntityType {
    DataProduct = "dataProduct",
    Domain = "domain",
    GlossaryTerm = "glossaryTerm",
    Metric = "metric",
}

/**
 * A stage of the guided lifecycle: the fields and conditions an asset needs before it can
 * leave the stage, and who is asked to complete them.
 */
export interface LifecycleGate {
    /**
     * Fields the asset must fill in before it can leave the stage.
     */
    checks: LifecycleFieldCheck[];
    /**
     * JSON Logic condition the asset must also meet before it can leave the stage.
     */
    conditions?: string;
    stage:       EntityStatus;
    /**
     * Who is asked to fill in the missing fields or get the conditions met. Without it the
     * stage holds the asset and asks no one
     * (ADR:2026-10-15-a-lifecycle-stage-asks-for-its-missing-metadata-in-one-task).
     */
    task?: Task;
}

/**
 * A field the asset must fill in before it can leave the gate's stage.
 */
export interface LifecycleFieldCheck {
    field: string;
    /**
     * Number and boolean fields accept zero and false as filled-in values.
     */
    valueType?: ValueType;
}

/**
 * Number and boolean fields accept zero and false as filled-in values.
 */
export enum ValueType {
    Boolean = "boolean",
    Number = "number",
}

/**
 * General lifecycle stage for entities that reference this vocabulary. Specialized entities
 * can declare their own status schema and lifecycle policy. Entity types without an
 * entityStatus property have no lifecycle. When a create request omits the stage, the
 * server assigns the entity type's initial stage.
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
 * Who is asked to fill in the missing fields or get the conditions met. Without it the
 * stage holds the asset and asks no one
 * (ADR:2026-10-15-a-lifecycle-stage-asks-for-its-missing-metadata-in-one-task).
 */
export interface Task {
    assignees:   Assignees;
    candidates?: EntityReference[];
}

export enum Assignees {
    Candidates = "candidates",
    Owners = "owners",
    Reviewers = "reviewers",
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
