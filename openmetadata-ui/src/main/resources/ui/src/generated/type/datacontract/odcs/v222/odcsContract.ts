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
     * ODCS export profile v2.2.2.
     */
    apiVersion?: APIVersion;
    /**
     * The database where the dataset resides.
     */
    database?: string;
    dataset:   Dataset[];
    /**
     * Name of the logical domain dataset the contract describes. This field is only required
     * for output data contracts.
     */
    datasetDomain?: string;
    /**
     * The kind of dataset being cataloged; Expected values are `virtualDataset` or
     * `managedDataset`.
     */
    datasetKind?: string;
    /**
     * May be required in cloud instance like GCP BigQuery dataset name.
     */
    datasetName: string;
    /**
     * High level description of the dataset.
     */
    description?: Description;
    /**
     * The connection driver required to connect to the dataset.
     */
    driver?: string;
    /**
     * The version of the connection driver to be used to connect to the dataset.
     */
    driverVersion?: string;
    /**
     * The kind of file this is. Valid value is `DataContract`.
     */
    kind: Kind;
    /**
     * User credentials for connecting to the dataset; how the credentials will be stored/passed
     * is out of the scope of this contract.
     */
    password?: string;
    price?:    Pricing;
    /**
     * The email distribution list (DL) of the persons or team responsible for maintaining the
     * dataset.
     */
    productDl?: string;
    /**
     * The URL for submitting feedback to the team responsible for maintaining the dataset.
     */
    productFeedbackUrl?: string;
    /**
     * Slack channel of the team responsible for maintaining the dataset.
     */
    productSlackChannel?: string;
    /**
     * Associated project name, can be used for billing or administrative purpose. Used to be
     * datasetProject.
     */
    project?: string;
    /**
     * The name of the data quantum or data product.
     */
    quantumName: string;
    /**
     * A list of roles that will provide user access to the dataset.
     */
    roles?: Role[];
    /**
     * The server where the dataset resides.
     */
    server?: string;
    /**
     * Columns (using the Table.Column notation) to do the checks on. By default, it is the
     * partition column.
     */
    slaDefaultColumn?: string;
    /**
     * A list of key/value pairs for SLA specific properties. There is no limit on the type of
     * properties (more details to come).
     */
    slaProperties?: ServiceLevelAgreementProperty[];
    /**
     * The platform where the dataset resides. Expected value is GoogleCloudPlatform, IBMCloud,
     * Azure...
     */
    sourcePlatform?: string;
    /**
     * The system where the dataset resides. Expected value can be BigQuery.
     */
    sourceSystem?: string;
    stakeholders?: Stakeholder[];
    /**
     * Current status of the dataset. Valid values are `production`, `test`, or `development`.
     */
    status: string;
    /**
     * A list of tags that may be assigned to the dataset, table or column; the `tags` keyword
     * may appear at any level.
     */
    tags?: string[];
    /**
     * Indicates the property the data is primarily associated with. Value is case insensitive.
     */
    tenant?: string;
    /**
     * Identifies the types of objects in the dataset. For BigQuery or any other database, the
     * expected value would be Tables.
     */
    type: string;
    /**
     * List of data modes for which the dataset may be used.  Expected sample values might be
     * `analytical` or `operational`. <br/>Note: in the future, this will probably be replaced
     * by ports.
     */
    userConsumptionMode?: string;
    /**
     * User credentials for connecting to the dataset; how the credentials will be stored/passed
     * is outside of the scope of the contract.
     */
    username?: string;
    /**
     * A unique identifier used to reduce the risk of dataset name collisions; initially the
     * UUID will be created using a UUID generator tool
     * ([example](https://www.uuidgenerator.net/)). However, we may want to develop a method
     * that accepts a seed value using a combination of fields–such as name, kind and source–to
     * create a repeatable value.
     */
    uuid: string;
    /**
     * Current version of the data contract.
     */
    version: string;
    [property: string]: any;
}

/**
 * ODCS export profile v2.2.2.
 */
export enum APIVersion {
    V222 = "v2.2.2",
}

