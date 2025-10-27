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
 * Query Runner Response
 */
export interface QueryRunnerResponse {
    /**
     * Duration of the query execution in seconds
     */
    duration?: number;
    /**
     * Detailed error log in case of failure
     */
    errorLog?: string;
    /**
     * The actual query that was executed (may be transpiled or modified from the original)
     */
    executedQuery?: string;
    /**
     * Error message in case of failure
     */
    message?: string;
    /**
     * Results of the query execution
     */
    results?: TableData;
    /**
     * Status of the query execution
     */
    status?: StatusType;
}

/**
 * Results of the query execution
 *
 * This schema defines the type to capture rows of sample data for a table.
 */
export interface TableData {
    /**
     * List of local column names (not fully qualified column names) of the table.
     */
    columns?: string[];
    /**
     * Data for multiple rows of the table.
     */
    rows?: Array<any[]>;
}

/**
 * Status of the query execution
 *
 * Enum defining possible Query Runner status
 */
export enum StatusType {
    Failed = "Failed",
    Running = "Running",
    Successful = "Successful",
}
