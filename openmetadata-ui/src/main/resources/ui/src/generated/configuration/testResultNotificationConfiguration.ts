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
 * This schema defines the SSL Config.
 */
export interface TestResultNotificationConfiguration {
    /**
     * Is Test Notification Enabled?
     */
    enabled?: boolean;
    /**
     * Send notification on Success, Failed or Aborted?
     */
    onResult?: TestCaseStatus[];
    /**
     * Send notification on the mail
     */
    receivers?: string[];
    /**
     * Send notification on the mail
     */
    sendToOwners?: boolean;
}

/**
 * Status of Test Case run.
 */
export enum TestCaseStatus {
    Aborted = "Aborted",
    Failed = "Failed",
    Queued = "Queued",
    Success = "Success",
}
