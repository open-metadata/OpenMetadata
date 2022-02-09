/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 *  Copyright 2021 Collate
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
 * This schema defines webhook for receiving events from OpenMetadata
 */
export interface Webhook {
  /**
   * Maximum number of events sent in a batch (Default 10).
   */
  batchSize?: number;
  /**
   * Change that lead to this version of the entity.
   */
  changeDescription?: ChangeDescription;
  /**
   * When `true` indicates the entity has been soft deleted.
   */
  deleted?: boolean;
  /**
   * Description of the application.
   */
  description?: string;
  /**
   * When set to `true`, the webhook event notification is enabled. Set it to `false` to
   * disable the subscription. (Default `true`).
   */
  enabled?: boolean;
  /**
   * Endpoint to receive the webhook events over POST requests.
   */
  endpoint: string;
  /**
   * Endpoint to receive the webhook events over POST requests.
   */
  eventFilters: EventFilter[];
  /**
   * Failure details are set only when `status` is not `success`.
   */
  failureDetails?: FailureDetails;
  /**
   * Link to this webhook resource.
   */
  href?: string;
  /**
   * Unique ID associated with a webhook subscription.
   */
  id: string;
  /**
   * Unique name of the application receiving webhook events.
   */
  name: string;
  /**
   * Secret set by the webhook client used for computing HMAC SHA256 signature of webhook
   * payload and sent in `X-OM-Signature` header in POST requests to publish the events.
   */
  secretKey?: string;
  /**
   * Status is `notStarted`, when webhook was created with `enabled` set to false and it never
   * started publishing events. Status is `started` when webhook is normally functioning and
   * 200 OK response was received for callback notification. Status is `failed` on bad
   * callback URL, connection failures, `1xx`, and `3xx` response was received for callback
   * notification. Status is `awaitingRetry` when previous attempt at callback timed out or
   * received `4xx`, `5xx` response. Status is `retryLimitReached` after all retries fail.
   */
  status?: Status;
  /**
   * Connection timeout in seconds. (Default 10s).
   */
  timeout?: number;
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
 * Change that lead to this version of the entity.
 *
 * Description of the change.
 */
export interface ChangeDescription {
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

export interface EventFilter {
  /**
   * Entities for which the events are needed. Example - `table`, `topic`, etc. **When not
   * set, events for all the entities will be provided**.
   */
  entities?: string[];
  /**
   * Event type that is being requested.
   */
  eventType: EventType;
}

/**
 * Event type that is being requested.
 *
 * Type of event.
 */
export enum EventType {
  EntityCreated = 'entityCreated',
  EntityDeleted = 'entityDeleted',
  EntitySoftDeleted = 'entitySoftDeleted',
  EntityUpdated = 'entityUpdated',
}

/**
 * Failure details are set only when `status` is not `success`.
 */
export interface FailureDetails {
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
}

/**
 * Status is `notStarted`, when webhook was created with `enabled` set to false and it never
 * started publishing events. Status is `started` when webhook is normally functioning and
 * 200 OK response was received for callback notification. Status is `failed` on bad
 * callback URL, connection failures, `1xx`, and `3xx` response was received for callback
 * notification. Status is `awaitingRetry` when previous attempt at callback timed out or
 * received `4xx`, `5xx` response. Status is `retryLimitReached` after all retries fail.
 */
export enum Status {
  AwaitingRetry = 'awaitingRetry',
  Failed = 'failed',
  NotStarted = 'notStarted',
  RetryLimitReached = 'retryLimitReached',
  Started = 'started',
}
