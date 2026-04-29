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
 * Request to create a new Task.
 */
export interface CreateTask {
    /**
     * FQN of the entity this task is about.
     */
    about?: string;
    /**
     * Type of the entity this task is about.
     */
    aboutType?: string;
    /**
     * FQNs of users or teams to assign this task to.
     */
    assignees?: string[];
    /**
     * Category of the task.
     */
    category: TaskCategory;
    /**
     * Description of what this task is about.
     */
    description?: string;
    /**
     * Display name for the task.
     */
    displayName?: string;
    /**
     * FQN of the domain this task belongs to.
     */
    domain?: string;
    /**
     * Due date for task completion.
     */
    dueDate?: number;
    /**
     * Reference to external system (JIRA, ServiceNow, etc.).
     */
    externalReference?: ExternalReference;
    /**
     * Name of the task (auto-generated if not provided).
     */
    name?: string;
    /**
     * Task-specific payload validated at runtime by the resolved TaskFormSchema for the task
     * type and category.
     */
    payload?: { [key: string]: any };
    /**
     * Priority of the task.
     */
    priority?: TaskPriority;
    /**
     * FQNs of users or teams who should review this task.
     */
    reviewers?: string[];
    /**
     * Tags for this task.
     */
    tags?: TagLabel[];
    /**
     * Type of the task.
     */
    type: TaskType;
}

/**
 * Category of the task.
 *
 * Category of task for grouping similar task types.
 */
export enum TaskCategory {
    Approval = "Approval",
    Custom = "Custom",
    DataAccess = "DataAccess",
    Incident = "Incident",
    MetadataUpdate = "MetadataUpdate",
    Review = "Review",
}

/**
 * Reference to external system (JIRA, ServiceNow, etc.).
 *
 * Reference to an external system like JIRA or ServiceNow.
 */
export interface ExternalReference {
    /**
     * ID in the external system (e.g., JIRA issue key).
     */
    externalId: string;
    /**
     * URL to view the item in the external system.
     */
    externalUrl?: string;
    /**
     * Timestamp of last sync with external system.
     */
    lastSyncedAt?: number;
    /**
     * Status of sync with external system.
     */
    syncStatus?: SyncStatus;
    /**
     * Name of the external system (e.g., 'jira', 'serviceNow', 'asana', 'github').
     */
    system: string;
}

/**
 * Status of sync with external system.
 */
export enum SyncStatus {
    Conflict = "conflict",
    Error = "error",
    Pending = "pending",
    Synced = "synced",
}

/**
 * Priority of the task.
 *
 * Priority level of the task.
 */
export enum TaskPriority {
    Critical = "Critical",
    High = "High",
    Low = "Low",
    Medium = "Medium",
}

/**
 * This schema defines the type for labeling an entity with a Tag.
 */
export interface TagLabel {
    /**
     * Timestamp when this tag was applied in ISO 8601 format
     */
    appliedAt?: Date;
    /**
     * Who it is that applied this tag (e.g: a bot, AI or a human)
     */
    appliedBy?: string;
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
     * Additional metadata associated with this tag label, such as recognizer information for
     * automatically applied tags.
     */
    metadata?: TagLabelMetadata;
    /**
     * Name of the tag or glossary term.
     */
    name?: string;
    /**
     * An explanation of why this tag was proposed, specially for autoclassification tags
     */
    reason?: string;
    /**
     * Label is from Tags or Glossary.
     */
    source: TagSource;
    /**
     * 'Suggested' state is used when a tag label is suggested by users or tools. Owner of the
     * entity must confirm the suggested labels before it is marked as 'Confirmed'.
     */
    state:  State;
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
    Automated = "Automated",
    Derived = "Derived",
    Generated = "Generated",
    Manual = "Manual",
    Propagated = "Propagated",
}

/**
 * Additional metadata associated with this tag label, such as recognizer information for
 * automatically applied tags.
 *
 * Additional metadata associated with a tag label, including information about how the tag
 * was applied.
 */
export interface TagLabelMetadata {
    /**
     * Epoch time in milliseconds when the certification tag expires
     */
    expiryDate?: number;
    /**
     * Metadata about the recognizer that automatically applied this tag
     */
    recognizer?: TagLabelRecognizerMetadata;
}

/**
 * Metadata about the recognizer that automatically applied this tag
 *
 * Metadata about the recognizer that applied a tag, including scoring and pattern
 * information.
 */
export interface TagLabelRecognizerMetadata {
    /**
     * Details of patterns that matched during recognition
     */
    patterns?: PatternMatch[];
    /**
     * Unique identifier of the recognizer that applied this tag
     */
    recognizerId: string;
    /**
     * Human-readable name of the recognizer
     */
    recognizerName: string;
    /**
     * Confidence score assigned by the recognizer (0.0 to 1.0)
     */
    score: number;
    /**
     * What the recognizer analyzed to apply this tag
     */
    target?: Target;
}

/**
 * Information about a pattern that matched during recognition
 */
export interface PatternMatch {
    /**
     * Name of the pattern that matched
     */
    name: string;
    /**
     * Regular expression or pattern definition
     */
    regex?: string;
    /**
     * Confidence score for this specific pattern match
     */
    score: number;
}

/**
 * What the recognizer analyzed to apply this tag
 */
export enum Target {
    ColumnName = "column_name",
    Content = "content",
}

/**
 * Label is from Tags or Glossary.
 */
export enum TagSource {
    Classification = "Classification",
    Glossary = "Glossary",
}

/**
 * 'Suggested' state is used when a tag label is suggested by users or tools. Owner of the
 * entity must confirm the suggested labels before it is marked as 'Confirmed'.
 */
export enum State {
    Confirmed = "Confirmed",
    Suggested = "Suggested",
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
     * Cover image configuration for the entity.
     */
    coverImage?: CoverImage;
    /**
     * An icon to associate with GlossaryTerm, Tag, Domain or Data Product.
     */
    iconURL?: string;
}

/**
 * Cover image configuration for the entity.
 *
 * Cover image configuration for an entity. This is used to display a banner or header image
 * for entities like Domain, Glossary, Data Product, etc.
 */
export interface CoverImage {
    /**
     * Position of the cover image in CSS background-position format. Supports keywords (top,
     * center, bottom) or pixel values (e.g., '20px 30px').
     */
    position?: string;
    /**
     * URL of the cover image.
     */
    url?: string;
}

/**
 * Type of the task.
 *
 * Type of task determining the workflow and required payload.
 */
export enum TaskType {
    CustomTask = "CustomTask",
    DataAccessRequest = "DataAccessRequest",
    DataQualityReview = "DataQualityReview",
    DescriptionUpdate = "DescriptionUpdate",
    DomainUpdate = "DomainUpdate",
    GlossaryApproval = "GlossaryApproval",
    IncidentResolution = "IncidentResolution",
    OwnershipUpdate = "OwnershipUpdate",
    PipelineReview = "PipelineReview",
    RequestApproval = "RequestApproval",
    Suggestion = "Suggestion",
    TagUpdate = "TagUpdate",
    TestCaseResolution = "TestCaseResolution",
    TierUpdate = "TierUpdate",
}
