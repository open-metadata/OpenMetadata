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
 * This schema defines the change event type to capture the changes to entities. Entities
 * change due to user activity, such as updating description of a dataset, changing
 * ownership, or adding new tags. Entity also changes due to activities at the metadata
 * sources, such as a new dataset was created, a datasets was deleted, or schema of a
 * dataset is modified. When state of entity changes, an event is produced. These events can
 * be used to build apps and bots that respond to the change from activities.
 */
export interface ChangeEvent {
  /**
   * For `eventType` `entityUpdated` this field captures details about what fields were
   * added/updated/deleted. For `eventType` `entityCreated` or `entityDeleted` this field is
   * null.
   */
  changeDescription?: ChangeDescription;
  /**
   * Current version of the entity after this change. Note that not all changes result in
   * entity version change. When entity version is not changed, `previousVersion` is same as
   * `currentVersion`.
   */
  currentVersion?: number;
  /**
   * For `eventType` `entityCreated`, this field captures JSON coded string of the entity
   * using the schema corresponding to `entityType`.
   */
  entity?: any;
  /**
   * Fully Qualified Name of entity that was modified by the operation.
   */
  entityFullyQualifiedName?: string;
  /**
   * Identifier of entity that was modified by the operation.
   */
  entityId: string;
  /**
   * Entity type that changed. Use the schema of this entity to process the entity attribute.
   */
  entityType: string;
  eventType: EventType;
  /**
   * Version of the entity before this change. Note that not all changes result in entity
   * version change. When entity version is not changed, `previousVersion` is same as
   * `currentVersion`.
   */
  previousVersion?: number;
  /**
   * Timestamp when the change was made in Unix epoch time milliseconds.
   */
  timestamp: number;
  /**
   * Name of the user whose activity resulted in the change.
   */
  userName?: string;
}

/**
 * For `eventType` `entityUpdated` this field captures details about what fields were
 * added/updated/deleted. For `eventType` `entityCreated` or `entityDeleted` this field is
 * null.
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

/**
 * Type of event.
 */
export enum EventType {
  EntityCreated = 'entityCreated',
  EntityDeleted = 'entityDeleted',
  EntityUpdated = 'entityUpdated',
}
