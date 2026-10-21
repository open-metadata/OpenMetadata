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
 * A committed publication of a revision's approved changes. A partly decided revision is
 * published in several applications, one per agreed set of changes.
 */
export interface ChangeApplication {
    appliedAt: number;
    /**
     * Attributed author of the published change (the requester).
     */
    appliedBy: string;
    /**
     * The changes of the revision this application published.
     */
    appliedOps?:     MutationOp[];
    changeRequestId: string;
    digest:          string;
    /**
     * Non-gated ops not applied because the field changed after submission (decision D9).
     */
    droppedOps?:             MutationOp[];
    id:                      string;
    resultingEntityVersion?: number;
    revisionId:              string;
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
