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
 * Response for security configuration validation
 */
export interface SecurityValidationResponse {
    /**
     * List of field errors (only present when status is 'failed')
     */
    errors?: FieldError[];
    /**
     * Overall validation status (success/failed)
     */
    status: Status;
}

export interface FieldError {
    /**
     * Concise error message for display under form field
     */
    error: string;
    /**
     * Field path that has the error (e.g.,
     * 'authenticationConfiguration.oidcConfiguration.clientId')
     */
    field: string;
}

/**
 * Overall validation status (success/failed)
 */
export enum Status {
    Failed = "failed",
    Success = "success",
}
