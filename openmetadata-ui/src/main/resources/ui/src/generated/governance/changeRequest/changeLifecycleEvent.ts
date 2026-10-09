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
 * One recorded step in a change request's life: submission, revision, approval, publication
 * or an ending.
 */
export interface ChangeLifecycleEvent {
    /**
     * User who caused the step; absent for steps taken by the system.
     */
    actor?:          string;
    changeRequestId: string;
    eventType:       LifecycleEventType;
    fromStatus?:     ChangeRequestStatus;
    id:              string;
    reason?:         string;
    revisionNumber?: number;
    /**
     * Position of this event in the request's history, starting at 1.
     */
    sequence:  number;
    timestamp: number;
    toStatus:  ChangeRequestStatus;
}

export enum LifecycleEventType {
    Applied = "Applied",
    Approved = "Approved",
    Cancelled = "Cancelled",
    Conflicted = "Conflicted",
    Overridden = "Overridden",
    PartiallyApplied = "PartiallyApplied",
    Rejected = "Rejected",
    Revised = "Revised",
    Submitted = "Submitted",
    Superseded = "Superseded",
    Withdrawn = "Withdrawn",
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
