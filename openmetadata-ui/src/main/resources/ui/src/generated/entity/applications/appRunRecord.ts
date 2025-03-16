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
 * App Run Record.
 */
export interface AppRunRecord {
    /**
     * Unique identifier of this application for which the job is ran.
     */
    appId?: string;
    /**
     * Name of the application.
     */
    appName?: string;
    /**
     * The configuration used for this application run. It's type will be based on the
     * application type. Old runs might not be compatible with schema of app configuration.
     */
    config?: { [key: string]: any };
    /**
     * End time of the job status.
     */
    endTime?: number;
    /**
     * Execution time of the job status.
     */
    executionTime?: number;
    /**
     * Extension type.
     */
    extension?: string;
    /**
     * Failure Context for the Application.
     */
    failureContext?: { [key: string]: any };
    /**
     * Arbitrary metadata that will be attached to the report.
     */
    properties?: { [key: string]: any };
    /**
     * This schema defines the type of application Run.
     */
    runType?:      string;
    scheduleInfo?: any[] | boolean | AppScheduleClass | number | number | null | string;
    /**
     * Services configured in the application run. This information is generated based on the
     * given configuration.
     */
    services?: EntityReference[];
    /**
     * Start of the job status.
     */
    startTime?: number;
    /**
     * Status for the Job.
     */
    status?: Status;
    /**
     * Success Context for the Application.
     */
    successContext?: { [key: string]: any };
    /**
     * Update time of the job status.
     */
    timestamp?: number;
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
    Daily = " Daily",
    Hourly = "Hourly",
    Monthly = "Monthly",
    None = "None",
    Weekly = "Weekly",
}

/**
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 */
export interface EntityReference {
    /**
     * If true the entity referred to has been soft-deleted.
     */
    deleted?: boolean;
    /**
     * Optional description of entity.
     */
    description?: string;
    /**
     * Display Name that identifies this entity.
     */
    displayName?: string;
    /**
     * Fully qualified name of the entity instance. For entities such as tables, databases
     * fullyQualifiedName is returned in this field. For entities that don't have name hierarchy
     * such as `user` and `team` this will be same as the `name` field.
     */
    fullyQualifiedName?: string;
    /**
     * Link to the entity resource.
     */
    href?: string;
    /**
     * Unique identifier that identifies an entity instance.
     */
    id: string;
    /**
     * If true the relationship indicated by this entity reference is inherited from the parent
     * entity.
     */
    inherited?: boolean;
    /**
     * Name of the entity instance.
     */
    name?: string;
    /**
     * Entity type/class name - Examples: `database`, `table`, `metrics`, `databaseService`,
     * `dashboardService`...
     */
    type: string;
}

/**
 * Status for the Job.
 */
export enum Status {
    Active = "active",
    ActiveError = "activeError",
    Completed = "completed",
    Failed = "failed",
    Pending = "pending",
    Running = "running",
    Started = "started",
    Stopped = "stopped",
    Success = "success",
}
