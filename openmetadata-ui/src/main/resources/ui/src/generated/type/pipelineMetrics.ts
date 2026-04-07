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
 * Aggregated metrics about pipelines
 */
export interface PipelineMetrics {
    /**
     * Count of active pipelines
     */
    activePipelines?: number;
    /**
     * Indicates if Elasticsearch data is available
     */
    dataAvailable: boolean;
    /**
     * Error message if metrics retrieval failed
     */
    errorMessage?: null | string;
    /**
     * Count of pipelines with failed last run status
     */
    failedPipelines?: number;
    /**
     * Count of inactive pipelines
     */
    inactivePipelines?: number;
    /**
     * Count of pipelines that have never been executed
     */
    pipelinesWithoutStatus?: number;
    /**
     * Breakdown of pipelines by service
     */
    serviceBreakdown?: ServiceBreakdown[];
    /**
     * Count of unique pipeline services
     */
    serviceCount?: number;
    /**
     * Count of pipelines with successful last run status
     */
    successfulPipelines?: number;
    /**
     * Total count of all pipelines
     */
    totalPipelines: number;
}

export interface ServiceBreakdown {
    count?:       number;
    serviceName?: string;
    serviceType?: null | string;
    [property: string]: any;
}
