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
 * How one approval step of a workflow run was decided: by the people who voted, by the
 * workflow itself when it had no one to ask, or by an administrator who published without
 * review. A run keeps its decisions in its variables under 'approvals'.
 */
export interface ApprovalOutcome {
    /**
     * Why the workflow approved the step itself. Absent when people decided it.
     */
    automaticReason?: AutomaticReason;
    /**
     * Timestamp on which the step was decided.
     */
    decidedAt: number;
    /**
     * Names of the users whose votes decided the step, or the administrator who overrode it.
     * Empty when the workflow decided it.
     */
    decidedBy?: string[];
    /**
     * What the step decided. PartiallyApproved: reviewers published some of a change request's
     * changes and dropped the rest. Overridden: an administrator published the change without
     * review.
     */
    decision: Decision;
    /**
     * Unique identifier of this decision.
     */
    id: string;
    /**
     * Name of the approval node that was decided.
     */
    node: string;
}

/**
 * Why the workflow approved the step itself. Absent when people decided it.
 */
export enum AutomaticReason {
    NoAssignees = "NoAssignees",
    SubmitterIsReviewer = "SubmitterIsReviewer",
}

/**
 * What the step decided. PartiallyApproved: reviewers published some of a change request's
 * changes and dropped the rest. Overridden: an administrator published the change without
 * review.
 */
export enum Decision {
    Approved = "Approved",
    Overridden = "Overridden",
    PartiallyApproved = "PartiallyApproved",
    Rejected = "Rejected",
}
