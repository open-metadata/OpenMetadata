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
 * Pagination information for lineage entities across different layers and depths
 */
export interface LineagePaginationInfo {
    /**
     * Depth-wise breakdown of downstream entities
     */
    downstreamDepthInfo: DepthInfo[];
    /**
     * Maximum depth reached in downstream direction
     */
    maxDownstreamDepth: number;
    /**
     * Maximum depth reached in upstream direction
     */
    maxUpstreamDepth: number;
    /**
     * Total number of downstream entities across all depths
     */
    totalDownstreamEntities: number;
    /**
     * Total number of upstream entities across all depths
     */
    totalUpstreamEntities: number;
    /**
     * Depth-wise breakdown of upstream entities
     */
    upstreamDepthInfo: DepthInfo[];
}

/**
 * Information about entities at a specific depth level
 */
export interface DepthInfo {
    /**
     * The depth level from root entity (0 for root, 1 for immediate upstream/downstream, etc.)
     */
    depth: number;
    /**
     * Total number of entities at this depth level
     */
    entityCount: number;
}
