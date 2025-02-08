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
    config?:  { [key: string]: any };
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
     * This schema defines the type of application Run.
     */
    runType?:      string;
    scheduleInfo?: any[] | boolean | AppScheduleClass | number | number | null | string;
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
