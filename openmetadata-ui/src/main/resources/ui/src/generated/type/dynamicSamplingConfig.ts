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
 * Configuration for dynamic sampling based on table row count.
 */
export interface DynamicSamplingConfig {
    /**
     * Row count thresholds for sampling. Evaluated in order from highest to lowest threshold.
     * Tables below the lowest threshold are profiled at 100% (no sampling).
     */
    thresholds?: Threshold[];
}

export interface Threshold {
    /**
     * Sample percentage or row count to use for tables at or above this threshold
     */
    profileSample:      number;
    profileSampleType?: ProfileSampleType;
    /**
     * Minimum row count for this tier to apply
     */
    rowCountThreshold:   number;
    samplingMethodType?: SamplingMethodType;
}

/**
 * Type of Profile Sample (percentage or rows)
 */
export enum ProfileSampleType {
    Percentage = "PERCENTAGE",
    Rows = "ROWS",
}

/**
 * Type of Sampling Method (BERNOULLI or SYSTEM)
 */
export enum SamplingMethodType {
    Bernoulli = "BERNOULLI",
    System = "SYSTEM",
}
