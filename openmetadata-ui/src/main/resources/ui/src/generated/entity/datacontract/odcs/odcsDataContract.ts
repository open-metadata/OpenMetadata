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
 * Open Data Contract Standard (ODCS) v3.1.0 data contract representation for import/export.
 */
export interface OdcsDataContract {
    /**
     * ODCS standard version.
     */
    apiVersion: OdcsAPIVersion;
    /**
     * External reference links.
     */
    authoritativeDefinitions?: OdcsAuthoritativeDefinition[];
    /**
     * ISO 8601 UTC creation timestamp.
     */
    contractCreatedTs?: Date;
    /**
     * Non-standard key-value pairs.
     */
    customProperties?: OdcsCustomProperty[];
    /**
     * Data product name.
     */
    dataProduct?: string;
    /**
     * Purpose, limitations, usage details.
     */
    description?: OdcsDescription;
    /**
     * Logical data domain name.
     */
    domain?: string;
    /**
     * Unique identifier (UUID recommended).
     */
    id: string;
    /**
     * Document type (always 'DataContract').
     */
    kind: OdcsKind;
    /**
     * Contract name.
     */
    name?: string;
    /**
     * Pricing information.
     */
    price?: OdcsPricing;
    /**
     * Data quality rules.
     */
    quality?: OdcsQualityRule[];
    /**
     * IAM roles.
     */
    roles?: OdcsRole[];
    /**
     * Schema definition with objects and properties.
     */
    schema?: OdcsSchemaElement[];
    /**
     * Infrastructure and server definitions.
     */
    servers?: OdcsServer[];
    /**
     * Default element for SLA checks.
     */
    slaDefaultElement?: string;
    /**
     * SLA specifications.
     */
    slaProperties?: OdcsSlaProperty[];
    /**
     * Contract status.
     */
    status: OdcsStatus;
    /**
     * Support channels.
     */
    support?: OdcsSupportChannel[];
    /**
     * Categorical labels.
     */
    tags?: string[];
    /**
     * Team members.
     */
    team?: OdcsTeamMember[];
    /**
     * Primary property association.
     */
    tenant?: string;
    /**
     * Current version number.
     */
    version: string;
    [property: string]: any;
}

/**
 * ODCS standard version.
 *
 * ODCS API version.
 */
export enum OdcsAPIVersion {
    V220 = "v2.2.0",
    V221 = "v2.2.1",
    V222 = "v2.2.2",
    V300 = "v3.0.0",
    V301 = "v3.0.1",
    V302 = "v3.0.2",
    V310 = "v3.1.0",
}

/**
 * External reference link.
 */
export interface OdcsAuthoritativeDefinition {
    /**
     * Name of the authoritative definition.
     */
    name?: string;
    /**
     * Type of the reference (e.g., documentation, specification).
     */
    type?: string;
    /**
     * URL to the authoritative definition.
     */
    url?: string;
    [property: string]: any;
}

/**
 * Custom property key-value pair.
 */
export interface OdcsCustomProperty {
    /**
     * Property name (camelCase).
     */
    property?: string;
    /**
     * Property value.
     */
    value?: string;
    [property: string]: any;
}

/**
 * Purpose, limitations, usage details.
 *
 * ODCS description object.
 */
export interface OdcsDescription {
    /**
     * Limitations of the data.
     */
    limitations?: string;
    /**
     * Purpose of the data contract.
     */
    purpose?: string;
    /**
     * Usage guidelines for the data.
     */
    usage?: string;
    [property: string]: any;
}

/**
 * Document type (always 'DataContract').
 *
 * Kind of ODCS document.
 */
export enum OdcsKind {
    DataContract = "DataContract",
}

/**
 * Pricing information.
 */
export interface OdcsPricing {
    /**
     * Cost per unit.
     */
    priceAmount?: number;
    /**
     * Currency code.
     */
    priceCurrency?: string;
    /**
     * Unit of measurement (megabyte, gigabyte, etc.).
     */
    priceUnit?: string;
    [property: string]: any;
}

/**
 * Data quality rule definition.
 */
