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
 * A TaskFormSchema defines the form structure for creating or resolving a specific type of
 * task. It includes a JSON Schema for validation and a UI schema for rendering.
 */
export interface TaskFormSchema {
    /**
     * Change that lead to this version of the entity.
     */
    changeDescription?: ChangeDescription;
    /**
     * Optional JSON Schema override used specifically when creating a task.
     */
    createFormSchema?: { [key: string]: any };
    /**
     * Optional uiSchema override used specifically when creating a task.
     */
    createUiSchema?: { [key: string]: any };
    /**
     * Default workflow stage to coarse task status mappings keyed by stage identifier.
     */
    defaultStageMappings?: { [key: string]: TaskStatus };
    /**
     * When true indicates the entity has been soft deleted.
     */
    deleted?: boolean;
    /**
     * Description of the form schema.
     */
    description?: string;
    /**
     * Display name for the form schema.
     */
    displayName?: string;
    /**
     * JSON Schema object defining the form fields and validation.
     */
    formSchema:          { [key: string]: any };
    fullyQualifiedName?: string;
    /**
     * Link to the resource.
     */
    href?: string;
    /**
     * Unique identifier (UUID) for this form schema.
     */
    id: string;
    /**
     * Unique key for this form schema (e.g., 'DescriptionSuggestion').
     */
    name: string;
    /**
     * The task category this form schema applies to.
     */
    taskCategory?: string;
    /**
     * The task type this form schema applies to.
     */
    taskType: string;
    /**
     * Per-transition form configuration keyed by transition identifier or formRef.
     */
    transitionForms?: { [key: string]: any };
    /**
     * RJSF uiSchema object for customizing form rendering.
     */
    uiSchema?: { [key: string]: any };
    /**
     * Last update timestamp.
     */
    updatedAt?: number;
    /**
     * User who last updated the form schema.
     */
    updatedBy?: string;
    /**
     * Metadata version of the entity.
     */
    version?: number;
    /**
     * Name of the WorkflowDefinition that orchestrates tasks created from this schema.
     */
    workflowDefinitionRef?: string;
    /**
     * Version of the bound workflow definition when this form schema was last saved.
     */
    workflowVersion?: number;
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

/**
 * Current status of the task in its lifecycle.
 */
export enum TaskStatus {
    Approved = "Approved",
    Cancelled = "Cancelled",
    Completed = "Completed",
    Failed = "Failed",
    InProgress = "InProgress",
    Open = "Open",
    Pending = "Pending",
    Rejected = "Rejected",
}
