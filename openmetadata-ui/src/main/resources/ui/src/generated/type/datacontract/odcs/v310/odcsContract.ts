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
 * An open data contract specification to establish agreement between data producers and
 * consumers.
 */
export interface OdcsContract {
    /**
     * ODCS export profile v3.1.0.
     */
    apiVersion:                APIVersion;
    authoritativeDefinitions?: AuthoritativeDefinition[];
    /**
     * Timestamp in UTC of when the data contract was created.
     */
    contractCreatedTs?: Date;
    customProperties?:  CustomProperty[];
    /**
     * The name of the data product.
     */
    dataProduct?: string;
    /**
     * High level description of the dataset.
     */
    description?: Description;
    /**
     * Name of the logical data domain.
     */
    domain?: string;
    /**
     * A unique identifier used to reduce the risk of dataset name collisions, such as a UUID.
     */
    id: string;
    /**
     * The kind of file this is. Valid value is `DataContract`.
     */
    kind: Kind;
    /**
     * Name of the data contract.
     */
    name?:  string;
    price?: Pricing;
    /**
     * A list of roles that will provide user access to the dataset.
     */
    roles?: Role[];
    /**
     * A list of elements within the schema to be cataloged.
     */
    schema?: SchemaObject[];
    /**
     * List of servers where the datasets reside.
     */
    servers?: VerticaServer[];
    /**
     * DEPRECATED SINCE 3.1. WILL BE REMOVED IN ODCS 4.0. Element (using the element path
     * notation) to do the checks on.
     */
    slaDefaultElement?: string;
    /**
     * A list of key/value pairs for SLA specific properties. There is no limit on the type of
     * properties (more details to come).
     */
    slaProperties?: ServiceLevelAgreementProperty[];
    /**
     * Current status of the dataset.
     */
    status:   string;
    support?: SupportItem[];
    tags?:    string[];
    /**
     * Team information object with members array (v3.1.0+).
     */
    team?: Team;
    /**
     * Indicates the property the data is primarily associated with. Value is case insensitive.
     */
    tenant?: string;
    /**
     * Current version of the data contract.
     */
    version: string;
}

/**
 * ODCS export profile v3.1.0.
 */
export enum APIVersion {
    V310 = "v3.1.0",
}

/**
 * List of links to sources that provide more details on the dataset; examples would be a
 * link to an external definition, a training video, a git repo, data catalog, or another
 * tool. Authoritative definitions follow the same structure in the standard.
 */
export interface AuthoritativeDefinition {
    /**
     * Description of the authoritative definition for humans.
     */
    description?: string;
    id?:          string;
    /**
     * Type of definition for authority: v2.3 adds standard values: `businessDefinition`,
     * `transformationImplementation`, `videoTutorial`, `tutorial`, and `implementation`.
     */
    type: string;
    /**
     * URL to the authority.
     */
    url: string;
}

/**
 * A list of key/value pairs for custom properties.
 */
export interface CustomProperty {
    /**
     * Description of the custom property.
     */
    description?: string;
    id?:          string;
    /**
     * The name of the key. Names should be in camel case–the same as if they were permanent
     * properties in the contract.
     */
    property: string;
    /**
     * The value of the key.
     */
    value: any[] | boolean | number | { [key: string]: any } | null | string;
}

/**
 * High level description of the dataset.
 */
export interface Description {
    authoritativeDefinitions?: AuthoritativeDefinition[];
    customProperties?:         CustomProperty[];
    /**
     * Limitations of the dataset.
     */
    limitations?: string;
    /**
     * Purpose of the dataset.
     */
    purpose?: string;
    /**
     * Intended usage of the dataset.
     */
    usage?: string;
    [property: string]: any;
}

/**
 * The kind of file this is. Valid value is `DataContract`.
 */
export enum Kind {
    DataContract = "DataContract",
}

export interface Pricing {
    id?: string;
    /**
     * Subscription price per unit of measure in `priceUnit`.
     */
    priceAmount?: number;
    /**
     * Currency of the subscription price in `price.priceAmount`.
     */
    priceCurrency?: string;
    /**
     * The unit of measure for calculating cost. Examples megabyte, gigabyte.
     */
    priceUnit?: string;
}

