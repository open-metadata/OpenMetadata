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
 * Reusable context memory for Context Center and AI-assisted retrieval.
 */
export interface ContextMemory {
    /**
     * Canonical answer or retained guidance represented by this memory.
     */
    answer?: string;
    /**
     * Change that led to this version.
     */
    changeDescription?: ChangeDescription;
    /**
     * When true indicates the entity has been soft deleted.
     */
    deleted?: boolean;
    /**
     * Optional markdown description for the memory.
     */
    description?: string;
    /**
     * Display name of the memory.
     */
    displayName?: string;
    /**
     * Domains this memory belongs to.
     */
    domains?: EntityReference[];
    /**
     * Fully qualified name of the memory.
     */
    fullyQualifiedName?: string;
    /**
     * Link to this resource.
     */
    href?: string;
    /**
     * Unique identifier of the memory.
     */
    id: string;
    /**
     * Incremental change that led to this version.
     */
    incrementalChangeDescription?: ChangeDescription;
    /**
     * Last time the memory was used by AI-assisted retrieval.
     */
    lastUsedAt?:            number;
    machineRepresentation?: MachineRepresentation;
    memoryScope?:           MemoryScope;
    memoryType?:            MemoryType;
    /**
     * Stable system name for the memory.
     */
    name: string;
    /**
     * Owners of this memory.
     */
    owners?: EntityReference[];
    /**
     * Immediate parent memory in an append-style thread.
     */
    parentMemory?: EntityReference;
    /**
     * Primary entity this memory should attach to for reuse.
     */
    primaryEntity?: EntityReference;
    /**
     * Canonical question or instruction represented by this memory.
     */
    question?: string;
    /**
     * Additional related entities this memory applies to.
     */
    relatedEntities?: EntityReference[];
    /**
     * Root memory in an append-style memory thread.
     */
    rootMemory?:  EntityReference;
    shareConfig?: ShareConfig;
    /**
     * Assistant message identifier used to produce this memory.
     */
    sourceAssistantMessage?: string;
    /**
     * Conversation identifier that produced this memory.
     */
    sourceConversation?: string;
    /**
     * The Context Center file this memory was extracted from.
     */
    sourceFile?: EntityReference;
    /**
     * Human message identifier used to produce this memory.
     */
    sourceHumanMessage?: string;
    sourceType?:         SourceType;
    status?:             MemoryStatus;
    /**
     * Optional summary of the memory.
     */
    summary?: string;
    /**
     * Tags associated with this memory.
     */
    tags?: TagLabel[];
    /**
     * Short title shown in Context Center.
     */
    title?: string;
    /**
     * Last update time in Unix epoch time milliseconds.
     */
    updatedAt?: number;
    /**
     * User who made the update.
     */
    updatedBy?: string;
    /**
     * How many times this memory has been used in AI-assisted retrieval.
     */
    usageCount?: number;
    /**
     * Metadata version of the entity.
     */
    version?: number;
}

/**
 * Change that led to this version.
 *
 * Description of the change.
 *
 * Incremental change that led to this version.
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
 * Domains this memory belongs to.
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
 *
 * Immediate parent memory in an append-style thread.
 *
 * Primary entity this memory should attach to for reuse.
 *
 * Root memory in an append-style memory thread.
 *
 * Principal receiving access. Supported principal types are user, team, and domain.
 *
 * The Context Center file this memory was extracted from.
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
 * Optional machine-oriented representation used for prompt packing.
 */
export interface MachineRepresentation {
    /**
     * Compressed or transformed memory content.
     */
    content?: string;
    /**
     * Representation format identifier.
     */
    format?: string;
    /**
     * Timestamp when the representation was generated.
     */
    generatedAt?: number;
    /**
     * Hash of the canonical source content used to generate this representation.
     */
    generatedFromHash?: string;
    status?:            MachineRepresentationStatus;
    /**
     * Version of the representation format.
     */
    version?: string;
}

/**
 * Availability state of the machine-oriented representation.
 */
export enum MachineRepresentationStatus {
    Failed = "Failed",
    Pending = "Pending",
    Ready = "Ready",
    Stale = "Stale",
}

/**
 * Scope where the memory should be applied.
 */
export enum MemoryScope {
    EntityScoped = "EntityScoped",
    UserGlobal = "UserGlobal",
}

/**
 * High-level type of reusable memory.
 */
export enum MemoryType {
    FAQ = "Faq",
    Note = "Note",
    Preference = "Preference",
    Runbook = "Runbook",
    UseCase = "UseCase",
}

/**
 * Visibility and sharing configuration for the memory.
 */
export interface ShareConfig {
    /**
     * Explicit principals the memory is shared with.
     */
    sharedWith?: SharedPrincipal[];
    visibility?: ShareVisibility;
}

/**
 * A principal granted access to the memory.
 */
export interface SharedPrincipal {
    /**
     * Principal receiving access. Supported principal types are user, team, and domain.
     */
    principal?: EntityReference;
    /**
     * Role granted to the principal.
     */
    role?: ShareRole;
}

/**
 * Role granted to the principal.
 *
 * Role granted to a shared principal.
 */
export enum ShareRole {
    Editor = "Editor",
    Viewer = "Viewer",
}

/**
 * Visibility level for the memory.
 */
export enum ShareVisibility {
    Entity = "Entity",
    Private = "Private",
    Shared = "Shared",
}

/**
 * How the memory was created.
 */
export enum SourceType {
    ChatPromotion = "ChatPromotion",
    FileExtraction = "FileExtraction",
    Manual = "Manual",
    RememberRequest = "RememberRequest",
}

/**
 * Lifecycle state of the memory. Any status may be set at creation (e.g. importing an
 * already-archived memory); the Draft -> Active -> Archived transition rules are only
 * enforced on subsequent updates.
 */
export enum MemoryStatus {
    Active = "Active",
    Archived = "Archived",
    Draft = "Draft",
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
