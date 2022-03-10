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
 * This scheam defines the test TableRowCountToBeBetween. Test the number of rows to between
 * to two values.
 *
 * This scheam defines the test TableColumnCountToEqual. Test the number of columns equal to
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
