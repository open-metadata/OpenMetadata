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
 * This schema defines the applications for Open-Metadata.
 */
export interface AppMarketPlaceDefinition {
  /**
   * Allow users to configure the app from the UI. If `false`, the `configure` step will be
   * hidden.
   */
  allowConfiguration?: boolean;
  /**
   * Application Configuration object.
   */
  appConfiguration?: { [key: string]: any };
  /**
   * Application Logo Url.
   */
  appLogoUrl?: string;
  /**
   * Application Screenshots.
   */
  appScreenshots?: string[];
  /**
   * This schema defines the type of application.
   */
  appType: AppType;
  /**
   * Change that lead to this version of the entity.
   */
  changeDescription?: ChangeDescription;
  /**
   * Full Qualified ClassName for the the application
   */
  className: string;
  /**
   * When `true` indicates the entity has been soft deleted.
   */
  deleted?: boolean;
  /**
   * Description of the Application.
   */
  description?: string;
  /**
   * Developer For the Application.
   */
  developer?: string;
  /**
   * Url for the developer
   */
  developerUrl?: string;
  /**
   * Display Name for the application.
   */
  displayName?: string;
  /**
   * Domain the asset belongs to. When not set, the asset inherits the domain from the parent
   * it belongs to.
   */
  domain?: EntityReference;
  /**
   * Event subscriptions that will be created when the application is installed.
   */
  eventSubscriptions?: CreateEventSubscription[];
  /**
   * Features of the Application.
   */
  features?: string;
  /**
   * FullyQualifiedName same as `name`.
   */
  fullyQualifiedName?: string;
  /**
   * Link to the resource corresponding to this entity.
   */
  href?: string;
  /**
   * Unique identifier of this application.
   */
  id: string;
  /**
   * Change that lead to this version of the entity.
   */
  incrementalChangeDescription?: ChangeDescription;
  /**
   * Name of the Application.
   */
  name: string;
  /**
   * Owners of this workflow.
   */
  owners?: EntityReference[];
  /**
   * Permission used by Native Applications.
   */
  permission: Permissions;
  /**
   * Flag to enable/disable preview for the application. If the app is in preview mode, it
   * can't be installed.
   */
  preview?: boolean;
  /**
   * Privacy Policy for the developer
   */
  privacyPolicyUrl?: string;
  /**
   * If app type is live, user can provide additional runtime context.
   */
  runtime?: ExecutionContext;
  /**
   * This schema defines the Schedule Type of Application.
   */
  scheduleType: ScheduleType;
  /**
   * Fully Qualified class name for the Python source that will execute the external
   * application.
   */
  sourcePythonClass?: string;
  /**
   * Support Email for the application
   */
  supportEmail?: string;
  /**
   * If the app run can be interrupted as part of the execution.
   */
  supportsInterrupt?: boolean;
  /**
   * A system app cannot be uninstalled or modified.
   */
  system?: boolean;
  /**
   * Tags associated with the entity.
   */
  tags?: TagLabel[];
  /**
   * Last update time corresponding to the new version of the entity in Unix epoch time
   * milliseconds.
   */
  updatedAt?: number;
  /**
   * User who made the update.
   */
  updatedBy?: string;
  /**
   * Metadata version of the entity.
   */
  version?: number;
}

/**
 * This schema defines the type of application.
 */
export enum AppType {
  External = 'external',
  Internal = 'internal',
}

/**
 * Change that lead to this version of the entity.
 *
 * Description of the change.
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
  changedBy?: string;
  changeSource?: ChangeSource;
  [property: string]: any;
}

/**
 * The source of the change. This will change based on the context of the change (example:
 * manual vs programmatic)
 */
export enum ChangeSource {
  Automated = 'Automated',
  Derived = 'Derived',
  Ingested = 'Ingested',
  Manual = 'Manual',
  Propagated = 'Propagated',
  Suggested = 'Suggested',
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
 * Domain the asset belongs to. When not set, the asset inherits the domain from the parent
 * it belongs to.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Owners of this Alert.
 *
 * This schema defines the EntityReferenceList type used for referencing an entity.
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
  config?: { [key: string]: any };
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
  provider?: ProviderType;
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
  ActivityFeed = 'ActivityFeed',
  Custom = 'Custom',
  GovernanceWorkflowChangeEvent = 'GovernanceWorkflowChangeEvent',
  Notification = 'Notification',
  Observability = 'Observability',
}

/**
 * Subscription which has a type and the config.
 */
export interface Destination {
  category: SubscriptionCategory;
  config?: Webhook;
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
  readTimeout?: number;
  statusDetails?: TionStatus;
  /**
   * Connection timeout in seconds. (Default 10s).
   */
  timeout?: number;
  type: SubscriptionType;
}

/**
 * Subscription Endpoint Type.
 */