export interface OdcsQualityRule {
    /**
     * External rule documentation.
     */
    authoritativeDefinitions?: OdcsAuthoritativeDefinition[];
    /**
     * Failure consequences.
     */
    businessImpact?: string;
    /**
     * Column to apply the rule to.
     */
    column?: string;
    /**
     * Additional execution properties.
     */
    customProperties?: { [key: string]: any };
    /**
     * Rule documentation.
     */
    description?: string;
    /**
     * KPI classification.
     */
    dimension?: Dimension;
    /**
     * Vendor name (soda, greatExpectations, etc.).
     */
    engine?: string;
    /**
     * Vendor-specific configuration.
     */
    implementation?: string;
    /**
     * Standard quality metric from library (ODCS 3.1.0).
     */
    metric?: OdcsQualityMetric;
    /**
     * Value must equal.
     */
    mustBe?: number;
    /**
     * Value must be between [min, max].
     */
    mustBeBetween?: number[];
    /**
     * Value must be greater than or equal to.
     */
    mustBeGreaterOrEqualTo?: number;
    /**
     * Value must be greater than.
     */
    mustBeGreaterThan?: number;
    /**
     * Value must be less than or equal to.
     */
    mustBeLessOrEqualTo?: number;
    /**
     * Value must be less than.
     */
    mustBeLessThan?: number;
    /**
     * Value must not equal.
     */
    mustNotBe?: number;
    /**
     * Value must not be between [min, max].
     */
    mustNotBeBetween?: number[];
    /**
     * Rule identifier.
     */
    name?: string;
    /**
     * SQL for type=sql.
     */
    query?: string;
    /**
     * Library rule name. For type=library, can be one of the standard quality metrics.
     */
    rule?: string;
    /**
     * Schedule expression.
     */
    schedule?: string;
    /**
     * Cron or tool name.
     */
    scheduler?: string;
    /**
     * Impact level designation.
     */
    severity?: string;
    /**
     * Rule categorization.
     */
    tags?: string[];
    /**
     * Quality rule type.
     */
    type?: Type;
    /**
     * Measurement unit (rows, percent).
     */
    unit?: string;
    /**
     * Static value list.
     */
    validValues?: string[];
    [property: string]: any;
}

/**
 * KPI classification.
 */
export enum Dimension {
    AC = "ac",
    Accuracy = "accuracy",
    CF = "cf",
    CS = "cs",
    Completeness = "completeness",
    Conformity = "conformity",
    Consistency = "consistency",
    Coverage = "coverage",
    Cp = "cp",
    Cv = "cv",
    Timeliness = "timeliness",
    Tm = "tm",
    Uniqueness = "uniqueness",
    Uq = "uq",
}

/**
 * Standard quality metric from library (ODCS 3.1.0).
 *
 * Standard quality metrics library supported by ODCS 3.1.0.
 */
export enum OdcsQualityMetric {
    Completeness = "completeness",
    DistinctValues = "distinctValues",
    DuplicateValues = "duplicateValues",
    Freshness = "freshness",
    InvalidValues = "invalidValues",
    MissingValues = "missingValues",
    NullValues = "nullValues",
    RowCount = "rowCount",
    UniqueValues = "uniqueValues",
}

/**
 * Quality rule type.
 */
export enum Type {
    Custom = "custom",
    Library = "library",
    SQL = "sql",
    Text = "text",
}

/**
 * IAM role definition.
 */
export interface OdcsRole {
    /**
     * Access type.
     */
    access?: Access;
    /**
     * Additional role attributes.
     */
    customProperties?: { [key: string]: any };
    /**
     * Permissions summary.
     */
    description?: string;
    /**
     * Initial approval authority.
     */
    firstLevelApprovers?: string[];
    /**
     * IAM role name (required).
     */
    role: string;
    /**
     * Secondary approval authority.
     */
    secondLevelApprovers?: string[];
    [property: string]: any;
}

/**
 * Access type.
 */
export enum Access {
    Read = "read",
    ReadWrite = "readWrite",
    Write = "write",
}

/**
 * Schema element (object or property).
 *
 * Array element schema.
 */