export interface Role {
    /**
     * The type of access provided by the IAM role.
     */
    access?:           string;
    customProperties?: CustomProperty[];
    /**
     * Description of the IAM role and its permissions.
     */
    description?: string;
    /**
     * The name(s) of the first-level approver(s) of the role.
     */
    firstLevelApprovers?: string;
    id?:                  string;
    /**
     * Name of the IAM role that provides access to the dataset.
     */
    role: string;
    /**
     * The name(s) of the second-level approver(s) of the role.
     */
    secondLevelApprovers?: string;
}

export interface SchemaObject {
    authoritativeDefinitions?: AuthoritativeDefinition[];
    /**
     * The business name of the element.
     */
    businessName?:     string;
    customProperties?: CustomProperty[];
    /**
     * Granular level of the data in the object.
     */
    dataGranularityDescription?: string;
    /**
     * Description of the element.
     */
    description?: string;
    id?:          string;
    /**
     * The logical element data type.
     */
    logicalType?: SchemaLogicalType;
    /**
     * Name of the element.
     */
    name: string;
    /**
     * Physical name.
     */
    physicalName?: string;
    /**
     * The physical element data type in the data source.
     */
    physicalType?: string;
    /**
     * A list of properties for the object.
     */
    properties?: SchemaProperty[];
    quality?:    DataQuality[];
    /**
     * A list of relationships to other properties. Each relationship must have 'from', 'to' and
     * optionally 'type' field.
     */
    relationships?: RelationshipSchemaLevel[];
    tags?:          string[];
}

/**
 * The logical element data type.
 */
export enum SchemaLogicalType {
    Object = "object",
}

/**
 * List of items in an array (only applicable when `logicalType: array`).
 */
export interface SchemaItemProperty {
    authoritativeDefinitions?: AuthoritativeDefinition[];
    /**
     * The business name of the element.
     */
    businessName?: string;
    /**
     * Can be anything, like confidential, restricted, and public to more advanced
     * categorization. Some companies like PayPal, use data classification indicating the class
     * of data in the element; expected values are 1, 2, 3, 4, or 5.
     */
    classification?: string;
    /**
     * True or false indicator; If element is considered a critical data element (CDE) then true
     * else false.
     */
    criticalDataElement?: boolean;
    customProperties?:    CustomProperty[];
    /**
     * Description of the element.
     */
    description?: string;
    /**
     * The element name within the dataset that contains the encrypted element value. For
     * example, unencrypted element `email_address` might have an encryptedName of
     * `email_address_encrypt`.
     */
    encryptedName?: string;
    /**
     * List of sample element values.
     */
    examples?: Array<any[] | boolean | number | { [key: string]: any } | null | string>;
    id?:       string;
    /**
     * List of items in an array (only applicable when `logicalType: array`).
     */
    items?: SchemaItemProperty;
    /**
     * The logical element data type.
     */
    logicalType?: ItemsLogicalType;
    /**
     * Additional optional metadata to describe the logical type.
     */
    logicalTypeOptions?: ItemsLogicalTypeOptions;
    /**
     * Name of the element.
     */
    name?: string;
    /**
     * Indicates if the element is partitioned; possible values are true and false.
     */
    partitioned?: boolean;
    /**
     * If element is used for partitioning, the position of the partition element. Starts from
     * 1. Example of `country, year` being partition columns, `country` has partitionKeyPosition
     * 1 and `year` partitionKeyPosition 2. Default to -1.
     */
    partitionKeyPosition?: number;
    /**
     * Physical name.
     */
    physicalName?: string;
    /**
     * The physical element data type in the data source. For example, VARCHAR(2), DOUBLE, INT.
     */
    physicalType?: string;
    /**
     * Boolean value specifying whether the element is primary or not. Default is false.
     */
    primaryKey?: boolean;
    /**
     * If element is a primary key, the position of the primary key element. Starts from 1.
     * Example of `account_id, name` being primary key columns, `account_id` has
     * primaryKeyPosition 1 and `name` primaryKeyPosition 2. Default to -1.
     */
    primaryKeyPosition?: number;
    /**
     * A list of properties for the object.
     */
    properties?: SchemaProperty[];
    quality?:    DataQuality[];
    /**
     * A list of relationships to other properties. When defined at property level, the 'from'
     * field is implicit and should not be specified.
     */
    relationships?: RelationshipPropertyLevel[];
    /**
     * Indicates if the element may contain Null values; possible values are true and false.
     * Default is false.
     */
    required?: boolean;
    tags?:     string[];
    /**
     * Describes the transform logic in very simple terms.
     */
    transformDescription?: string;
    /**
     * Logic used in the element transformation.
     */
    transformLogic?: string;
    /**
     * List of objects in the data source used in the transformation.
     */
    transformSourceObjects?: string[];
    /**
     * Indicates if the element contains unique values; possible values are true and false.
     * Default is false.
     */
    unique?: boolean;
}

