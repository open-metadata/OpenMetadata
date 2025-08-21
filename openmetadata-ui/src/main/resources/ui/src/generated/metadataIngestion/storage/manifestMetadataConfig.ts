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
export interface ManifestMetadataConfigClass {
    /**
     * List of metadata entries for the bucket containing information about where data resides
     * and its structure
     */
    entries: ManifestMetadataEntry[];
}

/**
 * Config properties for a container found in a user-supplied metadata config
 */
export interface ManifestMetadataEntry {
    /**
     * The top-level container name containing the data path to be ingested
     */
    containerName: string;
    /**
     * The path where the data resides in the container, excluding the bucket name
     */
    dataPath: string;
    /**
     * Flag indicating whether the container's data is partitioned
     */
    isPartitioned?: boolean;
    /**
     * What are the partition columns in case the container's data is partitioned
     */
    partitionColumns?: Column[];
    /**
     * For delimited files such as CSV, what is the separator being used?
     */
    separator?: string;
    /**
     * What's the schema format for the container, eg. avro, parquet, csv.
     */
    structureFormat?: string;
    [property: string]: any;
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
     * Cardinality distribution showing top categories with an 'Others' bucket.
     */
    cardinalityDistribution?: CardinalityDistribution;
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
 * Cardinality distribution showing top categories with an 'Others' bucket.
 */
export interface CardinalityDistribution {
    /**
     * List of category names including 'Others'.
     */
    categories?: string[];
    /**
     * List of counts corresponding to each category.
     */
    counts?: number[];
    /**
     * List of percentages corresponding to each category.
     */
    percentages?: number[];
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
