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
 * A request to change a published asset that is waiting for, or has finished, approval.
 */
export interface ChangeRequest {
    /**
     * Populated on read only; never persisted in the request row.
     */
    activeRevision?:      ChangeRevision;
    activeRevisionId:     string;
    activeRevisionNumber: number;
    /**
     * Changes of the active revision that the asset already shows because another change
     * published them; they are no longer reviewed.
     */
    alreadyPublished?: ChangeRef[];
    conflicts?:        ChangeConflict[];
    createdAt:         number;
    deliveryAttempts?: number;
    deliveryStatus?:   DeliveryStatus;
    /**
     * Changes of the active revision its reviewers can no longer agree on: the reviewers who
     * have not voted cannot bring either the approvals or the rejections to their threshold.
     * They are not published.
     */
    disagreed?:               ChangeRef[];
    entityFullyQualifiedName: string;
    entityId:                 string;
    entityType:               string;
    id:                       string;
    /**
     * Bot that submitted on the requester's behalf, if any.
     */
    impersonatedBy?: string;
    origin:          ChangeRequestOrigin;
    /**
     * Effective human requester.
     */
    requestedBy:   string;
    reviewPolicy?: ReviewPolicy;
    status:        ChangeRequestStatus;
    statusReason?: string;
    /**
     * Changes of the active revision whose field was published with another value after the
     * request was submitted. They leave the review and are not published; the requester can
     * propose them again.
     */
    superseded?:          ChangeRef[];
    taskId?:              string;
    updatedAt:            number;
    workflowDefinitionId: string;
}

/**
 * Populated on read only; never persisted in the request row.
 *
 * Immutable content of one revision of a change request.
 */
export interface ChangeRevision {
    /**
     * Entity version the ops were computed against.
     */
    baseEntityVersion?: number;
    changeRequestId:    string;
    createdAt:          number;
    createdBy:          string;
    /**
     * SHA-256 of the canonical ops.
     */
    digest:         string;
    id:             string;
    ops:            MutationOp[];
    revisionNumber: number;
    status:         ChangeRevisionStatus;
}

/**
 * One normalized operation of a proposed metadata change, recorded with the published value
 * it was computed against.
 */
export interface MutationOp {
    /**
     * JSON of the published field value this op was computed against. Set ops only.
     */
    baseValue?: string;
    /**
     * Top-level entity field name.
     */
    field: string;
    /**
     * True when an approval workflow gates this field; false for a field carried along in a
     * staged request.
     */
    gated?: boolean;
    /**
     * Element identity for add/remove: the string value itself, a tag FQN, a related glossary
     * term with its relation type, an external reference endpoint with its name, or an entity
     * reference id.
     */
    key?: string;
    op:   MutationOpType;
    /**
     * Reported with the active revision of a change request; not stored with the revision.
     */
    outcome?: ChangeOutcome;
    /**
     * JSON of the proposed field value (set) or of the element being added/removed.
     */
    value?: string;
}

/**
 * set replaces a top-level field value; add and remove change one element of a list field
 * identified by key.
 */
export enum MutationOpType {
    Add = "add",
    Remove = "remove",
    Set = "set",
}

/**
 * Reported with the active revision of a change request; not stored with the revision.
 *
 * Where one change of the active revision stands: published, dropped by its reviewers,
 * published by another change, not published because its reviewers could not agree,
 * superseded by a newer published value of its field, or still waiting for a decision.
 */
export enum ChangeOutcome {
    AlreadyPublished = "AlreadyPublished",
    Applied = "Applied",
    NotAgreed = "NotAgreed",
    Pending = "Pending",
    Rejected = "Rejected",
    Superseded = "Superseded",
}

export enum ChangeRevisionStatus {
    Active = "Active",
    Superseded = "Superseded",
}

/**
 * One change of a revision, identified like its mutation op: the field and, for an added or
 * removed element, its key.
 */
export interface ChangeRef {
    field: string;
    key?:  string;
}

export interface ChangeConflict {
    baseValue?:     string;
    currentValue?:  string;
    field:          string;
    proposedValue?: string;
    reason?:        string;
}

/**
 * Operational state of handing the active revision to the review workflow. Never implies
 * publication.
 */
export enum DeliveryStatus {
    AttentionRequired = "AttentionRequired",
    Delivered = "Delivered",
    Delivering = "Delivering",
    Pending = "Pending",
}

export enum ChangeRequestOrigin {
    Explicit = "Explicit",
    Intercepted = "Intercepted",
}

/**
 * How the reviewing workflow's approval step decides the request: how many reviewers must
 * agree to approve or to reject a change, and whether changes can be decided one by one.
 */
export interface ReviewPolicy {
    approvalThreshold?:  number;
    partialDecisions?:   boolean;
    rejectionThreshold?: number;
}

export enum ChangeRequestStatus {
    Applied = "Applied",
    Approved = "Approved",
    Cancelled = "Cancelled",
    Conflicted = "Conflicted",
    Pending = "Pending",
    Rejected = "Rejected",
    Superseded = "Superseded",
    Withdrawn = "Withdrawn",
}
