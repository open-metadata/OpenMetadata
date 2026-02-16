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
 * A Task represents an actionable work item for data governance workflows such as data
 * access requests, glossary approvals, metadata updates, and custom workflows. Tasks have
 * their own lifecycle, assignments, and tracking capabilities.
 */
export interface Task {
    /**
     * Reference to the entity this task is about.
     */
    about?: EntityReference;
    /**
     * Hash of the target entity's fully qualified name for efficient querying. Computed from
     * about.fullyQualifiedName using FullyQualifiedName.buildHash().
     */
    aboutFqnHash?: string;
    /**
     * Users or teams assigned to complete this task.
     */
    assignees?: EntityReference[];
    category:   TaskCategory;
    /**
     * Change that lead to this version of the task.
     */
    changeDescription?: ChangeDescription;
    /**
     * Number of comments on this task.
     */
    commentCount?: number;
    /**
     * Comments on this task.
     */
    comments?: TaskComment[];
    /**
     * Timestamp when the task was created.
     */
    createdAt?: number;
    /**
     * User who created this task.
     */
    createdBy: EntityReference;
    /**
     * When true indicates the entity has been soft deleted.
     */
    deleted?: boolean;
    /**
     * Description of the task in Markdown format.
     */
    description?: string;
    /**
     * Display name for the task.
     */
    displayName?: string;
    /**
     * Domains this task belongs to, inherited from the target entity for visibility scoping.
     */
    domains?: EntityReference[];
    /**
     * Due date for task completion.
     */
    dueDate?: number;
    /**
     * Reference to external system (JIRA, ServiceNow, etc.).
     */
    externalReference?:  ExternalReference;
    fullyQualifiedName?: string;
    /**
     * Link to the resource.
     */
    href?: string;
    /**
     * Unique identifier (UUID) for this task.
     */
    id:   string;
    name: string;
    /**
     * Task-specific payload based on task type.
     */
    payload?:  Payload;
    priority?: TaskPriority;
    /**
     * Resolution details when task is completed.
     */
    resolution?: TaskResolution;
    /**
     * Users or teams who should review this task.
     */
    reviewers?: EntityReference[];
    status:     TaskStatus;
    /**
     * Tags for this task.
     */
    tags?: TagLabel[];
    /**
     * Human-readable task identifier (e.g., TASK-00001).
     */
    taskId?: string;
    type:    TaskType;
    /**
     * Last update timestamp.
     */
    updatedAt?: number;
    /**
     * User who made the last update.
     */
    updatedBy?: string;
    /**
     * Metadata version of the entity.
     */
    version?: number;
    /**
     * Users following this task for updates.
     */
    watchers?: EntityReference[];
    /**
     * ID of the workflow instance managing this task.
     */
    workflowInstanceId?: string;
}

/**
 * Reference to the entity this task is about.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Users or teams assigned to complete this task.
 *
 * This schema defines the EntityReferenceList type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * User who posted the comment.
 *
 * User who reacted.
 *
 * User who created this task.
 *
 * Reference to the glossary term being approved.
 *
 * Reference to the failed test case result.
 *
 * Current domain of the entity.
 *
 * Proposed new domain for the entity.
 *
 * User who resolved the task.
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
 * Change that lead to this version of the task.
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
 * A comment on a task.
 */
export interface TaskComment {
    /**
     * User who posted the comment.
     */
    author: EntityReference;
    /**
     * Timestamp when comment was posted.
     */
    createdAt: number;
    /**
     * Unique identifier for the comment.
     */
    id: string;
    /**
     * Comment content in Markdown format.
     */
    message: string;
    /**
     * Reactions to the comment.
     */
    reactions?: Reaction[];
}

/**
 * Reactions to the comment.
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
 * Task-specific payload based on task type.
 *
 * Payload for Suggestion tasks.
 *
 * Payload for Data Access Request tasks.
 *
 * Payload for Glossary Approval tasks.
 *
 * Payload for Test Case Resolution tasks. Links to the TestCaseResolutionStatus workflow
 * via stateId.
 *
 * Payload for Description Update tasks.
 *
 * Payload for Tag Update tasks.
 *
 * Payload for Ownership Update tasks.
 *
 * Payload for Tier Update tasks.
 *
 * Payload for Domain Update tasks.
 *
 * Payload for Incident Resolution tasks.
 *
 * Payload for Review tasks (Pipeline Review, Data Quality Review).
 *
 * Generic payload for custom tasks allowing arbitrary key-value pairs.
 */
