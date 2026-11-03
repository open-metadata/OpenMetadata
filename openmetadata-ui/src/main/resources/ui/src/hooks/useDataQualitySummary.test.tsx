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

import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { TestCaseStatus } from '../generated/tests/testCase';
import { queryClient } from '../queryClient';
import { getDataQualityReport, getListTestCaseBySearch } from '../rest/testAPI';
import {
  DataQualityRange,
  DEFAULT_DATA_QUALITY_FILTERS,
} from '../utils/dataQualityFilters';
import {
  DATA_QUALITY_ROWS,
  useDataQualitySummary,
} from './useDataQualitySummary';

jest.mock('../rest/testAPI', () => ({
  getDataQualityReport: jest.fn(),
  getListTestCaseBySearch: jest.fn(),
}));

const mockSearch = getListTestCaseBySearch as jest.MockedFunction<
  typeof getListTestCaseBySearch
>;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

/** Answers each status query with its own bucket total. */
const respondByStatus = (totals: Record<string, number>, rows = 0) =>
  mockSearch.mockImplementation((params) => {
    const status = String(params?.testCaseStatus);

    return Promise.resolve({
      data: Array.from({ length: rows }, (_, i) => ({
        id: `${status}-${i}`,
        name: `${status}-${i}`,
      })),
      paging: { total: totals[status] ?? 0 },
    } as never);
  });

