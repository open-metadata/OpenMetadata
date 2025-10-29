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
 * Create Prompt Template entity request
 */
export interface CreatePromptTemplate {
    /**
     * List of fully qualified names of data products this entity is part of.
     */
    dataProducts?: string[];
    /**
     * Description of the prompt template. Its purpose and usage.
     */
    description?: string;
    /**
     * Display Name that identifies this prompt template.
     */
    displayName?: string;
    /**
     * Fully qualified names of the domains the Prompt Template belongs to.
     */
    domains?: string[];
    /**
     * Example usages of the template
     */
    examples?: PromptExample[];
    /**
     * Entity extension data with custom attributes added to the entity.
     */
    extension?: any;
    /**
     * Name that identifies this prompt template.
     */
    name: string;
    /**
     * Owners of this Prompt Template
     */
    owners?: EntityReference[];
    /**
     * Optional system prompt to accompany the template
     */
    systemPrompt?: string;
    /**
     * Tags for this Prompt Template
     */
    tags?: TagLabel[];
    /**
     * The actual prompt template text with variable placeholders
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
     * Variables used in the template
     */
    variables?: TemplateVariable[];
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
 * Owners of this Prompt Template
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
 * This schema defines the type for labeling an entity with a Tag.
 */
export interface TagLabel {
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
