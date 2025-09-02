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
 * This schema defines the Workflow Settings.
 */
export interface WorkflowSettings {
    /**
     * Used to set up the Workflow Executor Settings.
     */
    executorConfiguration?: ExecutorConfiguration;
    /**
     * Used to set up the History CleanUp Settings.
     */
    historyCleanUpConfiguration?: HistoryCleanUpConfiguration;
}

/**
 * Used to set up the Workflow Executor Settings.
 */
export interface ExecutorConfiguration {
    /**
     * Default worker Pool Size. The Workflow Executor by default has this amount of workers.
     */
    corePoolSize?: number;
    /**
     * The amount of time a Job gets locked before being retried. Default: 15 Days. This avoids
     * jobs that takes too long to run being retried while running.
     */
    jobLockTimeInMillis?: number;
    /**
     * Maximum worker Pool Size. The Workflow Executor could grow up to this number of workers.
     */
    maxPoolSize?: number;
    /**
     * Amount of Tasks that can be queued to be picked up by the Workflow Executor.
     */
    queueSize?: number;
    /**
     * The amount of Tasks that the Workflow Executor is able to pick up each time it looks for
     * more.
     */
    tasksDuePerAcquisition?: number;
}

/**
 * Used to set up the History CleanUp Settings.
 */
export interface HistoryCleanUpConfiguration {
    /**
     * Cleans the Workflow Task that were finished, after given number of days.
     */
    cleanAfterNumberOfDays?: number;
}
