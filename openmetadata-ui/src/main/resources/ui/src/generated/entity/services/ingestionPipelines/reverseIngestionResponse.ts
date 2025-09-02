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
 * Apply a set of operations on a service
 */
export interface ReverseIngestionResponse {
    /**
     * Error message in case of failure
     */
    message?: string;
    /**
     * List of operations to be performed on the service
     */
    results: ReverseIngestionOperationResult[];
    /**
     * The id of the service to be modified
     */
    serviceId: string;
    /**
     * Whether the workflow was successful. Failure indicates a critical failure such as
     * connection issues.
     */
    success?: boolean;
}

export interface ReverseIngestionOperationResult {
    /**
     * The id of the operation
     */
    id: string;
    /**
     * Error message in case of failure
     */
    message?: string;
    /**
     * Whether the specific operation was successful
     */
    success: boolean;
    [property: string]: any;
}