export interface SchemaProperty {
    authoritativeDefinitions?: AuthoritativeDefinition[];
    /**
     * The business name of the element.
     */
    businessName?: string;
    /**
     * Can be anything, like confidential, restricted, and public to more advanced
     * categorization. Some companies like PayPal, use data classification indicating the class
     * of data in the element; expected values are 1, 2, 3, 4, or 5.
     */
    classification?: string;
    /**
     * True or false indicator; If element is considered a critical data element (CDE) then true
     * else false.
     */
    criticalDataElement?: boolean;
    customProperties?:    CustomProperty[];
    /**
     * Description of the element.
     */
    description?: string;
    /**
     * The element name within the dataset that contains the encrypted element value. For
     * example, unencrypted element `email_address` might have an encryptedName of
     * `email_address_encrypt`.
     */
    encryptedName?: string;
    /**
     * List of sample element values.
     */
    examples?: Array<any[] | boolean | number | { [key: string]: any } | null | string>;
    id?:       string;
    /**
     * List of items in an array (only applicable when `logicalType: array`).
     */
    items?: SchemaItemProperty;
    /**
     * The logical element data type.
     */
    logicalType?: ItemsLogicalType;
    /**
     * Additional optional metadata to describe the logical type.
     */
    logicalTypeOptions?: PropertyLogicalTypeOptions;
    /**
     * Name of the element.
     */
    name: string;
    /**
     * Indicates if the element is partitioned; possible values are true and false.
     */
    partitioned?: boolean;
    /**
     * If element is used for partitioning, the position of the partition element. Starts from
     * 1. Example of `country, year` being partition columns, `country` has partitionKeyPosition
     * 1 and `year` partitionKeyPosition 2. Default to -1.
     */
    partitionKeyPosition?: number;
    /**
     * Physical name.
     */
    physicalName?: string;
    /**
     * The physical element data type in the data source. For example, VARCHAR(2), DOUBLE, INT.
     */
    physicalType?: string;
    /**
     * Boolean value specifying whether the element is primary or not. Default is false.
     */
    primaryKey?: boolean;
    /**
     * If element is a primary key, the position of the primary key element. Starts from 1.
     * Example of `account_id, name` being primary key columns, `account_id` has
     * primaryKeyPosition 1 and `name` primaryKeyPosition 2. Default to -1.
     */
    primaryKeyPosition?: number;
    /**
     * A list of properties for the object.
     */
    properties?: SchemaProperty[];
    quality?:    DataQuality[];
    /**
     * A list of relationships to other properties. When defined at property level, the 'from'
     * field is implicit and should not be specified.
     */
    relationships?: RelationshipPropertyLevel[];
    /**
     * Indicates if the element may contain Null values; possible values are true and false.
     * Default is false.
     */
    required?: boolean;
    tags?:     string[];
    /**
     * Describes the transform logic in very simple terms.
     */
    transformDescription?: string;
    /**
     * Logic used in the element transformation.
     */
    transformLogic?: string;
    /**
     * List of objects in the data source used in the transformation.
     */
    transformSourceObjects?: string[];
    /**
     * Indicates if the element contains unique values; possible values are true and false.
     * Default is false.
     */
    unique?: boolean;
}

