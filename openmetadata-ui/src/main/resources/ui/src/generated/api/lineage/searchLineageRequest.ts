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
 * Search Lineage Request Schema to find linage from Elastic Search.
 */
export interface SearchLineageRequest {
    direction: LineageDirection;
    /**
     * Lineage Direction Value.
     */
    directionValue?: string[];
    /**
     * The downstream depth of the lineage
     */
    downstreamDepth?: number;
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
     * Query Filter
     */
    queryFilter?: string;
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
