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

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { SORT_ORDER } from '../enums/common.enum';
import { TestCase, TestCaseStatus } from '../generated/tests/testCase';
import { getListTestCaseBySearch } from '../rest/testAPI';
import {
  DataQualityFilters,
  toSearchParams,
} from '../utils/dataQualityFilters';

export const DATA_QUALITY_QUERY_KEY = ['landingPage', 'widgets', 'dataQuality'];
const TTL_MS = 5 * 60 * 1000;

/**
 * Failing tests the card lists. Only that bucket needs rows; the rest are
 * counted, not listed — and it fetches exactly what is shown, so "N more" is
 * the bucket total minus these rather than minus a larger page nobody sees.
 */
export const DATA_QUALITY_FAILED_ROWS = 4;
const COUNT_ONLY_PAGE_SIZE = 1;

export interface DataQualitySummary {
  passed: number;
  failed: number;
  aborted: number;
  total: number;
  /** The failing tests themselves, for the card's rows. */
  failedTests: TestCase[];
  /**
   * No test case exists at all, whatever the filters. A zero `total` only says
   * nothing *ran* in the selected scope and window; this is what tells "not
   * set up" apart from "quiet this week".
   */
  hasNoTests: boolean;
  /** First load only — a filter change keeps the previous counts on screen. */
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  refetch: () => void;
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

/** Whether any test case exists — counted, never listed. */
const fetchAnyTestCount = async (): Promise<number> => {
  const response = await getListTestCaseBySearch({
    includeAllTests: true,
    limit: COUNT_ONLY_PAGE_SIZE,
    q: '*',
  });

  return response.paging?.total ?? 0;
};

/**
 * Test-result counts by status, plus the failing tests to list.
 *
 * One search per status rather than one page counted client-side: `paging.total`
 * is the whole bucket, so the numbers stay true even though only the failing
 * page is materialised. A fourth, unfiltered count tells an estate with no
 * tests from a quiet window.
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

  // `keepPreviousData` on each: a filter change is a new key, and without it
  // the card fell back to its first-load skeleton — unmounting the very filter
  // dropdown that was just used, and dropping its focus.
  const queryFor = (status: TestCaseStatus, limit: number) => ({
    placeholderData: keepPreviousData,
    queryFn: () => fetchByStatus(status, limit, filters, userName),
    queryKey: keyFor(status),
    staleTime: TTL_MS,
  });

  // Three `useQuery` calls rather than one `useQueries`: the latter matches its
  // observers by key, so on a key change there is no previous observer for
  // `keepPreviousData` to read from and the placeholder never appears.
  const failedQuery = useQuery(
    queryFor(TestCaseStatus.Failed, DATA_QUALITY_FAILED_ROWS)
  );
  const passedQuery = useQuery(
    queryFor(TestCaseStatus.Success, COUNT_ONLY_PAGE_SIZE)
  );
  const abortedQuery = useQuery(
    queryFor(TestCaseStatus.Aborted, COUNT_ONLY_PAGE_SIZE)
  );
  // Unfiltered, so it is one key for every filter: fetched alongside the
  // counts on first load — not after them, which would chain a second round
  // trip — and served from cache on every filter change after that.
  const anyTestQuery = useQuery({
    queryFn: fetchAnyTestCount,
    queryKey: [...DATA_QUALITY_QUERY_KEY, 'anyTest'],
    staleTime: TTL_MS,
  });
  const queries = [failedQuery, passedQuery, abortedQuery, anyTestQuery];

  const failed = failedQuery.data?.total ?? 0;
  const passed = passedQuery.data?.total ?? 0;
  const aborted = abortedQuery.data?.total ?? 0;

  return {
    aborted,
    failed,
    failedTests: failedQuery.data?.tests ?? [],
    hasNoTests: anyTestQuery.data === 0,
    isError: queries.some((query) => query.isError),
    isFetching: queries.some((query) => query.isFetching),
    isLoading: queries.some((query) => query.isPending),
    passed,
    refetch: () =>
      queries.forEach((query) => {
        void query.refetch();
      }),
    total: passed + failed + aborted,
  };
};
