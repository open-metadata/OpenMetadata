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
 * This schema defines the Worksheet entity. A Worksheet is a tab or sheet within a
 * spreadsheet file (Google Sheets, Excel) that contains structured data.
 */
export interface Worksheet {
    certification?: AssetCertification;
    /**
     * Change that lead to this version of the entity.
     */
    changeDescription?: ChangeDescription;
    /**
     * Number of columns in the worksheet
     */
    columnCount?: number;
    /**
     * Column definitions if structured data
     */
    columns?: Column[];
    /**
     * List of data products this entity is part of.
     */
    dataProducts?: EntityReference[];
    /**
     * When `true` indicates the entity has been soft deleted.
     */
    deleted?: boolean;
    /**
     * Description of the worksheet.
     */
    description?: string;
    /**
     * Display Name that identifies this worksheet.
     */
    displayName?: string;
    /**
     * Domains the Worksheet belongs to.
     */
    domains?: EntityReference[];
    /**
     * Status of the Worksheet.
     */
    entityStatus?: EntityStatus;
    /**
     * Entity extension data with custom attributes added to the entity.
     */
    extension?: any;
    /**
     * Followers of this entity.
     */
    followers?: EntityReference[];
    /**
     * Fully qualified name of the worksheet.
     */
    fullyQualifiedName?: string;
    /**
     * Link to the resource corresponding to this worksheet.
     */
    href?: string;
    /**
     * Unique identifier of this worksheet instance.
     */
    id: string;
    /**
     * Change that lead to this version of the entity.
     */
    incrementalChangeDescription?: ChangeDescription;
    /**
     * Position/index of the worksheet in the spreadsheet
     */
    index?: number;
    /**
     * Whether the worksheet is hidden
     */
    isHidden?: boolean;
    /**
     * Life Cycle of the entity
     */
    lifeCycle?: LifeCycle;
    /**
     * Name of the worksheet.
     */
    name: string;
    /**
     * Owners of this worksheet.
     */
    owners?: EntityReference[];
    /**
     * Number of rows in the worksheet
     */
    rowCount?: number;
    /**
     * Sample data from the worksheet
     */
    sampleData?: TableData;
    /**
     * Link to the drive service
     */
    service: EntityReference;
    /**
     * Type of drive service
     */
    serviceType?: DriveServiceType;
    /**
     * Source hash of the entity
     */
    sourceHash?: string;
    /**
     * Link to this worksheet in the source system.
     */
    sourceUrl?: string;
    /**
     * Reference to the parent File entity (with fileType=Spreadsheet)
     */
    spreadsheet: EntityReference;
    /**
     * Tags associated with this worksheet.
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
     * Latest usage information for this worksheet.
     */
    usageSummary?: UsageDetails;
    /**
     * Metadata version of the entity.
     */
    version?: number;
    /**
     * Votes on the entity.
     */
    votes?: Votes;
    /**
     * Native worksheet/tab ID
     */
    worksheetId?: string;
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
 * This schema defines the type for a column in a table.
 */
export interface Column {
    /**
     * Data type used array in dataType. For example, `array<int>` has dataType as `array` and
     * arrayDataType as `int`.
     */
    arrayDataType?: DataType;
    /**
     * Child columns if dataType or arrayDataType is `map`, `struct`, or `union` else `null`.
     */
    children?: Column[];
    /**
     * Column level constraint.
     */
    constraint?: Constraint;
    /**
     * List of Custom Metrics registered for a table.
     */
    customMetrics?: CustomMetric[];
    /**
     * Length of `char`, `varchar`, `binary`, `varbinary` `dataTypes`, else null. For example,
     * `varchar(20)` has dataType as `varchar` and dataLength as `20`.
     */
    dataLength?: number;
    /**
     * Data type of the column (int, date etc.).
     */
    dataType: DataType;
    /**
     * Display name used for dataType. This is useful for complex types, such as `array<int>`,
     * `map<int,string>`, `struct<>`, and union types.
     */
    dataTypeDisplay?: string;
    /**
     * Description of the column.
     */
    description?: string;
    /**
     * Display Name that identifies this column name.
     */
    displayName?:        string;
    fullyQualifiedName?: string;
    /**
     * Json schema only if the dataType is JSON else null.
     */
    jsonSchema?: string;
    name:        string;
    /**
     * Ordinal position of the column.
     */
    ordinalPosition?: number;
    /**
     * The precision of a numeric is the total count of significant digits in the whole number,
     * that is, the number of digits to both sides of the decimal point. Precision is applicable
     * Integer types, such as `INT`, `SMALLINT`, `BIGINT`, etc. It also applies to other Numeric
     * types, such as `NUMBER`, `DECIMAL`, `DOUBLE`, `FLOAT`, etc.
     */
    precision?: number;
    /**
     * Latest Data profile for a Column.
     */
    profile?: ColumnProfile;
    /**
     * The scale of a numeric is the count of decimal digits in the fractional part, to the
     * right of the decimal point. For Integer types, the scale is `0`. It mainly applies to non
     * Integer Numeric types, such as `NUMBER`, `DECIMAL`, `DOUBLE`, `FLOAT`, etc.
     */
    scale?: number;
    /**
     * Tags associated with the column.
     */
    tags?: TagLabel[];
}

/**
 * Data type used array in dataType. For example, `array<int>` has dataType as `array` and
 * arrayDataType as `int`.
 *
 * This enum defines the type of data stored in a column.
 *
 * Data type of the column (int, date etc.).
 */
export enum DataType {
    AggState = "AGG_STATE",
    Aggregatefunction = "AGGREGATEFUNCTION",
    Array = "ARRAY",
    Bigint = "BIGINT",
    Binary = "BINARY",
    Bit = "BIT",
    Bitmap = "BITMAP",
    Blob = "BLOB",
    Boolean = "BOOLEAN",
    Bytea = "BYTEA",
    Byteint = "BYTEINT",
    Bytes = "BYTES",
    CIDR = "CIDR",
    Char = "CHAR",
    Clob = "CLOB",
    Date = "DATE",
    Datetime = "DATETIME",
    Datetimerange = "DATETIMERANGE",
    Decimal = "DECIMAL",
    Double = "DOUBLE",
    Enum = "ENUM",
    Error = "ERROR",
    Fixed = "FIXED",
    Float = "FLOAT",
    Geography = "GEOGRAPHY",
    Geometry = "GEOMETRY",
    Heirarchy = "HEIRARCHY",
    Hll = "HLL",
    Hllsketch = "HLLSKETCH",
    Image = "IMAGE",
    Inet = "INET",
    Int = "INT",
    Interval = "INTERVAL",
    Ipv4 = "IPV4",
    Ipv6 = "IPV6",
    JSON = "JSON",
    Kpi = "KPI",
    Largeint = "LARGEINT",
    Long = "LONG",
    Longblob = "LONGBLOB",
    Lowcardinality = "LOWCARDINALITY",
    Macaddr = "MACADDR",
    Map = "MAP",
    Measure = "MEASURE",
    MeasureHidden = "MEASURE HIDDEN",
    MeasureVisible = "MEASURE VISIBLE",
    Mediumblob = "MEDIUMBLOB",
    Mediumtext = "MEDIUMTEXT",
    Money = "MONEY",
    Ntext = "NTEXT",
    Null = "NULL",
    Number = "NUMBER",
    Numeric = "NUMERIC",
    PGLsn = "PG_LSN",
    PGSnapshot = "PG_SNAPSHOT",
    Point = "POINT",
    Polygon = "POLYGON",
    QuantileState = "QUANTILE_STATE",
    Record = "RECORD",
    Rowid = "ROWID",
    Set = "SET",
    Smallint = "SMALLINT",
    Spatial = "SPATIAL",
    String = "STRING",
    Struct = "STRUCT",
    Super = "SUPER",
    Table = "TABLE",
    Text = "TEXT",
    Time = "TIME",
    Timestamp = "TIMESTAMP",
    Timestampz = "TIMESTAMPZ",
    Tinyint = "TINYINT",
    Tsquery = "TSQUERY",
    Tsvector = "TSVECTOR",
    Tuple = "TUPLE",
    TxidSnapshot = "TXID_SNAPSHOT",
    UUID = "UUID",
    Uint = "UINT",
    Union = "UNION",
    Unknown = "UNKNOWN",
    Varbinary = "VARBINARY",
    Varchar = "VARCHAR",
    Variant = "VARIANT",
    XML = "XML",
    Year = "YEAR",
}

/**
 * Column level constraint.
 *
 * This enum defines the type for column constraint.
 */
export enum Constraint {
    NotNull = "NOT_NULL",
    Null = "NULL",
    PrimaryKey = "PRIMARY_KEY",
    Unique = "UNIQUE",
}

/**
 * Custom Metric definition that we will associate with a column.
 */
export interface CustomMetric {
    /**
     * Name of the column in a table.
     */
    columnName?: string;
    /**
     * Description of the Metric.
     */
    description?: string;
    /**
     * SQL expression to compute the Metric. It should return a single numerical value.
     */
    expression: string;
    /**
     * Unique identifier of this Custom Metric instance.
     */
    id?: string;
    /**
     * Name that identifies this Custom Metric.
     */
    name: string;
    /**
     * Owners of this Custom Metric.
     */
    owners?: EntityReference[];
    /**
     * Last update time corresponding to the new version of the entity in Unix epoch time
     * milliseconds.
     */
    updatedAt?: number;
    /**
     * User who made the update.
     */
    updatedBy?: string;
}

/**
 * Owners of this Custom Metric.
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
 * Link to the drive service
 *
 * Reference to the parent File entity (with fileType=Spreadsheet)
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
 * Latest Data profile for a Column.
 *
 * This schema defines the type to capture the table's column profile.
 */
export interface ColumnProfile {
    /**
     * Custom Metrics profile list bound to a column.
     */
    customMetrics?: CustomMetricProfile[];
    /**
     * Number of values that contain distinct values.
     */
    distinctCount?: number;
    /**
     * Proportion of distinct values in a column.
     */
    distinctProportion?: number;
    /**
     * No.of Rows that contain duplicates in a column.
     */
    duplicateCount?: number;
    /**
     * First quartile of a column.
     */
    firstQuartile?: number;
    /**
     * Histogram of a column.
     */
    histogram?: any[] | boolean | HistogramClass | number | number | null | string;
    /**
     * Inter quartile range of a column.
     */
    interQuartileRange?: number;
    /**
     * Maximum value in a column.
     */
    max?: number | string;
    /**
     * Maximum string length in a column.
     */
    maxLength?: number;
    /**
     * Avg value in a column.
     */
    mean?: number;
    /**
     * Median of a column.
     */
    median?: number;
    /**
     * Minimum value in a column.
     */
    min?: number | string;
    /**
     * Minimum string length in a column.
     */
    minLength?: number;
    /**
     * Missing count is calculated by subtracting valuesCount - validCount.
     */
    missingCount?: number;
    /**
     * Missing Percentage is calculated by taking percentage of validCount/valuesCount.
     */
    missingPercentage?: number;
    /**
     * Column Name.
     */
    name: string;
    /**
     * Non parametric skew of a column.
     */
    nonParametricSkew?: number;
    /**
     * No.of null values in a column.
     */
    nullCount?: number;
    /**
     * No.of null value proportion in columns.
     */
    nullProportion?: number;
    /**
     * Standard deviation of a column.
     */
    stddev?: number;
    /**
     * Median value in a column.
     */
    sum?: number;
    /**
     * First quartile of a column.
     */
    thirdQuartile?: number;
    /**
     * Timestamp on which profile is taken.
     */
    timestamp: number;
    /**
     * No. of unique values in the column.
     */
    uniqueCount?: number;
    /**
     * Proportion of number of unique values in a column.
     */
    uniqueProportion?: number;
    /**
     * Total count of valid values in this column.
     */
    validCount?: number;
    /**
     * Total count of the values in this column.
     */
    valuesCount?: number;
    /**
     * Percentage of values in this column with respect to row count.
     */
    valuesPercentage?: number;
    /**
     * Variance of a column.
     */
    variance?: number;
}

/**
 * Profiling results of a Custom Metric.
 */
export interface CustomMetricProfile {
    /**
     * Custom metric name.
     */
    name?: string;
    /**
     * Profiling results for the metric.
     */
    value?: number;
}

export interface HistogramClass {
    /**
     * Boundaries of Histogram.
     */
    boundaries?: any[];
    /**
     * Frequencies of Histogram.
     */
    frequencies?: any[];
}

/**
 * Status of the Worksheet.
 *
 * Status of an entity. It is used for governance and is applied to all the entities in the
 * catalog.
 */
export enum EntityStatus {
    Approved = "Approved",
    Deprecated = "Deprecated",
    Draft = "Draft",
    InReview = "In Review",
    Rejected = "Rejected",
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
 * Sample data from the worksheet
 *
 * This schema defines the type to capture rows of sample data for a table.
 */
export interface TableData {
    /**
     * List of local column names (not fully qualified column names) of the table.
     */
    columns?: string[];
    /**
     * Data for multiple rows of the table.
     */
    rows?: Array<any[]>;
}

/**
 * Type of drive service
 *
 * Type of drive service such as Google Drive...
 */
export enum DriveServiceType {
    CustomDrive = "CustomDrive",
    GoogleDrive = "GoogleDrive",
    SharePoint = "SharePoint",
}

/**
 * Latest usage information for this worksheet.
 *
 * This schema defines the type for usage details. Daily, weekly, and monthly aggregation of
 * usage is computed along with the percentile rank based on the usage for a given day.
 */
export interface UsageDetails {
    /**
     * Daily usage stats of a data asset on the start date.
     */
    dailyStats: UsageStats;
    /**
     * Date in UTC.
     */
    date: Date;
    /**
     * Monthly (last 30 days) rolling usage stats of a data asset on the start date.
     */
    monthlyStats?: UsageStats;
    /**
     * Weekly (last 7 days) rolling usage stats of a data asset on the start date.
     */
    weeklyStats?: UsageStats;
}

/**
 * Daily usage stats of a data asset on the start date.
 *
 * Type used to return usage statistics.
 *
 * Monthly (last 30 days) rolling usage stats of a data asset on the start date.
 *
 * Weekly (last 7 days) rolling usage stats of a data asset on the start date.
 */
export interface UsageStats {
    /**
     * Usage count of a data asset on the start date.
     */
    count: number;
    /**
     * Optional daily percentile rank data asset use when relevant.
     */
    percentileRank?: number;
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
