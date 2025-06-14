/**
 * Defines a background job that is triggered on insertion of new record in background_jobs
 * table.
 */
export interface BackgroundJob {
    /**
     * Timestamp when the job was created in Unix epoch time milliseconds.
     */
    createdAt: number;
    /**
     * User or Bot who triggered the background job.
     */
    createdBy: string;
    /**
     * Unique identifier for the job. This field is auto-incremented.
     */
    id: any;
    /**
     * Object containing job arguments.
     */
    jobArgs: EnumCleanupArgs;
    /**
     * Type of the job.
     */
    jobType: JobType;
    /**
     * JobHandler name of the method that will be executed for this job.
     */
    methodName: string;
    /**
     * Timestamp when the job was run in Unix epoch time milliseconds (default: as soon as
     * possible).
     */
    runAt?: number;
    /**
     * Current status of the job.
     */
    status: Status;
    /**
     * Time when job was last updated in Unix epoch time milliseconds.
     */
    updatedAt: number;
}

/**
 * Object containing job arguments.
 *
 * Arguments for enum removal job.
 */
export interface EnumCleanupArgs {
    /**
     * Type of the entity.
     */
    entityType?: string;
    /**
     * Name of the property.
     */
    propertyName?: string;
    /**
     * List of removed enum keys.
     */
    removedEnumKeys?: string[];
    [property: string]: any;
}

/**
 * Type of the job.
 */
export enum JobType {
    CustomPropertyEnumCleanup = "CUSTOM_PROPERTY_ENUM_CLEANUP",
    DeleteEntity = "DELETE_ENTITY",
    DeleteToken = "DELETE_TOKEN",
}

/**
 * Current status of the job.
 */
export enum Status {
    Completed = "COMPLETED",
    Failed = "FAILED",
    Pending = "PENDING",
    Running = "RUNNING",
}
