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
 * This defines schema for sending alerts for OpenMetadata
 */
export interface CreateEventSubscription {
    /**
     * Type of Alert
     */
    alertType: AlertType;
    /**
     * Maximum number of events sent in a batch (Default 10).
     */
    batchSize?: number;
    /**
     * Consumer Class for the Event Subscription. Will use 'AlertPublisher' if not provided.
     */
    className?: string;
    config?:    { [key: string]: any };
    /**
     * A short description of the Alert, comprehensible to regular users.
     */
    description?: string;
    /**
     * Subscription Config.
     */
    destinations?: Destination[];
    /**
     * Display name for this Alert.
     */
    displayName?: string;
    /**
     * Fully qualified name of the domain the Table belongs to.
     */
    domain?: string;
    /**
     * Is the alert enabled.
     */
    enabled?: boolean;
    /**
     * Input for the Filters.
     */
    input?: AlertFilteringInput;
    /**
     * Name that uniquely identifies this Alert.
     */
    name: string;
    /**
     * Owners of this Alert.
     */
    owners?: EntityReference[];
    /**
     * Poll Interval in seconds.
     */
    pollInterval?: number;
    provider?:     ProviderType;
    /**
     * Defines a list of resources that triggers the Event Subscription, Eg All, User, Teams etc.
     */
    resources?: string[];
    /**
     * Number of times to retry callback on failure. (Default 3).
     */
    retries?: number;
    trigger?: Trigger;
}

/**
 * Type of Alert
 *
 * Type of Alerts supported.
 */
export enum AlertType {
    ActivityFeed = "ActivityFeed",
    Custom = "Custom",
    GovernanceWorkflowChangeEvent = "GovernanceWorkflowChangeEvent",
    Notification = "Notification",
    Observability = "Observability",
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

/**
 * Input for the Filters.
 *
 * Observability of the event subscription.
 */
export interface AlertFilteringInput {
    /**
     * List of filters for the event subscription.
     */
    actions?: ArgumentsInput[];
    /**
     * List of filters for the event subscription.
     */
    filters?: ArgumentsInput[];
}

/**
 * Observability Filters for Event Subscription.
 */
export interface ArgumentsInput {
    /**
     * Arguments List
     */
    arguments?: Argument[];
    effect?:    Effect;
    /**
     * Name of the filter
     */
    name?: string;
    /**
     * Prefix Condition for the filter.
     */
    prefixCondition?: PrefixCondition;
}

/**
 * Argument for the filter.
 */
export interface Argument {
    /**
     * Value of the Argument
     */
    input?: string[];
    /**
     * Name of the Argument
     */
    name?: string;
}

export enum Effect {
    Exclude = "exclude",
    Include = "include",
}

/**
 * Prefix Condition for the filter.
 *
 * Prefix Condition to be applied to the Condition.
 */
export enum PrefixCondition {
    And = "AND",
    Or = "OR",
}

/**
 * Owners of this Alert.
 *
 * This schema defines the EntityReferenceList type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 */
export interface EntityReference {
    /**
     * If true the entity referred to has been soft-deleted.
     */
    deleted?: boolean;
    /**
     * Optional description of entity.
     */
    description?: string;
    /**
     * Display Name that identifies this entity.
     */
    displayName?: string;
    /**
     * Fully qualified name of the entity instance. For entities such as tables, databases
     * fullyQualifiedName is returned in this field. For entities that don't have name hierarchy
     * such as `user` and `team` this will be same as the `name` field.
     */
    fullyQualifiedName?: string;
    /**
     * Link to the entity resource.
     */
    href?: string;
    /**
     * Unique identifier that identifies an entity instance.
     */
    id: string;
    /**
     * If true the relationship indicated by this entity reference is inherited from the parent
     * entity.
     */
    inherited?: boolean;
    /**
     * Name of the entity instance.
     */
    name?: string;
    /**
     * Entity type/class name - Examples: `database`, `table`, `metrics`, `databaseService`,
     * `dashboardService`...
     */
    type: string;
}

/**
 * Type of provider of an entity. Some entities are provided by the `system`. Some are
 * entities created and provided by the `user`. Typically `system` provide entities can't be
 * deleted and can only be disabled. Some apps such as AutoPilot create entities with
 * `automation` provider type. These entities can be deleted by the user.
 */
export enum ProviderType {
    Automation = "automation",
    System = "system",
    User = "user",
}

/**
 * Trigger Configuration for Alerts.
 */
export interface Trigger {
    /**
     * Cron Expression in case of Custom scheduled Trigger
     */
    cronExpression?: string;
    /**
     * Schedule Info
     */
    scheduleInfo?: ScheduleInfo;
    triggerType:   TriggerType;
}

/**
 * Schedule Info
 */
export enum ScheduleInfo {
    Custom = "Custom",
    Daily = "Daily",
    Monthly = "Monthly",
    Weekly = "Weekly",
}

/**
 * Trigger Configuration for Alerts.
 */
export enum TriggerType {
    RealTime = "RealTime",
    Scheduled = "Scheduled",
}
