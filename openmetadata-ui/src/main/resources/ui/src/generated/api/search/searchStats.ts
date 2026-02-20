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
 * Response containing search cluster statistics and index details.
 */
export interface SearchStats {
    /**
     * Health status of the search cluster (GREEN, YELLOW, RED).
     */
    clusterHealth?: string;
    /**
     * List of index details.
     */
    indexes?: IndexStats[];
    /**
     * Indicates if search indexing job is currently running. Orphan cleanup is not allowed
     * while indexing is in progress.
     */
    isSearchIndexingRunning?: boolean;
    /**
     * List of orphan indexes (indexes with zero aliases).
     */
    orphanIndexes?: OrphanIndex[];
    /**
     * Total number of documents across all indexes.
     */
    totalDocuments?: number;
    /**
     * Total number of indexes in the cluster.
     */
    totalIndexes?: number;
    /**
     * Total number of primary shards.
     */
    totalPrimaryShards?: number;
    /**
     * Total number of replica shards.
     */
    totalReplicaShards?: number;
    /**
     * Human-readable total storage size.
     */
    totalSizeFormatted?: string;
    /**
     * Total storage size in bytes.
     */
    totalSizeInBytes?: number;
}

export interface IndexStats {
    /**
     * List of aliases pointing to this index.
     */
    aliases?: string[];
    /**
     * Number of documents in the index.
     */
    documents?: number;
    /**
     * Index health status.
     */
    health?: string;
    /**
     * Index name.
     */
    name?: string;
    /**
     * Number of primary shards.
     */
    primaryShards?: number;
    /**
     * Number of replica shards.
     */
    replicaShards?: number;
    /**
     * Human-readable index size.
     */
    sizeFormatted?: string;
    /**
     * Index size in bytes.
     */
    sizeInBytes?: number;
    [property: string]: any;
}

export interface OrphanIndex {
    /**
     * Orphan index name.
     */
    name?: string;
    /**
     * Human-readable index size.
     */
    sizeFormatted?: string;
    /**
     * Index size in bytes.
     */
    sizeInBytes?: number;
    [property: string]: any;
}
