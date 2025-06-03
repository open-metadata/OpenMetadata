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
 * Detailed status of the destination during a test operation, including HTTP response
 * information.
 */
export interface TestDestinationStatus {
    /**
     * Body of the HTTP response, if any, returned by the server.
     */
    entity?: string;
    /**
     * HTTP headers returned in the response as a map of header names to values.
     */
    headers?: any;
    /**
     * URL location if the response indicates a redirect or newly created resource.
     */
    location?: string;
    /**
     * Media type of the response entity, if specified (e.g., application/json).
     */
    mediaType?: string;
    /**
     * Detailed reason for failure if the test did not succeed.
     */
    reason?: string;
    /**
     * Overall test status, indicating if the test operation succeeded or failed.
     */
    status?: Status;
    /**
     * HTTP status code of the response (e.g., 200 for OK, 404 for Not Found).
     */
    statusCode?: number;
    /**
     * HTTP status reason phrase associated with the status code (e.g., 'Not Found').
     */
    statusInfo?: string;
    /**
     * Timestamp when the response was received, in UNIX epoch time milliseconds.
     */
    timestamp?: number;
}

/**
 * Overall test status, indicating if the test operation succeeded or failed.
 */
export enum Status {
    Failed = "Failed",
    Success = "Success",
}
