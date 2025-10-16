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
 * This schema defines the schema for Test Case Result Updates for Feed.
 */
export interface TestCaseResult {
    /**
     * Summary of test case execution
     */
    entityTestResultSummary?: Array<any[] | boolean | number | number | null | EntityTestResultSummaryObject | string>;
    /**
     * Summary of test case execution
     */
    parameterValues?: TestCaseParameterValue[];
    /**
     * Test Case Result for last 7 days.
     */
    testCaseResult?: TestCaseResultElement[];
}

export interface EntityTestResultSummaryObject {
    /**
     * Status of the test case.
     */
    status?: TestCaseStatus;
    /**
     * Name of the test case.
     */
    testCaseName?: string;
    /**
     * Timestamp of the test case execution.
     */
    timestamp?: number;
    [property: string]: any;
}

/**
 * Status of the test case.
 *
 * Status of Test Case run.
 *
 * Status of the test for this dimension combination
 */
export enum TestCaseStatus {
    Aborted = "Aborted",
    Failed = "Failed",
    Queued = "Queued",
    Success = "Success",
}

/**
 * This schema defines the parameter values that can be passed for a Test Case.
 */
export interface TestCaseParameterValue {
    /**
     * name of the parameter. Must match the parameter names in testCaseParameterDefinition
     */
    name?: string;
    /**
     * value to be passed for the Parameters. These are input from Users. We capture this in
     * string and convert during the runtime.
     */
    value?: string;
    [property: string]: any;
}

/**
 * Schema to capture test case result.
 */
export interface TestCaseResultElement {
    /**
     * List of dimensional test results. Only populated when the test case has dimensionColumns
     * specified.
     */
    dimensionResults?: TestCaseDimensionResult[];
    /**
     * Number of rows that failed.
     */
    failedRows?: number;
    /**
     * Percentage of rows that failed.
     */
    failedRowsPercentage?: number;
    /**
     * Unique identifier of this failure instance
     */
    id?: string;
    /**
     * Incident State ID associated with this result. This association happens when the result
     * is created, and will stay there even when the incident is resolved.
     */
    incidentId?: string;
    /**
     * Upper bound limit for the test case result as defined in the test definition.
     */
    maxBound?: number;
    /**
     * Lower bound limit for the test case result as defined in the test definition.
     */
    minBound?: number;
    /**
     * Number of rows that passed.
     */
    passedRows?: number;
    /**
     * Percentage of rows that passed.
     */
    passedRowsPercentage?: number;
    /**
     * Details of test case results.
     */
    result?: string;
    /**
     * sample data to capture rows/columns that didn't match the expressed testcase.
     */
    sampleData?: string;
    /**
     * Test case that this result is for.
     */
    testCase?: EntityReference;
    /**
     * Fully qualified name of the test case.
     */
    testCaseFQN?: string;
    /**
     * Status of Test Case run.
     */
    testCaseStatus?: TestCaseStatus;
    /**
     * Test definition that this result is for.
     */
    testDefinition?:  EntityReference;
    testResultValue?: TestResultValue[];
    /**
     * Data one which test case result is taken.
     */
    timestamp: number;
    [property: string]: any;
}

/**
 * Test case result for dimensional analysis - supports both single and multi-dimensional
 * groupings
 */
export interface TestCaseDimensionResult {
    /**
     * Composite key for API filtering: 'region=mumbai' or 'region=mumbai,product=laptop'
     */
    dimensionKey: string;
    /**
     * Array of dimension name-value pairs for this result (e.g., [{'name': 'region', 'value':
     * 'mumbai'}, {'name': 'product', 'value': 'laptop'}])
     */
    dimensionValues: DimensionValue[];
    /**
     * Number of rows that failed for this dimension combination
     */
    failedRows?: number;
    /**
     * Percentage of rows that failed for this dimension combination
     */
    failedRowsPercentage?: number;
    /**
     * Unique identifier of this dimensional result instance
     */
    id: string;
    /**
     * Impact score indicating the significance of this dimension for revealing data quality
     * variations. Higher scores indicate dimensions with more significant quality issues
     * considering both failure rate and data volume.
     */
    impactScore?: number;
    /**
     * Number of rows that passed for this dimension combination
     */
    passedRows?: number;
    /**
     * Percentage of rows that passed for this dimension combination
     */
    passedRowsPercentage?: number;
    /**
     * Details of test case results for this dimension combination
     */
    result?: string;
    /**
     * Reference to the test case for efficient querying of dimensional time series
     */
    testCase?: EntityReference;
    /**
     * Reference to the parent TestCaseResult execution that generated this dimensional result
     */
    testCaseResultId: string;
    /**
     * Status of the test for this dimension combination
     */
    testCaseStatus: TestCaseStatus;
    /**
     * Test result values for this dimension combination
     */
    testResultValue?: TestResultValue[];
    /**
     * Timestamp when the dimensional test result was captured (same as parent TestCaseResult)
     */
    timestamp: number;
}

/**
 * A single dimension name-value pair for dimensional test results
 */
export interface DimensionValue {
    /**
     * Name of the dimension (e.g., 'column', 'region', 'tier')
     */
    name: string;
    /**
     * Value for this dimension (e.g., 'address', 'US', 'gold')
     */
    value: string;
}

/**
 * Reference to the test case for efficient querying of dimensional time series
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Test case that this result is for.
 *
 * Test definition that this result is for.
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
 * Schema to capture test case result values.
 */
export interface TestResultValue {
    /**
     * name of the value
     */
    name?: string;
    /**
     * predicted value
     */
    predictedValue?: string;
    /**
     * test result value
     */
    value?: string;
    [property: string]: any;
}
