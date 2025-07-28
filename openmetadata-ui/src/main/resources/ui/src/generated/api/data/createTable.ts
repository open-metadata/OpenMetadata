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
 * Schema corresponding to a table that belongs to a database
 */
export interface CreateTable {
    /**
     * Name of the tables in the database
     */
    columns: Column[];
    /**
     * FullyQualified name of the Schema corresponding to this table
     */
    databaseSchema: string;
    dataModel?:     DataModel;
    /**
     * List of fully qualified names of data products this entity is part of.
     */
    dataProducts?: string[];
    /**
     * Description of entity instance.
     */
    description?: string;
    /**
     * Display Name that identifies this table.
     */
    displayName?: string;
    /**
     * Fully qualified name of the domain the Table belongs to.
     */
    domain?: string;
    /**
     * Entity extension data with custom attributes added to the entity.
     */
    extension?: any;
    /**
     * File format in case of file/datalake tables.
     */
    fileFormat?: FileFormat;
    /**
     * Life Cycle of the entity
     */
    lifeCycle?: LifeCycle;
    /**
     * Full storage path in case of external and managed tables.
     */
    locationPath?: string;
    /**
     * Name that identifies the this entity instance uniquely. Same as id if when name is not
     * unique
     */
    name: string;
    /**
     * Owners of this entity
     */
    owners?: EntityReference[];
    /**
     * Retention period of the data in the database. Period is expressed as duration in ISO 8601
     * format in UTC. Example - `P23DT23H`.
     */
    retentionPeriod?: string;
    /**
     * DDL for Tables and Views
     */
    schemaDefinition?: string;
    /**
     * Source hash of the entity
     */
    sourceHash?: string;
    /**
     * Source URL of table.
     */
    sourceUrl?:           string;
    tableConstraints?:    TableConstraint[];
    tablePartition?:      TablePartition;
    tableProfilerConfig?: TableProfilerConfig;
    tableType?:           TableType;
    /**
     * Tags for this table
     */
    tags?: TagLabel[];
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
 * This captures information about how the table is modeled. Currently only DBT and DDL
 * model is supported.
 */
export interface DataModel {
    /**
     * Columns from the schema defined during modeling. In case of DBT, the metadata here comes
     * from `schema.yaml`.
     */
    columns?: Column[];
    /**
     * Description of the Table from the model.
     */
    description?: string;
    generatedAt?: Date;
    modelType:    ModelType;
    /**
     * Owners of this Table.
     */
    owners?: EntityReference[];
    /**
     * Path to sql definition file.
     */
    path?: string;
    /**
     * This corresponds to rws SQL from `<model_name>.sql` in DBT. This might be null when SQL
     * query need not be compiled as done in DBT.
     */
    rawSql?: string;
    /**
     * Resource Type of the model.
     */
    resourceType?: string;
    /**
     * This corresponds to compile SQL from `<model_name>.sql` in DBT. In cases where
     * compilation is not necessary, this corresponds to SQL that created the table.
     */
    sql?: string;
    /**
     * Tags for this data model.
     */
    tags?: TagLabel[];
    /**
     * Fully qualified name of Models/tables used for in `sql` for creating this table.
     */
    upstream?: string[];
}

export enum ModelType {
    DDL = "DDL",
    Dbt = "DBT",
}

/**
 * File format in case of file/datalake tables.
 */
export enum FileFormat {
    Avro = "avro",
    CSV = "csv",
    JSON = "json",
    JSONGz = "json.gz",
    JSONZip = "json.zip",
    Jsonl = "jsonl",
    JsonlGz = "jsonl.gz",
    JsonlZip = "jsonl.zip",
    Parq = "parq",
    Parquet = "parquet",
    ParquetSnappy = "parquet.snappy",
    Pq = "pq",
    Pqt = "pqt",
    Tsv = "tsv",
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
 * This enum defines the type for table constraint.
 */
export interface TableConstraint {
    /**
     * List of column names corresponding to the constraint.
     */
    columns?:        string[];
    constraintType?: ConstraintType;
    /**
     * List of referred columns for the constraint.
     */
    referredColumns?:  string[];
    relationshipType?: RelationshipType;
}

export enum ConstraintType {
    ClusterKey = "CLUSTER_KEY",
    DistKey = "DIST_KEY",
    ForeignKey = "FOREIGN_KEY",
    PrimaryKey = "PRIMARY_KEY",
    SortKey = "SORT_KEY",
    Unique = "UNIQUE",
}

export enum RelationshipType {
    ManyToMany = "MANY_TO_MANY",
    ManyToOne = "MANY_TO_ONE",
    OneToMany = "ONE_TO_MANY",
    OneToOne = "ONE_TO_ONE",
}

/**
 * This schema defines the partition column of a table and format the partition is created.
 */
export interface TablePartition {
    /**
     * List of column partitions with their type and interval.
     */
    columns?: PartitionColumnDetails[];
}

/**
 * This schema defines the partition column of a table and format the partition is created.
 */
export interface PartitionColumnDetails {
    /**
     * List of column names corresponding to the partition.
     */
    columnName?: string;
    /**
     * partition interval , example hourly, daily, monthly.
     */
    interval?:     string;
    intervalType?: PartitionIntervalTypes;
}

/**
 * type of partition interval
 */
export enum PartitionIntervalTypes {
    ColumnValue = "COLUMN-VALUE",
    Enum = "ENUM",
    IngestionTime = "INGESTION-TIME",
    Injected = "INJECTED",
    IntegerRange = "INTEGER-RANGE",
    Other = "OTHER",
    TimeUnit = "TIME-UNIT",
}

/**
 * This schema defines the type for Table profile config.
 */
export interface TableProfilerConfig {
    /**
     * Option to turn on/off column metric computation. If enabled, profiler will compute column
     * level metrics.
     */
    computeColumnMetrics?: boolean;
    /**
     * Option to turn on/off table metric computation. If enabled, profiler will compute table
     * level metrics.
     */
    computeTableMetrics?: boolean;
    /**
     * column names to exclude from profiling.
     */
    excludeColumns?: string[];
    /**
     * Only run profiler on included columns with specific metrics.
     */
    includeColumns?: ColumnProfilerConfig[];
    /**
     * Partitioning configuration
     */
    partitioning?: PartitionProfilerConfig;
    /**
     * Users' raw SQL query to fetch sample data and profile the table
     */
    profileQuery?: string;
    /**
     * Percentage of data or no. of rows used to compute the profiler metrics and run data
     * quality tests
     */
    profileSample?:     number;
    profileSampleType?: ProfileSampleType;
    /**
     * Whether to randomize the sample data or not.
     */
    randomizedSample?: boolean;
    /**
     * Number of sample rows to ingest when 'Generate Sample Data' is enabled
     */
    sampleDataCount?:    number;
    samplingMethodType?: SamplingMethodType;
    [property: string]: any;
}

/**
 * This schema defines the type for Table profile config include Columns.
 */
export interface ColumnProfilerConfig {
    /**
     * Column Name of the table to be included.
     */
    columnName?: string;
    /**
     * Include only following metrics.
     */
    metrics?: string[];
    [property: string]: any;
}

/**
 * Partitioning configuration
 *
 * This schema defines the partition configuration used by profiler.
 */
export interface PartitionProfilerConfig {
    /**
     * whether to use partition
     */
    enablePartitioning?: boolean;
    /**
     * name of the column to use for the partition
     */
    partitionColumnName?: string;
    /**
     * end of the integer range for partitioning
     */
    partitionIntegerRangeEnd?: number;
    /**
     * start of the integer range for partitioning
     */
    partitionIntegerRangeStart?: number;
    /**
     * The interval to use for the partitioning
     */
    partitionInterval?:     number;
    partitionIntervalType?: PartitionIntervalTypes;
    /**
     * unit used for the partition interval
     */
    partitionIntervalUnit?: PartitionIntervalUnit;
    /**
     * unit used for the partition interval
     */
    partitionValues?: any[];
    [property: string]: any;
}

/**
 * unit used for the partition interval
 */
export enum PartitionIntervalUnit {
    Day = "DAY",
    Hour = "HOUR",
    Month = "MONTH",
    Year = "YEAR",
}

/**
 * Type of Profile Sample (percentage or rows)
 */
export enum ProfileSampleType {
    Percentage = "PERCENTAGE",
    Rows = "ROWS",
}

/**
 * Type of Sampling Method (BERNOULLI or SYSTEM)
 */
export enum SamplingMethodType {
    Bernoulli = "BERNOULLI",
    System = "SYSTEM",
}

/**
 * This schema defines the type used for describing different types of tables.
 */
export enum TableType {
    Dynamic = "Dynamic",
    External = "External",
    Foreign = "Foreign",
    Iceberg = "Iceberg",
    Local = "Local",
    MaterializedView = "MaterializedView",
    Partitioned = "Partitioned",
    Regular = "Regular",
    SecureView = "SecureView",
    Stream = "Stream",
    Transient = "Transient",
    View = "View",
}
