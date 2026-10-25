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
 * Publication state of an ontology. The server derives it on read from the ontology state,
 * its sealed releases and its working content. It is never stored and clients cannot set it.
 */
export interface OntologyPublicationStatus {
    active?: ActiveRelease;
    latest?: LatestRelease;
    /**
     * Number of rows that paging through GET /v1/ontologies/{id}/working/diff returns: added,
     * changed and removed members of the working ontology against the active release. Without
     * an active release, every working member counts as added.
     */
    unpublishedChanges: number;
}

/**
 * The release the ontology currently publishes.
 */
export interface ActiveRelease {
    /**
     * Time of the activation that made this release current.
     */
    activatedAt?:    number;
    releaseId:       string;
    releaseRevision: number;
    /**
     * Semantic version of the release. Absent on releases captured without a version bump.
     */
    semanticVersion?: string;
}

/**
 * The newest sealed release, whatever its stage.
 */
export interface LatestRelease {
    releaseId:        string;
    releaseRevision:  number;
    semanticVersion?: string;
    stage:            Stage;
}

/**
 * Stage of the latest sealed release. Draft and InReview mirror the release status.
 * ChangesRequested is a rejected release. Approved is an approved release that is not
 * active. Published is an approved release that is active.
 */
export enum Stage {
    Approved = "Approved",
    ChangesRequested = "ChangesRequested",
    Draft = "Draft",
    InReview = "InReview",
    Published = "Published",
}
