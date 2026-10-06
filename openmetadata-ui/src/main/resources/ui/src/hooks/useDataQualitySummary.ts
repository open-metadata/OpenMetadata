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

import { useQueries } from '@tanstack/react-query';
import { SORT_ORDER } from '../enums/common.enum';
import { TestCase, TestCaseStatus } from '../generated/tests/testCase';
import { getListTestCaseBySearch } from '../rest/testAPI';
import {
  DataQualityFilters,
  toSearchParams,
} from '../utils/dataQualityFilters';

export const DATA_QUALITY_QUERY_KEY = ['landingPage', 'widgets', 'dataQuality'];
const TTL_MS = 5 * 60 * 1000;
// Only the failing bucket needs rows; the rest are counted, not listed.
const FAILED_PAGE_SIZE = 10;
const COUNT_ONLY_PAGE_SIZE = 1;

export interface DataQualitySummary {
  passed: number;
  failed: number;
  aborted: number;
  total: number;
  /** The failing tests themselves, for the card's rows. */
  failedTests: TestCase[];
  isLoading: boolean;
  isError: boolean;
}

const fetchByStatus = async (
  status: TestCaseStatus,
  limit: number,
  filters: DataQualityFilters,
  userName?: string
) => {
  const response = await getListTestCaseBySearch({
    fields: 'testCaseResult',
    includeAllTests: true,
    limit,
    q: '*',
    sortField: 'testCaseResult.timestamp',
    sortType: SORT_ORDER.DESC,
    testCaseStatus: status,
    ...toSearchParams(filters, userName),
  });

  return {
    tests: response.data ?? [],
    total: response.paging?.total ?? 0,
  };
};

/**
 * Test-result counts by status, plus the failing tests to list.
 *
 * Three parallel searches rather than one page counted client-side: `paging.total`
 * is the whole bucket, so the numbers stay true even though only the failing
 * page is materialised.
 */
export const useDataQualitySummary = (
  filters: DataQualityFilters,
  userName?: string
): DataQualitySummary => {
  // The filters are part of every key, so changing one refetches rather than
  // serving the previous filter's counts from cache.
  const keyFor = (status: TestCaseStatus) => [
    ...DATA_QUALITY_QUERY_KEY,
    status,
    filters,
    userName,
  ];

  const [failedQuery, passedQuery, abortedQuery] = useQueries({
    queries: [
      {
        queryFn: () =>
          fetchByStatus(
            TestCaseStatus.Failed,
            FAILED_PAGE_SIZE,
            filters,
            userName
          ),
        queryKey: keyFor(TestCaseStatus.Failed),
        staleTime: TTL_MS,
      },
      {
        queryFn: () =>
          fetchByStatus(
            TestCaseStatus.Success,
            COUNT_ONLY_PAGE_SIZE,
            filters,
            userName
          ),
        queryKey: keyFor(TestCaseStatus.Success),
        staleTime: TTL_MS,
      },
      {
        queryFn: () =>
          fetchByStatus(
            TestCaseStatus.Aborted,
            COUNT_ONLY_PAGE_SIZE,
            filters,
            userName
          ),
        queryKey: keyFor(TestCaseStatus.Aborted),
        staleTime: TTL_MS,
      },
    ],
  });

  const failed = failedQuery.data?.total ?? 0;
  const passed = passedQuery.data?.total ?? 0;
  const aborted = abortedQuery.data?.total ?? 0;

  return {
    aborted,
    failed,
    failedTests: failedQuery.data?.tests ?? [],
    isError: failedQuery.isError || passedQuery.isError || abortedQuery.isError,
    isLoading:
      failedQuery.isPending || passedQuery.isPending || abortedQuery.isPending,
    passed,
    total: passed + failed + aborted,
  };
};
