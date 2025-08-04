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
 * A `SearchIndex` is a index mapping definition in ElasticSearch or OpenSearch
 */
export interface SearchIndex {
    certification?: AssetCertification;
    /**
     * Change that lead to this version of the entity.
     */
    changeDescription?: ChangeDescription;
    /**
     * List of data products this entity is part of.
     */
    dataProducts?: EntityReference[];
    /**
     * When `true` indicates the entity has been soft deleted.
     */
    deleted?: boolean;
    /**
     * Description of the SearchIndex instance.
     */
    description?: string;
    /**
     * Display Name that identifies this SearchIndex. It could be title or label from the source
     * services.
     */
    displayName?: string;
    /**
     * Domains the SearchIndex belongs to. When not set, the SearchIndex inherits the domain
     * from the messaging service it belongs to.
     */
    domains?: EntityReference[];
    /**
     * Entity extension data with custom attributes added to the entity.
     */
    extension?: any;
    /**
     * Fields in this SearchIndex.
     */
    fields: SearchIndexField[];
    /**
     * Followers of this searchIndex.
     */
    followers?: EntityReference[];
    /**
     * Name that uniquely identifies a SearchIndex in the format
     * 'searchServiceName.searchIndexName'.
     */
    fullyQualifiedName?: string;
    /**
     * Link to the resource corresponding to this entity.
     */
    href?: string;
    /**
     * Unique identifier that identifies this SearchIndex instance.
     */
    id: string;
    /**
     * Change that lead to this version of the entity.
     */
    incrementalChangeDescription?: ChangeDescription;
    /**
     * Whether the entity is index or index template.
     */
    indexType?: IndexType;
    /**
     * Life Cycle of the entity
     */
    lifeCycle?: LifeCycle;
    /**
     * Name that identifies the SearchIndex.
     */
    name: string;
    /**
     * Owners of this searchIndex.
     */
    owners?: EntityReference[];
    /**
     * Sample data for a searchIndex.
     */
    sampleData?: SearchIndexSampleData;
    /**
     * Contains key/value pair of searchIndex settings.
     */
    searchIndexSettings?: { [key: string]: any };
    /**
     * Link to the search cluster/service where this SearchIndex is hosted in.
     */
    service: EntityReference;
    /**
     * Service type where this SearchIndex is hosted in.
     */
    serviceType?: SearchServiceType;
    /**
     * Source hash of the entity
     */
    sourceHash?: string;
    /**
     * Tags for this searchIndex.
     */
    tags?: TagLabel[];
    /**
     * Last update time corresponding to the new version of the entity in Unix epoch time
     * milliseconds.
     */
    updatedAt?: number;
    /**
     * User who made the update.
     */
    updatedBy?: string;
    /**
     * Metadata version of the entity.
     */
    version?: number;
    /**
     * Votes on the entity.
     */
    votes?: Votes;
}

/**
 * Defines the Asset Certification schema.
 */
export interface AssetCertification {
    /**
     * The date when the certification was applied.
     */
    appliedDate: number;
    /**
     * The date when the certification expires.
     */
    expiryDate: number;
    tagLabel:   TagLabel;
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
     * An icon to associate with GlossaryTerm, Tag, Domain or Data Product.
     */
    iconURL?: string;
}

/**
 * Change that lead to this version of the entity.
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
 * List of data products this entity is part of.
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
 * User, Pipeline, Query that created,updated or accessed the data asset
 *
 * Link to the search cluster/service where this SearchIndex is hosted in.
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
 * This schema defines the type for a field in a searchIndex.
 */
export interface SearchIndexField {
    /**
     * Child columns if dataType has properties.
     */
    children?: SearchIndexField[];
    /**
     * Data type of the searchIndex (int, date etc.).
     */
    dataType: DataType;
    /**
     * Display name used for dataType.
     */
    dataTypeDisplay?: string;
    /**
     * Description of the field.
     */
    description?: string;
    /**
     * Display Name that identifies this searchIndexField name.
     */
    displayName?:        string;
    fullyQualifiedName?: string;
    name:                string;
    /**
     * Tags associated with the column.
     */
    tags?: TagLabel[];
}

/**
 * Data type of the searchIndex (int, date etc.).
 *
 * This enum defines the type of data stored in a searchIndex.
 */
export enum DataType {
    AggregateMetricDouble = "AGGREGATE_METRIC_DOUBLE",
    AnnotatedText = "ANNOTATED-TEXT",
    Array = "ARRAY",
    Binary = "BINARY",
    Boolean = "BOOLEAN",
    Byte = "BYTE",
    Completion = "COMPLETION",
    ConstantKeyword = "CONSTANT_KEYWORD",
    Date = "DATE",
    Datetime = "DATETIME",
    DenseVector = "DENSE_VECTOR",
    Double = "DOUBLE",
    Flattened = "FLATTENED",
    Float = "FLOAT",
    GeoPoint = "GEO_POINT",
    GeoShape = "GEO_SHAPE",
    HalfFloat = "HALF_FLOAT",
    Histogram = "HISTOGRAM",
    IP = "IP",
    Integer = "INTEGER",
    Join = "JOIN",
    Keyword = "KEYWORD",
    Long = "LONG",
    Murmur3 = "MURMUR3",
    Nested = "NESTED",
    Number = "NUMBER",
    Object = "OBJECT",
    Percolator = "PERCOLATOR",
    Point = "POINT",
    Range = "RANGE",
    RankFeature = "RANK_FEATURE",
    RankFeatures = "RANK_FEATURES",
    ScaledFloat = "SCALED_FLOAT",
    SearchAsYouType = "SEARCH_AS_YOU_TYPE",
    Shape = "SHAPE",
    Short = "SHORT",
    Text = "TEXT",
    Time = "TIME",
    Timestamp = "TIMESTAMP",
    Timestampz = "TIMESTAMPZ",
    Unknown = "UNKNOWN",
    UnsignedLong = "UNSIGNED_LONG",
    Version = "VERSION",
    Wildcard = "WILDCARD",
}

/**
 * Whether the entity is index or index template.
 */
export enum IndexType {
    Index = "Index",
    IndexTemplate = "IndexTemplate",
}

/**
 * Life Cycle of the entity
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
 * Sample data for a searchIndex.
 *
 * This schema defines the type to capture sample data for a SearchIndex.
 */
export interface SearchIndexSampleData {
    /**
     * List of local sample messages for a SearchIndex.
     */
    messages?: string[];
}

/**
 * Service type where this SearchIndex is hosted in.
 *
 * Type of search service such as ElasticSearch or OpenSearch.
 */
export enum SearchServiceType {
    CustomSearch = "CustomSearch",
    ElasticSearch = "ElasticSearch",
    OpenSearch = "OpenSearch",
}

/**
 * Votes on the entity.
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
