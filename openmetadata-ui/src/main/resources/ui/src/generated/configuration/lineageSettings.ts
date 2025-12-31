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
 * This schema defines the Lineage Settings.
 */
export interface LineageSettings {
    /**
     * DownStream Depth for Lineage.
     */
    downstreamDepth: number;
    /**
     * Performance configuration for lineage graph builder.
     */
    graphPerformanceConfig?: GraphPerformanceConfig;
    /**
     * Lineage Layer.
     */
    lineageLayer: LineageLayer;
    /**
     * Pipeline View Mode for Lineage.
     */
    pipelineViewMode: PipelineViewMode;
    /**
     * Upstream Depth for Lineage.
     */
    upstreamDepth: number;
}

/**
 * Performance configuration for lineage graph builder.
 *
 * Configuration for lineage graph performance and scalability
 */
export interface GraphPerformanceConfig {
    /**
     * Cache time-to-live in seconds
     */
    cacheTTLSeconds?: number;
    /**
     * Enable caching for small/medium graphs
     */
    enableCaching?: boolean;
    /**
     * Enable progress tracking for long-running queries
     */
    enableProgressTracking?: boolean;
    /**
     * Batch size for fetching large graph nodes
     */
    largeGraphBatchSize?: number;
    /**
     * Maximum number of graphs to cache
     */
    maxCachedGraphs?: number;
    /**
     * Maximum nodes to keep in memory before switching to streaming
     */
    maxInMemoryNodes?: number;
    /**
     * Batch size for fetching medium graph nodes
     */
    mediumGraphBatchSize?: number;
    /**
     * Node count threshold for medium graphs (optimized batching)
     */
    mediumGraphThreshold?: number;
    /**
     * Report progress every N nodes processed
     */
    progressReportInterval?: number;
    /**
     * Scroll context timeout in minutes
     */
    scrollTimeoutMinutes?: number;
    /**
     * Batch size for fetching small graph nodes from search backend
     */
    smallGraphBatchSize?: number;
    /**
     * Node count threshold for small graphs (eligible for caching)
     */
    smallGraphThreshold?: number;
    /**
     * Batch size for streaming very large graphs
     */
    streamingBatchSize?: number;
    /**
     * Use Elasticsearch/OpenSearch scroll API for large result sets
     */
    useScrollForLargeGraphs?: boolean;
}

/**
 * Lineage Layer.
 *
 * Lineage Layers
 */
export enum LineageLayer {
    ColumnLevelLineage = "ColumnLevelLineage",
    DataObservability = "DataObservability",
    EntityLineage = "EntityLineage",
}

/**
 * Pipeline View Mode for Lineage.
 *
 * Determines the view mode for pipelines in lineage.
 */
export enum PipelineViewMode {
    Edge = "Edge",
    Node = "Node",
}