describe('useDataQualitySummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
  });

  it('totals the three buckets from their paging counts', async () => {
    respondByStatus({
      [TestCaseStatus.Aborted]: 2,
      [TestCaseStatus.Failed]: 5,
      [TestCaseStatus.Success]: 6,
    });

    const { result } = renderHook(
      () => useDataQualitySummary(DEFAULT_DATA_QUALITY_FILTERS),
      {
        wrapper,
      }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.passed).toBe(6);
    expect(result.current.failed).toBe(5);
    expect(result.current.aborted).toBe(2);
    expect(result.current.total).toBe(13);
  });

  it('counts the whole failing bucket even though it lists only a page', async () => {
    respondByStatus(
      {
        [TestCaseStatus.Aborted]: 0,
        [TestCaseStatus.Failed]: 42,
        [TestCaseStatus.Success]: 0,
      },
      3
    );

    const { result } = renderHook(
      () => useDataQualitySummary(DEFAULT_DATA_QUALITY_FILTERS),
      {
        wrapper,
      }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // The bar must show the real bucket size, not the page that was rendered.
    expect(result.current.failed).toBe(42);
    expect(result.current.tests).toHaveLength(3);
  });

  it('lists the latest results of any status, and only counts the buckets', async () => {
    respondByStatus({
      [TestCaseStatus.Aborted]: 0,
      [TestCaseStatus.Failed]: 1,
      [TestCaseStatus.Success]: 0,
    });

    const { result } = renderHook(
      () => useDataQualitySummary(DEFAULT_DATA_QUALITY_FILTERS),
      {
        wrapper,
      }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const limits = mockSearch.mock.calls.map(([params]) => [
      String(params?.testCaseStatus),
      params?.limit,
    ]);

    // One unfiltered page of rows; the status queries only count.
    expect(limits).toContainEqual(['undefined', DATA_QUALITY_ROWS]);
    expect(limits).toContainEqual([TestCaseStatus.Failed, 1]);
    expect(limits).toContainEqual([TestCaseStatus.Success, 1]);
    expect(limits).toContainEqual([TestCaseStatus.Aborted, 1]);
  });

  it('puts failures first, then aborted, then passing', async () => {
    const result_ = (id: string, status: TestCaseStatus) => ({
      id,
      name: id,
      testCaseResult: { testCaseStatus: status },
    });
    mockSearch.mockImplementation((params) =>
      Promise.resolve({
        data:
          params?.testCaseStatus === undefined
            ? [
                result_('pass', TestCaseStatus.Success),
                result_('abort', TestCaseStatus.Aborted),
                result_('fail', TestCaseStatus.Failed),
              ]
            : [],
        paging: { total: 1 },
      } as never)
    );

    const { result } = renderHook(
      () => useDataQualitySummary(DEFAULT_DATA_QUALITY_FILTERS),
      { wrapper }
    );

    await waitFor(() => expect(result.current.tests).toHaveLength(3));

    expect(result.current.tests.map(({ id }) => id)).toEqual([
      'fail',
      'abort',
      'pass',
    ]);
  });

  it('counts every result on the tables the rows show, and asks for the incident', async () => {
    mockSearch.mockImplementation((params) =>
      Promise.resolve({
        data:
          params?.testCaseStatus === undefined
            ? [
                {
                  id: 't',
                  name: 't',
                  entityLink: '<#E::table::svc.db.s.orders::columns::id>',
                },
              ]
            : [],
        paging: { total: 1 },
      } as never)
    );
    (getDataQualityReport as jest.Mock).mockResolvedValue({
      data: [
        {
          originEntityFQN: 'svc.db.s.orders',
          'testCaseResult.testCaseStatus': 'failed',
          document_count: '3',
        },
      ],
    });

    const { result } = renderHook(
      () => useDataQualitySummary(DEFAULT_DATA_QUALITY_FILTERS),
      { wrapper }
    );

    await waitFor(() =>
      expect(result.current.tableCounts['svc.db.s.orders']).toEqual({
        passed: 0,
        failed: 3,
        aborted: 0,
      })
    );

    const query = JSON.parse(
      (getDataQualityReport as jest.Mock).mock.calls[0][0].q
    );

    // Column tests count toward their table, so the rows' tables are asked for.
    expect(query.query.bool.must).toContainEqual({
      terms: { originEntityFQN: ['svc.db.s.orders'] },
    });
    expect(
      mockSearch.mock.calls.find(
        ([params]) => params?.limit === DATA_QUALITY_ROWS
      )?.[0]?.fields
    ).toBe('testCaseResult,incidentStatus');
  });

  it('surfaces a failed lookup instead of reporting a clean estate', async () => {
    mockSearch.mockRejectedValue(new Error('network'));

    const { result } = renderHook(
      () => useDataQualitySummary(DEFAULT_DATA_QUALITY_FILTERS),
      {
        wrapper,
      }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.total).toBe(0);
    expect(result.current.tests).toEqual([]);
  });

  // A filter change is a new key; without placeholder data the card dropped
  // back to its first-load skeleton and unmounted the dropdown just used.
  it('keeps the previous counts on screen while a filter change loads', async () => {
    respondByStatus({
      [TestCaseStatus.Aborted]: 0,
      [TestCaseStatus.Failed]: 3,
      [TestCaseStatus.Success]: 7,
    });

    const { result, rerender } = renderHook(
      ({ filters }) => useDataQualitySummary(filters),
      { initialProps: { filters: DEFAULT_DATA_QUALITY_FILTERS }, wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockSearch.mockReturnValue(new Promise(() => undefined));
    rerender({
      filters: {
        ...DEFAULT_DATA_QUALITY_FILTERS,
        range: DataQualityRange.LAST_90_DAYS,
      },
    });

    await waitFor(() => expect(result.current.isFetching).toBe(true));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.total).toBe(10);
  });

  // A zero total only says nothing ran in this window; the unfiltered count
  // is what tells an estate with no tests at all from a quiet week.
  it('tells "no tests at all" apart from "nothing ran in this window"', async () => {
    respondByStatus({ undefined: 4 });

    const { result } = renderHook(
      () => useDataQualitySummary(DEFAULT_DATA_QUALITY_FILTERS),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.total).toBe(0);
    expect(result.current.hasNoTests).toBe(false);

    queryClient.clear();
    respondByStatus({});
    const { result: empty } = renderHook(
      () => useDataQualitySummary(DEFAULT_DATA_QUALITY_FILTERS),
      { wrapper }
    );

    await waitFor(() => expect(empty.current.isLoading).toBe(false));

    expect(empty.current.hasNoTests).toBe(true);
    expect(mockSearch).toHaveBeenCalledWith(
      expect.not.objectContaining({ startTimestamp: expect.anything() })
    );
  });
});
