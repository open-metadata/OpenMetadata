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
     * Optional filter constraining which test cases the bulk 'all' selection resolves to. When
     * search criteria are set, 'all' means all test cases matching the same search/filter shown
     * in the UI (not every test case in the system), minus any excludeIds.
     */
    filter?: Filter;
}

/**
 * Optional filter constraining which test cases the bulk 'all' selection resolves to. When
 * search criteria are set, 'all' means all test cases matching the same search/filter shown
 * in the UI (not every test case in the system), minus any excludeIds.
 */
export interface Filter {
    /**
     * Restrict to test cases on this column.
     */
    columnName?: string;
    /**
     * Restrict to test cases under this entity link (e.g. a table).
     */
    entityLink?: string;
    /**
     * List of test suite IDs to exclude from the bulk add.
     */
    excludeIds?: string[];
    /**
     * When an entityLink is set, prefix-match it so column tests under the entity are included.
     */
    includeAllTests?: boolean;
    /**
     * Free-text search term applied to the test cases (matches the UI search box).
     */
    q?: string;
    /**
     * Restrict to test cases with this latest execution status.
     */
    testCaseStatus?: TestCaseStatus;
    /**
     * Restrict to column-level ('column'), table-level ('table'), or all ('all') test cases.
     */
    testCaseType?: string;
}

/**
 * Restrict to test cases with this latest execution status.
 *
 * Status of Test Case run.
 */
export enum TestCaseStatus {
    Aborted = "Aborted",
    Failed = "Failed",
    Queued = "Queued",
    Success = "Success",
}
