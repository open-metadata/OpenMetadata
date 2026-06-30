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
 * Defines a Task for a given User to approve.
 */
export interface UserApprovalTask {
    branches?: string[];
    config?:   NodeConfiguration;
    /**
     * Description of the Node.
     */
    description?: string;
    /**
     * Display Name that identifies this Node.
     */
    displayName?:       string;
    input?:             string[];
    inputNamespaceMap?: InputNamespaceMap;
    /**
     * Name that identifies this Node.
     */
    name?:    string;
    output?:  string[];
    subType?: string;
    type?:    string;
    [property: string]: any;
}

export interface NodeConfiguration {
    /**
     * Number of reviewers that must approve for the task to be completed. Default is 1 (any
     * single reviewer can approve).
     */
    approvalThreshold?: number;
    /**
     * People/Teams assigned to the Task.
     */
    assignees: Assignees;
    /**
     * Optional label describing how assignees are derived for the stage.
     */
    assigneeStrategy?: string;
    /**
     * Auto-fires after the ISO 8601 duration in the named process variable elapses. The
     * boundary timer interrupts the user task and exits the subprocess with the configured
     * transitionId as the node's result, so an outgoing edge with that condition routes the
     * workflow downstream (e.g. to auto-revoke or auto-close).
     */
    expiryTimer?: ExpiryTimer;
    /**
     * Number of reviewers that must reject for the task to be rejected. Default is 1 (any
     * single reviewer can reject). This allows for scenarios where you want multiple approvals
     * but a single rejection can veto.
     */
    rejectionThreshold?: number;
    /**
     * Human-readable stage label shown to task assignees.
     */
    stageDisplayName?: string;
    /**
     * Workflow stage identifier stored on the task while this user task is active.
     */
    stageId?: string;
    /**
     * Coarse task status mapped while this user task is active.
     */
    taskStatus?: TaskStatus;
    /**
     * Transitions available from this stage. Edge conditions should match these transition ids.
     */
    transitionMetadata?: TransitionMetadatum[];
}

/**
 * People/Teams assigned to the Task.
 */
export interface Assignees {
    /**
     * Add the Owners to the assignees List.
     */
    addOwners?: boolean;
    /**
     * Add the Reviewers to the assignees List.
     */
    addReviewers?: boolean;
    /**
     * List of specific candidates (users or teams) assigned to this task.
     */
    candidates?: EntityReference[];
    /**
     * Strategy applied when no reviewers, owners, or candidates resolve to assignees. 'none'
     * keeps the default behavior (the gateway auto-approves event-driven approvals and leaves
     * workflow-managed tasks unassigned); 'assignAdmins' falls back to all platform admins,
     * excluding the requester so self-approval can never happen.
     */
    emptyAssigneeStrategy?: EmptyAssigneeStrategy;
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
 * Strategy applied when no reviewers, owners, or candidates resolve to assignees. 'none'
 * keeps the default behavior (the gateway auto-approves event-driven approvals and leaves
 * workflow-managed tasks unassigned); 'assignAdmins' falls back to all platform admins,
 * excluding the requester so self-approval can never happen.
 */
export enum EmptyAssigneeStrategy {
    AssignAdmins = "assignAdmins",
    None = "none",
}

/**
 * Auto-fires after the ISO 8601 duration in the named process variable elapses. The
 * boundary timer interrupts the user task and exits the subprocess with the configured
 * transitionId as the node's result, so an outgoing edge with that condition routes the
 * workflow downstream (e.g. to auto-revoke or auto-close).
 */
export interface ExpiryTimer {
    /**
     * When set, the underlying Task entity is closed at the moment the timer fires with this
     * resolutionType (the final taskStatus is derived from it by TaskRepository — TimedOut maps
     * to Expired). Leave unset when a downstream node is responsible for closing the Task
     * (avoids double-resolve).
     */
    closeAsResolution?: ResolutionType;
    /**
     * Name of the process variable holding the ISO 8601 duration (e.g. 'accessDuration' →
     * 'P14D').
     */
    durationVariable: string;
    /**
     * Result value emitted when the timer fires. Must match an outgoing edge condition from
     * this node.
     */
    transitionId: string;
}

/**
 * When set, the underlying Task entity is closed at the moment the timer fires with this
 * resolutionType (the final taskStatus is derived from it by TaskRepository — TimedOut maps
 * to Expired). Leave unset when a downstream node is responsible for closing the Task
 * (avoids double-resolve).
 *
 * How the task was resolved.
 */
export enum ResolutionType {
    Approved = "Approved",
    AutoApproved = "AutoApproved",
    AutoRejected = "AutoRejected",
    Cancelled = "Cancelled",
    Completed = "Completed",
    Expired = "Expired",
    Rejected = "Rejected",
    Revoked = "Revoked",
    TimedOut = "TimedOut",
}

/**
 * Coarse task status mapped while this user task is active.
 *
 * Current status of the task in its lifecycle.
 */
export enum TaskStatus {
    Approved = "Approved",
    Cancelled = "Cancelled",
    Completed = "Completed",
    Expired = "Expired",
    Failed = "Failed",
    Granted = "Granted",
    ManualRevoke = "ManualRevoke",
    InProgress = "InProgress",
    Open = "Open",
    Pending = "Pending",
    Rejected = "Rejected",
    Revoked = "Revoked",
}

export interface TransitionMetadatum {
    formRef?:         string;
    id:               string;
    label:            string;
    requiresComment?: boolean;
    resolutionType?:  ResolutionType;
    targetStageId:    string;
    targetTaskStatus: TaskStatus;
}

export interface InputNamespaceMap {
    relatedEntity: string;
}
