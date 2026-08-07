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
 * Cross-service-type overview: per-entity-type service counts plus one globally name-sorted
 * page of slim service summaries. Serves list UIs that show all service types side by side
 * without issuing one request per type. Connection configuration is never returned. Deep
 * pagination is bounded: `offset` + `limit` must not exceed 10000; beyond that use the
 * per-service-type list APIs with cursor pagination.
 */
export interface ServicesOverview {
    /**
     * Number of services per service entity type. Reflects `entityType`, `include`, `domain`,
     * `excludeProvider` and `q`. NOT affected by `listEntityType`, `serviceType` or `health`.
     * Every entity type in the requested universe is present, with 0 when empty.
     */
    counts: { [key: string]: number };
    /**
     * One globally name-sorted page of service summaries, merged across the listed service
     * entity types.
     */
    data: ServiceSummary[];
    /**
     * Number of services per health state, nested under each service entity type, e.g.
     * `{"databaseService": {"failed": 2, "success": 5}}`. Same filters as `counts`, and always
     * sums to `counts` for that entity type. Empty unless `includeHealth` is `true`, and also
     * empty when any requested service type holds more than 10000 services — the tally is
     * omitted rather than approximated, while `data[*].health` remains exact at any size.
     * Filtering by `health` is rejected in that case, since the list cannot be filtered without
     * resolving every service.
     */
    healthCounts?: { [key: string]: { [key: string]: number } };
    /**
     * Offset based paging for `data`. `paging.total` is `total` restricted to `listEntityType`,
     * `serviceType` and `health`, which may be smaller than `total`.
     */
    paging: Paging;
    /**
     * Number of services per connector type, nested under each service entity type, e.g.
     * `{"databaseService": {"Snowflake": 3, "Mysql": 1}}`. Same filters as `counts`. Lets a
     * client offer a connector filter listing only connectors that actually exist. Sums to
     * `counts` per entity type.
     */
    serviceTypeCounts: { [key: string]: { [key: string]: number } };
    /**
     * Sum of `counts` — the size of the requested universe. Clients use this to decide between
     * client-side and server-side pagination.
     */
    total: number;
}

/**
 * Slim projection of a service entity. Deliberately excludes `connection` so that no secret
 * decryption or masking is ever performed to serve this view.
 */
export interface ServiceSummary {
    /**
     * When `true` indicates the service has been soft deleted.
     */
    deleted?: boolean;
    /**
     * Description of the service.
     */
    description?: string;
    /**
     * Display Name that identifies the service.
     */
    displayName?: string;
    /**
     * Service entity type, e.g. `databaseService`, `dashboardService`.
     */
    entityType: string;
    /**
     * FullyQualifiedName of the service.
     */
    fullyQualifiedName?: string;
    /**
     * Worst state across this service's ingestion pipelines' most recent runs. Present only
     * when `includeHealth` is `true`.
     */
    health?: ServiceHealth;
    /**
     * Unique identifier of the service.
     */
    id: string;
    /**
     * Name that identifies the service.
     */
    name: string;
    /**
     * Owners of this service.
     */
    owners?: EntityReference[];
    /**
     * Connector type, e.g. `Snowflake`, `Looker`.
     */
    serviceType: string;
    /**
     * Tags applied to this service.
     */
    tags?: TagLabel[];
    /**
     * Last update time corresponding to the new version of the service in Unix epoch time
     * milliseconds.
     */
    updatedAt?: number;
}

/**
 * Worst state across this service's ingestion pipelines' most recent runs. Present only
 * when `includeHealth` is `true`.
 *
 * Reduction of a service's ingestion pipelines to a single state, worst-wins: `failed` >
 * `partialSuccess` > `success`. A service with no pipelines, or whose pipelines have only
 * non-terminal states (queued/running/stopped), is `notRun`.
 */
export enum ServiceHealth {
    Failed = "failed",
    NotRun = "notRun",
    PartialSuccess = "partialSuccess",
    Success = "success",
}

/**
 * Owners of this service.
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
 * Offset based paging for `data`. `paging.total` is `total` restricted to `listEntityType`,
 * `serviceType` and `health`, which may be smaller than `total`.
 *
 * Type used for cursor based pagination information in GET list responses.
 */
export interface Paging {
    /**
     * After cursor used for getting the next page (see API pagination for details).
     */
    after?: string;
    /**
     * Before cursor used for getting the previous page (see API pagination for details).
     */
    before?: string;
    /**
     * Limit used in case of offset based pagination.
     */
    limit?: number;
    /**
     * Offset used in case of offset based pagination.
     */
    offset?: number;
    /**
     * Total number of entries available to page through.
     */
    total: number;
}
