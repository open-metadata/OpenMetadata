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
 * This schema defines the type for a profile of a user, team, or organization.
 */
export interface Profile {
    images?:       ImageList;
    subscription?: MessagingProvider;
    /**
     * Read only, computed when the profile is read and never stored, nor recorded in change
     * events. A webhook of `subscription` listed here does not send until the value its
     * `lastFailedReason` names is entered again.
     */
    subscriptionStatus?: MessagingProviderStatus;
}

/**
 * Links to a list of images of varying resolutions/sizes.
 */
export interface ImageList {
    image?:    string;
    image192?: string;
    image24?:  string;
    image32?:  string;
    image48?:  string;
    image512?: string;
    image72?:  string;
}

/**
 * Holds the Subscription Config for different types
 */
export interface MessagingProvider {
    gChat?:   Webhook;
    generic?: Webhook;
    msTeams?: Webhook;
    slack?:   Webhook;
}

/**
 * This schema defines webhook for receiving events from OpenMetadata.
 */
export interface Webhook {
    /**
     * Authentication configuration for the webhook. If not specified, the webhook will be sent
     * without authentication.
     */
    authType?: AuthenticationConfigurationType;
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
     * Send the Event to Admins
     */
    sendToAdmins?: boolean;
    /**
     * Send the Event to Followers
     */
    sendToFollowers?: boolean;
    /**
     * Send the Event to Owners
     */
    sendToOwners?: boolean;
}

/**
 * Authentication configuration for the webhook. If not specified, the webhook will be sent
 * without authentication.
 *
 * No authentication.
 *
 * Bearer token authentication for webhook endpoints.
 *
 * OAuth2 Client Credentials configuration for webhook authentication.
 */
export interface AuthenticationConfigurationType {
    /**
     * Authentication type discriminator.
     */
    type: Type;
    /**
     * Secret key used for computing HMAC SHA256 signature of webhook payload, sent in the
     * X-OM-Signature header.
     */
    secretKey?: string;
    /**
     * OAuth2 client identifier. Stored encrypted via Fernet.
     */
    clientId?: string;
    /**
     * OAuth2 client secret. Stored encrypted via Fernet.
     */
    clientSecret?: string;
    /**
     * Optional OAuth2 scopes to request (space-separated).
     */
    scope?: string;
    /**
     * Token endpoint URL to obtain access tokens.
     */
    tokenUrl?: string;
}

/**
 * Authentication type discriminator.
 */
export enum Type {
    Bearer = "bearer",
    None = "none",
    Oauth2 = "oauth2",
}

/**
 * HTTP operation to send the webhook request. Supports POST or PUT.
 */
export enum HTTPMethod {
    Post = "POST",
    Put = "PUT",
}

/**
 * Read only, computed when the profile is read and never stored, nor recorded in change
 * events. A webhook of `subscription` listed here does not send until the value its
 * `lastFailedReason` names is entered again.
 *
 * The status of each webhook of `subscription` whose stored configuration cannot be used to
 * send.
 */
export interface MessagingProviderStatus {
    gChat?:   SubscriptionStatus;
    generic?: SubscriptionStatus;
    msTeams?: SubscriptionStatus;
    slack?:   SubscriptionStatus;
}

/**
 * Current status of the subscription, including details on the last successful and failed
 * attempts, and retry information.
 */
export interface SubscriptionStatus {
    /**
     * Read only, computed when the status is read and never stored. True when the stored
     * configuration cannot be used to send, such as a secret that must be entered again;
     * `lastFailedReason` names it, and nothing is sent until it is changed. Absent for a
     * failure of a send.
     */
    configurationUnusable?: boolean;
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
