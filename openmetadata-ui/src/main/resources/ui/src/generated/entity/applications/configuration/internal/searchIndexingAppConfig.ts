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
 * Search Indexing App.
 */
export interface SearchIndexingAppConfig {
    /**
     * Enable automatic performance tuning based on cluster capabilities and database entity
     * count
     */
    autoTune?: boolean;
    /**
     * Maximum number of events sent in a batch (Default 100).
     */
    batchSize?: number;
    /**
     * Overrides applied to staged indexes during bulk reindex. Reverted to liveIndexSettings
     * before alias swap. Nothing reads from staged indexes, so refresh=-1 and replicas=0 are
     * safe. Defaults: refresh=-1, replicas=0, durability=async, syncInterval=30s,
     * forceMergeOnPromote=false.
     */
    bulkIndexSettings?: BulkIndexOverrides;
    /**
     * Number of threads to use for reindexing
     */
    consumerThreads?: number;
    /**
     * List of Entities to Reindex
     */
    entities?: string[];
    /**
     * Initial backoff time in milliseconds
     */
    initialBackoff?: number;
    /**
     * Settings applied to staged indexes before alias swap (live serving values). Tune for read
     * freshness and HA. Defaults: refresh=1s (near-real-time, required if users/agents
     * read-after-write), replicas=1, shards=1, durability=request.
     */
    liveIndexSettings?: IndexSettings;
    /**
     * Override liveIndexSettings for specific entity types. Useful for large or specialized
     * entities (e.g. 'container' on instances with 500k+ assets, 'queryCostRecord' for
     * high-cardinality time series). Keys are entity type names; values override the global
     * liveIndexSettings.
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
     * Number of entities per partition for distributed indexing. Smaller values create more
     * partitions for better distribution across servers. Range: 1000-50000.
     */
    partitionSize?: number;
    /**
     * Maximum number of events sent in a batch (Default 100).
     */
    payLoadSize?: number;
    /**
     * Number of threads to use for reindexing
     */
    producerThreads?: number;
    /**
     * Queue Size to user internally for reindexing.
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
     * Per-entity-type override for time series max days. Keys are entity type names (e.g.
     * testCaseResult, queryCostRecord), values are number of days. Entities not listed here use
     * the default Time Series Max Days value.
     */
    timeSeriesEntityDays?: { [key: string]: number };
    /**
     * Maximum age in days for time series data during reindexing. Default 0 (index all data).
     * Set to a positive value like 15 to limit to recent data only.
     */
    timeSeriesMaxDays?: number;
    /**
     * Application Type
     */
    type?: SearchIndexingType;
    /**
     * Enable distributed indexing to scale reindexing across multiple servers with fault
     * tolerance and parallel processing
     */
    useDistributedIndexing?: boolean;
}

/**
 * Overrides applied to staged indexes during bulk reindex. Reverted to liveIndexSettings
 * before alias swap. Nothing reads from staged indexes, so refresh=-1 and replicas=0 are
 * safe. Defaults: refresh=-1, replicas=0, durability=async, syncInterval=30s,
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
 * Settings applied to staged indexes before alias swap (live serving values). Tune for read
 * freshness and HA. Defaults: refresh=1s (near-real-time, required if users/agents
 * read-after-write), replicas=1, shards=1, durability=request.
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

/**
 * Application Type
 *
 * Application type.
 */
export enum SearchIndexingType {
    SearchIndexing = "SearchIndexing",
}
