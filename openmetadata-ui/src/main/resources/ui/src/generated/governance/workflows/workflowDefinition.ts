/*
 *  Copyright 2025 Collate.
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
 * Defines a workflow, having all the different pieces and attributes.
 */
export interface WorkflowDefinition {
    /**
     * Change that lead to this version of the entity.
     */
    changeDescription?: ChangeDescription;
    config?:            WorkflowConfiguration;
    /**
     * When `true` indicates the entity has been soft deleted.
     */
    deleted?: boolean;
    /**
     * When `true` indicates the workflow is deployed.
     */
    deployed?: boolean;
    /**
     * Description of the workflow definition.
     */
    description: string;
    /**
     * Display Name that identifies this workflow definition.
     */
    displayName?: string;
    /**
     * List of edges that connect the workflow elements and guide its flow.
     */
    edges?: EdgeDefinition[];
    /**
     * FullyQualifiedName same as `name`.
     */
    fullyQualifiedName?: string;
    /**
     * Link to the resource corresponding to this entity.
     */
    href?: string;
    /**
     * Unique identifier of this workflow definition.
     */
    id?: string;
    /**
     * Change that lead to this version of the entity.
     */
    incrementalChangeDescription?: ChangeDescription;
    /**
     * Name that identifies this workflow definition.
     */
    name: string;
    /**
     * List of nodes used on the workflow.
     */
    nodes?: { [key: string]: any }[];
    /**
     * Owners of this workflow definition.
     */
    owners?: EntityReference[];
    /**
     * Workflow Trigger.
     */
    trigger?: any[] | boolean | number | number | null | TriggerObject | string;
    /**
     * Last update time corresponding to the new version of the entity in Unix epoch time
     * milliseconds.
     */
    updatedAt?: number;
    /**
     * User who made the update.
     */
    updatedBy?: string;
    /**
     * Metadata version of the entity.
     */
    version?: number;
}

/**
 * Change that lead to this version of the entity.
 *
 * Description of the change.
 */
export interface ChangeDescription {
    changeSummary?: { [key: string]: ChangeSummary };
    /**
     * Names of fields added during the version changes.
     */
    fieldsAdded?: FieldChange[];
    /**
     * Fields deleted during the version changes with old value before deleted.
     */
    fieldsDeleted?: FieldChange[];
    /**
     * Fields modified during the version changes with old and new values.
     */
    fieldsUpdated?: FieldChange[];
    /**
     * When a change did not result in change, this could be same as the current version.
     */
    previousVersion?: number;
}

export interface ChangeSummary {
    changedAt?: number;
    /**
     * Name of the user or bot who made this change
     */
    changedBy?:    string;
    changeSource?: ChangeSource;
    [property: string]: any;
}

/**
 * The source of the change. This will change based on the context of the change (example:
 * manual vs programmatic)
 */
export enum ChangeSource {
    Automated = "Automated",
    Derived = "Derived",
    Ingested = "Ingested",
    Manual = "Manual",
    Propagated = "Propagated",
    Suggested = "Suggested",
}

export interface FieldChange {
    /**
     * Name of the entity field that changed.
     */
    name?: string;
    /**
     * New value of the field. Note that this is a JSON string and use the corresponding field
     * type to deserialize it.
     */
    newValue?: any;
    /**
     * Previous value of the field. Note that this is a JSON string and use the corresponding
     * field type to deserialize it.
     */
    oldValue?: any;
}

export interface WorkflowConfiguration {
    /**
     * Maximum number of stages to retain per workflow instance. Older stages will be dropped.
     */
    maxStagesPerInstance?: number;
    /**
     * Maximum number of retries for optimistic locking on workflow instance updates.
     */
    optimisticLockMaxRetries?: number;
    /**
     * If True, all the stage status will be stored in the database.
     */
    storeStageStatus: boolean;
}

/**
 * Governance Workflow Edge.
 */
export interface EdgeDefinition {
    /**
     * Defines if the edge will follow a path depending on the source node result.
     */
    condition?: string;
    /**
     * Element from which the edge will start.
     */
    from: string;
    /**
     * Element on which the edge will end.
     */
    to: string;
}

/**
 * Owners of this workflow definition.
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

export interface TriggerObject {
    type?: Type;
    [property: string]: any;
}

export enum Type {
    EventBasedEntity = "eventBasedEntity",
    NoOp = "noOp",
    PeriodicBatchEntity = "periodicBatchEntity",
}
