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
 * Response from OpenLineage event processing.
 */
export interface OpenLineageResponse {
    /**
     * Details about failed events (for batch requests).
     */
    failedEvents?: FailedEvent[];
    /**
     * Number of lineage edges created.
     */
    lineageEdgesCreated?: number;
    /**
     * Human-readable message about the processing result.
     */
    message?: string;
    /**
     * Overall status of the request.
     */
    status: Status;
    /**
     * Summary of batch processing (for batch requests).
     */
    summary?: ProcessingSummary;
    /**
     * Datasets that could not be resolved to, or created as, OpenMetadata entities. No edge
     * touching them was created.
     */
    unresolvedDatasets?: UnresolvedEntity[];
    /**
     * Jobs with no matching OpenMetadata Pipeline. Their edges were created without a pipeline
     * reference.
     */
    unresolvedJobs?: UnresolvedEntity[];
}

/**
 * Information about a failed event in batch processing.
 */
export interface FailedEvent {
    /**
     * Index of the failed event in the batch.
     */
    index: number;
    /**
     * Reason for the failure.
     */
    reason: string;
    /**
     * Whether the event can be retried.
     */
    retriable?: boolean;
    [property: string]: any;
}

/**
 * Overall status of the request.
 */
export enum Status {
    Failure = "failure",
    PartialSuccess = "partial_success",
    Success = "success",
}

/**
 * Summary of batch processing (for batch requests).
 *
 * Summary of batch processing results.
 */
export interface ProcessingSummary {
    /**
     * Number of events that failed processing.
     */
    failed?: number;
    /**
     * Number of events that created lineage edges but left some datasets unresolved.
     */
    partial?: number;
    /**
     * Total number of events received.
     */
    received?: number;
    /**
     * Number of events skipped (e.g., non-COMPLETE events).
     */
    skipped?: number;
    /**
     * Number of events processed successfully.
     */
    successful?: number;
    [property: string]: any;
}

/**
 * An OpenLineage dataset or job that could not be resolved to an OpenMetadata entity.
 */
export interface UnresolvedEntity {
    /**
     * Index of the event in a batch request. Not set for a single-event request.
     */
    eventIndex?: number;
    /**
     * Human-readable detail about why it could not be resolved.
     */
    message?: string;
    /**
     * OpenLineage name of the dataset or job.
     */
    name: string;
    /**
     * OpenLineage namespace of the dataset or job.
     */
    namespace: string;
    reason:    UnresolvedReason;
}

/**
 * Why an OpenLineage dataset or job could not be resolved to an OpenMetadata entity.
 */
export enum UnresolvedReason {
    CreationDisabled = "creationDisabled",
    InvalidEntity = "invalidEntity",
    MissingColumns = "missingColumns",
    MissingDatabase = "missingDatabase",
    NamespaceNotMapped = "namespaceNotMapped",
    NotFound = "notFound",
    PipelineNotFound = "pipelineNotFound",
    ServiceNotFound = "serviceNotFound",
    UnparsableName = "unparsableName",
}
