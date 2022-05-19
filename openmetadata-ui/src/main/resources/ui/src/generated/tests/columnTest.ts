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
    description?:        string;
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
    Daily = "Daily",
    Hourly = "Hourly",
    Weekly = "Weekly",
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
    Aborted = "Aborted",
    Failed = "Failed",
    Success = "Success",
}

/**
 * Column Test Case.
 */
export interface ColumnTestCase {
    columnTestType?: ColumnTestType;
    config?:         ColumnValuesToBeBetween;
}

export enum ColumnTestType {
    ColumnValueLengthsToBeBetween = "columnValueLengthsToBeBetween",
    ColumnValuesMissingCountToBeEqual = "columnValuesMissingCountToBeEqual",
    ColumnValuesToBeBetween = "columnValuesToBeBetween",
    ColumnValuesToBeNotInSet = "columnValuesToBeNotInSet",
    ColumnValuesToBeNotNull = "columnValuesToBeNotNull",
    ColumnValuesToBeUnique = "columnValuesToBeUnique",
    ColumnValuesToMatchRegex = "columnValuesToMatchRegex",
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
    columnValuesToBeUnique?:  boolean;
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
    missingValueMatch?: string[] | boolean | number | number | { [key: string]: any } | null | string;
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
