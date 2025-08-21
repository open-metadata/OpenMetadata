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
 * Periodic Batch Entity Trigger.
 */
export interface PeriodicBatchEntityTrigger {
    config?: TriggerConfiguration;
    output?: string[];
    type?:   string;
}

/**
 * Entity Event Trigger Configuration.
 */
export interface TriggerConfiguration {
    /**
     * Number of Entities to process at once.
     */
    batchSize?: number;
    /**
     * Deprecated: Single entity type for which workflow should be triggered. Use 'entityTypes'
     * for multiple types.
     */
    entityType?: string;
    /**
     * Array of Entity Types for which this workflow should be triggered. Supports multiple
     * entity types in one workflow.
     */
    entityTypes?: string[];
    /**
     * Select the Search Filters to filter down the entities fetched.
     */
    filters: string;
    /**
     * Defines the schedule of the Periodic Trigger.
     */
    schedule: any[] | boolean | AppScheduleClass | number | number | null | string;
}

export interface AppScheduleClass {
    /**
     * Cron Expression in case of Custom scheduled Trigger
     */
    cronExpression?:  string;
    scheduleTimeline: ScheduleTimeline;
}

/**
 * This schema defines the Application ScheduleTimeline Options
 */
export enum ScheduleTimeline {
    Custom = "Custom",
    Daily = "Daily",
    Hourly = "Hourly",
    Monthly = "Monthly",
    None = "None",
    Weekly = "Weekly",
}