export interface OdcsSchemaElement {
    /**
     * External documentation links.
     */
    authoritativeDefinitions?: OdcsAuthoritativeDefinition[];
    /**
     * Business terminology.
     */
    businessName?: string;
    /**
     * Data classification tag (e.g., PII, public, internal, restricted, confidential,
     * sensitive).
     */
    classification?: string;
    /**
     * CDE designation.
     */
    criticalDataElement?: boolean;
    /**
     * Non-standard attributes.
     */
    customProperties?: { [key: string]: any };
    /**
     * Aggregation level details (for objects).
     */
    dataGranularityDescription?: string;
    /**
     * Element documentation.
     */
    description?: string;
    /**
     * Encrypted column reference.
     */
    encryptedName?: string;
    /**
     * Sample values.
     */
    examples?: string[];
    /**
     * Array element schema.
     */
    items?: OdcsSchemaElement;
    /**
     * Logical data type per ODCS v3.1.0 spec.
     */
    logicalType?: LogicalType;
    /**
     * Type-specific options.
     */
    logicalTypeOptions?: OdcsLogicalTypeOptions;
    /**
     * Element identifier (required).
     */
    name: string;
    /**
     * Partitioning indicator.
     */
    partitioned?: boolean;
    /**
     * Partition order.
     */
    partitionKeyPosition?: number;
    /**
     * Physical storage name.
     */
    physicalName?: string;
    /**
     * Database-specific type.
     */
    physicalType?: string;
    /**
     * Whether this is a primary key (for properties).
     */
    primaryKey?: boolean;
    /**
     * Position in composite primary key (starts from 1).
     */
    primaryKeyPosition?: number;
    /**
     * Nested properties for object types.
     */
    properties?: OdcsSchemaElement[];
    /**
     * Quality rules for this schema element.
     */
    quality?: OdcsQualityRule[];
    /**
     * Whether null values are allowed.
     */
    required?: boolean;
    /**
     * Categorical assignments.
     */
    tags?: string[];
    /**
     * Business transformation summary.
     */
    transformDescription?: string;
    /**
     * Transformation SQL/logic.
     */
    transformLogic?: string;
    /**
     * Source objects list.
     */
    transformSourceObjects?: string[];
    /**
     * Uniqueness constraint.
     */
    unique?: boolean;
    [property: string]: any;
}

/**
 * Logical data type per ODCS v3.1.0 spec.
 */
export enum LogicalType {
    Array = "array",
    Boolean = "boolean",
    Bytes = "bytes",
    Date = "date",
    Decimal = "decimal",
    Double = "double",
    Float = "float",
    Integer = "integer",
    Long = "long",
    Null = "null",
    Number = "number",
    Object = "object",
    String = "string",
    Text = "text",
    Time = "time",
    Timestamp = "timestamp",
}

/**
 * Type-specific options.
 *
 * Type-specific options for schema properties.
 */
export interface OdcsLogicalTypeOptions {
    /**
     * Default timezone for timestamp/time types.
     */
    defaultTimezone?: string;
    /**
     * Exclusive maximum value.
     */
    exclusiveMaximum?: number;
    /**
     * Exclusive minimum value.
     */
    exclusiveMinimum?: number;
    /**
     * Format specification (e.g., date format, string pattern).
     */
    format?: string;
    /**
     * Maximum value for numeric types or maximum date.
     */
    maximum?: number;
    /**
     * Maximum array items.
     */
    maxItems?: number;
    /**
     * Maximum string length.
     */
    maxLength?: number;
    /**
     * Maximum object properties.
     */
    maxProperties?: number;
    /**
     * Minimum value for numeric types or minimum date.
     */
    minimum?: number;
    /**
     * Minimum array items.
     */
    minItems?: number;
    /**
     * Minimum string length.
     */
    minLength?: number;
    /**
     * Minimum object properties.
     */
    minProperties?: number;
    /**
     * Value must be multiple of this number.
     */
    multipleOf?: number;
    /**
     * Regex pattern for string validation.
     */
    pattern?: string;
    /**
     * Whether the timestamp/time defines the timezone or not.
     */
    timezone?: boolean;
    /**
     * Whether array items must be unique.
     */
    uniqueItems?: boolean;
    [property: string]: any;
}

