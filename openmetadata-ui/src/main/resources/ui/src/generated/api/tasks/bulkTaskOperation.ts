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
 * Request for bulk operations on multiple tasks.
 */
export interface BulkTaskOperation {
    /**
     * Operation to perform on the tasks.
     */
    operation: BulkOperation;
    /**
     * Parameters for the operation.
     */
    params?: BulkOperationParams;
    /**
     * List of task IDs (UUID or taskId) to operate on.
     */
    taskIds: string[];
}

/**
 * Operation to perform on the tasks.
 *
 * Type of bulk operation.
 */
export enum BulkOperation {
    Approve = "Approve",
    Assign = "Assign",
    Cancel = "Cancel",
    Reject = "Reject",
    UpdatePriority = "UpdatePriority",
}

/**
 * Parameters for the operation.
 *
 * Parameters for bulk operations.
 */
export interface BulkOperationParams {
    /**
     * FQNs of assignees (for Assign operation).
     */
    assignees?: string[];
    /**
     * Comment for approval/rejection.
     */
    comment?: string;
    /**
     * New priority (for UpdatePriority operation).
     */
    priority?: TaskPriority;
    [property: string]: any;
}

/**
 * New priority (for UpdatePriority operation).
 *
 * Priority level of the task.
 */
export enum TaskPriority {
    Critical = "Critical",
    High = "High",
    Low = "Low",
    Medium = "Medium",
}
