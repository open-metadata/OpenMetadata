/*
 *  Copyright 2023 Collate.
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

export const ADD_TEST_CASE_LIST_FILTER_KEYS = [
  'status',
  'testType',
  'table',
  'column',
] as const;

export type AddTestCaseListFilterKey = (typeof ADD_TEST_CASE_LIST_FILTER_KEYS)[number];

export interface AddTestCaseListFilterConfig {
  searchKey: AddTestCaseListFilterKey;
  labelKey: string;
  singleSelect: boolean;
  showSelectedCounts?: boolean;
}

export const ADD_TEST_CASE_LIST_FILTERS: AddTestCaseListFilterConfig[] = [
  {
    searchKey: 'status',
    labelKey: 'label.status',
    singleSelect: true,
  },
  {
    searchKey: 'testType',
    labelKey: 'label.test-type',
    singleSelect: true,
  },
  {
    searchKey: 'table',
    labelKey: 'label.table',
    singleSelect: false,
    showSelectedCounts: true,
  },
  {
    searchKey: 'column',
    labelKey: 'label.column',
    singleSelect: false,
    showSelectedCounts: true,
  },
];
