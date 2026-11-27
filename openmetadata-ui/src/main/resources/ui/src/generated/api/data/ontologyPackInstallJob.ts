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
 * Background execution state of a library install into a native ontology. Progress counts
 * completed slices.
 */
export interface OntologyPackInstallJob {
    cancelRequested?: boolean;
    completedAt?:     number;
    createdAt:        number;
    createdBy:        string;
    error?:           string;
    id:               number;
    memberCount:      number;
    membersApplied:   number;
    message?:         string;
    moduleIds:        string[];
    ontologyId:       string;
    packId:           string;
    planDigest?:      string;
    /**
     * Slices applied.
     */
    progress: number;
    status:   Status;
    /**
     * Slices planned. Zero until the plan exists.
     */
    total:     number;
    updatedAt: number;
    version:   string;
}

export enum Status {
    Cancelled = "CANCELLED",
    Completed = "COMPLETED",
    Failed = "FAILED",
    Queued = "QUEUED",
    Running = "RUNNING",
}
