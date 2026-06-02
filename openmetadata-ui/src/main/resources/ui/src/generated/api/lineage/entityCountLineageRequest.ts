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
 * Request schema for getting lineage with entity count based pagination
 */
export interface EntityCountLineageRequest {
    /**
     * Filter lineage by specific column names. Use comma-separated list (e.g., 'col1,col2') to
     * filter columns.
     */
    columnFilter?: string;
    /**
     * Direction of lineage traversal (upstream or downstream)
     */
    direction: LineageDirection;
    /**
     * Maximum downstream depth to compute pagination info for when requested
     */
    downstreamDepth?: number;
    /**
     * Filter lineage edges by observed time window (epoch millis), inclusive upper bound;
     * matched via range overlap on edge createdAt/updatedAt. Set endTime alone (startTime
     * unset) for an as-of/point-in-time query: edges that existed on or before this instant.
     * See startTime for the hard-prune and preservePaths interaction notes.
     */
    endTime?: number;
    /**
     * Entity Fqn to search lineage
     */
    fqn: string;
    /**
     * Starting offset for pagination (0-based)
     */
    from?: number;
    /**
     * Include deleted entities
     */
    includeDeleted?: boolean;
    /**
     * Include pagination totals and depth counts in the response
     */
    includePaginationInfo?: boolean;
    /**
     * Include source fields
     */
    includeSourceFields?: string[];
    /**
     * Connected Via
     */
    isConnectedVia?: boolean;
    /**
     * Maximum depth to traverse in the specified direction
     */
    maxDepth?: number;
    /**
     * Filter entities by specific node depth level. Negative values for upstream (e.g., -1,
     * -2), positive for downstream (1, 2), 0 for root entity
     */
    nodeDepth?: number;
    /**
     * Preserve all paths when applying node-level filters. When true, intermediate nodes that
     * don't match filters are kept if they're part of a path to matching nodes.
     */
    preservePaths?: boolean;
    /**
     * Query Filter
     */
    queryFilter?: string;
    /**
     * Number of entities to return in this page
     */
    size?: number;
    /**
     * Filter lineage edges by observed time window (epoch millis), inclusive lower bound;
     * matched via range overlap on edge createdAt/updatedAt. Note: the window is applied as a
     * hard prune during graph traversal (point-in-time semantics) - an out-of-window edge
     * severs discovery of everything reachable only through it, in both upstream and downstream
     * directions. This means preservePaths does NOT extend to the time window: a node is shown
     * only if it is reachable from the root through edges that are all in-window. Legacy edges
     * with no timestamps always match any window (back-compat); a window query over mixed
     * legacy and temporal data therefore returns all legacy edges.
     */
    startTime?: number;
    /**
     * Maximum upstream depth to compute pagination info for when requested
     */
    upstreamDepth?: number;
}

/**
 * Direction of lineage traversal (upstream or downstream)
 *
 * Lineage Direction Schema.
 */
export enum LineageDirection {
    Downstream = "Downstream",
    Upstream = "Upstream",
}
