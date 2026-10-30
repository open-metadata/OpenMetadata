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
 * The state of one ontology release review as seen by the calling user: the frozen approval
 * rule, each assignee entry with its vote, the latest decision, and whether the caller's
 * vote would decide the review.
 */
export interface OntologyReleaseReview {
    approvalRule: OntologyApprovalRule;
    assignees:    Assignee[];
    /**
     * True when the caller holds a pending assignee entry on an open review and is neither the
     * requester nor the author.
     */
    callerCanVote: boolean;
    /**
     * True when the caller can vote and an approval by the caller would complete the frozen
     * rule.
     */
    callerCompletesRule: boolean;
    latestDecision?:     Decision;
    ontology:            EntityReference;
    release:             EntityReference;
    /**
     * User who requested the review.
     */
    requester?: EntityReference;
    /**
     * The release's workflow status.
     */
    status: EntityStatus;
    /**
     * The approval task that decides this review.
     */
    task: EntityReference;
    /**
     * Human readable task identifier, such as TASK-00042.
     */
    taskId?: string;
}

/**
 * How many of an ontology's reviewers must approve a release review. AnyReviewer decides on
 * the first approval. AllReviewers waits for every reviewer entry; a reviewer team counts
 * once and any member covers it. Frozen into the review task when a review is requested.
 */
export enum OntologyApprovalRule {
    AllReviewers = "AllReviewers",
    AnyReviewer = "AnyReviewer",
}

/**
 * One assignee entry of the review task. A reviewer team is one entry, covered by any
 * member's vote.
 */
export interface Assignee {
    assignee: EntityReference;
    status:   AssigneeStatus;
    /**
     * The counted vote that covers this entry, when one exists.
     */
    vote?: TaskReviewVote;
}

/**
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Assignee entry the vote covers: the voter's own entry, or the team the voter votes
 * through.
 *
 * User who cast the vote.
 *
 * User who requested the review.
 *
 * The approval task that decides this review.
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

export enum AssigneeStatus {
    Approved = "Approved",
    Pending = "Pending",
    Rejected = "Rejected",
}

/**
 * The counted vote that covers this entry, when one exists.
 *
 * One counted vote on a multi-reviewer approval task. The server records it; clients cannot
 * set it.
 */
export interface TaskReviewVote {
    /**
     * Assignee entry the vote covers: the voter's own entry, or the team the voter votes
     * through.
     */
    assignee: EntityReference;
    /**
     * Comment given with the vote, kept verbatim.
     */
    comment?: string;
    decision: ReviewVoteDecision;
    /**
     * Workflow stage the task was in when the vote was counted. A voter is recorded once per
     * stage, so a task that moves through several approval stages keeps every stage's vote.
     */
    stage?: string;
    /**
     * When the vote was counted.
     */
    timestamp: number;
    /**
     * User who cast the vote.
     */
    voter: EntityReference;
}

/**
 * What a counted review vote decided.
 */
export enum ReviewVoteDecision {
    Approved = "Approved",
    Rejected = "Rejected",
}

/**
 * The vote that decided the review.
 */
export interface Decision {
    decision: ReviewVoteDecision;
    /**
     * The deciding reviewer's comment, verbatim.
     */
    reason?:   string;
    timestamp: number;
    user:      EntityReference;
}

/**
 * The release's workflow status.
 *
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
