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
 * Preview response for bulk column update showing what will change for each column.
 */
export interface BulkColumnUpdatePreview {
    /**
     * List of column update previews showing current vs new values.
     */
    columnPreviews: ColumnUpdatePreview[];
    /**
     * Total number of columns that will be updated.
     */
    totalColumns: number;
}

/**
 * Preview of changes for a single column showing diff between current and new values.
 */
export interface ColumnUpdatePreview {
    /**
     * Fully qualified name of the column.
     */
    columnFQN: string;
    /**
     * Current column metadata values.
     */
    currentValues: ColumnMetadata;
    /**
     * Name of the database (if applicable).
     */
    databaseName?: string;
    /**
     * Display name of the parent entity.
     */
    entityDisplayName?: string;
    /**
     * Fully qualified name of the parent entity.
     */
    entityFQN: string;
    /**
     * Type of entity containing the column (table, dashboardDataModel, etc.).
     */
    entityType: string;
    /**
     * True if there are actual changes between current and new values.
     */
    hasChanges: boolean;
    /**
     * New column metadata values that will be applied.
     */
    newValues: ColumnMetadata;
    /**
     * Name of the schema (if applicable).
     */
    schemaName?: string;
    /**
     * Name of the service.
     */
    serviceName?: string;
}

/**
 * Current column metadata values.
 *
 * Column metadata including display name, description, tags, and glossary terms.
 *
 * New column metadata values that will be applied.
 */
export interface ColumnMetadata {
    /**
     * Description of the column.
     */
    description?: string;
    /**
     * Display name of the column.
     */
    displayName?: string;
    /**
     * Tags and glossary terms associated with the column.
     */
    tags?: TagLabel[];
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
