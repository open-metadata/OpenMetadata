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
 * Day-wise pipeline runtime trend showing max, min, and average runtime
 */
export interface PipelineRuntimeTrend {
    /**
     * Average runtime in milliseconds for pipelines executed on this date
     */
    avgRuntime?: number;
    /**
     * Date in YYYY-MM-DD format
     */
    date: string;
    /**
     * Maximum runtime in milliseconds among all pipelines executed on this date
     */
    maxRuntime?: number;
    /**
     * Minimum runtime in milliseconds among all pipelines executed on this date
     */
    minRuntime?: number;
    /**
     * Timestamp for the date
     */
    timestamp: number;
    /**
     * Total number of pipelines executed on this date
     */
    totalPipelines: number;
}
