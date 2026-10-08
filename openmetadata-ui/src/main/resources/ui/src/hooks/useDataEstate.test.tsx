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
import { SystemChartType } from '../enums/DataInsight.enum';
import { queryClient } from '../queryClient';
import { getMultiChartsPreviewByName } from '../rest/DataInsightAPI';
import { postAggregateFieldOptions } from '../rest/miscAPI';
import {
  MAX_NAMED_CONNECTORS,
  OTHER_CONNECTORS_KEY,
  useDataEstate,
} from './useDataEstate';

jest.mock('../rest/DataInsightAPI', () => ({
  getMultiChartsPreviewByName: jest.fn(),
}));

jest.mock('../rest/miscAPI', () => ({
  postAggregateFieldOptions: jest.fn(),
}));

const mockGetCharts = getMultiChartsPreviewByName as jest.MockedFunction<
  typeof getMultiChartsPreviewByName
>;
const mockSearchData = postAggregateFieldOptions as jest.MockedFunction<
  typeof postAggregateFieldOptions
>;

const serviceTypeBuckets = (...buckets: Array<[string, number]>) =>
  ({
    data: {
      aggregations: {
        'sterms#serviceType': {
          buckets: buckets.map(([key, doc_count]) => ({ doc_count, key })),
        },
      },
    },
  } as never);

const DAY_ONE = 1_700_000_000_000;
const DAY_TWO = DAY_ONE + 86_400_000;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const chartsResponse = (
  totals: Array<{ count: number; day: number; group: string }>,
  coverage: Array<{ count: number; day: number; group: string }>
) =>
  ({
    [SystemChartType.TotalDataAssets]: {
      results: totals.map((row) => ({ ...row, term: row.group })),
    },
    [SystemChartType.PercentageOfDataAssetWithDescription]: {
      results: coverage.map((row) => ({ ...row, term: row.group })),
    },
  } as never);

