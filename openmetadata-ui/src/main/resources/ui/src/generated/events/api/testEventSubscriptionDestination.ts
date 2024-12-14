/*
 *  Copyright 2024 Collate.
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
     * Name of the event subscription
     */
    alertName?: string;
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
    statusDetails?: SubscriptionStatus;
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
}

/**
 * HTTP operation to send the webhook request. Supports POST or PUT.
 */
export enum HTTPMethod {
    Post = "POST",
    Put = "PUT",
}

/**
 * Subscription Current Status
 */
export interface SubscriptionStatus {
    /**
     * Last non-successful callback time in UNIX UTC epoch time in milliseconds.
     */
    lastFailedAt?: number;
    /**
     * Last non-successful activity response reason received during callback.
     */
    lastFailedReason?: string;
    /**
     * Last non-successful activity response code received during callback.
     */
    lastFailedStatusCode?: number;
    /**
     * Last non-successful callback time in UNIX UTC epoch time in milliseconds.
     */
    lastSuccessfulAt?: number;
    /**
     * Next retry will be done at this time in Unix epoch time milliseconds. Only valid is
     * `status` is `awaitingRetry`.
     */
    nextAttempt?: number;
    status?:      Status;
    timestamp?:   number;
}

/**
 * Status is `disabled`, when eventSubscription was created with `enabled` set to false and
 * it never started publishing events. Status is `active` when eventSubscription is normally
 * functioning and 200 OK response was received for callback notification. Status is
 * `failed` on bad callback URL, connection failures, `1xx`, and `3xx` response was received
 * for callback notification. Status is `awaitingRetry` when previous attempt at callback
 * timed out or received `4xx`, `5xx` response. Status is `retryLimitReached` after all
 * retries fail.
 */
export enum Status {
    Active = "active",
    AwaitingRetry = "awaitingRetry",
    Disabled = "disabled",
    Failed = "failed",
    RetryLimitReached = "retryLimitReached",
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
