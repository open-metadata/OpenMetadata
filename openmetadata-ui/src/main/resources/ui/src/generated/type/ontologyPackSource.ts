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
 * Verified library pack selection that a native ontology change set installs.
 */
export interface OntologyPackSource {
    /**
     * Selected modules with their dependencies, in catalogue order.
     */
    moduleIds: string[];
    packId:    string;
    /**
     * Set when a library install job cut the pack into change sets. Applying the change set
     * verifies its operations against the job's recorded plan.
     */
    slice?:  Slice;
    version: string;
}

/**
 * Set when a library install job cut the pack into change sets. Applying the change set
 * verifies its operations against the job's recorded plan.
 */
export interface Slice {
    /**
     * Number of slices in the plan.
     */
    count: number;
    /**
     * Zero-based position of this slice in the plan.
     */
    index: number;
    /**
     * Background job that planned this slice.
     */
    jobId: number;
    /**
     * SHA-256 of the plan's ordered slice digests.
     */
    planDigest: string;
}
