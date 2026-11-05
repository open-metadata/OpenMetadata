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
 * Append-only evidence committed with an ontology release capture, completed approval
 * workflow decision, or activation.
 */
export interface OntologyReleaseEvent {
    /**
     * The new activation revision committed with an ACTIVATED event, including rollback.
     */
    activationRevision?: number;
    contentDigest:       string;
    createdAt:           number;
    createdBy:           string;
    eventType:           EventType;
    id:                  string;
    ontologyId:          string;
    /**
     * Previously active release, absent for the first activation.
     */
    previousReleaseId?: string;
    releaseId:          string;
    resolution?:        TaskResolution;
    reviewTarget?:      OntologyReviewTarget;
    taskId?:            string;
    /**
     * Distinct reviewers whose votes were accepted by the completed workflow.
     */
    voters?:               string[];
    workflowDefinitionId?: string;
    workflowInstanceId?:   string;
}

export enum EventType {
    Activated = "ACTIVATED",
    Approved = "APPROVED",
    Captured = "CAPTURED",
    Rejected = "REJECTED",
}

/**
 * Details about how the task was resolved.
 */
export interface TaskResolution {
    /**
     * Optional comment explaining the resolution.
     */
    comment?: string;
    /**
     * The new value that was applied when task was resolved (for update tasks).
     */
    newValue?: string;
    /**
     * Structured resolution data submitted via the transition form at resolution time.
     */
    payload?: { [key: string]: any };
    /**
     * Timestamp when the task was resolved.
     */
    resolvedAt?: number;
    /**
     * User who resolved the task.
     */
    resolvedBy?: EntityReference;
    type?:       ResolutionType;
}

/**
 * User who resolved the task.
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
 * Server-captured immutable ontology release reviewed by an existing approval workflow task.
 */
export interface OntologyReviewTarget {
    /**
     * Approval rule frozen when the review was requested. Reviews requested before the rule
     * existed decide on the first approval.
     */
    approvalRule?: OntologyApprovalRule;
    author:        string;
    /**
     * SHA-256 of the ontology-review-v3 sealed release identity.
     */
    contentDigest: string;
    entityId:      string;
    /**
     * Entity-history version submitted for review; reviewers read this frozen release header.
     */
    entityVersion: number;
    /**
     * Owning ontology ID used to serialize release review decisions.
     */
    ontologyId: string;
}

/**
 * Approval rule frozen when the review was requested. Reviews requested before the rule
 * existed decide on the first approval.
 *
 * How many of an ontology's reviewers must approve a release review. AnyReviewer decides on
 * the first approval. AllReviewers waits for every reviewer entry; a reviewer team counts
 * once and any member covers it. Frozen into the review task when a review is requested.
 */
export enum OntologyApprovalRule {
    AllReviewers = "AllReviewers",
    AnyReviewer = "AnyReviewer",
}