/**
 * The logical element data type.
 */
export enum ItemsLogicalType {
    Array = "array",
    Boolean = "boolean",
    Date = "date",
    Integer = "integer",
    Number = "number",
    Object = "object",
    String = "string",
    Time = "time",
    Timestamp = "timestamp",
}

/**
 * Additional optional metadata to describe the logical type.
 */
export interface ItemsLogicalTypeOptions {
    /**
     * The default timezone of the timestamp. If timezone is not defined, the default timezone
     * UTC is used.
     */
    defaultTimezone?: string;
    /**
     * All values must be strictly less than this value (values < exclusiveMaximum).
     */
    exclusiveMaximum?: number | string;
    /**
     * All values must be strictly greater than this value (values > exclusiveMinimum).
     */
    exclusiveMinimum?: number | string;
    /**
     * Format of the value in terms of how many bits of space it can use (follows the Rust float
     * types).
     */
    format?: Format;
    /**
     * All values are less than or equal to this value (values <= maximum).
     */
    maximum?: number | string;
    /**
     * Maximum number of items.
     */
    maxItems?: number;
    /**
     * Maximum length of the string.
     */
    maxLength?: number;
    /**
     * Maximum number of properties.
     */
    maxProperties?: number;
    /**
     * All values are greater than or equal to this value (values >= minimum).
     */
    minimum?: number | string;
    /**
     * Minimum number of items
     */
    minItems?: number;
    /**
     * Minimum length of the string.
     */
    minLength?: number;
    /**
     * Minimum number of properties.
     */
    minProperties?: number;
    /**
     * Values must be multiples of this number. For example, multiple of 5 has valid values 0,
     * 5, 10, -5.
     */
    multipleOf?: number;
    /**
     * Regular expression pattern to define valid value. Follows regular expression syntax from
     * ECMA-262 (https://262.ecma-international.org/5.1/#sec-15.10.1).
     */
    pattern?: string;
    /**
     * Property names that are required to exist in the object.
     */
    required?: string[];
    /**
     * Whether the timestamp defines the timezone or not. If true, timezone information is
     * included in the timestamp.
     */
    timezone?: boolean;
    /**
     * If set to true, all items in the array are unique.
     */
    uniqueItems?: boolean;
}

/**
 * Format of the value in terms of how many bits of space it can use (follows the Rust float
 * types).
 */
export enum Format {
    F32 = "f32",
    F64 = "f64",
    I128 = "i128",
    I16 = "i16",
    I32 = "i32",
    I64 = "i64",
    I8 = "i8",
    U128 = "u128",
    U16 = "u16",
    U32 = "u32",
    U64 = "u64",
    U8 = "u8",
}

/**
 * Data quality rules with all the relevant information for rule setup and execution.
 *
 * Common comparison operators for data quality checks.
 */
