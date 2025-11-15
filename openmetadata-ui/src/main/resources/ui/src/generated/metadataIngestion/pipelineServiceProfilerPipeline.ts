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
 * PipelineService Profiler Pipeline Configuration.
 */
export interface PipelineServiceProfilerPipeline {
    /**
     * List of Database Service Names for mapping pipeline observability to table entities
     */
    dbServiceNames?: string[];
    /**
     * Include failed pipeline runs in observability data
     */
    includeFailedRuns?: boolean;
    /**
     * Maximum number of recent pipeline runs to profile for observability data
     */
    maxRunsToProfile?: number;
    /**
     * Number of days to look back for pipeline runs
     */
    observabilityDays?: number;
    /**
     * Regex include/exclude pipelines for profiling.
     */
    pipelineFilterPattern?: FilterPattern;
    /**
     * Percentage of tables to profile. Value should be between 1 and 100
     */
    profileSample?: number;
    /**
     * Regex include/exclude tables for profiling based on pipeline outputs.
     */
    tableFilterPattern?: FilterPattern;
    /**
     * Pipeline profiler type
     */
    type?: PipelineProfilerConfigType;
}

/**
 * Regex include/exclude pipelines for profiling.
 *
 * Regex to only fetch entities that matches the pattern.
 *
 * Regex include/exclude tables for profiling based on pipeline outputs.
 */
export interface FilterPattern {
    /**
     * List of strings/regex patterns to match and exclude only database entities that match.
     */
    excludes?: string[];
    /**
     * List of strings/regex patterns to match and include only database entities that match.
     */
    includes?: string[];
}

/**
 * Pipeline profiler type
 *
 * Pipeline Source Config Profiler Pipeline type
 */
export enum PipelineProfilerConfigType {
    PipelineProfiler = "PipelineProfiler",
}