/**
 * Server/infrastructure definition.
 */
export interface OdcsServer {
    /**
     * Account identifier.
     */
    account?: string;
    /**
     * Catalog name.
     */
    catalog?: string;
    /**
     * Non-standard attributes.
     */
    customProperties?: { [key: string]: any };
    /**
     * Database name.
     */
    database?: string;
    /**
     * Dataset name.
     */
    dataset?: string;
    /**
     * File delimiter.
     */
    delimiter?: string;
    /**
     * Server details.
     */
    description?: string;
    /**
     * Environment type.
     */
    environment?: Environment;
    /**
     * Data format.
     */
    format?: string;
    /**
     * Server hostname.
     */
    host?: string;
    /**
     * File location/path.
     */
    location?: string;
    /**
     * Server port.
     */
    port?: number;
    /**
     * Cloud project (BigQuery, etc.).
     */
    project?: string;
    /**
     * Cloud region.
     */
    region?: string;
    /**
     * Access role list.
     */
    roles?: string[];
    /**
     * Schema name.
     */
    schema?: string;
    /**
     * Server identifier (required).
     */
    server: string;
    /**
     * Stream name.
     */
    stream?: string;
    /**
     * Kafka/messaging topic.
     */
    topic?: string;
    /**
     * Technology platform (required).
     */
    type: string;
    /**
     * Data warehouse name.
     */
    warehouse?: string;
    [property: string]: any;
}

/**
 * Environment type.
 */
export enum Environment {
    Dev = "dev",
    Preprod = "preprod",
    Prod = "prod",
    UAT = "uat",
}

/**
 * SLA property definition.
 */
export interface OdcsSlaProperty {
    /**
     * SLA driver.
     */
    driver?: Driver;
    /**
     * Target element path.
     */
    element?: string;
    /**
     * SLA attribute name (required).
     */
    property: string;
    /**
     * Time unit (d/day/days, y/yr/years).
     */
    unit?: string;
    /**
     * Agreement specification (required).
     */
    value: string;
    /**
     * Extended value.
     */
    valueExt?: string;
    [property: string]: any;
}

/**
 * SLA driver.
 */
export enum Driver {
    Analytics = "analytics",
    Operational = "operational",
    Regulatory = "regulatory",
}

/**
 * Contract status.
 *
 * Status of the ODCS data contract.
 */
export enum OdcsStatus {
    Active = "active",
    Deprecated = "deprecated",
    Draft = "draft",
    Proposed = "proposed",
    Retired = "retired",
}

/**
 * Support and communication channel.
 */
export interface OdcsSupportChannel {
    /**
     * Channel identifier (required).
     */
    channel: string;
    /**
     * Channel purpose.
     */
    description?: string;
    /**
     * Subscription/request URL.
     */
    invitationUrl?: string;
    /**
     * Channel scope.
     */
    scope?: Scope;
    /**
     * Channel tool type.
     */
    tool?: Tool;
    /**
     * Access URL (required).
     */
    url: string;
    [property: string]: any;
}

/**
 * Channel scope.
 */
export enum Scope {
    Announcements = "announcements",
    Interactive = "interactive",
    Issues = "issues",
}

/**
 * Channel tool type.
 */
export enum Tool {
    Discord = "discord",
    Email = "email",
    Other = "other",
    Slack = "slack",
    Teams = "teams",
    Ticket = "ticket",
}

/**
 * Team member information.
 */
export interface OdcsTeamMember {
    /**
     * Join date.
     */
    dateIn?: Date;
    /**
     * Departure date.
     */
    dateOut?: Date;
    /**
     * Role context.
     */
    description?: string;
    /**
     * Full name.
     */
    name?: string;
    /**
     * Successor identifier.
     */
    replacedByUsername?: string;
    /**
     * Job title.
     */
    role?: string;
    /**
     * User identifier/email.
     */
    username?: string;
    [property: string]: any;
}
