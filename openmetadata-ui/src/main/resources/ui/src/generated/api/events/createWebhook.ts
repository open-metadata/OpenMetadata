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
export interface CreateWebhook {
  /**
   * Maximum number of events sent in a batch (Default 10).
   */
  batchSize?: number;
  /**
   * Description of the application
   */
  description?: string;
  /**
   * When set to `true`, the webhook event notification is enabled. Set it to `false` to
   * disable the subscription. (Default `true`)
   */
  enabled?: boolean;
  /**
   * Endpoint to receive the webhook events over POST requests.
   */
  endpoint: string;
  /**
   * Event filters to filter for desired events.
   */
  eventFilters: EventFilter[];
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
   * Connection timeout in seconds. (Default = 10s)
   */
  timeout?: number;
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
