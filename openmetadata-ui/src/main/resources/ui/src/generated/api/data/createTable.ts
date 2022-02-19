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
   * Database corresponding to this table
   */
  database: EntityReference;
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
  tableConstraints?: TableConstraint[];
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
   * Column level constraint.
   */
  constraint?: Constraint;
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
 * 'Suggested' state is used when a tag label is suggested by users or tools. Owner of the
 * entity must confirm the suggested labels before it is marked as 'Confirmed'.
 */
export enum State {
  Confirmed = 'Confirmed',
  Suggested = 'Suggested',
}

/**
 * Database corresponding to this table
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Owner of this entity
 */
export interface EntityReference {
  /**
   * Optional description of entity.
   */
  description?: string;
  /**
   * Display Name that identifies this entity.
   */
  displayName?: string;
  /**
   * Link to the entity resource.
   */
  href?: string;
  /**
   * Unique identifier that identifies an entity instance.
   */
  id: string;
  /**
   * Name of the entity instance. For entities such as tables, databases where the name is not
   * unique, fullyQualifiedName is returned in this field.
   */
  name?: string;
  /**
   * Entity type/class name - Examples: `database`, `table`, `metrics`, `databaseService`,
   * `dashboardService`...
   */
  type: string;
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
 * This schema defines the type used for describing different types of tables.
 */
export enum TableType {
  External = 'External',
  MaterializedView = 'MaterializedView',
  Regular = 'Regular',
  SecureView = 'SecureView',
  View = 'View',
}
