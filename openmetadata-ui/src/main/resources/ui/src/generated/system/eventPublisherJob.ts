/*
 *  Copyright 2025 Collate.
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
 * This schema defines Event Publisher Job.
 */
export interface EventPublisherJob {
    /**
     * Provide After in case of failure to start reindexing after the issue is solved
     */
    afterCursor?: string;
    /**
     * Enable automatic performance tuning based on cluster capabilities and database entity
     * count
     */
    autoTune?: boolean;
    /**
     * Maximum number of events sent in a batch (Default 10).
     */
    batchSize?: number;
    /**
     * Number of consumer threads to use for reindexing
     */
    consumerThreads?: number;
    /**
     * List of Entities to Reindex
     */
    entities?: string[];
    /**
     * Failure for the job
     */
    failure?: IndexingAppError;
    /**
     * Force reindexing even if no index mapping changes are detected
     */
    force?: boolean;
    /**
     * Initial backoff time in milliseconds
     */
    initialBackoff?: number;
    /**
     * Maximum backoff time in milliseconds
     */
    maxBackoff?: number;
    /**
     * Maximum number of concurrent requests to the search index
     */
    maxConcurrentRequests?: number;
    /**
     * Maximum number of retries for a failed request
     */
    maxRetries?: number;
    /**
     * Name of the result
     */
    name?: string;
    /**
     * Payload size in bytes depending on config.
     */
    payLoadSize?: number;
    /**
     * Number of producer threads to use for reindexing
     */
    producerThreads?: number;
    /**
     * Queue Size to use internally for reindexing.
     */
    queueSize?: number;
    /**
     * This schema publisher run modes.
     */
    recreateIndex?: boolean;
    /**
     * Recreate Indexes with updated Language
     */
    searchIndexMappingLanguage?: SearchIndexMappingLanguage;
    /**
     * Optional Slack bot token for sending progress notifications with real-time updates
     */
    slackBotToken?: string;
    /**
     * Slack channel ID or name (required when using bot token, e.g., 'C1234567890' or
     * '#general')
     */
    slackChannel?: string;
    stats?:        Stats;
    /**
     * This schema publisher run job status.
     */
    status?:    Status;
    timestamp?: number;
}

/**
 * Failure for the job
 *
 * This schema defines Event Publisher Job Error Schema. Additional properties exist for
 * backward compatibility. Don't use it.
 */
export interface IndexingAppError {
    errorSource?:      ErrorSource;
    failedCount?:      number;
    failedEntities?:   EntityError[];
    lastFailedCursor?: string;
    message?:          string;
    reason?:           string;
    stackTrace?:       string;
    submittedCount?:   number;
    successCount?:     number;
    [property: string]: any;
}

export enum ErrorSource {
    Job = "Job",
    Processor = "Processor",
    Reader = "Reader",
    Sink = "Sink",
}

/**
 * Entity And Message Scehma in case of failures.
 */
export interface EntityError {
    entity?:  any;
    message?: string;
}

/**
 * Recreate Indexes with updated Language
 *
 * This schema defines the language options available for search index mappings.
 */
export enum SearchIndexMappingLanguage {
    En = "EN",
    Jp = "JP",
    Ru = "RU",
    Zh = "ZH",
}

export interface Stats {
    /**
     * Stats for different entities. Keys should match entity types
     */
    entityStats?: { [key: string]: StepStats };
    /**
     * Stats for the job
     */
    jobStats?: StepStats;
}

/**
 * Stats for Different Steps Reader, Processor, Writer.
 *
 * Stats for the job
 */
export interface StepStats {
    /**
     * Count of Total Failed Records
     */
    failedRecords?: number;
    /**
     * Count of Total Successfully Records
     */
    successRecords?: number;
    /**
     * Count of Total Failed Records
     */
    totalRecords?: number;
}

/**
 * This schema publisher run job status.
 */
export enum Status {
    Active = "active",
    ActiveError = "activeError",
    Completed = "completed",
    Failed = "failed",
    Running = "running",
    Started = "started",
    StopInProgress = "stopInProgress",
    Stopped = "stopped",
    Success = "success",
}
