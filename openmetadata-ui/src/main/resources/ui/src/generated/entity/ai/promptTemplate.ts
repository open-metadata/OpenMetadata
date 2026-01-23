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
 * Prompt Template entity representing a reusable prompt template for AI agents. Templates
 * can include variables, system prompts, and examples for consistent AI behavior.
 */
export interface PromptTemplate {
    /**
     * Change that led to this version
     */
    changeDescription?: ChangeDescription;
    /**
     * When true, indicates the entity has been soft deleted
     */
    deleted?: boolean;
    /**
     * Description of the Prompt Template and its purpose
     */
    description?: string;
    /**
     * Display name for the Prompt Template
     */
    displayName?: string;
    /**
     * Domain the Prompt Template belongs to
     */
    domain?: EntityReference;
    /**
     * Domains the Prompt Template belongs to
     */
    domains?: EntityReference[];
    /**
     * Examples demonstrating how to use this template
     */
    examples?: PromptExample[];
    /**
     * Entity extension data with custom attributes
     */
    extension?: any;
    /**
     * Followers of this Prompt Template
     */
    followers?: EntityReference[];
    /**
     * Fully qualified name of the Prompt Template
     */
    fullyQualifiedName?: string;
    /**
     * Link to this resource
     */
    href?: string;
    /**
     * Unique identifier of the Prompt Template
     */
    id: string;
    /**
     * Change that led to this version
     */
    incrementalChangeDescription?: ChangeDescription;
    /**
     * Life Cycle properties of the entity
     */
    lifeCycle?: LifeCycle;
    metrics?:   PromptMetrics;
    /**
     * Name that identifies this Prompt Template
     */
    name: string;
    /**
     * Owners of this Prompt Template
     */
    owners?: EntityReference[];
    /**
     * Reference to parent template if this is a version/fork
     */
    parentTemplate?: EntityReference;
    /**
     * Source hash of the entity
     */
    sourceHash?: string;
    /**
     * System prompt to set the AI's behavior and context
     */
    systemPrompt?: string;
    /**
     * Tags for this Prompt Template
     */
    tags?: TagLabel[];
    /**
     * The actual prompt template content with variables in {{variable}} format
     */
    templateContent: string;
    /**
     * Type of prompt template
     */
    templateType?: TemplateType;
    /**
     * Template version for tracking changes
     */
    templateVersion?: string;
    /**
     * Last update time in Unix epoch milliseconds
     */
    updatedAt?: number;
    /**
     * User who made the update
     */
    updatedBy?: string;
    /**
     * AI Agents using this template
     */
    usedByAgents?: EntityReference[];
    /**
     * Variables used in this template
     */
    variables?: TemplateVariable[];
    /**
     * Metadata version of the entity
     */
    version?: number;
    /**
     * Votes on the entity
     */
    votes?: Votes;
}

/**
 * Change that led to this version
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
 * Domain the Prompt Template belongs to
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Domains the Prompt Template belongs to
 *
 * This schema defines the EntityReferenceList type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * User, Pipeline, Query that created,updated or accessed the data asset
 *
 * Reference to parent template if this is a version/fork
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
 * Example of how to use this prompt template
 */
export interface PromptExample {
    /**
     * Description of this example
     */
    description?: string;
    /**
     * Expected output for this example
     */
    expectedOutput?: string;
    /**
     * Example name
     */
    name?: string;
    /**
     * Example variable values
     */
    variables?: { [key: string]: string };
}

/**
 * Life Cycle properties of the entity
 *
 * This schema defines Life Cycle Properties.
 */
export interface LifeCycle {
    /**
     * Access Details about accessed aspect of the data asset
     */
    accessed?: AccessDetails;
    /**
     * Access Details about created aspect of the data asset
     */
    created?: AccessDetails;
    /**
     * Access Details about updated aspect of the data asset
     */
    updated?: AccessDetails;
}

/**
 * Access Details about accessed aspect of the data asset
 *
 * Access details of an entity
 *
 * Access Details about created aspect of the data asset
 *
 * Access Details about updated aspect of the data asset
 */
export interface AccessDetails {
    /**
     * User, Pipeline, Query that created,updated or accessed the data asset
     */
    accessedBy?: EntityReference;
    /**
     * Any process that accessed the data asset that is not captured in OpenMetadata.
     */
    accessedByAProcess?: string;
    /**
     * Timestamp of data asset accessed for creation, update, read.
     */
    timestamp: number;
}

/**
 * Usage and performance metrics for the prompt template
 */
export interface PromptMetrics {
    /**
     * Average latency in milliseconds
     */
    averageLatencyMs?: number;
    /**
     * Average tokens used when rendering this template
     */
    averageTokens?: number;
    lastUsedAt?:    number;
    /**
     * Success rate (0-1) of executions using this template
     */
    successRate?: number;
    /**
     * Number of times this template has been used
     */
    usageCount?: number;
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
 * Type of prompt template
 */
export enum TemplateType {
    ChatCompletion = "ChatCompletion",
    Classification = "Classification",
    CodeGeneration = "CodeGeneration",
    Custom = "Custom",
    Embedding = "Embedding",
    Extraction = "Extraction",
    TextGeneration = "TextGeneration",
}

/**
 * Variable definition in the prompt template
 */
export interface TemplateVariable {
    /**
     * Expected data type for this variable
     */
    dataType?: DataType;
    /**
     * Default value if not provided
     */
    defaultValue?: string;
    /**
     * Description of what this variable represents
     */
    description?: string;
    /**
     * Variable name (e.g., 'user_query', 'context')
     */
    name: string;
    /**
     * Whether this variable is required
     */
    required?: boolean;
    /**
     * Regex pattern for validation
     */
    validationPattern?: string;
}

/**
 * Expected data type for this variable
 */
export enum DataType {
    Array = "Array",
    Boolean = "Boolean",
    Number = "Number",
    Object = "Object",
    String = "String",
}

/**
 * Votes on the entity
 *
 * This schema defines the Votes for a Data Asset.
 */
export interface Votes {
    /**
     * List of all the Users who downVoted
     */
    downVoters?: EntityReference[];
    /**
     * Total down-votes the entity has
     */
    downVotes?: number;
    /**
     * List of all the Users who upVoted
     */
    upVoters?: EntityReference[];
    /**
     * Total up-votes the entity has
     */
    upVotes?: number;
}
