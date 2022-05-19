/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 *  Copyright 2021 Collate
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
 * This schema defines the Table entity. A Table organizes data in rows and columns and is
 * defined by a Schema. OpenMetadata does not have a separate abstraction for Schema. Both
 * Table and Schema are captured in this entity.
 */
export interface Table {
  /**
   * Change that lead to this version of the entity.
   */
  changeDescription?: ChangeDescription;
  /**
   * Columns in this table.
   */
  columns: Column[];
  /**
   * Reference to Database that contains this table.
   */
  database?: EntityReference;
  /**
   * Reference to database schema that contains this table.
   */
  databaseSchema?: EntityReference;
  /**
   * This captures information about how the table is modeled. Currently only DBT model is
   * supported.
   */
  dataModel?: DataModel;
  /**
   * When `true` indicates the entity has been soft deleted.
   */
  deleted?: boolean;
  /**
   * Description of a table.
   */
  description?: string;
  /**
   * Display Name that identifies this table. It could be title or label from the source
   * services.
   */
  displayName?: string;
  /**
   * Entity extension data with custom attributes added to the entity.
   */
  extension?: any;
  /**
   * Followers of this table.
   */
  followers?: EntityReference[];
  /**
   * Fully qualified name of a table in the form `serviceName.databaseName.tableName`.
   */
  fullyQualifiedName?: string;
  /**
   * Link to this table resource.
   */
  href?: string;
  /**
   * Unique identifier of this table instance.
   */
  id: string;
  /**
   * Details of other tables this table is frequently joined with.
   */
  joins?: TableJoins;
  /**
   * Reference to the Location that contains this table.
   */
  location?: EntityReference;
  /**
   * Name of a table. Expected to be unique within a database.
   */
  name: string;
  /**
   * Owner of this table.
   */
  owner?: EntityReference;
  /**
   * Percentage of data we want to execute the profiler and tests on. Represented in the range
   * (0, 100).
   */
  profileSample?: number;
  /**
   * Sample data for a table.
   */
  sampleData?: TableData;
  /**
   * Link to Database service this table is hosted in.
   */
  service?: EntityReference;
  /**
   * Service type this table is hosted in.
   */
  serviceType?: DatabaseServiceType;
  /**
   * Table constraints.
   */
  tableConstraints?: TableConstraint[];
  tablePartition?: TablePartition;
  /**
   * Data profile for a table.
   */
  tableProfile?: TableProfile[];
  /**
   * List of queries that ran against a table.
   */
  tableQueries?: SQLQuery[];
  /**
   * List of test cases that ran against a table.
   */
  tableTests?: TableTest[];
  tableType?: TableType;
  /**
   * Tags for this table.
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
   * Latest usage information for this table.
   */
  usageSummary?: TypeUsedToReturnUsageDetailsOfAnEntity;
  /**
   * Metadata version of the entity.
   */
  version?: number;
  /**
   * View Definition in SQL. Applies to TableType.View only.
   */
  viewDefinition?: string;
}

/**
 * Change that lead to this version of the entity.
 *
 * Description of the change.
 */
