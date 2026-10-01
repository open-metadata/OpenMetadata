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
 * Tabs of the test case detail page. Lives here rather than beside the page so
 * the routing utilities that build these URLs — a lower layer — do not have to
 * import a route-level module to name a tab.
 */
export enum TestCasePageTabs {
  TEST_CASE_RESULTS = 'test-case-results',
  DIMENSIONALITY = 'dimensionality',
  SQL_QUERY = 'sql-query',
  ISSUES = 'issues',
}
