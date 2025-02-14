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
 * Current status of the subscription, including details on the last successful and failed
 * attempts, and retry information.
 */
export interface SubscriptionStatus {
    /**
     * Timestamp of the last failed callback in UNIX UTC epoch time in milliseconds.
     */
    lastFailedAt?: number;
    /**
     * Detailed reason for the last failure received during callback.
     */
    lastFailedReason?: string;
    /**
     * HTTP status code received during the last failed callback attempt.
     */
    lastFailedStatusCode?: number;
    /**
     * Timestamp of the last successful callback in UNIX UTC epoch time in milliseconds.
     */
    lastSuccessfulAt?: number;
    /**
     * Timestamp for the next retry attempt in UNIX epoch time in milliseconds. Only valid if
     * `status` is `awaitingRetry`.
     */
    nextAttempt?: number;
    /**
     * Status is `disabled` when the event subscription was created with `enabled` set to false
     * and it never started publishing events. Status is `active` when the event subscription is
     * functioning normally and a 200 OK response was received for the callback notification.
     * Status is `failed` when a bad callback URL, connection failures, or `1xx` or `3xx`
     * response was received for the callback notification. Status is `awaitingRetry` when the
     * previous attempt at callback timed out or received a `4xx` or `5xx` response. Status is
     * `retryLimitReached` after all retries fail.
     */
    status?: Status;
    /**
     * Current timestamp of this status in UNIX epoch time in milliseconds.
     */
    timestamp?: number;
}

/**
 * Status is `disabled` when the event subscription was created with `enabled` set to false
 * and it never started publishing events. Status is `active` when the event subscription is
 * functioning normally and a 200 OK response was received for the callback notification.
 * Status is `failed` when a bad callback URL, connection failures, or `1xx` or `3xx`
 * response was received for the callback notification. Status is `awaitingRetry` when the
 * previous attempt at callback timed out or received a `4xx` or `5xx` response. Status is
 * `retryLimitReached` after all retries fail.
 */
export enum Status {
    Active = "active",
    AwaitingRetry = "awaitingRetry",
    Disabled = "disabled",
    Failed = "failed",
    RetryLimitReached = "retryLimitReached",
}
