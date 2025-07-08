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
 * Schema defining eventSubscription test API.
 */
export interface TestEventSubscriptionDestination {
    /**
     * List of external destinations.
     */
    destinations?: Destination[];
}

/**
 * Subscription which has a type and the config.
 */
export interface Destination {
    category: SubscriptionCategory;
    config?:  Webhook;
    /**
     * Is the subscription enabled.
     */
    enabled?: boolean;
    /**
     * Unique identifier that identifies this Event Subscription.
     */
    id?: string;
    /**
     * Read timeout in seconds. (Default 12s).
     */
    readTimeout?:   number;
    statusDetails?: TionStatus;
    /**
     * Connection timeout in seconds. (Default 10s).
     */
    timeout?: number;
    type:     SubscriptionType;
}

/**
 * Subscription Endpoint Type.
 */
export enum SubscriptionCategory {
    Admins = "Admins",
    Assignees = "Assignees",
    External = "External",
    Followers = "Followers",
    Mentions = "Mentions",
    Owners = "Owners",
    Teams = "Teams",
    Users = "Users",
}

/**
 * This schema defines webhook for receiving events from OpenMetadata.
 *
 * This schema defines email config for receiving events from OpenMetadata.
 *
 * A generic map that can be deserialized later.
 */
export interface Webhook {
    /**
     * Endpoint to receive the webhook events over POST requests.
     */
    endpoint?: string;
    /**
     * Custom headers to be sent with the webhook request.
     */
    headers?: { [key: string]: any };
    /**
     * HTTP operation to send the webhook request. Supports POST or PUT.
     */
    httpMethod?: HTTPMethod;
    /**
     * Query parameters to be added to the webhook request URL.
     */
    queryParams?: { [key: string]: any };
    /**
     * List of receivers to send mail to
     */
    receivers?: string[];
    /**
     * Secret set by the webhook client used for computing HMAC SHA256 signature of webhook
     * payload and sent in `X-OM-Signature` header in POST requests to publish the events.
     */
    secretKey?: string;
    /**
     * Send the Event to Admins
     *
     * Send the Mails to Admins
     */
    sendToAdmins?: boolean;
    /**
     * Send the Event to Followers
     *
     * Send the Mails to Followers
     */
    sendToFollowers?: boolean;
    /**
     * Send the Event to Owners
     *
     * Send the Mails to Owners
     */
    sendToOwners?: boolean;
    [property: string]: any;
}

/**
 * HTTP operation to send the webhook request. Supports POST or PUT.
 */
export enum HTTPMethod {
    Post = "POST",
    Put = "PUT",
}

/**
 * Current status of the subscription, including details on the last successful and failed
 * attempts, and retry information.
 *
 * Detailed status of the destination during a test operation, including HTTP response
 * information.
 */
export interface TionStatus {
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
     *
     * Overall test status, indicating if the test operation succeeded or failed.
     */
    status?: Status;
    /**
     * Current timestamp of this status in UNIX epoch time in milliseconds.
     *
     * Timestamp when the response was received, in UNIX epoch time milliseconds.
     */
    timestamp?: number;
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
     * HTTP status code of the response (e.g., 200 for OK, 404 for Not Found).
     */
    statusCode?: number;
    /**
     * HTTP status reason phrase associated with the status code (e.g., 'Not Found').
     */
    statusInfo?: string;
}

/**
 * Status is `disabled` when the event subscription was created with `enabled` set to false
 * and it never started publishing events. Status is `active` when the event subscription is
 * functioning normally and a 200 OK response was received for the callback notification.
 * Status is `failed` when a bad callback URL, connection failures, or `1xx` or `3xx`
 * response was received for the callback notification. Status is `awaitingRetry` when the
 * previous attempt at callback timed out or received a `4xx` or `5xx` response. Status is
 * `retryLimitReached` after all retries fail.
 *
 * Overall test status, indicating if the test operation succeeded or failed.
 */
export enum Status {
    Active = "active",
    AwaitingRetry = "awaitingRetry",
    Disabled = "disabled",
    Failed = "failed",
    RetryLimitReached = "retryLimitReached",
    StatusFailed = "Failed",
    Success = "Success",
}

/**
 * Subscription Endpoint Type.
 */
export enum SubscriptionType {
    ActivityFeed = "ActivityFeed",
    Email = "Email",
    GChat = "GChat",
    GovernanceWorkflowChangeEvent = "GovernanceWorkflowChangeEvent",
    MSTeams = "MsTeams",
    Slack = "Slack",
    Webhook = "Webhook",
}
