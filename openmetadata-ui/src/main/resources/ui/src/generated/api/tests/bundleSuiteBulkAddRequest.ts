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
export interface BundleSuiteBulkAddRequestClass {
    /**
     * Mode of bulk addition. 'ids' to specify exact test suite IDs, 'all' to select all suites
     * with optional exclusions.
     */
    mode: Mode;
    /**
     * Configuration for selecting test case to add to the bundle. Choose either 'ids' mode to
     * specify exact suites, or 'all' mode to select all suites with optional exclusions.
     */
    selection: BundleSuiteBulkAddRequestBulk;
    /**
     * TestSuite ID where we will be adding the test cases.
     */
    testSuiteId: string;
}

/**
 * Mode of bulk addition. 'ids' to specify exact test suite IDs, 'all' to select all suites
 * with optional exclusions.
 */
export enum Mode {
    All = "all",
    IDS = "ids",
}

/**
 * Configuration for selecting test case to add to the bundle. Choose either 'ids' mode to
 * specify exact suites, or 'all' mode to select all suites with optional exclusions.
 *
 * Add a specific set of test suites by their IDs.
 *
 * Add all test suites, with an optional list of IDs to exclude.
 */
export interface BundleSuiteBulkAddRequestBulk {
    /**
     * List of test suite IDs to add.
     */
    ids?: string[];
    /**
     * Optional filter to exclude specific test suites from the bulk selection.
     */
    filter?: Filter;
}

/**
 * Optional filter to exclude specific test suites from the bulk selection.
 */
export interface Filter {
    /**
     * List of test suite IDs to exclude from the bulk add.
     */
    excludeIds?: string[];
}
