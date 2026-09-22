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
 * Aggregate onboarding health for one asset type. Every measure is null when its window
 * holds no sample, so a board can say `no data yet` instead of showing a zero it did not
 * measure.
 */
export interface OnboardingSummary {
    daysInEntryStage?:    DaysInEntryStage;
    entityType:           string;
    followUps?:           FollowUPS;
    reachedReviewInTime?: ReachedReviewInTime;
}

/**
 * Median time assets spent in the entry stage before the gate let them move.
 */
export interface DaysInEntryStage {
    /**
     * Days saved against the previous window. Negative means slower.
     */
    deltaDays?:          number;
    medianDays?:         number;
    previousMedianDays?: number;
    previousSampleSize?: number;
    sampleSize?:         number;
    stage?:              string;
    windowDays?:         number;
}

/**
 * Reminders sent in the window, split by who sent them.
 */
export interface FollowUPS {
    manual?:         number;
    previousManual?: number;
    reassignments?:  number;
    stallNotices?:   number;
    windowDays?:     number;
}

/**
 * Share of a cohort that left the entry stage within the threshold.
 */
export interface ReachedReviewInTime {
    cohortSize?: number;
    /**
     * Percentage points gained against the pre-playbook baseline.
     */
    deltaPoints?:        number;
    previousCohortSize?: number;
    previousShare?:      number;
    /**
     * Percentage of the cohort that reached the next stage in time.
     */
    share?:         number;
    stage?:         string;
    thresholdDays?: number;
    windowDays?:    number;
}
