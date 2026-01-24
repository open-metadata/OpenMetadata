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
 * Response containing all unique columns grouped by metadata similarity for grid-based
 * editing.
 */
export interface ColumnGridResponse {
    /**
     * List of unique column names with their metadata groups.
     */
    columns: ColumnGridItem[];
    /**
     * Cursor for pagination (Base64-encoded). Use this in the next request to get the next page
     * of results.
     */
    cursor?: string;
    /**
     * Total number of column occurrences across all entities.
     */
    totalOccurrences: number;
    /**
     * Total number of unique column names.
     */
    totalUniqueColumns: number;
}

/**
 * A unique column name with its metadata groups.
 */
export interface ColumnGridItem {
    /**
     * Name of the column.
     */
    columnName: string;
    /**
     * Metadata groups - columns with identical metadata are grouped together.
     */
    groups: ColumnMetadataGroup[];
    /**
     * Whether this column has different metadata across occurrences.
     */
    hasVariations: boolean;
    /**
     * Aggregate metadata status across all occurrences. Uses worst-case: MISSING if any
     * occurrence is missing, INCOMPLETE if any is incomplete, otherwise COMPLETE.
     */
    metadataStatus?: MetadataStatus;
    /**
     * Total number of occurrences for this column name.
     */
    totalOccurrences: number;
}

/**
 * A group of columns with identical metadata.
 */
export interface ColumnMetadataGroup {
    /**
     * Nested columns for STRUCT, MAP, or UNION data types.
     */
    children?: ColumnChild[];
    /**
     * Data type (common across all columns in this group).
     */
    dataType?: string;
    /**
     * Description (common across all columns in this group).
     */
    description?: string;
    /**
     * Display name (common across all columns in this group).
     */
    displayName?: string;
    /**
     * Unique identifier for this metadata group (hash of metadata values).
     */
    groupId: string;
    /**
     * Metadata completeness status for this group.
     */
    metadataStatus?: MetadataStatus;
    /**
     * Number of column occurrences in this group.
     */
    occurrenceCount: number;
    /**
     * List of column occurrences in this group.
     */
    occurrences: ColumnOccurrenceRef[];
    /**
     * Tags (common across all columns in this group).
     */
    tags?: TagLabel[];
}

/**
 * A child column within a STRUCT, MAP, or UNION type.
 */
export interface ColumnChild {
    /**
     * Nested children for deeply nested structures.
     */
    children?: ColumnChild[];
    /**
     * Data type of the child column.
     */
    dataType?: string;
    /**
     * Description of the child column.
     */
    description?: string;
    /**
     * Display name of the child column.
     */
    displayName?: string;
    /**
     * Fully qualified name of the child column.
     */
    fullyQualifiedName?: string;
    /**
     * Name of the child column.
     */
    name: string;
    /**
     * Tags on the child column.
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

/**
 * Metadata completeness status for this group.
 *
 * Metadata completeness status for a column or group of columns.
 *
 * Aggregate metadata status across all occurrences. Uses worst-case: MISSING if any
 * occurrence is missing, INCOMPLETE if any is incomplete, otherwise COMPLETE.
 */
export enum MetadataStatus {
    Complete = "COMPLETE",
    Incomplete = "INCOMPLETE",
    Inconsistent = "INCONSISTENT",
    Missing = "MISSING",
}

/**
 * Reference to a column occurrence.
 */
export interface ColumnOccurrenceRef {
    /**
     * Fully qualified name of the column.
     */
    columnFQN: string;
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
     * Type of entity containing the column.
     */
    entityType: string;
    /**
     * Name of the schema (if applicable).
     */
    schemaName?: string;
    /**
     * Name of the service.
     */
    serviceName?: string;
}
