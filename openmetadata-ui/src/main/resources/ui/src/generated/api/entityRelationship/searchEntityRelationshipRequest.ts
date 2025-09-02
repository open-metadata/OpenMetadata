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
 * Search Entity Relationship Request Schema to find entity relationships from Elastic
 * Search.
 */
export interface SearchEntityRelationshipRequest {
    direction: EntityRelationshipDirection;
    /**
     * Entity Relationship Direction Value.
     */
    directionValue?: string[];
    /**
     * The downstream depth of the entity relationship
     */
    downstreamDepth?: number;
    /**
     * Entity Fqn to search entity relationships
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
     * The upstream depth of the entity relationship
     */
    upstreamDepth?: number;
}

/**
 * Entity Relationship Direction Schema.
 */
export enum EntityRelationshipDirection {
    Downstream = "Downstream",
    Upstream = "Upstream",
}
