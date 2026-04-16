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
 * A manifest entry for auto-discovering structured or unstructured data in object storage.
 * Supports glob patterns, auto-partition detection, and explicit partition column
 * definitions.
 */
export interface ManifestEntry {
    /**
     * When enabled, automatically detects Hive-style partition columns from directory names
     * (e.g., year=2024/month=01/).
     */
    autoPartitionDetection?: boolean;
    /**
     * Path segments to exclude from discovery. Any file path containing these segments will be
     * skipped. Defaults to common internal paths like _delta_log, _temporary, _spark_metadata,
     * .tmp, _SUCCESS.
     */
    excludePaths?: string[];
    /**
     * Glob patterns to exclude from discovery. Any file matching these patterns will be
     * skipped. Example patterns exclude an archive subtree or a temp prefix subtree.
     */
    excludePatterns?: string[];
    /**
     * Explicit partition column definitions. Overrides auto-detection when provided. Use when
     * auto-detection cannot determine partition structure (e.g., non-standard directory naming).
     */
    partitionColumns?: PartitionColumn[];
    /**
     * Glob-style path pattern relative to bucket root. Use a single-star wildcard for one path
     * level, and a double-star wildcard for recursive matching. Example patterns: data, one
     * level wildcard, events, parquet files; or logs, recursive wildcard, json files.
     */
    pathPattern: string;
    /**
     * For delimited files such as CSV, the separator character.
     */
    separator?: string;
    /**
     * Expected file format for schema inference. Leave blank to auto-detect from the file
     * extension. Ignored when Unstructured Data is enabled.
     */
    structureFormat?: null | string;
    /**
     * When true, files matching the path pattern are cataloged as individual containers without
     * schema extraction. Use for images, documents, and other non-tabular files.
     */
    unstructuredData?: boolean;
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
