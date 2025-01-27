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
     * application type.
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