describe('useDataEstate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
    mockSearchData.mockResolvedValue(serviceTypeBuckets());
  });

  it('totals the newest day and ranks connectors by size', async () => {
    mockGetCharts.mockResolvedValue(
      chartsResponse(
        [
          { count: 10, day: DAY_ONE, group: 'Snowflake' },
          { count: 100, day: DAY_TWO, group: 'Snowflake' },
          { count: 250, day: DAY_TWO, group: 'Redshift' },
        ],
        []
      )
    );

    const { result } = renderHook(() => useDataEstate(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.totalAssets).toBe(350);
  });

  // The card says "by connector", and the chart's groups are entity types
  // (table, chart, databaseSchema) — reading the breakdown off it is what put
  // those under that heading. The service dimension only exists on the search
  // aggregation, so that is where the split has to come from.
  it("splits by service, not by the chart's entity-type groups", async () => {
    mockGetCharts.mockResolvedValue(
      chartsResponse([{ count: 350, day: DAY_TWO, group: 'table' }], [])
    );
    mockSearchData.mockResolvedValue(
      serviceTypeBuckets(['Snowflake', 100], ['BigQuery', 250])
    );

    const { result } = renderHook(() => useDataEstate(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Largest first, and labelled the way the classic widget labelled them.
    expect(result.current.connectors).toEqual([
      { count: 250, key: 'BigQuery', name: 'Big Query' },
      { count: 100, key: 'Snowflake', name: 'Snowflake' },
    ]);
  });

  // The range filter moves the totals delta and the coverage trend; "how much
  // of the estate is Snowflake" is a live count with no window to narrow.
  it('does not refetch the split when the window changes', async () => {
    mockGetCharts.mockResolvedValue(
      chartsResponse([{ count: 350, day: DAY_TWO, group: 'table' }], [])
    );

    const { result, rerender } = renderHook(
      ({ windowDays }) => useDataEstate({ windowDays }),
      { initialProps: { windowDays: 7 }, wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    rerender({ windowDays: 90 });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetCharts).toHaveBeenCalledTimes(2);
    expect(mockSearchData).toHaveBeenCalledTimes(1);
  });

  it('reports the change across the window, not the whole estate', async () => {
    mockGetCharts.mockResolvedValue(
      chartsResponse(
        [
          { count: 300, day: DAY_ONE, group: 'Snowflake' },
          { count: 318, day: DAY_TWO, group: 'Snowflake' },
        ],
        []
      )
    );

    const { result } = renderHook(() => useDataEstate(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.totalDelta).toBe(18);
  });

  it('reports no delta when the window holds a single day', async () => {
    mockGetCharts.mockResolvedValue(
      chartsResponse([{ count: 300, day: DAY_ONE, group: 'Snowflake' }], [])
    );

    const { result } = renderHook(() => useDataEstate(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Without a baseline the honest answer is "unknown", not "+300".
    expect(result.current.totalDelta).toBeNull();
  });

  it('takes description coverage as a per-day value and its point change', async () => {
    mockGetCharts.mockResolvedValue(
      chartsResponse(
        [],
        [
          { count: 22.6, day: DAY_ONE, group: '' },
          { count: 23, day: DAY_TWO, group: '' },
        ]
      )
    );

    const { result } = renderHook(() => useDataEstate(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.descriptionCoverage).toBeCloseTo(23);
    expect(result.current.descriptionCoverageDelta).toBeCloseTo(0.4);
    expect(result.current.descriptionCoverageSeries).toHaveLength(2);
  });

  it('weights the per-entity-type percentages instead of summing them', async () => {
    // The real chart reports one percentage per entity type. Summing them put
    // "240%" on the card; an unweighted mean would read 33% here, letting the
    // two assets nobody described outvote the eight hundred that are.
    mockGetCharts.mockResolvedValue(
      chartsResponse(
        [
          { count: 800, day: DAY_TWO, group: 'table' },
          { count: 100, day: DAY_TWO, group: 'database' },
          { count: 100, day: DAY_TWO, group: 'databaseSchema' },
        ],
        [
          { count: 100, day: DAY_TWO, group: 'table' },
          { count: 0, day: DAY_TWO, group: 'database' },
          { count: 0, day: DAY_TWO, group: 'databaseSchema' },
        ]
      )
    );

    const { result } = renderHook(() => useDataEstate(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.descriptionCoverage).toBeCloseTo(80);
  });

  it('falls back to the plain mean when the totals chart carries no weight', async () => {
    // A group the totals chart does not report, so there is nothing to weight
    // by. Better an unweighted average than dropping the day entirely.
    mockGetCharts.mockResolvedValue(
      chartsResponse(
        [],
        [
          { count: 40, day: DAY_TWO, group: 'table' },
          { count: 60, day: DAY_TWO, group: 'database' },
        ]
      )
    );

    const { result } = renderHook(() => useDataEstate(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.descriptionCoverage).toBeCloseTo(50);
  });

  it('never reports a coverage above 100 percent', async () => {
    mockGetCharts.mockResolvedValue(
      chartsResponse(
        [
          { count: 1, day: DAY_TWO, group: 'table' },
          { count: 1, day: DAY_TWO, group: 'database' },
          { count: 1, day: DAY_TWO, group: 'databaseSchema' },
        ],
        [
          { count: 100, day: DAY_TWO, group: 'table' },
          { count: 100, day: DAY_TWO, group: 'database' },
          { count: 100, day: DAY_TWO, group: 'databaseSchema' },
        ]
      )
    );

    const { result } = renderHook(() => useDataEstate(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.descriptionCoverage).toBeCloseTo(100);
  });

  it('keeps the derived arrays referentially stable across re-renders', async () => {
    mockGetCharts.mockResolvedValue(
      chartsResponse(
        [
          { count: 100, day: DAY_TWO, group: 'Snowflake' },
          { count: 250, day: DAY_TWO, group: 'Redshift' },
        ],
        [{ count: 23, day: DAY_TWO, group: '' }]
      )
    );

    const { result, rerender } = renderHook(() => useDataEstate(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const settled = result.current;
    rerender();

    // The bar chart replaces its series whenever the option identity changes,
    // which replays the entry animation. A re-render with unchanged query data
    // must not hand it new arrays.
    expect(result.current.connectors).toBe(settled.connectors);
    expect(result.current.descriptionCoverageSeries).toBe(
      settled.descriptionCoverageSeries
    );
  });

  it('surfaces a failed fetch instead of reporting an empty estate', async () => {
    mockGetCharts.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useDataEstate(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.totalAssets).toBe(0);
    expect(result.current.connectors).toEqual([]);
  });

  // The search query's built-in aggregation stops at the engine's default of
  // ten buckets; an eleventh connector vanished from the bar and from "across
  // N connectors".
  it('asks for every connector rather than the default ten buckets', async () => {
    mockGetCharts.mockResolvedValue(chartsResponse([], []));

    const { result } = renderHook(() => useDataEstate(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockSearchData).toHaveBeenCalledWith(
      expect.objectContaining({ fieldName: 'serviceType', size: 1000 })
    );
  });

  it('folds the tail into one Other segment without losing its assets', async () => {
    mockGetCharts.mockResolvedValue(chartsResponse([], []));
    const buckets = Array.from(
      { length: 12 },
      (_, index) => [`Service${index}`, 100 - index] as [string, number]
    );
    mockSearchData.mockResolvedValue(serviceTypeBuckets(...buckets));

    const { result } = renderHook(() => useDataEstate(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const { connectors } = result.current;
    const total = buckets.reduce((sum, [, count]) => sum + count, 0);

    expect(result.current.connectorCount).toBe(12);
    expect(connectors).toHaveLength(MAX_NAMED_CONNECTORS);
    expect(connectors[connectors.length - 1].key).toBe(OTHER_CONNECTORS_KEY);
    expect(connectors.reduce((sum, c) => sum + c.count, 0)).toBe(total);
  });

  // Data Insights has no rows until its pipeline runs; the header used to
  // print 0 next to a populated breakdown.
  it('falls back to the live connector sum when Data Insights has no rows', async () => {
    mockGetCharts.mockResolvedValue(chartsResponse([], []));
    mockSearchData.mockResolvedValue(
      serviceTypeBuckets(['Snowflake', 100], ['BigQuery', 250])
    );

    const { result } = renderHook(() => useDataEstate(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.totalAssets).toBe(350);
    expect(result.current.totalDelta).toBeNull();
  });

  // A window switch is a new key; without placeholder data the card dropped
  // back to its first-load skeleton and unmounted the filter just used.
  it('keeps the previous window on screen while the next one loads', async () => {
    mockGetCharts.mockResolvedValueOnce(
      chartsResponse([{ count: 350, day: DAY_TWO, group: 'table' }], [])
    );

    const { result, rerender } = renderHook(
      ({ windowDays }) => useDataEstate({ windowDays }),
      { initialProps: { windowDays: 7 }, wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockGetCharts.mockReturnValueOnce(new Promise(() => undefined));
    rerender({ windowDays: 30 });

    await waitFor(() => expect(result.current.isFetching).toBe(true));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.totalAssets).toBe(350);
    // The label must still describe the figures shown, not the new range.
    expect(result.current.windowDays).toBe(7);
  });
});
