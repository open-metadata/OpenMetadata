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
 * An authenticated reviewer decision on one exact revision. Append-only.
 */
export interface ApprovalDecision {
    /**
     * Changes this decision approves. When both change lists are absent or empty, the decision
     * covers the whole revision.
     */
    approvedChanges?: ChangeRef[];
    changeRequestId:  string;
    comment?:         string;
    decidedAt:        number;
    decidedBy:        string;
    decision:         DecisionType;
    digest:           string;
    id:               string;
    /**
     * Changes this decision rejects, including omitted changes in a per-change review. When
     * both change lists are absent or empty, the decision covers the whole revision.
     */
    rejectedChanges?: ChangeRef[];
    revisionId:       string;
    revisionNumber:   number;
    taskId?:          string;
}

/**
 * One change of a revision, identified like its mutation op: the field and, for an added or
 * removed element, its key.
 */
export interface ChangeRef {
    field: string;
    key?:  string;
}

export enum DecisionType {
    Approve = "Approve",
    Override = "Override",
    Reject = "Reject",
}
