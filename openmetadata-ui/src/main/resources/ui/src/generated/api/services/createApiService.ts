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
 * Create API Service entity request
 */
export interface CreateAPIService {
    connection?: APIConnection;
    /**
     * List of fully qualified names of data products this entity is part of.
     */
    dataProducts?: string[];
    /**
     * Description of API service entity.
     */
    description?: string;
    /**
     * Display Name that identifies this API service. It could be title or label from the source
     * services.
     */
    displayName?: string;
    /**
     * Fully qualified names of the domains the API Service belongs to.
     */
    domains?: string[];
    /**
     * The ingestion agent responsible for executing the ingestion pipeline.
     */
    ingestionRunner?: EntityReference;
    /**
     * Name that identifies the this entity instance uniquely
     */
    name: string;
    /**
     * Owners of this API service.
     */
    owners?:     EntityReference[];
    serviceType: APIServiceType;
    /**
     * Tags for this API Service.
     */
    tags?: TagLabel[];
}

/**
 * API Service Connection.
 */
export interface APIConnection {
    config?: RESTConnection;
}

/**
 * REST Connection Config
 */
export interface RESTConnection {
    /**
     * Regex to only fetch api collections with names matching the pattern.
     */
    apiCollectionFilterPattern?: FilterPattern;
    /**
     * Regex to only fetch api endpoints with names matching the pattern.
     */
    apiEndpointFilterPattern?: FilterPattern;
    /**
     * Documentation URL for the schema.
     */
    docURL?: string;
    /**
     * OpenAPI Schema source config. Either a URL or a file path must be provided.
     */
    openAPISchemaConnection: OpenAPISchemaConnection;
    /**
     * Supports Metadata Extraction.
     */
    supportsMetadataExtraction?: boolean;
    /**
     * Generated Token to connect to OpenAPI Schema.
     */
    token?: string;
    /**
     * REST API Type
     */
    type?: RESTType;
}

/**
 * Regex to only fetch api collections with names matching the pattern.
 *
 * Regex to only fetch entities that matches the pattern.
 *
 * Regex to only fetch api endpoints with names matching the pattern.
 */
export interface FilterPattern {
    /**
     * List of strings/regex patterns to match and exclude only database entities that match.
     */
    excludes?: string[];
    /**
     * List of strings/regex patterns to match and include only database entities that match.
     */
    includes?: string[];
}

/**
 * OpenAPI Schema source config. Either a URL or a file path must be provided.
 *
 * Open API Schema URL Connection Config
 *
 * Open API Schema File Path Connection Config
 */
export interface OpenAPISchemaConnection {
    /**
     * Open API Schema URL.
     */
    openAPISchemaURL?: string;
    /**
     * Path to a local OpenAPI schema file.
     */
    openAPISchemaFilePath?: string;
}

/**
 * REST API Type
 *
 * REST API type
 */
export enum RESTType {
    REST = "Rest",
}

/**
 * The ingestion agent responsible for executing the ingestion pipeline.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Owners of this API service.
 *
 * This schema defines the EntityReferenceList type used for referencing an entity.
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
 * Type of api service such as REST, Webhook,...
 */
export enum APIServiceType {
    REST = "Rest",
    Webhook = "WEBHOOK",
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
