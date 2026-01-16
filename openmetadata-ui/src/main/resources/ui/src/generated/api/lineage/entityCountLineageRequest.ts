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
     * Direction of lineage traversal (upstream or downstream)
     */
    direction: LineageDirection;
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
     * Query Filter
     */
    queryFilter?: string;
    /**
     * Number of entities to return in this page
     */
    size?: number;
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
