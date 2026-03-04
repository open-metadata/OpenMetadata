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
 * List of pipeline execution trends over a time period
 */
export interface PipelineExecutionTrendList {
    /**
     * List of execution trend data points
     */
    data: PipelineExecutionTrend[];
    /**
     * Indicates if data is available from Elasticsearch
     */
    dataAvailable: boolean;
    /**
     * End date of the trend period
     */
    endDate?: string;
    /**
     * Error message if data retrieval failed
     */
    errorMessage?: null | string;
    /**
     * Pagination information
     */
    paging?: Paging;
    /**
     * Start date of the trend period
     */
    startDate?: string;
    /**
     * Total executions in the period
     */
    totalExecutions?: number;
    /**
     * Total failed executions in the period
     */
    totalFailed?: number;
    /**
     * Total successful executions in the period
     */
    totalSuccessful?: number;
}

/**
 * Day-wise pipeline execution trend showing succeeded and failed counts
 */
export interface PipelineExecutionTrend {
    /**
     * Date in YYYY-MM-DD format
     */
    date: string;
    /**
     * Number of failed pipeline executions on this date
     */
    failedCount?: number;
    /**
     * Number of pending pipeline executions on this date
     */
    pendingCount?: number;
    /**
     * Number of running pipeline executions on this date
     */
    runningCount?: number;
    /**
     * Number of skipped pipeline executions on this date
     */
    skippedCount?: number;
    /**
     * Number of successful pipeline executions on this date
     */
    successCount?: number;
    /**
     * Timestamp for the execution date
     */
    timestamp: number;
    /**
     * Total number of pipeline executions on this date
     */
    totalCount: number;
}

/**
 * Pagination information
 *
 * Type used for cursor based pagination information in GET list responses.
 */
export interface Paging {
    /**
     * After cursor used for getting the next page (see API pagination for details).
     */
    after?: string;
    /**
     * Before cursor used for getting the previous page (see API pagination for details).
     */
    before?: string;
    /**
     * Limit used in case of offset based pagination.
     */
    limit?: number;
    /**
     * Offset used in case of offset based pagination.
     */
    offset?: number;
    /**
     * Total number of entries available to page through.
     */
    total: number;
}
