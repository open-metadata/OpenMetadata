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
 * Aggregated data for Cost Analysis Report.
 */
export interface AggregatedCostAnalysisReportData {
    /**
     * Type of the entity
     */
    entityType?: string;
    /**
     * Count and Size of the frequently used Data Assets over a period of time
     */
    frequentlyUsedDataAssets?: DataAssetMetrics;
    /**
     * Name of the service
     */
    serviceName?: string;
    /**
     * Name of the service owner
     */
    serviceOwner?: string;
    /**
     * Type of the service
     */
    serviceType?: string;
    /**
     * Total Count
     */
    totalCount?: number;
    /**
     * Total Size based in Bytes
     */
    totalSize?: number;
    /**
     * Count and Size of the unused Data Assets over a period of time
     */
    unusedDataAssets?: DataAssetMetrics;
}

/**
 * Count and Size of the frequently used Data Assets over a period of time
 *
 * Store the Count and Size in bytes of the Data Assets over a time period
 *
 * Count and Size of the unused Data Assets over a period of time
 */
export interface DataAssetMetrics {
    /**
     * Count of the Data Assets over a period of time
     */
    count?: DataAssetValues;
    /**
     * Size of the Data Assets over a period of time
     */
    size?: DataAssetValues;
    /**
     * Total Count
     */
    totalCount?: number;
    /**
     * Total Size based in Bytes
     */
    totalSize?: number;
    [property: string]: any;
}

/**
 * Count of the Data Assets over a period of time
 *
 * Count or Size in bytes of Data Assets over a time period
 *
 * Size of the Data Assets over a period of time
 */
export interface DataAssetValues {
    /**
     * Data Asset Count or Size for 14 days
     */
    fourteenDays?: number | null;
    /**
     * Data Asset Count or Size for 7 days
     */
    sevenDays?: number | null;
    /**
     * Data Asset Count or Size for 60 days
     */
    sixtyDays?: number | null;
    /**
     * Data Asset Count or Size for 30 days
     */
    thirtyDays?: number | null;
    /**
     * Data Asset Count or Size for 3 days
     */
    threeDays?: number | null;
}
