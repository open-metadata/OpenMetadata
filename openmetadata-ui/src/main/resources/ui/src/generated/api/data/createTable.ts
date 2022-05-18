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
 * Schema corresponding to a table that belongs to a database
 */
export interface CreateTable {
  /**
   * Name of the tables in the database
   */
  columns: Column[];
  /**
   * Schema corresponding to this table
   */
  databaseSchema: EntityReference;
  /**
   * Description of entity instance.
   */
  description?: string;
  /**
   * Name that identifies the this entity instance uniquely. Same as id if when name is not
   * unique
   */
  name: string;
  /**
   * Owner of this entity
   */
  owner?: EntityReference;
  /**
   * Percentage of data we want to execute the profiler and tests on. Represented in the range
   * (0, 100].
   */
  profileSample?: number;
  tableConstraints?: TableConstraint[];
  tablePartition?: TablePartition;
  tableType?: TableType;
  /**
   * Tags for this table
   */
  tags?: TagLabel[];
  /**
   * View Definition in SQL. Applies to TableType.View only
   */
  viewDefinition?: string;
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
 * Schema corresponding to this table
 *
 * Owner of this entity
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
