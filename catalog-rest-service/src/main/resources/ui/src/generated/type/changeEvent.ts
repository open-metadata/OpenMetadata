/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * This schema defines the change event type to capture the changes to entities. Entities
 * change due to user activity, such as updating description of a dataset, changing
 * ownership, or adding new tags. Entity also changes due to activities at the metadata
 * sources, such as a new dataset was created, a datasets was deleted, or schema of a
 * dataset is modified. When state of entity changes, an event is produced. These events can
 * be used to build apps and bots that respond to the change from activities.
 */
export interface ChangeEvent {
  /**
   * Date and time when the change was made.
   */
  dateTime: Date;
  /**
   * Entity that changed.
   */
  entity: any;
  /**
   * Entity type that changed. Use the schema of this entity to process the entity attribute.
   */
  entityType?: string;
  eventType: EventType;
  /**
   * API operation that was result of user activity resulted in the change.
   */
  operation: any;
  /**
   * Name of the user whose activity resulted in the change.
   */
  userName: string;
}

/**
 * Type of event
 */
export enum EventType {
  EntityCreated = 'ENTITY_CREATED',
  EntityDeleted = 'ENTITY_DELETED',
  EntityFollowed = 'ENTITY_FOLLOWED',
  EntityUnfollowed = 'ENTITY_UNFOLLOWED',
  EntityUpdated = 'ENTITY_UPDATED',
}
