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
 * Schema defining a Typed Event with its status, data, and timestamp.
 */
export interface TypedEvent {
    /**
     * The event data, which can be of different types depending on the status.
     */
    data: ChangeEvent[];
    /**
     * The status of the event, such as 'failed', 'successful', or 'unprocessed'.
     */
    status: Status;
    /**
     * The timestamp when the event occurred, represented as a long.
     */
    timestamp: number;
}

/**
 * This schema defines the change event type to capture the changes to entities. Entities
 * change due to user activity, such as updating description of a dataset, changing
 * ownership, or adding new tags. Entity also changes due to activities at the metadata
 * sources, such as a new dataset was created, a datasets was deleted, or schema of a
 * dataset is modified. When state of entity changes, an event is produced. These events can
 * be used to build apps and bots that respond to the change from activities.
 *
 * Change Event that failed
 *
 * Failed Events Schema
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
     * Domain the entity belongs to.
     */
    domains?: string[];
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
    entityId?: string;
    /**
     * Entity type that changed. Use the schema of this entity to process the entity attribute.
     */
    entityType?: string;
    eventType?:  EventType;
    /**
     * Unique identifier for the event.
     */
    id?: string;
    /**
     * Change that lead to this version of the entity.
     */
    incrementalChangeDescription?: ChangeDescription;
    /**
     * Version of the entity before this change. Note that not all changes result in entity
     * version change. When entity version is not changed, `previousVersion` is same as
     * `currentVersion`.
     */
    previousVersion?: number;
    /**
     * Timestamp when the change was made in Unix epoch time milliseconds.
     *
     * Time of Failure
     */
    timestamp?: number;
    /**
     * Name of the user whose activity resulted in the change.
     */
    userName?: string;
    /**
     * Change Event that failed
     */
    changeEvent?: ChangeEventClass;
    /**
     * Unique identifier that identifies this Event Subscription.
     */
    failingSubscriptionId?: string;
    /**
     * Reason for failure
     */
    reason?: string;
    /**
     * Source of the failed event
     */
    source?: string;
}

/**
 * For `eventType` `entityUpdated` this field captures details about what fields were
 * added/updated/deleted. For `eventType` `entityCreated` or `entityDeleted` this field is
 * null.
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
 * This schema defines the change event type to capture the changes to entities. Entities
 * change due to user activity, such as updating description of a dataset, changing
 * ownership, or adding new tags. Entity also changes due to activities at the metadata
 * sources, such as a new dataset was created, a datasets was deleted, or schema of a
 * dataset is modified. When state of entity changes, an event is produced. These events can
 * be used to build apps and bots that respond to the change from activities.
 *
 * Change Event that failed
 */
export interface ChangeEventClass {
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
     * Domain the entity belongs to.
     */
    domains?: string[];
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
    eventType:  EventType;
    /**
     * Unique identifier for the event.
     */
    id: string;
    /**
     * Change that lead to this version of the entity.
     */
    incrementalChangeDescription?: ChangeDescription;
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
 * Type of event.
 */
export enum EventType {
    EntityCreated = "entityCreated",
    EntityDeleted = "entityDeleted",
    EntityFieldsChanged = "entityFieldsChanged",
    EntityNoChange = "entityNoChange",
    EntityRestored = "entityRestored",
    EntitySoftDeleted = "entitySoftDeleted",
    EntityUpdated = "entityUpdated",
    LogicalTestCaseAdded = "logicalTestCaseAdded",
    PostCreated = "postCreated",
    PostUpdated = "postUpdated",
    SuggestionAccepted = "suggestionAccepted",
    SuggestionCreated = "suggestionCreated",
    SuggestionDeleted = "suggestionDeleted",
    SuggestionRejected = "suggestionRejected",
    SuggestionUpdated = "suggestionUpdated",
    TaskClosed = "taskClosed",
    TaskResolved = "taskResolved",
    ThreadCreated = "threadCreated",
    ThreadUpdated = "threadUpdated",
}

/**
 * The status of the event, such as 'failed', 'successful', or 'unprocessed'.
 */
export enum Status {
    Failed = "failed",
    Successful = "successful",
    Unprocessed = "unprocessed",
}
