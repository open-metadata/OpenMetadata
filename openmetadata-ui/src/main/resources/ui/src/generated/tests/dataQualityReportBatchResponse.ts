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
 * Response containing the results for a batch of data quality report aggregations.
 */
export interface DataQualityReportBatchResponse {
    /**
     * Results for each request. Match to requests by key; order is not guaranteed.
     */
    results: DataQualityReportResult[];
}

/**
 * Result for a single data quality report request in a batch.
 */
export interface DataQualityReportResult {
    /**
     * Error message. Present when the request failed.
     */
    error?: string;
    /**
     * Key used to correlate this result with its originating request.
     */
    key: string;
    /**
     * Aggregation result. Present when the request succeeded.
     */
    report?: DataQualityReport;
}

/**
 * Aggregation result. Present when the request succeeded.
 *
 * Data Quality report and aggregation model.
 */
export interface DataQualityReport {
    /**
     * Data for the data quality report.
     */
    data: { [key: string]: string }[];
    /**
     * Metadata for the data quality report.
     */
    metadata: DataQualityReportMetadata;
}

/**
 * Metadata for the data quality report.
 *
 * Schema to capture data quality reports and aggregation data.
 */
export interface DataQualityReportMetadata {
    /**
     * Dimensions to capture the data quality report.
     */
    dimensions?: string[];
    /**
     * Keys to identify the data quality report.
     */
    keys?: string[];
    /**
     * Metrics to capture the data quality report.
     */
    metrics?: string[];
    [property: string]: any;
}
