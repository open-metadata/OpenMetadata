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
 * Search Lineage Request Schema to find linage from Elastic Search.
 */
export interface SearchLineageRequest {
    /**
     * Column-level lineage filter. Supports filtering by column names in fromColumns or
     * toColumn fields.
     */
    columnFilter?: string;
    direction:     LineageDirection;
    /**
     * Lineage Direction Value.
     */
    directionValue?: string[];
    /**
     * The downstream depth of the lineage
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
     * Include deleted entities
     */
    includeDeleted?: boolean;
    /**
     * Include source fields
     */
    includeSourceFields?: string[];
    /**
     * Connected Via
     */
    isConnectedVia?: boolean;
    /**
     * Layer to start the search from.
     */
    layerFrom?: number;
    /**
     * Size of the search result.
     */
    layerSize?: number;
    /**
     * When true, preserves all nodes in the path to filtered results. When false, only returns
     * nodes matching the filter.
     */
    preservePaths?: boolean;
    /**
     * Query Filter
     */
    queryFilter?: string;
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
     * The upstream depth of the lineage
     */
    upstreamDepth?: number;
}

/**
 * Lineage Direction Schema.
 */
export enum LineageDirection {
    Downstream = "Downstream",
    Upstream = "Upstream",
}