export interface ChangeDescription {
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
   * List of column test cases that ran against a table column.
   */
  columnTests?: ColumnTest[];
  /**
   * Column level constraint.
   */
  constraint?: Constraint;
  /**
   * List of Custom Metrics registered for a column.
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
   * Display name used for dataType. This is useful for complex types, such as `array<int>,
   * map<int,string>, struct<>, and union types.
   */
  dataTypeDisplay?: string;
  /**
   * Description of the column.
   */
  description?: string;
  /**
   * Display Name that identifies this column name.
   */
  displayName?: string;
  fullyQualifiedName?: string;
  /**
   * Json schema only if the dataType is JSON else null.
   */
  jsonSchema?: string;
  name: string;
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
  Array = 'ARRAY',
  Bigint = 'BIGINT',
  Binary = 'BINARY',
  Blob = 'BLOB',
  Boolean = 'BOOLEAN',
  Byteint = 'BYTEINT',
  Bytes = 'BYTES',
  Char = 'CHAR',
  Date = 'DATE',
  Datetime = 'DATETIME',
  Decimal = 'DECIMAL',
  Double = 'DOUBLE',
  Enum = 'ENUM',
  Float = 'FLOAT',
  Geography = 'GEOGRAPHY',
  Int = 'INT',
  Interval = 'INTERVAL',
  JSON = 'JSON',
  Longblob = 'LONGBLOB',
  Map = 'MAP',
  Mediumblob = 'MEDIUMBLOB',
  Mediumtext = 'MEDIUMTEXT',
  Number = 'NUMBER',
  Numeric = 'NUMERIC',
  Set = 'SET',
  Smallint = 'SMALLINT',
  String = 'STRING',
  Struct = 'STRUCT',
  Text = 'TEXT',
  Time = 'TIME',
  Timestamp = 'TIMESTAMP',
  Tinyint = 'TINYINT',
  UUID = 'UUID',
  Union = 'UNION',
  Varbinary = 'VARBINARY',
  Varchar = 'VARCHAR',
}

/**
 * ColumnTest is a test definition to capture data quality tests against tables and columns.
 */
