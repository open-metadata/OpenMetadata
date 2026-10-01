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
import { SystemChartType } from '../enums/DataInsight.enum';
import { getMultiChartsPreviewByName } from '../rest/DataInsightAPI';
import React from 'react';
import { queryClient } from '../queryClient';
import { useDataEstate } from './useDataEstate';

jest.mock('../rest/DataInsightAPI', () => ({
  getMultiChartsPreviewByName: jest.fn(),
}));

const mockGetCharts = getMultiChartsPreviewByName as jest.MockedFunction<
  typeof getMultiChartsPreviewByName
>;

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
    expect(result.current.connectors).toEqual([
      { count: 250, name: 'Redshift' },
      { count: 100, name: 'Snowflake' },
    ]);
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

  it('surfaces a failed fetch instead of reporting an empty estate', async () => {
    mockGetCharts.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useDataEstate(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.totalAssets).toBe(0);
    expect(result.current.connectors).toEqual([]);
  });
});
