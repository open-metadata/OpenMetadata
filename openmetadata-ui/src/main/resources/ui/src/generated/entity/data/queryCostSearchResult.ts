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
 * Query Cost Search Result
 */
export interface QueryCostSearchResult {
    /**
     * Overall statistics across all queries
     */
    overallStats: OverallStats;
    /**
     * List of query groups with their metrics
     */
    queryGroups: QueryGroup[];
    [property: string]: any;
}

/**
 * Overall statistics across all queries
 */
export interface OverallStats {
    /**
     * Average cost across all queries
     */
    avgCost: number;
    /**
     * Maximum cost among all queries
     */
    maxCost: number;
    /**
     * Minimum cost among all queries
     */
    minCost: number;
    /**
     * Total cost across all queries
     */
    totalCost: number;
    /**
     * Total number of query executions
     */
    totalExecutionCount: number;
    [property: string]: any;
}

export interface QueryGroup {
    /**
     * Average duration per query execution
     */
    avgDuration: number;
    /**
     * Additional query details
     */
    queryDetails: QueryDetails;
    /**
     * The text of the query
     */
    queryText: string;
    /**
     * Total cost of all query executions
     */
    totalCost: number;
    /**
     * Total number of query executions
     */
    totalCount: number;
    /**
     * Total duration of all query executions
     */
    totalDuration: number;
    /**
     * List of users who executed the query
     */
    users: string[];
    [property: string]: any;
}

/**
 * Additional query details
 *
 * Details about the query
 */
export interface QueryDetails {
    /**
     * Query information
     */
    query?: { [key: string]: any };
    [property: string]: any;
}
