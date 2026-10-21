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
 * Per-input outcomes of a bulk create requested with an explicit onConflict policy.
 * Validation failures and conflicts are isolated to the affected inputs. Authentication,
 * malformed requests and unexpected server failures remain HTTP errors.
 */
export interface BulkCreateResult {
    createdCount: number;
    failedCount:  number;
    onConflict:   ConflictPolicy;
    /**
     * Exactly one outcome per input, in request order. Counts sum to the number of inputs.
     */
    results:      Item[];
    skippedCount: number;
}

/**
 * How to report existing FQNs and repeated FQNs in the request. Both policies continue
 * creating other valid inputs; neither updates existing entities. The first valid
 * occurrence of a new FQN wins.
 */
export enum ConflictPolicy {
    Fail = "fail",
    Skip = "skip",
}

/**
 * Outcome for one input, identified by its zero-based request index even when names are
 * repeated.
 */
export interface Item {
    fullyQualifiedName?: string;
    /**
     * ID of the newly created entity. Absent for skipped and failed inputs.
     */
    id?:   string;
    index: number;
    /**
     * Human-readable explanation of a skipped or failed input.
     */
    message?: string;
    /**
     * Stable reason code for a skipped or failed input. Absent for created inputs.
     */
    reason?: Reason;
    status:  Status;
}

/**
 * Stable reason code for a skipped or failed input. Absent for created inputs.
 */
export enum Reason {
    AlreadyExists = "ALREADY_EXISTS",
    DuplicateInRequest = "DUPLICATE_IN_REQUEST",
    ValidationError = "VALIDATION_ERROR",
}

export enum Status {
    Created = "created",
    Failed = "failed",
    Skipped = "skipped",
}