export interface Dataset {
    authoritativeDefinitions?: AuthoritativeDefinition[];
    /**
     * Array. A list of columns in the table.
     */
    columns?: Column[];
    /**
     * Granular level of the data in the table. Example would be `pmt_txn_id`.
     */
    dataGranularity?: string;
    /**
     * Description of the dataset.
     */
    description?: string;
    /**
     * Physical name of the table, default value is table name + version separated by
     * underscores, as `table_1_2_0`.
     */
    physicalName?: string;
    /**
     * Name of the previous version of the dataset, if applicable.
     */
    priorTableName?: string;
    /**
     * Data quality rules with all the relevant information for rule setup and execution.
     */
    quality?: DataQuality[];
    /**
     * Name of the table being cataloged; the value should only contain the table name. Do not
     * include the project or dataset name in the value.
     */
    table: string;
    [property: string]: any;
}

/**
 * List of links to sources that provide more details on the table; examples would be a link
 * to an external definition, a training video, a GitHub repo, Collibra, or another tool.
 * Authoritative definitions follow the same structure in the standard.
 */
export interface AuthoritativeDefinition {
    /**
     * Type of definition for authority: v2.3 adds standard values: `businessDefinition`,
     * `transformationImplementation`, `videoTutorial`, `tutorial`, and `implementation`.
     */
    type: string;
    /**
     * URL to the authority.
     */
    url: string;
    [property: string]: any;
}

export interface Column {
    authoritativeDefinitions?: AuthoritativeDefinition[];
    /**
     * The business name of the column.
     */
    businessName?: string;
    /**
     * Can be anything, like confidential, restricted, and public to more advanced
     * categorization. Some companies like PayPal, use data classification indicating the class
     * of data in the column; expected values are 1, 2, 3, 4, or 5.
     */
    classification?: string;
    /**
     * If column is used for clustering, the position of the cluster column. Starts from 1.
     * Example of `year, date` being cluster columns, `year` has clusterKeyPosition 1 and `date`
     * clusterKeyPosition 2. Default to -1.
     */
    clusterKeyPosition?: number;
    /**
     * Indicates of the column is clustered; possible values are true and false.
     */
    clusterStatus?: boolean;
    /**
     * The name of the column.
     */
    column: string;
    /**
     * True or false indicator; If element is considered a critical data element (CDE) then true
     * else false.
     */
    criticalDataElementStatus?: boolean;
    /**
     * Description of the column.
     */
    description?: string;
    /**
     * The column name within the table that contains the encrypted column value. For example,
     * unencrypted column `email_address` might have an encryptedColumnName of
     * `email_address_encrypt`.
     */
    encryptedColumnName?: string;
    /**
     * Indicates if the column may contain Null values; possible values are true and false.
     * Default is false.
     */
    isNullable?: boolean;
    /**
     * Boolean value specifying whether the column is primary or not. Default is false.
     */
    isPrimaryKey?: boolean;
    /**
     * Indicates if the column contains unique values; possible values are true and false.
     * Default is false.
     */
    isUnique?: boolean;
    /**
     * The logical column datatype.
     */
    logicalType: string;
    /**
     * If column is used for partitioning, the position of the partition column. Starts from 1.
     * Example of `country, year` being partition columns, `country` has partitionKeyPosition 1
     * and `year` partitionKeyPosition 2. Default to -1.
     */
    partitionKeyPosition?: number;
    /**
     * Indicates if the column is partitioned; possible values are true and false.
     */
    partitionStatus?: boolean;
    /**
     * The physical column datatype.
     */
    physicalType: string;
    /**
     * If column is a primary key, the position of the primary key column. Starts from 1.
     * Example of `account_id, name` being primary key columns, `account_id` has
     * primaryKeyPosition 1 and `name` primaryKeyPosition 2. Default to -1.
     */
    primaryKeyPosition?: number;
    /**
     * List of sample column values.
     */
    sampleValues?: string[];
    /**
     * A list of tags that may be assigned to the dataset, table or column; the tags keyword may
     * appear at any level.
     */
    tags?: string[];
    /**
     * Describes the transform logic in very simple terms.
     */
    transformDescription?: string;
    /**
     * Logic used in the column transformation.
     */
    transformLogic?: string;
    /**
     * List of sources used in column transformation.
     */
    transformSourceTables?: string[];
    [property: string]: any;
}

