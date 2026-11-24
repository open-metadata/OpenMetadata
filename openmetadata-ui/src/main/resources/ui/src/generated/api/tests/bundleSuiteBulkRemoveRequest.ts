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
 * Request object for bulk-removing test cases from a logical (bundle) test suite.
 */
export interface BundleSuiteBulkRemoveRequest {
    /**
     * Ids of the test cases to remove from the test suite.
     */
    testCaseIds: string[];
    /**
     * TestSuite ID from which we will be removing the test cases.
     */
    testSuiteId: string;
}
