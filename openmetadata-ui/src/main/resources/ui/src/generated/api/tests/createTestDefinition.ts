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
 * Schema corresponding to a Test Definition
 */
export interface CreateTestDefinition {
    /**
     * Description of the testcase.
     */
    description: string;
    /**
     * Display Name that identifies this test case.
     */
    displayName?: string;
    /**
     * Fully qualified names of the domains the Test Definition belongs to.
     */
    domains?:   string[];
    entityType: EntityType;
    /**
     * Name that identifies this test case.
     */
    name: string;
    /**
     * Owners of this TestCase definition.
     */
    owners?:              EntityReference[];
    parameterDefinition?: TestCaseParameterDefinition[];
    provider?:            ProviderType;
    supportedDataTypes?:  DataType[];
    testPlatforms:        TestPlatform[];
}

/**
 * This enum defines the type for which this test definition applies to.
 */
export enum EntityType {
    Column = "COLUMN",
    Table = "TABLE",
}

/**
 * Owners of this TestCase definition.
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
 * This schema defines the parameters that can be passed for a Test Case.
 */
export interface TestCaseParameterDefinition {
    /**
     * Data type of the parameter (int, date etc.).
     */
    dataType?: TestDataType;
    /**
     * Description of the parameter.
     */
    description?: string;
    /**
     * Display Name that identifies this parameter name.
     */
    displayName?: string;
    /**
     * name of the parameter.
     */
    name?: string;
    /**
     * List of values that can be passed for this parameter.
     */
    optionValues?: any[];
    /**
     * Is this parameter required.
     */
    required?: boolean;
    /**
     * Validation for the test parameter value.
     */
    validationRule?: ValidationRule;
    [property: string]: any;
}

/**
 * Data type of the parameter (int, date etc.).
 *
 * This enum defines the type of data stored in a column.
 */
export enum TestDataType {
    Array = "ARRAY",
    Boolean = "BOOLEAN",
    Date = "DATE",
    Datetime = "DATETIME",
    Decimal = "DECIMAL",
    Double = "DOUBLE",
    Float = "FLOAT",
    Int = "INT",
    Map = "MAP",
    Number = "NUMBER",
    Set = "SET",
    String = "STRING",
    Time = "TIME",
    Timestamp = "TIMESTAMP",
}

/**
 * Validation for the test parameter value.
 */
export interface ValidationRule {
    /**
     * Name of the parameter to validate against.
     */
    parameterField?: string;
    /**
     * This enum defines the type to use for a parameter validation rule.
     */
    rule?: Rule;
    [property: string]: any;
}

/**
 * This enum defines the type to use for a parameter validation rule.
 */
export enum Rule {
    Equals = "EQUALS",
    GreaterThanOrEquals = "GREATER_THAN_OR_EQUALS",
    LessThanOrEquals = "LESS_THAN_OR_EQUALS",
    NotEquals = "NOT_EQUALS",
}

/**
 * Type of provider of an entity. Some entities are provided by the `system`. Some are
 * entities created and provided by the `user`. Typically `system` provide entities can't be
 * deleted and can only be disabled. Some apps such as AutoPilot create entities with
 * `automation` provider type. These entities can be deleted by the user.
 */
export enum ProviderType {
    Automation = "automation",
    System = "system",
    User = "user",
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
 * This schema defines the platform where tests are defined and ran.
 */
export enum TestPlatform {
    Dbt = "DBT",
    Deequ = "Deequ",
    GreatExpectations = "GreatExpectations",
    OpenMetadata = "OpenMetadata",
    Other = "Other",
    Soda = "Soda",
}
