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
 * Request to run multiple data quality report aggregations in a single call.
 */
export interface DataQualityReportBatchRequest {
    /**
     * List of data quality report aggregations to execute concurrently.
     */
    requests: DataQualityReportRequest[];
}

/**
 * A single data quality report aggregation to execute as part of a batch.
 */
export interface DataQualityReportRequest {
    /**
     * Aggregation query to perform aggregation on the search results.
     */
    aggregationQuery: string;
    /**
     * Filter by domain fully qualified name.
     */
    domain?: string;
    /**
     * Index to perform the aggregation against.
     */
    index: string;
    /**
     * Key used to correlate this request with its result in the response.
     */
    key: string;
    /**
     * Search query to filter the aggregation results.
     */
    q?: string;
}
