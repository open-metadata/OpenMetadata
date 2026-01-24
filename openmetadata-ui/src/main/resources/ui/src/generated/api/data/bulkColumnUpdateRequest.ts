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
 * Bulk update request for updating column metadata (description, display name, tags,
 * glossary terms) across entities. Supports two modes: 1) Search-based: provide columnName
 * and filters to find and update all matching columns, 2) Explicit: provide specific list
 * of column FQNs to update.
 */
export interface BulkColumnUpdateRequest {
    /**
     * Column name to search for (exact match, case-sensitive). When provided, the system will
     * search for all columns with this name and apply updates based on filters.
     */
    columnName?: string;
    /**
     * Explicit list of column updates (alternative to search-based mode). Use this when you
     * want to update specific columns by FQN.
     */
    columnUpdates?: ColumnUpdate[];
    /**
     * Filter by database name.
     */
    databaseName?: string;
    /**
     * Description to apply to all matching columns.
     */
    description?: string;
    /**
     * Display Name to apply to all matching columns.
     */
    displayName?: string;
    /**
     * Filter by domain ID.
     */
    domainId?: string;
    /**
     * If true, performs a dry-run to preview which columns will be updated without actually
     * making changes. Returns a list of columns that would be affected.
     */
    dryRun?: boolean;
    /**
     * Filter by entity types (e.g., table, dashboardDataModel). If not provided, searches
     * across all supported types.
     */
    entityTypes?: string[];
    /**
     * Filter by schema name.
     */
    schemaName?: string;
    /**
     * Filter by service name.
     */
    serviceName?: string;
    /**
     * Tags and glossary terms to apply to all matching columns. Provide an empty array to
     * remove all tags.
     */
    tags?: TagLabel[];
}

/**
 * Individual column update with FQN and metadata changes.
 */
export interface ColumnUpdate {
    /**
     * Fully qualified name of the column to update.
     */
    columnFQN: string;
    /**
     * Description of the column.
     */
    description?: string;
    /**
     * Display Name that identifies this column name.
     */
    displayName?: string;
    /**
     * Type of entity containing the column (table or dashboardDataModel).
     */
    entityType: string;
    /**
     * Tags and glossary terms associated with the column. Provide an empty array to remove all
     * tags.
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
