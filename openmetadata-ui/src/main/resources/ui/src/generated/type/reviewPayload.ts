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
 * Payload for Review tasks (Pipeline Review, Data Quality Review).
 */
export interface ReviewPayload {
    /**
     * Supporting documents or evidence.
     */
    attachments?: ReviewAttachment[];
    /**
     * Review findings and observations.
     */
    findings?: string;
    /**
     * Reviewer's recommendation.
     */
    recommendation?: Recommendation;
    /**
     * Criteria to be reviewed.
     */
    reviewCriteria?: ReviewCriterion[];
    /**
     * Type of review.
     */
    reviewType: ReviewType;
}

/**
 * An attachment for a review.
 */
export interface ReviewAttachment {
    /**
     * Description of the attachment.
     */
    description?: string;
    /**
     * Name of the attachment.
     */
    name?: string;
    /**
     * URL to the attachment.
     */
    url?: string;
}

/**
 * Reviewer's recommendation.
 */
export enum Recommendation {
    Approve = "Approve",
    Defer = "Defer",
    NeedsWork = "NeedsWork",
    Reject = "Reject",
}

/**
 * A single review criterion with status.
 */
export interface ReviewCriterion {
    /**
     * Name of the criterion.
     */
    criterion?: string;
    /**
     * Notes about this criterion.
     */
    notes?: string;
    /**
     * Status of this criterion.
     */
    status?: Status;
}

/**
 * Status of this criterion.
 */
export enum Status {
    Failed = "Failed",
    NotApplicable = "NotApplicable",
    Passed = "Passed",
    Pending = "Pending",
}

/**
 * Type of review.
 */
export enum ReviewType {
    Custom = "Custom",
    DataQuality = "DataQuality",
    Documentation = "Documentation",
    Pipeline = "Pipeline",
    Schema = "Schema",
    Security = "Security",
}
