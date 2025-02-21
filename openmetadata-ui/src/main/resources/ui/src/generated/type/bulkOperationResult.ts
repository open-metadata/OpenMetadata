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
 * Represents result of bulk Operation performed on entities.
 */
export interface BulkOperationResult {
    /**
     * Reason why import was aborted. This is set only when the `status` field is set to
     * `aborted`
     */
    abortReason?: string;
    /**
     * True if the operation has dryRun flag enabled
     */
    dryRun?: boolean;
    /**
     * Failure Request that can be processed successfully.
     */
    failedRequest?:         Response[];
    numberOfRowsFailed?:    number;
    numberOfRowsPassed?:    number;
    numberOfRowsProcessed?: number;
    status?:                Status;
    /**
     * Request that can be processed successfully.
     */
    successRequest?: Response[];
}

/**
 * Request that can be processed successfully.
 */
export interface Response {
    /**
     * Message for the request.
     */
    message?: string;
    /**
     * Request that can be processed successfully.
     */
    request?: any;
}

/**
 * State of an action over API.
 */
export enum Status {
    Aborted = "aborted",
    Failure = "failure",
    PartialSuccess = "partialSuccess",
    Success = "success",
}