export interface DataQuality {
    /**
     * Additional arguments for the metric, if needed.
     */
    arguments?:                { [key: string]: any };
    authoritativeDefinitions?: AuthoritativeDefinition[];
    /**
     * Consequences of the rule failure.
     */
    businessImpact?: string;
    /**
     * Additional properties required for rule execution.
     */
    customProperties?: CustomProperty[];
    /**
     * Describe the quality check to be completed.
     */
    description?: string;
    /**
     * The key performance indicator (KPI) or dimension for data quality.
     */
    dimension?: Dimension;
    /**
     * Name of the engine which executes the data quality checks.
     */
    engine?:         string;
    id?:             string;
    implementation?: { [key: string]: any } | string;
    method?:         string;
    /**
     * Define a data quality check based on the predefined metrics as per ODCS.
     */
    metric?: Metric;
    /**
     * Must be equal to the value to be valid. When using numbers, it is equivalent to '='.
     */
    mustBe?: any;
    /**
     * Must be between the two numbers to be valid. Smallest number first in the array.
     */
    mustBeBetween?: number[];
    /**
     * Must be greater than or equal to the value to be valid. It is equivalent to '>='.
     */
    mustBeGreaterOrEqualTo?: number;
    /**
     * Must be greater than the value to be valid. It is equivalent to '>'.
     */
    mustBeGreaterThan?: number;
    /**
     * Must be less than or equal to the value to be valid. It is equivalent to '<='.
     */
    mustBeLessOrEqualTo?: number;
    /**
     * Must be less than the value to be valid. It is equivalent to '<'.
     */
    mustBeLessThan?: number;
    /**
     * Must not be equal to the value to be valid. When using numbers, it is equivalent to '!='.
     */
    mustNotBe?: any;
    /**
     * Must not be between the two numbers to be valid. Smallest number first in the array.
     */
    mustNotBeBetween?: number[];
    /**
     * Name of the data quality check.
     */
    name?: string;
    /**
     * Query string that adheres to the dialect of the provided server.
     */
    query?: string;
    /**
     * Use metric instead
     */
    rule?: string;
    /**
     * Rule execution schedule details.
     */
    schedule?: string;
    /**
     * The name or type of scheduler used to start the data quality check.
     */
    scheduler?: string;
    /**
     * The severance of the quality rule.
     */
    severity?: string;
    tags?:     string[];
    /**
     * The type of quality check. 'text' is human-readable text that describes the quality of
     * the data. 'library' is a set of maintained predefined quality attributes such as row
     * count or unique. 'sql' is an individual SQL query that returns a value that can be
     * compared. 'custom' is quality attributes that are vendor-specific, such as Soda or Great
     * Expectations.
     */
    type?: DataQualityType;
    /**
     * Unit the rule is using, popular values are `rows` or `percent`, but any value is allowed.
     */
    unit?: string;
}

/**
 * The key performance indicator (KPI) or dimension for data quality.
 */
export enum Dimension {
    Accuracy = "accuracy",
    Completeness = "completeness",
    Conformity = "conformity",
    Consistency = "consistency",
    Coverage = "coverage",
    Timeliness = "timeliness",
    Uniqueness = "uniqueness",
}

/**
 * Define a data quality check based on the predefined metrics as per ODCS.
 */
export enum Metric {
    DuplicateValues = "duplicateValues",
    InvalidValues = "invalidValues",
    MissingValues = "missingValues",
    NullValues = "nullValues",
    RowCount = "rowCount",
}

/**
 * The type of quality check. 'text' is human-readable text that describes the quality of
 * the data. 'library' is a set of maintained predefined quality attributes such as row
 * count or unique. 'sql' is an individual SQL query that returns a value that can be
 * compared. 'custom' is quality attributes that are vendor-specific, such as Soda or Great
 * Expectations.
 */
export enum DataQualityType {
    Custom = "custom",
    Library = "library",
    SQL = "sql",
    Text = "text",
}

/**
 * Relationship definition at property level, where 'from' is implicitly the current
 * property.
 */
export interface RelationshipPropertyLevel {
    customProperties?: CustomProperty[];
    /**
     * Source property or properties.
     */
    from?: string[] | string;
    /**
     * Target property or properties to reference.
     */
    to: string[] | string;
    /**
     * The type of relationship. Defaults to 'foreignKey'.
     */
    type?: RelationshipType;
}

/**
 * The type of relationship. Defaults to 'foreignKey'.
 */
export enum RelationshipType {
    ForeignKey = "foreignKey",
}

/**
 * Additional optional metadata to describe the logical type.
 */
