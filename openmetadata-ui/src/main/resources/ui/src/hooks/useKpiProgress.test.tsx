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
import { KpiTargetType } from '../generated/dataInsight/kpi/kpi';
import { queryClient } from '../queryClient';
import { getListKpiResult, getListKPIs } from '../rest/KpiAPI';
import {
  KpiWindow,
  KPI_ALL_TIME,
  KPI_WINDOW_DAYS,
  useKpiProgress,
} from './useKpiProgress';

jest.mock('../rest/KpiAPI', () => ({
  getListKPIs: jest.fn(),
  getListKpiResult: jest.fn(),
}));

const mockGetListKPIs = getListKPIs as jest.MockedFunction<typeof getListKPIs>;
const mockGetListKpiResult = getListKpiResult as jest.MockedFunction<
  typeof getListKpiResult
>;

const DAY_MS = 86_400_000;
const NOW = 1_700_000_000_000;
const DAY_ONE = NOW - 2 * DAY_MS;
const DAY_TWO = NOW - DAY_MS;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const START_DATE = NOW - 400 * DAY_MS;

const kpi = (endDate: number, targetValue = 100, name = 'completeness') =>
  ({
    displayName: 'Completeness',
    endDate,
    fullyQualifiedName: name,
    id: `kpi-${name}`,
    metricType: KpiTargetType.Percentage,
    name,
    startDate: START_DATE,
    targetValue,
  } as never);

const kpiList = (...kpis: unknown[]) => ({ data: kpis } as never);

const kpiResults = (...rows: Array<{ count: number; day: number }>) =>
  ({ results: rows.map((row) => ({ ...row, group: '', term: '' })) } as never);

