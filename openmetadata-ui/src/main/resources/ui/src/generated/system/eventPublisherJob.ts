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
     * Override settings applied to staged indexes during bulk reindex. Unset fields fall back
     * to: replicas=0, refresh=-1, translog durability=async, translog sync=30s,
     * forceMergeOnPromote=false.
     */
    bulkIndexSettings?: BulkIndexOverrides;
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
     * Index settings applied to staged indexes before alias swap (live serving values). Unset
     * fields fall back to OS/ES defaults: shards=1, replicas=1, refresh=1s, translog
     * durability=request.
     */
    liveIndexSettings?: IndexSettings;
    /**
     * Override liveIndexSettings for specific entity types. Useful for very large or
     * specialized entities. Keys are entity type names (e.g. 'container', 'table').
     */
    liveIndexSettingsByEntity?: { [key: string]: IndexSettings };
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
     * Number of entities per partition for distributed indexing. Smaller values create more
     * partitions for better distribution across servers. Range: 1000-50000.
     */
    partitionSize?: number;
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
    status?: Status;
    /**
     * Per-entity-type override for time series max days. Keys are entity type names, values are
     * number of days. Entities not in this map use timeSeriesMaxDays as default.
     */
    timeSeriesEntityDays?: { [key: string]: number };
    /**
     * Maximum age in days for time series data during reindexing. Only records from the last N
     * days will be indexed. Default 0 (index all data). Set to a positive value like 15 to
     * limit to recent data.
     */
    timeSeriesMaxDays?: number;
    timestamp?:         number;
    /**
     * Enable distributed indexing across multiple servers. When enabled, reindexing work is
     * partitioned and can be processed by multiple servers concurrently with crash recovery
     * support.
     */
    useDistributedIndexing?: boolean;
}

/**
 * Override settings applied to staged indexes during bulk reindex. Unset fields fall back
 * to: replicas=0, refresh=-1, translog durability=async, translog sync=30s,
 * forceMergeOnPromote=false.
 *
 * Overrides applied to a staged index DURING bulk reindex for write throughput. Reverted to
 * indexSettings before alias swap. Nothing reads from the staged index, so refresh=-1 and
 * replicas=0 are safe here.
 */
export interface BulkIndexOverrides {
    /**
     * Run _forcemerge to 1 segment before swapping the alias. Improves post-reindex query
     * performance at the cost of build time.
     */
    forceMergeOnPromote?:  boolean;
    numberOfReplicas?:     number;
    refreshInterval?:      string;
    translogDurability?:   TranslogDurability;
    translogSyncInterval?: string;
}

/**
 * 'request' = fsync per write (durable). 'async' = fsync on interval (faster, can lose
 * <syncInterval seconds on crash).
 */
export enum TranslogDurability {
    Async = "async",
    Request = "request",
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
 * Index settings applied to staged indexes before alias swap (live serving values). Unset
 * fields fall back to OS/ES defaults: shards=1, replicas=1, refresh=1s, translog
 * durability=request.
 *
 * Index settings applied to live (post-promote) search indexes. Tune for read freshness,
 * durability, and HA. These do not affect bulk reindex throughput; bulkIndexOverrides
 * controls that.
 */
export interface IndexSettings {
    /**
     * Replica shard count. 1 for HA on multi-node clusters; 0 for single-node.
     */
    numberOfReplicas?: number;
    /**
     * Primary shard count. Cannot be changed after creation. Aim for 10-50 GB per shard; 1 is
     * correct for most OpenMetadata indexes.
     */
    numberOfShards?: number;
    /**
     * How often new writes become searchable. '1s' = near-real-time (default; required if
     * users/agents read-after-write). Higher values reduce CPU/segment churn but delay search
     * visibility.
     */
    refreshInterval?: string;
    /**
     * 'request' = fsync per write (durable). 'async' = fsync on interval (faster, can lose
     * <syncInterval seconds on crash).
     */
    translogDurability?: TranslogDurability;
    /**
     * Translog fsync cadence when durability=async. Ignored when durability=request.
     */
    translogSyncInterval?: string;
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
    /**
     * Stats for the process step (building search index documents)
     */
    processStats?: StepStats;
    /**
     * Stats for the reader step (reading from database)
     */
    readerStats?: StepStats;
    /**
     * Stats for the sink step (writing to search index)
     */
    sinkStats?: StepStats;
    /**
     * Stats for the vector step (generating and indexing vector embeddings)
     */
    vectorStats?: StepStats;
}

/**
 * Stats for Different Steps Reader, Processor, Writer.
 *
 * Stats for the job
 *
 * Stats for the process step (building search index documents)
 *
 * Stats for the reader step (reading from database)
 *
 * Stats for the sink step (writing to search index)
 *
 * Stats for the vector step (generating and indexing vector embeddings)
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
    /**
     * Cumulative time (ms) spent in this stage. UI computes avg latency = totalTimeMs /
     * successRecords and throughput = successRecords / (totalTimeMs / 1000).
     */
    totalTimeMs?: number;
    /**
     * Count of records with failed vector embeddings
     */
    vectorFailedRecords?: number;
    /**
     * Count of records with successful vector embeddings
     */
    vectorSuccessRecords?: number;
    /**
     * Count of Records with Warnings (e.g., stale references that were skipped)
     */
    warningRecords?: number;
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