export interface ColumnTest {
  /**
   * Name of the column in a table.
   */
  columnName: string;
  /**
   * Description of the testcase.
   */
  description?: string;
  executionFrequency?: TestCaseExecutionFrequency;
  /**
   * Unique identifier of this table instance.
   */
  id?: string;
  /**
   * Name that identifies this test case. Name passed by client will be  overridden by  auto
   * generating based on table/column name and test name
   */
  name: string;
  /**
   * Owner of this Pipeline.
   */
  owner?: EntityReference;
  /**
   * List of results of the test case.
   */
  results?: TestCaseResult[];
  testCase: ColumnTestCase;
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
 * How often the test case should run.
 */
export enum TestCaseExecutionFrequency {
  Daily = 'Daily',
  Hourly = 'Hourly',
  Weekly = 'Weekly',
}

/**
 * Owner of this Pipeline.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Owner of this Custom Metric.
 *
 * Reference to Database that contains this table.
 *
 * Reference to database schema that contains this table.
 *
 * Followers of this table.
 *
 * Reference to the Location that contains this table.
 *
 * Owner of this table.
 *
 * Link to Database service this table is hosted in.
 *
 * User who ran this query.
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
 * Schema to capture test case result.
 */
export interface TestCaseResult {
  /**
   * Data one which profile is taken.
   */
  executionTime?: number;
  /**
   * Details of test case results.
   */
  result?: string;
  /**
   * sample data to capture rows/columns that didn't match the expressed testcase.
   */
  sampleData?: string;
  /**
   * Status of Test Case run.
   */
  testCaseStatus?: TestCaseStatus;
}

/**
 * Status of Test Case run.
 */
export enum TestCaseStatus {
  Aborted = 'Aborted',
  Failed = 'Failed',
  Success = 'Success',
}

/**
 * Column Test Case.
 */
export interface ColumnTestCase {
  columnTestType?: ColumnTestType;
  config?: ColumnValuesToBeBetween;
}

export enum ColumnTestType {
  ColumnValueLengthsToBeBetween = 'columnValueLengthsToBeBetween',
  ColumnValuesMissingCountToBeEqual = 'columnValuesMissingCountToBeEqual',
  ColumnValuesToBeBetween = 'columnValuesToBeBetween',
  ColumnValuesToBeNotInSet = 'columnValuesToBeNotInSet',
  ColumnValuesToBeNotNull = 'columnValuesToBeNotNull',
  ColumnValuesToBeUnique = 'columnValuesToBeUnique',
  ColumnValuesToMatchRegex = 'columnValuesToMatchRegex',
}

/**
 * This schema defines the test ColumnValuesToBeUnique. Test the values in a column to be
 * unique.
 *
 * This schema defines the test ColumnValuesToBeNotNull. Test the number of values in a
 * column are null. Values must be explicitly null. Empty strings don't count as null.
 *
 * This schema defines the test ColumnValuesToMatchRegex. Test the values in a column to
 * match a given regular expression.
 *
 * This schema defines the test ColumnValuesToBeNotInSet. Test the column values to not be
 * in the set.
 *
 * This schema defines the test ColumnValuesToBeBetween. Test the values in a column to be
 * between minimum and maximum value.
 *
 * This schema defines the test ColumnValuesMissingCount. Test the column values missing
 * count to be equal to given number.
 *
 * This schema defines the test ColumnValueLengthsToBeBetween. Test the value lengths in a
 * column to be between minimum and maximum value.
 */
export interface ColumnValuesToBeBetween {
  columnValuesToBeUnique?: boolean;
  columnValuesToBeNotNull?: boolean;
  /**
   * The regular expression the column entries should match.
   */
  regex?: string;
  /**
   * An Array of values.
   */
  forbiddenValues?: Array<number | string>;
  /**
   * The {maxValue} value for the column entry. if maxValue is not included, minValue is
   * treated as lowerBound and there will eb no maximum number of rows
   */
  maxValue?: number;
  /**
   * The {minValue} value for the column entry. If minValue is not included, maxValue is
   * treated as upperBound and there will be no minimum number of rows
   */
  minValue?: number;
  /**
   * No.of missing values to be equal to.
   */
  missingCountValue?: number;
  /**
   * By default match all null and empty values to be missing. This field allows us to
   * configure additional strings such as N/A, NULL as missing strings as well.
   */
  missingValueMatch?:
    | string[]
    | boolean
    | number
    | number
    | { [key: string]: any }
    | null
    | string;
  /**
   * The {maxLength} for the column length. if maxLength is not included, minLength is treated
   * as lowerBound and there will eb no maximum number of rows
   */
  maxLength?: number;
  /**
   * The {minLength} for the column length. If minLength is not included, maxLength is treated
   * as upperBound and there will be no minimum number of rows
   */
  minLength?: number;
}

/**
 * Column level constraint.
 *
 * This enum defines the type for column constraint.
 */
export enum Constraint {
  NotNull = 'NOT_NULL',
  Null = 'NULL',
  PrimaryKey = 'PRIMARY_KEY',
  Unique = 'UNIQUE',
}

/**
 * Custom Metric definition that we will associate with a column.
 */
export interface CustomMetric {
  /**
   * Name of the column in a table.
   */
  columnName: string;
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
   * Owner of this Custom Metric.
   */
  owner?: EntityReference;
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
 * This schema defines the type for labeling an entity with a Tag.
 */
export interface TagLabel {
  /**
   * Unique name of the tag category.
   */
  description?: string;
  /**
   * Link to the tag resource.
   */
  href?: string;
  /**
   * Label type describes how a tag label was applied. 'Manual' indicates the tag label was
   * applied by a person. 'Derived' indicates a tag label was derived using the associated tag
   * relationship (see TagCategory.json for more details). 'Propagated` indicates a tag label
   * was propagated from upstream based on lineage. 'Automated' is used when a tool was used
   * to determine the tag label.
   */
  labelType: LabelType;
  /**
   * Label is from Tags or Glossary.
   */
  source: Source;
  /**
   * 'Suggested' state is used when a tag label is suggested by users or tools. Owner of the
   * entity must confirm the suggested labels before it is marked as 'Confirmed'.
   */
  state: State;
  tagFQN: string;
}

/**
 * Label type describes how a tag label was applied. 'Manual' indicates the tag label was
 * applied by a person. 'Derived' indicates a tag label was derived using the associated tag
 * relationship (see TagCategory.json for more details). 'Propagated` indicates a tag label
 * was propagated from upstream based on lineage. 'Automated' is used when a tool was used
 * to determine the tag label.
 */
export enum LabelType {
  Automated = 'Automated',
  Derived = 'Derived',
  Manual = 'Manual',
  Propagated = 'Propagated',
}

/**
 * Label is from Tags or Glossary.
 */
export enum Source {
  Glossary = 'Glossary',
  Tag = 'Tag',
}

/**
 * 'Suggested' state is used when a tag label is suggested by users or tools. Owner of the
 * entity must confirm the suggested labels before it is marked as 'Confirmed'.
 */
export enum State {
  Confirmed = 'Confirmed',
  Suggested = 'Suggested',
}

/**
 * This captures information about how the table is modeled. Currently only DBT model is
 * supported.
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
  modelType: ModelType;
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
   * This corresponds to compile SQL from `<model_name>.sql` in DBT. In cases where
   * compilation is not necessary, this corresponds to SQL that created the table.
   */
  sql: string;
  /**
   * Fully qualified name of Models/tables used for in `sql` for creating this table.
   */
  upstream?: string[];
}

export enum ModelType {
  Dbt = 'DBT',
}

/**
 * Details of other tables this table is frequently joined with.
 *
 * This schema defines the type to capture information about how columns in this table are
 * joined with columns in the other tables.
 */
export interface TableJoins {
  columnJoins?: ColumnJoins[];
  dayCount?: number;
  /**
   * Date can be only from today going back to last 29 days.
   */
  startDate?: Date;
}

/**
 * This schema defines the type to capture how frequently a column is joined with columns in
 * the other tables.
 */
export interface ColumnJoins {
  columnName?: string;
  /**
   * Fully qualified names of the columns that this column is joined with.
   */
  joinedWith?: JoinedWith[];
}

export interface JoinedWith {
  fullyQualifiedName?: string;
  joinCount?: number;
}

/**
 * Sample data for a table.
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
 * Service type this table is hosted in.
 *
 * Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres...
 */
export enum DatabaseServiceType {
  Athena = 'Athena',
  AzureSQL = 'AzureSQL',
  BigQuery = 'BigQuery',
  Clickhouse = 'Clickhouse',
  Databricks = 'Databricks',
  Db2 = 'Db2',
  DeltaLake = 'DeltaLake',
  Druid = 'Druid',
  DynamoDB = 'DynamoDB',
  Glue = 'Glue',
  Hive = 'Hive',
  MariaDB = 'MariaDB',
  Mssql = 'Mssql',
  Mysql = 'Mysql',
  Oracle = 'Oracle',
  PinotDB = 'PinotDB',
  Postgres = 'Postgres',
  Presto = 'Presto',
  Redshift = 'Redshift',
  SQLite = 'SQLite',
  Salesforce = 'Salesforce',
  SampleData = 'SampleData',
  SingleStore = 'SingleStore',
  Snowflake = 'Snowflake',
  Trino = 'Trino',
  Vertica = 'Vertica',
}

/**
 * This enum defines the type for table constraint.
 */
export interface TableConstraint {
  /**
   * List of column names corresponding to the constraint.
   */
  columns?: string[];
  constraintType?: ConstraintType;
}

export enum ConstraintType {
  ForeignKey = 'FOREIGN_KEY',
  PrimaryKey = 'PRIMARY_KEY',
  Unique = 'UNIQUE',
}

/**
 * This schema defines the partition column of a table and format the partition is created.
 */
export interface TablePartition {
  /**
   * List of column names corresponding to the partition.
   */
  columns: string[];
  /**
   * partition interval , example hourly, daily, monthly.
   */
  interval: string;
  /**
   * type of partition interval, example time-unit, integer-range
   */
  intervalType: IntervalType;
}

/**
 * type of partition interval, example time-unit, integer-range
 */
export enum IntervalType {
  ColumnValue = 'COLUMN-VALUE',
  IngestionTime = 'INGESTION-TIME',
  IntegerRange = 'INTEGER-RANGE',
  TimeUnit = 'TIME-UNIT',
}

/**
 * This schema defines the type to capture the table's data profile.
 */
export interface TableProfile {
  /**
   * No.of columns in the table.
   */
  columnCount?: number;
  /**
   * List of local column profiles of the table.
   */
  columnProfile?: ColumnProfile[];
  /**
   * Data one which profile is taken.
   */
  profileDate?: Date;
  /**
   * Percentage of data used to compute this profiler execution. Represented in the range (0,
   * 100].
   */
  profileSample?: number;
  /**
   * No.of rows in the table. This is always executed on the whole table.
   */
  rowCount?: number;
}

/**
 * This schema defines the type to capture the table's column profile.
 */
export interface ColumnProfile {
  /**
   * Custom Metrics profile list bound to a column.
   */
  customMetricsProfile?: CustomMetricProfile[];
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
   * Histogram of a column.
   */
  histogram?:
    | any[]
    | boolean
    | HistogramClass
    | number
    | number
    | null
    | string;
  /**
   * Maximum value in a column.
   */
  max?: number | number | string;
  /**
   * Maximum string length in a column.
   */
  maxLength?: number;
  /**
   * Avg value in a column.
   */
  mean?: number;
  /**
   * Minimum value in a column.
   */
  min?: number | number | string;
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
  name?: string;
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
   * Percentage of values in this column with respect to rowcount.
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
 * This schema defines the type to capture the table's sql queries.
 */
export interface SQLQuery {
  /**
   * Checksum to avoid registering duplicate queries.
   */
  checksum?: string;
  /**
   * How long did the query took to run in seconds.
   */
  duration?: number;
  /**
   * SQL Query text that matches the table name.
   */
  query?: string;
  /**
   * Date on which the query ran.
   */
  queryDate?: Date;
  /**
   * User who ran this query.
   */
  user?: EntityReference;
  /**
   * Users can vote up to rank the popular queries.
   */
  vote?: number;
}

/**
 * TableTest is a test definition to capture data quality tests against tables and columns.
 */
export interface TableTest {
  /**
   * Description of the testcase.
   */
  description?: string;
  executionFrequency?: TestCaseExecutionFrequency;
  /**
   * Unique identifier of this table instance.
   */
  id?: string;
  /**
   * Name that identifies this test case.
   */
  name: string;
  /**
   * Owner of this Pipeline.
   */
  owner?: EntityReference;
  /**
   * List of results of the test case.
   */
  results?: TestCaseResult[];
  testCase: TableTestCase;
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
 * Table Test Case.
 */
export interface TableTestCase {
  config?: TableRowCountToBeBetween;
  tableTestType?: TableTestType;
}

/**
 * This schema defines the test TableRowCountToEqual. Test the number of rows equal to a
 * value.
 *
 * This schema defines the test TableRowCountToBeBetween. Test the number of rows to between
 * to two values.
 *
 * This schema defines the test TableColumnCountToEqual. Test the number of columns equal to
 * a value.
 */
export interface TableRowCountToBeBetween {
  /**
   * Expected number of rows {value}
   */
  value?: number;
  /**
   * Expected number of rows should be lower than or equal to {maxValue}. if maxValue is not
   * included, minValue is treated as lowerBound and there will eb no maximum number of rows
   */
  maxValue?: number;
  /**
   * Expected number of rows should be greater than or equal to {minValue}. If minValue is not
   * included, maxValue is treated as upperBound and there will be no minimum number of rows
   */
  minValue?: number;
  /**
   * Expected number of columns to equal to a {value}
   */
  columnCount?: number;
}

export enum TableTestType {
  TableColumnCountToEqual = 'tableColumnCountToEqual',
  TableRowCountToBeBetween = 'tableRowCountToBeBetween',
  TableRowCountToEqual = 'tableRowCountToEqual',
}

/**
 * This schema defines the type used for describing different types of tables.
 */
export enum TableType {
  External = 'External',
  Iceberg = 'Iceberg',
  MaterializedView = 'MaterializedView',
  Regular = 'Regular',
  SecureView = 'SecureView',
  View = 'View',
}

/**
 * Latest usage information for this table.
 *
 * This schema defines the type for usage details. Daily, weekly, and monthly aggregation of
 * usage is computed along with the percentile rank based on the usage for a given day.
 */
export interface TypeUsedToReturnUsageDetailsOfAnEntity {
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
