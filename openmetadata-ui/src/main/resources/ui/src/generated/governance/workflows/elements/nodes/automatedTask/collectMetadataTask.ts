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
 * Keeps one Metadata Completion task open on an asset while it is in this node's stage and
 * any listed field is still empty or the stage's conditions are not met
 * (ADR:2026-10-15-a-lifecycle-stage-asks-for-its-missing-metadata-in-one-task). The stage
 * gate, not the task, decides whether the asset advances.
 */
export interface CollectMetadataTask {
    config:             MetadataCollectionConfiguration;
    description?:       string;
    displayName?:       string;
    input?:             string[];
    inputNamespaceMap?: InputNamespaceMap;
    name:               string;
    subType?:           string;
    type?:              string;
}

export interface MetadataCollectionConfiguration {
    /**
     * Assignees when the task goes to specific users or teams.
     */
    candidates?: EntityReference[];
    /**
     * JSON Logic condition the asset must also meet before it leaves the stage. The task only
     * reports that it is not met.
     */
    conditions?: string;
    /**
     * Fields the task asks for; it lists only the ones still empty.
     */
    fields?: RequiredField[];
    /**
     * Set on the steps a rejected approval adds instead of collecting fields: `request` asks
     * the stage's assignees to revise the asset, with the reviewer's comment; `resubmit` closes
     * that request when the stage's approval opens again
     * (ADR:2026-10-21-a-rejected-lifecycle-approval-asks-for-a-revision-and-the-next-edit-resubmits-it).
     */
    revision?: Revision;
    /**
     * The task applies while the asset is in this stage.
     */
    stage: EntityStatus;
    /**
     * The stage the asset moves to once the fields are filled in.
     */
    targetStage?: EntityStatus;
    /**
     * Who is asked to complete what the stage still needs.
     */
    taskAssignees: TaskAssignees;
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
 * A field the asset must fill in, with the JSON Logic condition that is true once it is
 * filled in.
 */
export interface RequiredField {
    /**
     * Path of the field, such as description, owners or extension.<property>.
     */
    field: string;
    /**
     * JSON Logic condition that is true once the field is filled in.
     */
    rules: string;
}

/**
 * Set on the steps a rejected approval adds instead of collecting fields: `request` asks
 * the stage's assignees to revise the asset, with the reviewer's comment; `resubmit` closes
 * that request when the stage's approval opens again
 * (ADR:2026-10-21-a-rejected-lifecycle-approval-asks-for-a-revision-and-the-next-edit-resubmits-it).
 */
export enum Revision {
    Request = "request",
    Resubmit = "resubmit",
}

/**
 * The task applies while the asset is in this stage.
 *
 * General lifecycle stage for entities that reference this vocabulary. Specialized entities
 * can declare their own status schema and lifecycle policy. Entity types without an
 * entityStatus property have no lifecycle. When a create request omits the stage, the
 * server assigns the entity type's initial stage.
 *
 * The stage the asset moves to once the fields are filled in.
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
 * Who is asked to complete what the stage still needs.
 */
export enum TaskAssignees {
    Candidates = "candidates",
    Owners = "owners",
    Reviewers = "reviewers",
}

export interface InputNamespaceMap {
    relatedEntity: string;
}
