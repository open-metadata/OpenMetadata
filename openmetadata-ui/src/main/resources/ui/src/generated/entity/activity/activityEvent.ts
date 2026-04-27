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
 * A lightweight activity notification for user dashboards and feeds. NOT for compliance,
 * audit trails, or workflows - use entity version history and Task entity for those
 * purposes.
 */
export interface ActivityEvent {
    /**
     * EntityLink string identifying the specific entity/field/column the activity is about.
     * Format: <#E::entityType::fqn::fieldName::arrayFieldName::arrayFieldValue>
     */
    about?: string;
    /**
     * User or bot who performed the action.
     */
    actor: EntityReference;
    /**
     * Optional structured change description with field-level details.
     */
    changeDescription?: ChangeDescription;
    /**
     * Domains this activity belongs to, inherited from the source entity for domain-scoped
     * visibility.
     */
    domains?: EntityReference[];
    /**
     * Reference to the entity that changed.
     */
    entity: EntityReference;
    /**
     * Type of activity that occurred.
     */
    eventType: ActivityEventType;
    /**
     * Name of the field that was changed, if applicable.
     */
    fieldName?: string;
    /**
     * Unique identifier for this activity event.
     */
    id: string;
    /**
     * New value (truncated for display, not for audit).
     */
    newValue?: string;
    /**
     * Previous value (truncated for display, not for audit).
     */
    oldValue?: string;
    /**
     * Reactions for this activity event.
     */
    reactions?: Reaction[];
    /**
     * Human-readable summary of the activity for display.
     */
    summary?: string;
    /**
     * Timestamp when the activity occurred in Unix epoch time milliseconds.
     */
    timestamp: number;
}

/**
 * User or bot who performed the action.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Domains this activity belongs to, inherited from the source entity for domain-scoped
 * visibility.
 *
 * This schema defines the EntityReferenceList type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Reference to the entity that changed.
 *
 * User who reacted.
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
 * Optional structured change description with field-level details.
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
 * Type of activity that occurred.
 *
 * Type of activity event.
 */
export enum ActivityEventType {
    ColumnDescriptionUpdated = "ColumnDescriptionUpdated",
    ColumnTagsUpdated = "ColumnTagsUpdated",
    CustomPropertyUpdated = "CustomPropertyUpdated",
    DescriptionUpdated = "DescriptionUpdated",
    DomainUpdated = "DomainUpdated",
    EntityCreated = "EntityCreated",
    EntityDeleted = "EntityDeleted",
    EntityRestored = "EntityRestored",
    EntitySoftDeleted = "EntitySoftDeleted",
    EntityUpdated = "EntityUpdated",
    OwnerUpdated = "OwnerUpdated",
    PipelineStatusChanged = "PipelineStatusChanged",
    TagsUpdated = "TagsUpdated",
    TestCaseStatusChanged = "TestCaseStatusChanged",
    TierUpdated = "TierUpdated",
}

/**
 * Reactions for this activity event.
 *
 * This schema defines the reaction to an entity or a conversation in the activity feeds.
 */
export interface Reaction {
    reactionType: ReactionType;
    /**
     * User who reacted.
     */
    user: EntityReference;
}

/**
 * Type of reaction.
 */
export enum ReactionType {
    Confused = "confused",
    Eyes = "eyes",
    Heart = "heart",
    Hooray = "hooray",
    Laugh = "laugh",
    Rocket = "rocket",
    ThumbsDown = "thumbsDown",
    ThumbsUp = "thumbsUp",
}