export enum SubscriptionCategory {
  Admins = 'Admins',
  Assignees = 'Assignees',
  External = 'External',
  Followers = 'Followers',
  Mentions = 'Mentions',
  Owners = 'Owners',
  Teams = 'Teams',
  Users = 'Users',
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
  Post = 'POST',
  Put = 'PUT',
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
  Active = 'active',
  AwaitingRetry = 'awaitingRetry',
  Disabled = 'disabled',
  Failed = 'failed',
  RetryLimitReached = 'retryLimitReached',
  StatusFailed = 'Failed',
  Success = 'Success',
}

/**
 * Subscription Endpoint Type.
 */
export enum SubscriptionType {
  ActivityFeed = 'ActivityFeed',
  Email = 'Email',
  GChat = 'GChat',
  GovernanceWorkflowChangeEvent = 'GovernanceWorkflowChangeEvent',
  MSTeams = 'MsTeams',
  Slack = 'Slack',
  Webhook = 'Webhook',
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
  effect?: Effect;
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
  Exclude = 'exclude',
  Include = 'include',
}

/**
 * Prefix Condition for the filter.
 *
 * Prefix Condition to be applied to the Condition.
 */
export enum PrefixCondition {
  And = 'AND',
  Or = 'OR',
}

/**
 * Type of provider of an entity. Some entities are provided by the `system`. Some are
 * entities created and provided by the `user`. Typically `system` provide entities can't be
 * deleted and can only be disabled.
 */
export enum ProviderType {
  System = 'system',
  User = 'user',
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
  triggerType: TriggerType;
}

/**
 * Schedule Info
 */
export enum ScheduleInfo {
  Custom = 'Custom',
  Daily = 'Daily',
  Monthly = 'Monthly',
  Weekly = 'Weekly',
}

/**
 * Trigger Configuration for Alerts.
 */
export enum TriggerType {
  RealTime = 'RealTime',
  Scheduled = 'Scheduled',
}

/**
 * Permission used by Native Applications.
 *
 * This schema defines the Permission used by Native Application.
 */
export enum Permissions {
  All = 'All',
}

/**
 * If app type is live, user can provide additional runtime context.
 *
 * Execution Configuration.
 *
 * Live Execution object.
 *
 * Scheduled Execution Context Configuration.
 */
export interface ExecutionContext {}

/**
 * This schema defines the Schedule Type of Application.
 *
 * This schema defines the type of application.
 */
export enum ScheduleType {
  Live = 'Live',
  NoSchedule = 'NoSchedule',
  Scheduled = 'Scheduled',
  ScheduledOrManual = 'ScheduledOrManual',
}

/**
 * This schema defines the type for labeling an entity with a Tag.
 */
export interface TagLabel {
  /**
   * Description for the tag label.
   */
  description?: string;
  /**
   * Display Name that identifies this tag.
   */
  displayName?: string;
  /**
   * Link to the tag resource.
   */
  href?: string;
  /**
   * Label type describes how a tag label was applied. 'Manual' indicates the tag label was
   * applied by a person. 'Derived' indicates a tag label was derived using the associated tag
   * relationship (see Classification.json for more details). 'Propagated` indicates a tag
   * label was propagated from upstream based on lineage. 'Automated' is used when a tool was
   * used to determine the tag label.
   */
  labelType: LabelType;
  /**
   * Name of the tag or glossary term.
   */
  name?: string;
  /**
   * Label is from Tags or Glossary.
   */
  source: TagSource;
  /**
   * 'Suggested' state is used when a tag label is suggested by users or tools. Owner of the
   * entity must confirm the suggested labels before it is marked as 'Confirmed'.
   */
  state: State;
  style?: Style;
  tagFQN: string;
}

/**
 * Label type describes how a tag label was applied. 'Manual' indicates the tag label was
 * applied by a person. 'Derived' indicates a tag label was derived using the associated tag
 * relationship (see Classification.json for more details). 'Propagated` indicates a tag
 * label was propagated from upstream based on lineage. 'Automated' is used when a tool was
 * used to determine the tag label.
 */
export enum LabelType {
  Automated = 'Automated',
  Derived = 'Derived',
  Manual = 'Manual',
  Propagated = 'Propagated',
}

/**
 * Label is from Tags or Glossary.
 */
export enum TagSource {
  Classification = 'Classification',
  Glossary = 'Glossary',
}

/**
 * 'Suggested' state is used when a tag label is suggested by users or tools. Owner of the
 * entity must confirm the suggested labels before it is marked as 'Confirmed'.
 */
export enum State {
  Confirmed = 'Confirmed',
  Suggested = 'Suggested',
}

/**
 * UI Style is used to associate a color code and/or icon to entity to customize the look of
 * that entity in UI.
 */
export interface Style {
  /**
   * Hex Color Code to mark an entity such as GlossaryTerm, Tag, Domain or Data Product.
   */
  color?: string;
  /**
   * An icon to associate with GlossaryTerm, Tag, Domain or Data Product.
   */
  iconURL?: string;
}