export interface DataQuality {
    /**
     * Consequences of the rule failure.
     */
    businessImpact?: string;
    /**
     * The Rosewall data quality code(s) indicating which quality checks need to be performed at
     * the dataset, table or column level; The quality keyword may appear at any level; Some
     * quality checks require parameters such so the check can be completed (eg, list of fields
     * used to identify a distinct row) therefore some quality checks may be followed by a
     * single value or an array; See appendix for link to quality checks.
     */
    code?: string;
    /**
     * To be used in lieu of quality.columns when only a single column is required for the
     * quality check.
     */
    column?: string;
    /**
     * List of columns to be used in the quality check.
     */
    columns?: string;
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
    dimension?: string;
    /**
     * Rule execution schedule details.
     */
    scheduleCronExpression?: string;
    /**
     * The severance of the quality rule.
     */
    severity?: string;
    /**
     * The template name which indicates what is the equivalent template from the tool.
     */
    templateName: string;
    /**
     * Name of the tool used to complete the quality check; Most will be Elevate initially.
     */
    toolName: string;
    /**
     * Name of the quality tool's rule created to complete the quality check.
     */
    toolRuleName?: string;
    /**
     * The type of quality check.
     */
    type?: string;
    [property: string]: any;
}

export interface CustomProperty {
    /**
     * The name of the key. Names should be in camel case–the same as if they were permanent
     * properties in the contract.
     */
    property?: string;
    /**
     * The value of the key.
     */
    value?: { [key: string]: any };
    [property: string]: any;
}

/**
 * High level description of the dataset.
 */
export interface Description {
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
    [property: string]: any;
}

export interface Role {
    /**
     * The type of access provided by the IAM role; the value will generally come directly from
     * the "BQ dataset to IAM roles mapping" document.
     */
    access: string;
    /**
     * The name(s) of the first level approver(s) of the role; the value will generally come
     * directly from the "BQ dataset to IAM roles mapping" document.
     */
    firstLevelApprovers?: string;
    /**
     * Name of the IAM role that provides access to the dataset; the value will generally come
     * directly from the "BQ dataset to IAM roles mapping" document.
     */
    role: string;
    /**
     * The name(s) of the second level approver(s) of the role; the value will generally come
     * directly from the "BQ dataset to IAM roles mapping" document.
     */
    secondLevelApprovers?: string;
    [property: string]: any;
}

export interface ServiceLevelAgreementProperty {
    /**
     * Column(s) to check on. Multiple columns should be extremely rare and, if so, separated by
     * commas.
     */
    column?: string;
    /**
     * Describes the importance of the SLA from the list of: `regulatory`, `analytics`, or
     * `operational`.
     */
    driver?: string;
    /**
     * Specific property in SLA, check the periodic table. May requires units (more details to
     * come).
     */
    property: string;
    /**
     * **d**, day, days for days; **y**, yr, years for years, etc. Units use the ISO standard.
     */
    unit?: string;
    /**
     * Agreement value. The label will change based on the property itself.
     */
    value: number | string;
    /**
     * Extended agreement value. The label will change based on the property itself.
     */
    valueExt?: number | string;
    [property: string]: any;
}

export interface Stakeholder {
    /**
     * The date when the user became a stakeholder.
     */
    dateIn?: string;
    /**
     * The date when the user ceased to be a stakeholder
     */
    dateOut?: string;
    /**
     * The username of the user who replaced the stakeholder
     */
    replacedByUsername?: string;
    /**
     * The stakeholder's job role; Examples might be owner, data steward. There is no limit on
     * the role.
     */
    role?: string;
    /**
     * The stakeholder's username or email.
     */
    username?: string;
    [property: string]: any;
}