export interface PropertyLogicalTypeOptions {
    /**
     * The default timezone of the timestamp. If timezone is not defined, the default timezone
     * UTC is used.
     */
    defaultTimezone?: string;
    /**
     * All values must be strictly less than this value (values < exclusiveMaximum).
     */
    exclusiveMaximum?: number | string;
    /**
     * All values must be strictly greater than this value (values > exclusiveMinimum).
     */
    exclusiveMinimum?: number | string;
    /**
     * Format of the value in terms of how many bits of space it can use (follows the Rust float
     * types).
     */
    format?: Format;
    /**
     * All values are less than or equal to this value (values <= maximum).
     */
    maximum?: number | string;
    /**
     * Maximum number of items.
     */
    maxItems?: number;
    /**
     * Maximum length of the string.
     */
    maxLength?: number;
    /**
     * Maximum number of properties.
     */
    maxProperties?: number;
    /**
     * All values are greater than or equal to this value (values >= minimum).
     */
    minimum?: number | string;
    /**
     * Minimum number of items
     */
    minItems?: number;
    /**
     * Minimum length of the string.
     */
    minLength?: number;
    /**
     * Minimum number of properties.
     */
    minProperties?: number;
    /**
     * Values must be multiples of this number. For example, multiple of 5 has valid values 0,
     * 5, 10, -5.
     */
    multipleOf?: number;
    /**
     * Regular expression pattern to define valid value. Follows regular expression syntax from
     * ECMA-262 (https://262.ecma-international.org/5.1/#sec-15.10.1).
     */
    pattern?: string;
    /**
     * Property names that are required to exist in the object.
     */
    required?: string[];
    /**
     * Whether the timestamp defines the timezone or not. If true, timezone information is
     * included in the timestamp.
     */
    timezone?: boolean;
    /**
     * If set to true, all items in the array are unique.
     */
    uniqueItems?: boolean;
}

/**
 * Relationship definition at schema level, requiring both 'from' and 'to' fields with
 * matching types.
 */
export interface RelationshipSchemaLevel {
    customProperties?: CustomProperty[];
    /**
     * Source property or properties.
     */
    from: string[] | string;
    /**
     * Target property or properties to reference.
     */
    to: string[] | string;
    /**
     * The type of relationship. Defaults to 'foreignKey'.
     */
    type?: RelationshipType;
}

/**
 * Data source details of where data is physically stored.
 */
export interface VerticaServer {
    /**
     * The Snowflake account used by the server.
     */
    account?: string;
    /**
     * The name of the catalog.
     */
    catalog?:          string;
    customProperties?: CustomProperty[];
    /**
     * The name of the database.
     */
    database?: string;
    /**
     * Name of the dataset.
     */
    dataset?: string;
    /**
     * Only for format = json. How multiple json documents are delimited within one file
     */
    delimiter?: string;
    /**
     * Description of the server.
     */
    description?: string;
    /**
     * The server endpoint for S3-compatible servers.
     */
    endpointUrl?: string;
    /**
     * Environment of the server.
     */
    environment?: string;
    /**
     * File format.
     */
    format?: string;
    /**
     * The host of the Vertica server.
     */
    host?: string;
    id?:   string;
    /**
     * SFTP URL, starting with `sftp://`
     */
    location?: string;
    /**
     * The relative or absolute path to the data file(s).
     */
    path?: string;
    /**
     * The port of the Vertica server.
     */
    port?: number;
    /**
     * The GCP project name.
     */
    project?: string;
    /**
     * AWS region of Redshift server.
     */
    region?: string;
    /**
     * Region name.
     */
    regionName?: string;
    /**
     * List of roles that have access to the server.
     */
    roles?: Role[];
    /**
     * The name of the schema.
     */
    schema?: string;
    /**
     * Identifier of the server.
     */
    server: string;
    /**
     * The name of the service.
     */
    serviceName?: string;
    /**
     * Staging directory.
     */
    stagingDir?: string;
    /**
     * Name of the data stream.
     */
    stream?: string;
    /**
     * Type of the server.
     */
    type: ServerType;
    /**
     * The name of the cluster of resources that is a Snowflake virtual warehouse.
     */
    warehouse?: string;
}

/**
 * Type of the server.
 */
