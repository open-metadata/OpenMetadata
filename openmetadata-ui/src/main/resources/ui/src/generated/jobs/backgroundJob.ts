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
    jobArgs: Args;
    /**
     * Type of the job.
     */
    jobType: JobType;
    /**
     * Message describing the job status or error details
     */
    message?: string;
    /**
     * JobHandler name  that will be executed for this job.
     */
    methodName: string;
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
 *
 * Arguments for delete operation job
 */
export interface Args {
    /**
     * Type of the entity.
     *
     * Type of entity being deleted
     */
    entityType: string;
    /**
     * Name of the property.
     */
    propertyName?: string;
    /**
     * List of removed enum keys.
     */
    removedEnumKeys?: string[];
    /**
     * Identifier of entity that was modified by the operation.
     */
    entityId?: string;
    /**
     * Unique name that identifies a Type.
     */
    entityName?: string;
    /**
     * Whether to perform hard delete
     */
    hardDelete?: boolean;
    /**
     * Whether to recursively delete child entities
     */
    recursive?: boolean;
    /**
     * User who initiated the delete operation
     */
    updatedBy?: string;
}

/**
 * Type of the job.
 */
export enum JobType {
    CustomPropertyEnumCleanup = "CUSTOM_PROPERTY_ENUM_CLEANUP",
    DeleteEntity = "DELETE_ENTITY",
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
