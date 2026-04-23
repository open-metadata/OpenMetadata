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
 * Result of a bulk task operation.
 */
export interface BulkTaskOperationResult {
    /**
     * Number of failed tasks.
     */
    failed?: number;
    /**
     * Individual results for each task.
     */
    results?: BulkTaskOperationResultItem[];
    /**
     * Number of successfully processed tasks.
     */
    successful?: number;
    /**
     * Total number of tasks in the request.
     */
    totalRequested?: number;
}

/**
 * Result of a single task operation.
 */
export interface BulkTaskOperationResultItem {
    /**
     * Error message if the operation failed.
     */
    error?: string;
    /**
     * Status of the operation.
     */
    status?: Status;
    /**
     * The task ID that was processed.
     */
    taskId?: string;
    [property: string]: any;
}

/**
 * Status of the operation.
 */
export enum Status {
    Failed = "failed",
    Success = "success",
}
