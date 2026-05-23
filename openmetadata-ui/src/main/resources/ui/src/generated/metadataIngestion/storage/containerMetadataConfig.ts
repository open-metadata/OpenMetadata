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
 * Definition of the properties contained by an object store container template config file
 */
export interface ContainerMetadataConfig {
    /**
     * List of metadata entries for the bucket containing information about where data resides
     * and its structure
     */
    entries: MetadataEntry[];
}

/**
 * Config properties for a container found in a user-supplied metadata config
 */
export interface MetadataEntry {
    /**
     * When true and dataPath is a glob, automatically detect Hive-style partition columns from
     * matched paths (e.g. year=2024/month=01). Ignored for literal paths.
     */
    autoPartitionDetection?: boolean;
    /**
     * Literal path relative to the bucket root, or a glob-style pattern. Use a single-star
     * wildcard for one path level, a double-star wildcard for any depth, and a question mark
     * for a single character.
     */
    dataPath: string;
    /**
     * Depth of the data path in the container
     */
    depth?: number;
    /**
     * Path segments to skip during glob discovery. Any file whose path contains one of these
     * segments is ignored. Common defaults applied when unset: _delta_log, _temporary,
     * _spark_metadata, .tmp, _SUCCESS.
     */
    excludePaths?: string[];
    /**
     * Glob patterns to exclude during glob discovery. Any file matching one of these patterns
     * is skipped.
     */
    excludePatterns?: string[];
    /**
     * Flag indicating whether the container's data is partitioned
     */
    isPartitioned?: boolean;
    /**
     * Explicit partition column definitions. Overrides auto-detection when provided.
     */
    partitionColumns?: PartitionColumn[];
    /**
     * For delimited files such as CSV, what is the separator being used?
     */
    separator?: string;
    /**
     * Expected file format for schema inference. Leave blank to auto-detect from the file
     * extension. Ignored when Unstructured Data is enabled.
     */
    structureFormat?: string;
    /**
     * When true, files matching the glob dataPath are cataloged as individual containers
     * without schema extraction. Use for images, documents, and other non-tabular files.
     */
    unstructuredData?: boolean;
    /**
     * Legacy option for literal dataPath entries. List of file extensions (e.g. png, pdf, jpg)
     * to catalog as unstructured. Prefer the unstructuredData flag with a glob dataPath for new
     * configurations.
     */
    unstructuredFormats?: string[];
    [property: string]: any;
}

export interface PartitionColumn {
    /**
     * Partition column data type.
     */
    dataType: DataType;
    /**
     * Display name for the data type (optional).
     */
    dataTypeDisplay?: string;
    /**
     * Description of the partition column (optional).
     */
    description?: string;
    /**
     * Partition column name.
     */
    name: string;
    [property: string]: any;
}

/**
 * Partition column data type.
 *
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
    Hierarchyid = "HIERARCHYID",
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