export interface Payload {
    /**
     * Confidence score for AI-generated suggestions (0-100).
     *
     * Confidence score for AI-generated descriptions (0-100).
     *
     * Confidence score for AI-generated tag suggestions (0-100).
     */
    confidence?: number;
    /**
     * Current value of the field.
     */
    currentValue?: string;
    /**
     * Path to the field being updated (e.g., 'columns.customer_id.description').
     *
     * Path to the field being updated (e.g., 'columns.customer_id.description' or just
     * 'description' for entity-level).
     *
     * Path to the field being tagged (e.g., 'columns.customer_id' or empty for entity-level).
     */
    fieldPath?: string;
    /**
     * Explanation of why this suggestion was made.
     */
    reasoning?: string;
    /**
     * Source of the suggestion.
     *
     * Source of the update request.
     *
     * Source of the tag update.
     */
    source?: Source;
    /**
     * Suggested new value for the field.
     */
    suggestedValue?: string;
    /**
     * Type of suggestion.
     */
    suggestionType?: SuggestionType;
    /**
     * List of assets being requested access to.
     */
    assets?: EntityReference[];
    /**
     * Requested duration for access (ISO 8601).
     */
    duration?: string;
    /**
     * When the access should expire.
     */
    expirationDate?: number;
    /**
     * Business justification for the request.
     *
     * Reason for the ownership change.
     *
     * Reason for the tier change.
     *
     * Reason for the domain change.
     */
    reason?: string;
    /**
     * Type of access requested.
     */
    requestedAccess?: RequestedAccess;
    /**
     * External ticket ID (JIRA, ServiceNow) if required.
     */
    ticketId?: string;
    /**
     * Action being approved.
     */
    action?: Action;
    /**
     * Current state of the term before changes.
     */
    currentState?: string;
    /**
     * Reference to the glossary term being approved.
     */
    glossaryTerm?: EntityReference;
    /**
     * Proposed state of the term after changes.
     */
    proposedState?: string;
    /**
     * Reason for the test failure.
     */
    failureReason?: string;
    /**
     * How the failure was resolved.
     *
     * How the incident was resolved.
     */
    resolution?: string;
    /**
     * Root cause analysis.
     */
    rootCause?: string;
    /**
     * Severity of the incident.
     */
    severity?: Severity;
    /**
     * State ID linking to the TestCaseResolutionStatus workflow. This groups all status updates
     * for a single incident lifecycle.
     */
    testCaseResolutionStatusId?: string;
    /**
     * Reference to the failed test case result.
     */
    testCaseResult?: EntityReference;
    /**
     * Current description value.
     */
    currentDescription?: string;
    /**
     * Proposed new description value.
     */
    newDescription?: string;
    /**
     * Current tags on the field/entity.
     */
    currentTags?: TagLabel[];
    /**
     * Type of tag operation.
     */
    operation?: Operation;
    /**
     * Tags to be added.
     */
    tagsToAdd?: TagLabel[];
    /**
     * Tags to be removed.
     */
    tagsToRemove?: TagLabel[];
    /**
     * Current owners of the entity.
     */
    currentOwners?: EntityReference[];
    /**
     * Proposed new owners for the entity.
     */
    newOwners?: EntityReference[];
    /**
     * Current tier of the entity.
     */
    currentTier?: TagLabel;
    /**
     * Proposed new tier for the entity.
     */
    newTier?: TagLabel;
    /**
     * Current domain of the entity.
     */
    currentDomain?: EntityReference;
    /**
     * Proposed new domain for the entity.
     */
    newDomain?: EntityReference;
    /**
     * When the incident was resolved.
     */
    endTime?: number;
    /**
     * URL to external incident ticket.
     */
    externalTicketUrl?: string;
    /**
     * Assets impacted by this incident.
     */
    impactedAssets?: EntityReference[];
    /**
     * Type of incident.
     */
    incidentType?: IncidentType;
    /**
     * Measures to prevent recurrence.
     */
    preventiveMeasures?: string;
    /**
     * When the incident started.
     */
    startTime?: number;
    /**
     * Supporting documents or evidence.
     */
    attachments?: ReviewAttachment[];
    /**
     * Review findings and observations.
     */
    findings?: string;
    /**
     * Reviewer's recommendation.
     */
    recommendation?: Recommendation;
    /**
     * Criteria to be reviewed.
     */
    reviewCriteria?: ReviewCriterion[];
    /**
     * Type of review.
     */
    reviewType?: ReviewType;
    /**
     * Generic data content for the task.
     */
    data?: string;
    /**
     * Additional metadata as key-value pairs.
     */
    metadata?: { [key: string]: any };
    [property: string]: any;
}

