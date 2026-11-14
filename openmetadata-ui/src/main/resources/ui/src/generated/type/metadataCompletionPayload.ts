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
 * Payload for Metadata Completion tasks: what an asset still needs before its lifecycle
 * workflow lets it leave the current stage
 * (ADR:2026-10-15-a-lifecycle-stage-asks-for-its-missing-metadata-in-one-task). Only the
 * server writes it.
 */
export interface MetadataCompletionPayload {
    /**
     * False while the stage's lifecycle conditions are not met.
     */
    conditionsMet?: boolean;
    /**
     * Paths of the required fields that are still empty, in the order the stage lists them.
     */
    missingFields: string[];
    /**
     * Name of the node in that workflow that lists the required fields.
     */
    node: string;
    /**
     * Present on a Revise and resubmit task: the stage's approval was rejected and the asset is
     * to be revised
     * (ADR:2026-10-21-a-rejected-lifecycle-approval-asks-for-a-revision-and-the-next-edit-resubmits-it).
     */
    revision?: Revision;
    /**
     * Stage the asset has to be in for the task to apply.
     */
    stage: EntityStatus;
    /**
     * Stage the asset moves to once the fields are filled in and any approval passes.
     */
    targetStage?: EntityStatus;
    /**
     * Name of the workflow definition whose stage asks for the fields.
     */
    workflow: string;
}

/**
 * Present on a Revise and resubmit task: the stage's approval was rejected and the asset is
 * to be revised
 * (ADR:2026-10-21-a-rejected-lifecycle-approval-asks-for-a-revision-and-the-next-edit-resubmits-it).
 */
export interface Revision {
    /**
     * What the reviewer asked to change, when they left a comment.
     */
    comment?: string;
    /**
     * Name of the user who rejected the approval.
     */
    requestedBy?: string;
}

/**
 * Stage the asset has to be in for the task to apply.
 *
 * General lifecycle stage for entities that reference this vocabulary. Specialized entities
 * can declare their own status schema and lifecycle policy. Entity types without an
 * entityStatus property have no lifecycle. When a create request omits the stage, the
 * server assigns the entity type's initial stage.
 *
 * Stage the asset moves to once the fields are filled in and any approval passes.
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
