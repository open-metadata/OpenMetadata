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
 * This schema defines the EventSubscription entity. An Event Subscription has trigger,
 * filters and Subscription
 */
export interface EventSubscription {
    /**
     * Type of Alert
     */
    alertType: AlertType;
    /**
     * Maximum number of events sent in a batch (Default 100).
     */
    batchSize?: number;
    /**
     * Change that led to this version of the Event Subscription.
     */
    changeDescription?: ChangeDescription;
    /**
     * Java class for the Event Subscription.
     */
    className?: string;
    config?:    { [key: string]: any };
    /**
     * A short description of the Event Subscription, comprehensible to regular users.
     */
    description?: string;
    /**
     * Destination Config.
     */
    destinations: Destination[];
    /**
     * Display name for this Event Subscription.
     */
    displayName?: string;
    /**
     * Domains the asset belongs to. When not set, the asset inherits the domain from the parent
     * it belongs to.
     */
    domains?: EntityReference[];
    /**
     * Is the event Subscription enabled.
     */
    enabled?: boolean;
    /**
     * Set of rules that the Event Subscription Contains to allow conditional control for
     * alerting.
     */
    filteringRules?: FilteringRules;
    /**
     * FullyQualifiedName that uniquely identifies a Event Subscription.
     */
    fullyQualifiedName?: string;
    /**
     * Link to the resource corresponding to this entity.
     */
    href?: string;
    /**
     * Unique identifier that identifies this Event Subscription.
     */
    id: string;
    /**
     * Change that lead to this version of the entity.
     */
    incrementalChangeDescription?: ChangeDescription;
    /**
     * Input for the Filters.
     */
    input?: AlertFilteringInput;
    /**
     * Name that uniquely identifies this Event Subscription.
     */
    name: string;
    /**
     * Owners of this Event Subscription.
     */
    owners?: EntityReference[];
    /**
     * Poll Interval in seconds.
     */
    pollInterval?: number;
    provider?:     ProviderType;
    /**
     * Number of times to retry callback on failure. (Default 3).
     */
    retries?: number;
    /**
     * Trigger information for Alert.
     */
    trigger?: Trigger;
    /**
     * Last update time corresponding to the new version of the Event Subscription in Unix epoch
     * time milliseconds.
     */
    updatedAt?: number;
    /**
     * User who made the update.
     */
    updatedBy?: string;
    /**
     * Metadata version of the Event Subscription.
     */
    version?: number;
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
 * Change that led to this version of the Event Subscription.
 *
 * Description of the change.
 *
 * Change that lead to this version of the entity.
 */
export interface ChangeDescription {
    changeSummary?: { [key: string]: ChangeSummary };
    /**
     * Names of fields added during the version changes.
     */
    fieldsAdded?: FieldChange[];
    /**
     * Fields deleted during the version changes with old value before deleted.
     */
    fieldsDeleted?: FieldChange[];
    /**
     * Fields modified during the version changes with old and new values.
     */
    fieldsUpdated?: FieldChange[];
    /**
     * When a change did not result in change, this could be same as the current version.
     */
    previousVersion?: number;
}

export interface ChangeSummary {
    changedAt?: number;
    /**
     * Name of the user or bot who made this change
     */
    changedBy?:    string;
    changeSource?: ChangeSource;
    [property: string]: any;
}

/**
 * The source of the change. This will change based on the context of the change (example:
 * manual vs programmatic)
 */
export enum ChangeSource {
    Automated = "Automated",
    Derived = "Derived",
    Ingested = "Ingested",
    Manual = "Manual",
    Propagated = "Propagated",
    Suggested = "Suggested",
}

export interface FieldChange {
    /**
     * Name of the entity field that changed.
     */
    name?: string;
    /**
     * New value of the field. Note that this is a JSON string and use the corresponding field
     * type to deserialize it.
     */
    newValue?: any;
    /**
     * Previous value of the field. Note that this is a JSON string and use the corresponding
     * field type to deserialize it.
     */
    oldValue?: any;
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
 * Domains the asset belongs to. When not set, the asset inherits the domain from the parent
 * it belongs to.
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
 * Set of rules that the Event Subscription Contains to allow conditional control for
 * alerting.
 *
 * Filtering Rules for Event Subscription.
 */
export interface FilteringRules {
    /**
     * A set of filter rules associated with the Alert.
     */
    actions?: EventFilterRule[];
    /**
     * Defines a list of resources that triggers the Event Subscription, Eg All, User, Teams etc.
     */
    resources: string[];
    /**
     * A set of filter rules associated with the Alert.
     */
    rules?: EventFilterRule[];
}

/**
 * Describes an Event Filter Rule
 */
export interface EventFilterRule {
    /**
     * Arguments to the Condition.
     */
    arguments?: string[];
    /**
     * Expression in SpEL used for matching of a `Rule` based on entity, resource, and
     * environmental attributes.
     */
    condition: string;
    /**
     * Description of the Event Filter Rule.
     */
    description?: string;
    /**
     * Display Name of the Filter.
     */
    displayName?: string;
    effect:       Effect;
    /**
     * FullyQualifiedName in the form `eventSubscription.eventFilterRuleName`.
     */
    fullyQualifiedName?: string;
    inputType?:          InputType;
    /**
     * Name of this Event Filter.
     */
    name?: string;
    /**
     * Prefix Condition to be applied to the Condition.
     */
    prefixCondition?: PrefixCondition;
}

export enum Effect {
    Exclude = "exclude",
    Include = "include",
}

export enum InputType {
    None = "none",
    Runtime = "runtime",
    Static = "static",
}

/**
 * Prefix Condition to be applied to the Condition.
 *
 * Prefix Condition for the filter.
 */
export enum PrefixCondition {
    And = "AND",
    Or = "OR",
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
 * Trigger information for Alert.
 *
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
