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
     * Timestamp when the job was created.
     */
    createdAt: any;
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
    jobArgs: { [key: string]: any };
    /**
     * Type of the job.
     */
    jobType: JobType;
    /**
     * JobHandler name of the method that will be executed for this job.
     */
    methodName: string;
    /**
     * Current status of the job.
     */
    status: Status;
    /**
     * Timestamp when the job was last updated.
     */
    updatedAt: any;
}

/**
 * Type of the job.
 */
export enum JobType {
    CustomPropertyEnumCleanup = "CUSTOM_PROPERTY_ENUM_CLEANUP",
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
