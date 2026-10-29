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
import { useDataEstate } from './useDataEstate';
import {
  deriveTotalDataAssets,
  useTotalDataAssets,
} from './useTotalDataAssets';

jest.mock('../rest/DataInsightAPI', () => ({
  getMultiChartsPreviewByName: jest.fn(),
}));

jest.mock('../rest/miscAPI', () => ({
  postAggregateFieldOptions: jest
    .fn()
    .mockResolvedValue({ data: { aggregations: {} } }),
}));

const mockGetCharts = getMultiChartsPreviewByName as jest.MockedFunction<
  typeof getMultiChartsPreviewByName
>;
const mockAggregate = postAggregateFieldOptions as jest.MockedFunction<
  typeof postAggregateFieldOptions
>;

const DAY_ONE = 1_700_000_000_000;
const DAY_TWO = DAY_ONE + 86_400_000;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const row = (group: string, day: number, count: number) => ({
  count,
  day,
  group,
  term: group,
});

describe('deriveTotalDataAssets', () => {
  it('splits the newest day by type with each type’s change across the window', () => {
    const result = deriveTotalDataAssets([
      row('table', DAY_ONE, 70),
      row('dashboard', DAY_ONE, 10),
      row('table', DAY_TWO, 75),
      row('dashboard', DAY_TWO, 25),
    ]);

    expect(result.totalAssets).toBe(100);
    expect(result.totalDelta).toBe(20);
    expect(result.assetTypes).toEqual([
      { count: 75, delta: 5, key: 'table', share: 75 },
      { count: 25, delta: 15, key: 'dashboard', share: 25 },
    ]);
    expect(result.fastestGrowing?.key).toBe('dashboard');
  });

  it('counts a type that appeared mid-window from zero', () => {
    const result = deriveTotalDataAssets([
      row('table', DAY_ONE, 10),
      row('table', DAY_TWO, 10),
      row('mlmodel', DAY_TWO, 4),
    ]);

    expect(result.assetTypes.find((type) => type.key === 'mlmodel')).toEqual(
      expect.objectContaining({ delta: 4 })
    );
  });

  it('reports no movement when the window holds a single day', () => {
    const result = deriveTotalDataAssets([row('table', DAY_TWO, 10)]);

    expect(result.totalDelta).toBeNull();
    expect(result.assetTypes[0].delta).toBeNull();
    expect(result.fastestGrowing).toBeUndefined();
  });

  it('leaves out types that hold nothing on the newest day', () => {
    const result = deriveTotalDataAssets([
      row('table', DAY_ONE, 10),
      row('topic', DAY_ONE, 2),
      row('table', DAY_TWO, 12),
      row('topic', DAY_TWO, 0),
    ]);

    expect(result.assetTypes.map((type) => type.key)).toEqual(['table']);
  });

  it('names no fastest type when nothing grew', () => {
    const result = deriveTotalDataAssets([
      row('table', DAY_ONE, 10),
      row('table', DAY_TWO, 8),
    ]);

    expect(result.fastestGrowing).toBeUndefined();
  });
});

describe('useTotalDataAssets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
    mockGetCharts.mockResolvedValue({
      [SystemChartType.TotalDataAssets]: {
        results: [row('table', DAY_ONE, 8), row('table', DAY_TWO, 10)],
      },
      [SystemChartType.PercentageOfDataAssetWithDescription]: { results: [] },
    } as never);
  });

  it('reads the totals chart over the selected window', async () => {
    const { result } = renderHook(
      () => useTotalDataAssets({ windowDays: 14 }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.totalAssets).toBe(10);
    expect(result.current.windowDays).toBe(14);

    const [, { start, end }] = mockGetCharts.mock.calls[0];

    expect(end - start).toBe(14 * 86_400_000);
  });

  // Both cards default to a week, so the landing page should ask once.
  it('shares one request with the data estate card for the same window', async () => {
    const { result } = renderHook(
      () => ({
        estate: useDataEstate({ windowDays: 7 }),
        totals: useTotalDataAssets({ windowDays: 7 }),
      }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.totals.isLoading).toBe(false));

    expect(mockGetCharts).toHaveBeenCalledTimes(1);
  });

  it('does not ask for a live count while Data Insights has rows', async () => {
    const { result } = renderHook(() => useTotalDataAssets(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockAggregate).not.toHaveBeenCalled();
  });

  // Data Insights only has rows once its pipeline has run; until then the
  // card would print zero above an estate full of assets.
  it('falls back to a live count by entity type without Data Insights', async () => {
    mockGetCharts.mockResolvedValue({
      [SystemChartType.TotalDataAssets]: { results: [] },
      [SystemChartType.PercentageOfDataAssetWithDescription]: { results: [] },
    } as never);
    mockAggregate.mockResolvedValue({
      data: {
        aggregations: {
          'sterms#entityType': {
            buckets: [
              { doc_count: 30, key: 'table' },
              { doc_count: 10, key: 'dashboard' },
            ],
          },
        },
      },
    } as never);

    const { result } = renderHook(() => useTotalDataAssets(), { wrapper });

    await waitFor(() => expect(result.current.totalAssets).toBe(40));

    expect(mockAggregate).toHaveBeenCalledWith(
      expect.objectContaining({ fieldName: 'entityType', index: 'dataAsset' })
    );
    expect(result.current.assetTypes.map((type) => type.key)).toEqual([
      'table',
      'dashboard',
    ]);
    // A live count has no history to measure a change against.
    expect(result.current.totalDelta).toBeNull();
    expect(result.current.assetTypes[0].delta).toBeNull();
  });

  // The chart leaves out tags and glossary terms, and Data Insights never
  // indexes the data-quality types; counting them live made the total drop the
  // day the chart started returning rows.
  it('counts live only the types the totals chart counts', async () => {
    mockGetCharts.mockResolvedValue({
      [SystemChartType.TotalDataAssets]: { results: [] },
      [SystemChartType.PercentageOfDataAssetWithDescription]: { results: [] },
    } as never);
    mockAggregate.mockResolvedValue({
      data: {
        aggregations: {
          'sterms#entityType': {
            buckets: [
              { doc_count: 30, key: 'table' },
              { doc_count: 6, key: 'dataProduct' },
              { doc_count: 500, key: 'tag' },
              { doc_count: 80, key: 'glossaryTerm' },
              { doc_count: 40, key: 'testCaseResult' },
              { doc_count: 9, key: 'apiService' },
            ],
          },
        },
      },
    } as never);

    const { result } = renderHook(() => useTotalDataAssets(), { wrapper });

    await waitFor(() => expect(result.current.totalAssets).toBe(36));

    expect(result.current.assetTypes.map((type) => type.key)).toEqual([
      'table',
      'dataProduct',
    ]);
  });

  it('surfaces a failed fetch', async () => {
    mockGetCharts.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useTotalDataAssets(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.totalAssets).toBe(0);
  });
});
