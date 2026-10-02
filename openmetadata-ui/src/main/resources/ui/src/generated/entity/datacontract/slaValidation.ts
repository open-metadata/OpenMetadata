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
 * SLA validation details for data contract.
 */
export interface SlaValidation {
    /**
     * Actual latency in milliseconds.
     */
    actualLatency?: number;
    /**
     * Whether availability requirement was met.
     */
    availabilityMet?: boolean;
    /**
     * When the data was last refreshed, as far as OpenMetadata can tell. Absent when no source
     * records it.
     */
    lastRefreshedAt?: number;
    /**
     * Whether latency requirement was met.
     */
    latencyMet?: boolean;
    /**
     * Which SLA requirements were missed, and which could not be evaluated and why.
     */
    message?: string;
    /**
     * Where the last refresh time comes from: the latest profile of the SLA column (its newest
     * value), the table's system metrics (its latest write), or its life cycle (its last
     * update).
     */
    refreshedAtSource?: RefreshedAtSource;
    /**
     * Whether refresh frequency requirement was met.
     */
    refreshFrequencyMet?: boolean;
}

/**
 * Where the last refresh time comes from: the latest profile of the SLA column (its newest
 * value), the table's system metrics (its latest write), or its life cycle (its last
 * update).
 */
export enum RefreshedAtSource {
    LifeCycle = "lifeCycle",
    SlaColumnProfile = "slaColumnProfile",
    SystemProfile = "systemProfile",
}
