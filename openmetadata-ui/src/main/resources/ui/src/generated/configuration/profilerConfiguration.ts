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
 * This schema defines the profiler configuration. It is used to configure globally the
 * metrics to compute for specific data types.
 */
export interface ProfilerConfiguration {
    metricConfiguration?: MetricConfigurationDefinition[];
}

/**
 * This schema defines the parameters that can be passed for a Test Case.
 */
export interface MetricConfigurationDefinition {
    dataType?: DataType;
    /**
     * If true, the metric will not be computed for the data type.
     */
    disabled?: boolean;
    metrics?:  MetricType[];
}

/**
 * This enum defines the type of data stored in a column.
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
 * This schema defines all possible metric types in OpenMetadata.
 */
export enum MetricType {
    CardinalityDistribution = "cardinalityDistribution",
    ColumnCount = "columnCount",
    ColumnNames = "columnNames",
    CountInSet = "countInSet",
    DistinctCount = "distinctCount",
    DistinctProportion = "distinctProportion",
    DuplicateCount = "duplicateCount",
    FirstQuartile = "firstQuartile",
    Histogram = "histogram",
    ILikeCount = "iLikeCount",
    ILikeRatio = "iLikeRatio",
    InterQuartileRange = "interQuartileRange",
    LikeCount = "likeCount",
    LikeRatio = "likeRatio",
    Max = "max",
    MaxLength = "maxLength",
    Mean = "mean",
    Median = "median",
    Min = "min",
    MinLength = "minLength",
    NonParametricSkew = "nonParametricSkew",
    NotLikeCount = "notLikeCount",
    NotRegexCount = "notRegexCount",
    NullCount = "nullCount",
    NullProportion = "nullProportion",
    RegexCount = "regexCount",
    RowCount = "rowCount",
    Stddev = "stddev",
    Sum = "sum",
    System = "system",
    ThirdQuartile = "thirdQuartile",
    UniqueCount = "uniqueCount",
    UniqueProportion = "uniqueProportion",
    ValuesCount = "valuesCount",
}