/**
 * Action being approved.
 */
export enum Action {
    Create = "Create",
    Delete = "Delete",
    Update = "Update",
}

/**
 * An attachment for a review.
 */
export interface ReviewAttachment {
    /**
     * Description of the attachment.
     */
    description?: string;
    /**
     * Name of the attachment.
     */
    name?: string;
    /**
     * URL to the attachment.
     */
    url?: string;
}

/**
 * This schema defines the type for labeling an entity with a Tag.
 *
 * Current tier of the entity.
 *
 * Proposed new tier for the entity.
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
 * Type of incident.
 */
export enum IncidentType {
    Custom = "Custom",
    DataQuality = "DataQuality",
    Freshness = "Freshness",
    Pipeline = "Pipeline",
    Schema = "Schema",
    Volume = "Volume",
}

/**
 * Type of tag operation.
 */
export enum Operation {
    Add = "Add",
    Remove = "Remove",
    Replace = "Replace",
}

/**
 * Reviewer's recommendation.
 */
export enum Recommendation {
    Approve = "Approve",
    Defer = "Defer",
    NeedsWork = "NeedsWork",
    Reject = "Reject",
}

/**
 * Type of access requested.
 */
export enum RequestedAccess {
    Admin = "Admin",
    Read = "Read",
    Write = "Write",
}

/**
 * A single review criterion with status.
 */
export interface ReviewCriterion {
    /**
     * Name of the criterion.
     */
    criterion?: string;
    /**
     * Notes about this criterion.
     */
    notes?: string;
    /**
     * Status of this criterion.
     */
    status?: Status;
}

/**
 * Status of this criterion.
 */
export enum Status {
    Failed = "Failed",
    NotApplicable = "NotApplicable",
    Passed = "Passed",
    Pending = "Pending",
}

/**
 * Type of review.
 */
export enum ReviewType {
    Custom = "Custom",
    DataQuality = "DataQuality",
    Documentation = "Documentation",
    Pipeline = "Pipeline",
    Schema = "Schema",
    Security = "Security",
}

/**
 * Severity of the incident.
 */
export enum Severity {
    Critical = "Critical",
    High = "High",
    Low = "Low",
    Medium = "Medium",
    Severity1 = "Severity1",
    Severity2 = "Severity2",
    Severity3 = "Severity3",
    Severity4 = "Severity4",
    Severity5 = "Severity5",
}

/**
 * Source of the suggestion.
 *
 * Source of the update request.
 *
 * Source of the tag update.
 */
export enum Source {
    Agent = "Agent",
    AutoPilot = "AutoPilot",
    Classification = "Classification",
    Ingestion = "Ingestion",
    User = "User",
}

/**
 * Type of suggestion.
 */
export enum SuggestionType {
    CustomProperty = "CustomProperty",
    Description = "Description",
    Domain = "Domain",
    Owner = "Owner",
    Tag = "Tag",
    Tier = "Tier",
}

/**
 * Priority level of the task.
 */
export enum TaskPriority {
    Critical = "Critical",
    High = "High",
    Low = "Low",
    Medium = "Medium",
}

/**
 * Resolution details when task is completed.
 *
 * Details about how the task was resolved.
 */
export interface TaskResolution {
    /**
     * Optional comment explaining the resolution.
     */
    comment?: string;
    /**
     * The new value that was applied when task was resolved (for update tasks).
     */
    newValue?: string;
    /**
     * Timestamp when the task was resolved.
     */
    resolvedAt?: number;
    /**
     * User who resolved the task.
     */
    resolvedBy?: EntityReference;
    type?:       ResolutionType;
}

/**
 * How the task was resolved.
 */
export enum ResolutionType {
    Approved = "Approved",
    AutoApproved = "AutoApproved",
    AutoRejected = "AutoRejected",
    Cancelled = "Cancelled",
    Completed = "Completed",
    Rejected = "Rejected",
    TimedOut = "TimedOut",
}

/**
 * Current status of the task in its lifecycle.
 */
export enum TaskStatus {
    Approved = "Approved",
    Cancelled = "Cancelled",
    Completed = "Completed",
    Failed = "Failed",
    InProgress = "InProgress",
    Open = "Open",
    Pending = "Pending",
    Rejected = "Rejected",
}

/**
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
    Suggestion = "Suggestion",
    TagUpdate = "TagUpdate",
    TestCaseResolution = "TestCaseResolution",
    TierUpdate = "TierUpdate",
}