export enum ServerType {
    API = "api",
    Athena = "athena",
    Azure = "azure",
    Bigquery = "bigquery",
    Clickhouse = "clickhouse",
    Cloudsql = "cloudsql",
    Custom = "custom",
    Databricks = "databricks",
    Db2 = "db2",
    Denodo = "denodo",
    Dremio = "dremio",
    Duckdb = "duckdb",
    Glue = "glue",
    Hive = "hive",
    Impala = "impala",
    Informix = "informix",
    Kafka = "kafka",
    Kinesis = "kinesis",
    Local = "local",
    Mysql = "mysql",
    Oracle = "oracle",
    Postgres = "postgres",
    Postgresql = "postgresql",
    Presto = "presto",
    Pubsub = "pubsub",
    Redshift = "redshift",
    S3 = "s3",
    SFTP = "sftp",
    Snowflake = "snowflake",
    Sqlserver = "sqlserver",
    Synapse = "synapse",
    Trino = "trino",
    Vertica = "vertica",
    Zen = "zen",
}

export interface ServiceLevelAgreementProperty {
    /**
     * Description of the SLA for humans.
     */
    description?: string;
    /**
     * Describes the importance of the SLA from the list of: `regulatory`, `analytics`, or
     * `operational`.
     */
    driver?: string;
    /**
     * Element(s) to check on. Multiple elements should be extremely rare and, if so, separated
     * by commas.
     */
    element?: string;
    id?:      string;
    /**
     * Specific property in SLA, check the periodic table. May requires units (more details to
     * come).
     */
    property: string;
    /**
     * Configuration information for the scheduling tool, for cron a possible value is 0 20 * *
     * *.
     */
    schedule?: string;
    /**
     * Name of the scheduler, can be cron or any tool your organization support.
     */
    scheduler?: string;
    /**
     * **d**, day, days for days; **y**, yr, years for years, etc. Units use the ISO standard.
     */
    unit?: string;
    /**
     * Agreement value. The label will change based on the property itself.
     */
    value: boolean | number | null | string;
    /**
     * Extended agreement value. The label will change based on the property itself.
     */
    valueExt?: boolean | number | null | string;
}

/**
 * Top level for support channels.
 */
export interface SupportItem {
    /**
     * Channel name or identifier.
     */
    channel:           string;
    customProperties?: CustomProperty[];
    /**
     * Description of the channel, free text.
     */
    description?: string;
    id?:          string;
    /**
     * Some tools uses invitation URL for requesting or subscribing. Follows the [URL
     * scheme](https://en.wikipedia.org/wiki/URL#Syntax).
     */
    invitationUrl?: string;
    /**
     * Scope can be: `interactive`, `announcements`, `issues`, `notifications`.
     */
    scope?: string;
    /**
     * Name of the tool, value can be `email`, `slack`, `teams`, `discord`, `ticket`,
     * `googlechat`, or `other`.
     */
    tool?: string;
    /**
     * Access URL using normal [URL scheme](https://en.wikipedia.org/wiki/URL#Syntax) (https,
     * mailto, etc.).
     */
    url?: string;
}

/**
 * Team information object with members array (v3.1.0+).
 *
 * Team information.
 */
export interface Team {
    authoritativeDefinitions?: AuthoritativeDefinition[];
    /**
     * Custom properties block.
     */
    customProperties?: CustomProperty[];
    /**
     * Team description.
     */
    description?: string;
    id?:          string;
    /**
     * List of members.
     */
    members?: TeamMember[];
    /**
     * Team name.
     */
    name?: string;
    tags?: string[];
}

/**
 * Team member information.
 *
 * DEPRECATED: Array of team members. Use the Team object structure instead. This array
 * format is maintained for backward compatibility with v3.0.2 and earlier versions and will
 * be removed in ODCS 4.0.
 */
export interface TeamMember {
    authoritativeDefinitions?: AuthoritativeDefinition[];
    /**
     * Custom properties block.
     */
    customProperties?: CustomProperty[];
    /**
     * The date when the user joined the team.
     */
    dateIn?: Date;
    /**
     * The date when the user ceased to be part of the team.
     */
    dateOut?: Date;
    /**
     * The user's description.
     */
    description?: string;
    id?:          string;
    /**
     * The user's name.
     */
    name?: string;
    /**
     * The username of the user who replaced the previous user.
     */
    replacedByUsername?: string;
    /**
     * The user's job role; Examples might be owner, data steward. There is no limit on the role.
     */
    role?: string;
    tags?: string[];
    /**
     * The user's username or email.
     */
    username: string;
}