describe('useKpiProgress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reads the latest value and the change across the window', async () => {
    mockGetListKPIs.mockResolvedValue(kpiList(kpi(NOW + 10 * DAY_MS)));
    mockGetListKpiResult.mockResolvedValue(
      kpiResults({ count: 40, day: DAY_ONE }, { count: 70, day: DAY_TWO })
    );

    const { result } = renderHook(() => useKpiProgress(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.kpis[0].current).toBe(70);
    expect(result.current.kpis[0].delta).toBe(30);
    expect(result.current.kpis[0].series).toEqual([40, 70]);
  });

  it('fetches the results over the window the series is labelled with', async () => {
    mockGetListKPIs.mockResolvedValue(kpiList(kpi(NOW + 10 * DAY_MS)));
    mockGetListKpiResult.mockResolvedValue(kpiResults({ count: 40, day: NOW }));

    const { result } = renderHook(() => useKpiProgress(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // The axis labels have to describe the data that was actually requested.
    expect(mockGetListKpiResult).toHaveBeenCalledWith('completeness', {
      endTs: NOW,
      startTs: NOW - KPI_WINDOW_DAYS * DAY_MS,
    });
    expect(result.current.kpis[0].windowEnd).toBe(NOW);
    expect(result.current.kpis[0].windowStart).toBe(
      NOW - KPI_WINDOW_DAYS * DAY_MS
    );
  });

  // "All time" cannot be a span off the clock: KPIs start on different dates, so
  // each one is read from its own, and the axis has to say so per row.
  it("reads from each KPI's own start date on all time", async () => {
    mockGetListKPIs.mockResolvedValue(kpiList(kpi(NOW + 10 * DAY_MS)));
    mockGetListKpiResult.mockResolvedValue(kpiResults({ count: 40, day: NOW }));

    const { result } = renderHook(() => useKpiProgress(KPI_ALL_TIME), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetListKpiResult).toHaveBeenCalledWith('completeness', {
      endTs: NOW,
      startTs: START_DATE,
    });
    expect(result.current.kpis[0].windowStart).toBe(START_DATE);
  });

  it('calls a closed window missed when the projection fell short', async () => {
    mockGetListKPIs.mockResolvedValue(kpiList(kpi(NOW - DAY_MS)));
    mockGetListKpiResult.mockResolvedValue(
      kpiResults({ count: 10, day: DAY_ONE }, { count: 12, day: DAY_TWO })
    );

    const { result } = renderHook(() => useKpiProgress(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.kpis[0].daysLeft).toBe(0);
    expect(result.current.kpis[0].status).toBe('missed');
    expect(result.current.atRiskCount).toBe(1);
  });

  // The projection is null whenever the series holds a single point, and a
  // closed window used to read that as a miss -- so a finished KPI that had
  // already beaten its target was reported missed and counted as at risk.
  it('calls a closed window on track when a lone result already met the target', async () => {
    mockGetListKPIs.mockResolvedValue(kpiList(kpi(NOW - DAY_MS)));
    mockGetListKpiResult.mockResolvedValue(
      kpiResults({ count: 120, day: DAY_TWO })
    );

    const { result } = renderHook(() => useKpiProgress(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.kpis[0].daysLeft).toBe(0);
    expect(result.current.kpis[0].projected).toBeNull();
    expect(result.current.kpis[0].status).toBe('onTrack');
    expect(result.current.atRiskCount).toBe(0);
  });

  it('still calls a closed window missed when the observed value fell short', async () => {
    mockGetListKPIs.mockResolvedValue(kpiList(kpi(NOW - DAY_MS)));
    mockGetListKpiResult.mockResolvedValue(
      kpiResults({ count: 40, day: DAY_TWO })
    );

    const { result } = renderHook(() => useKpiProgress(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.kpis[0].status).toBe('missed');
    expect(result.current.atRiskCount).toBe(1);
  });

  it('keeps the derived arrays referentially stable across re-renders', async () => {
    mockGetListKPIs.mockResolvedValue(kpiList(kpi(NOW + 10 * DAY_MS)));
    mockGetListKpiResult.mockResolvedValue(
      kpiResults({ count: 40, day: DAY_ONE }, { count: 70, day: DAY_TWO })
    );

    const { result, rerender } = renderHook(() => useKpiProgress(), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const settled = result.current;
    rerender();

    // The sparkline replaces its series whenever the option identity changes,
    // which replays the entry animation. A re-render with unchanged query data
    // must not hand it a new series — that drew the trend a second time.
    expect(result.current.kpis).toBe(settled.kpis);
    expect(result.current.kpis[0].series).toBe(settled.kpis[0].series);
  });

  it('surfaces a failed fetch instead of reporting no KPIs', async () => {
    mockGetListKPIs.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useKpiProgress(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.kpis).toEqual([]);
  });

  // The rate is the change over the days the results actually span. A KPI
  // that started reporting a day ago spread its whole move over the 30-day
  // window, understated its pace, and was called at risk.
  it('projects off the span the results cover, not the selected window', async () => {
    mockGetListKPIs.mockResolvedValue(kpiList(kpi(NOW + 10 * DAY_MS)));
    mockGetListKpiResult.mockResolvedValue(
      kpiResults({ count: 40, day: DAY_ONE }, { count: 70, day: DAY_TWO })
    );

    const { result } = renderHook(() => useKpiProgress(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // +30 in one day, ten days left.
    expect(result.current.kpis[0].projected).toBe(370);
    expect(result.current.kpis[0].status).toBe('onTrack');
  });

  // The list endpoint pages at ten by default; anything past the first page
  // silently dropped off the card.
  it('follows the paging cursor until every KPI is read', async () => {
    mockGetListKPIs
      .mockResolvedValueOnce({
        data: [kpi(NOW + 10 * DAY_MS, 100, 'first')],
        paging: { after: 'cursor-1', total: 2 },
      } as never)
      .mockResolvedValueOnce({
        data: [kpi(NOW + 10 * DAY_MS, 100, 'second')],
        paging: { total: 2 },
      } as never);
    mockGetListKpiResult.mockResolvedValue(kpiResults({ count: 40, day: NOW }));

    const { result } = renderHook(() => useKpiProgress(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(
      result.current.kpis.map((entry) => entry.fullyQualifiedName)
    ).toEqual(['first', 'second']);
    expect(mockGetListKPIs).toHaveBeenLastCalledWith(
      expect.objectContaining({ after: 'cursor-1', limit: expect.any(Number) })
    );
  });

  it('carries the metric type and the window the delta is worded for', async () => {
    mockGetListKPIs.mockResolvedValue(kpiList(kpi(NOW + 10 * DAY_MS)));
    mockGetListKpiResult.mockResolvedValue(kpiResults({ count: 40, day: NOW }));

    const { result, rerender } = renderHook(
      ({ range }) => useKpiProgress(range),
      {
        initialProps: { range: KPI_WINDOW_DAYS as KpiWindow },
        wrapper,
      }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.kpis[0].metricType).toBe(KpiTargetType.Percentage);
    expect(result.current.kpis[0].windowDays).toBe(KPI_WINDOW_DAYS);

    rerender({ range: KPI_ALL_TIME });

    await waitFor(() => expect(result.current.kpis[0].windowDays).toBeNull());
  });

  // A range switch is a new key; without placeholder data the card dropped
  // back to its first-load skeleton and unmounted the range filter.
  it('keeps the previous range on screen while the next one loads', async () => {
    mockGetListKPIs.mockResolvedValue(kpiList(kpi(NOW + 10 * DAY_MS)));
    mockGetListKpiResult.mockResolvedValue(kpiResults({ count: 40, day: NOW }));

    const { result, rerender } = renderHook(
      ({ range }) => useKpiProgress(range),
      {
        initialProps: { range: KPI_WINDOW_DAYS as KpiWindow },
        wrapper,
      }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockGetListKPIs.mockReturnValue(new Promise(() => undefined));
    rerender({ range: 90 });

    await waitFor(() => expect(result.current.isFetching).toBe(true));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.kpis).toHaveLength(1);
  });
});
