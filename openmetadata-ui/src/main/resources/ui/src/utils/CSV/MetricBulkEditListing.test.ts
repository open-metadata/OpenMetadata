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
import { EntityStatus, Metric } from '../../generated/entity/data/metric';
import { getMetrics } from '../../rest/metricsAPI';
import { fetchMetricBulkEditGrid } from './MetricBulkEditListing';

jest.mock('../../rest/metricsAPI', () => ({
  getMetrics: jest.fn(),
}));

jest.mock('./CSV.utils', () => ({
  getMetricColumnsAndDataSourceFromMetrics: jest
    .fn()
    .mockImplementation((metrics: Metric[]) => ({
      columns: [{ key: 'name' }],
      dataSource: metrics.map((metric) => ({ name: metric.name })),
    })),
}));

const mockGetMetrics = getMetrics as jest.MockedFunction<typeof getMetrics>;

const buildMetric = (overrides: Partial<Metric>): Metric =>
  ({
    id: 'id-default',
    name: 'metric_default',
    displayName: 'Metric Default',
    description: '',
    entityStatus: EntityStatus.Approved,
    ...overrides,
  } as Metric);

const PAGE_ONE = [
  buildMetric({ id: 'id-1', name: 'net_sales' }),
  buildMetric({
    id: 'id-2',
    name: 'gross_margin',
    entityStatus: EntityStatus.Draft,
  }),
];

const PAGE_TWO = [
  buildMetric({ id: 'id-3', name: 'churn_rate' }),
  buildMetric({ id: 'id-4', name: 'sales_velocity' }),
];

const baseArgs = {
  headers: [{ name: 'name', required: true }],
  multipleOwner: { user: true, team: false },
  isBulkEdit: true,
  signal: new AbortController().signal,
};

describe('fetchMetricBulkEditGrid', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('pages through the listing and matches filtered metrics across pages', async () => {
    mockGetMetrics
      .mockResolvedValueOnce({
        data: PAGE_ONE,
        paging: { after: 'cursor-2', total: 4 },
      })
      .mockResolvedValueOnce({
        data: PAGE_TWO,
        paging: { total: 4 },
      });

    const onProgress = jest.fn();
    const grid = await fetchMetricBulkEditGrid({
      ...baseArgs,
      scope: { mode: 'filtered', filters: { searchText: 'sales' } },
      onProgress,
    });

    expect(mockGetMetrics).toHaveBeenCalledTimes(2);
    expect(grid.loadedCount).toBe(4);
    expect(grid.matchedCount).toBe(2);
    expect(grid.dataSource.map((row) => row.name)).toEqual([
      'net_sales',
      'sales_velocity',
    ]);
    expect(onProgress).toHaveBeenLastCalledWith(4, 2);
  });

  it('filters by status', async () => {
    mockGetMetrics.mockResolvedValueOnce({
      data: PAGE_ONE,
      paging: { total: 2 },
    });

    const grid = await fetchMetricBulkEditGrid({
      ...baseArgs,
      scope: {
        mode: 'filtered',
        filters: { statusFilter: EntityStatus.Draft },
      },
    });

    expect(grid.dataSource.map((row) => row.name)).toEqual(['gross_margin']);
  });

  it('stops paging early once every selected metric is found', async () => {
    mockGetMetrics.mockResolvedValueOnce({
      data: PAGE_ONE,
      paging: { after: 'cursor-2', total: 4 },
    });

    const grid = await fetchMetricBulkEditGrid({
      ...baseArgs,
      scope: {
        mode: 'selected',
        ids: ['id-1'],
        names: ['net_sales'],
        filters: {},
      },
    });

    expect(mockGetMetrics).toHaveBeenCalledTimes(1);
    expect(grid.matchedCount).toBe(1);
    expect(grid.dataSource.map((row) => row.name)).toEqual(['net_sales']);
  });

  it('matches selected metrics by name when ids are unavailable', async () => {
    mockGetMetrics.mockResolvedValueOnce({
      data: PAGE_ONE,
      paging: { total: 2 },
    });

    const grid = await fetchMetricBulkEditGrid({
      ...baseArgs,
      scope: {
        mode: 'selected',
        ids: [],
        names: ['gross_margin'],
        filters: {},
      },
    });

    expect(grid.dataSource.map((row) => row.name)).toEqual(['gross_margin']);
  });
});
