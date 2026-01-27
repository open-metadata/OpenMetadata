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
 * Test case result for a specific combination of dimension values
 */
export interface DimensionResult {
    /**
     * Array of dimension name-value pairs for this result (e.g., [{'name': 'region', 'value':
     * 'mumbai'}, {'name': 'product', 'value': 'laptop'}])
     */
    dimensionValues: DimensionValue[];
    /**
     * Number of rows that failed for this dimension
     */
    failedRows?: number;
    /**
     * Percentage of rows that failed for this dimension
     */
    failedRowsPercentage?: number;
    /**
     * Impact score indicating the significance of this dimension for revealing data quality
     * variations. Higher scores indicate dimensions with more variance in test results.
     */
    impactScore?: number;
    /**
     * Number of rows that passed for this dimension
     */
    passedRows?: number;
    /**
     * Percentage of rows that passed for this dimension
     */
    passedRowsPercentage?: number;
    /**
     * Details of test case results for this dimension combination
     */
    result?: string;
    /**
     * Status of the test for this dimension combination
     */
    testCaseStatus:   TestCaseStatus;
    testResultValue?: TestResultValue[];
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
 * Status of the test for this dimension combination
 *
 * Status of Test Case run.
 */
export enum TestCaseStatus {
    Aborted = "Aborted",
    Failed = "Failed",
    Queued = "Queued",
    Success = "Success",
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
