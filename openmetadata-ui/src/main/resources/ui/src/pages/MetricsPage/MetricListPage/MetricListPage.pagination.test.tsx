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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Kind } from '../../../generated/api/data/metricHierarchyItem';
import {
  getMetricHierarchy,
  MetricHierarchyListParams,
} from '../../../rest/metricsAPI';
import MetricListPage from './MetricListPage';

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    getResourcePermission: jest
      .fn()
      .mockResolvedValue({ ViewAll: true, ViewBasic: true }),
  }),
}));

jest.mock('../../../components/Metric/AddMetric/useMetricCreateDrawer', () => ({
  useMetricCreateDrawer: () => ({ formDrawer: null, openDrawer: jest.fn() }),
}));

jest.mock(
  '../../../components/Metric/MetricListHealth/MetricListHealth',
  () => () => null
);

jest.mock('../../../rest/metricsAPI', () => ({
  getMetricHierarchy: jest.fn(),
  getMetrics: jest.fn(),
  deleteMetricAsync: jest.fn(),
  exportMetricDetailsInCSV: jest.fn(),
}));

jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

const mockGetMetricHierarchy = getMetricHierarchy as jest.Mock;

const TOTAL_METRICS = 45;

const hierarchyPage = ({ limit = 20, offset = 0 }: MetricHierarchyListParams) =>
  Promise.resolve({
    data: Array.from(
      { length: Math.min(limit, TOTAL_METRICS - offset) },
      (_, i) => {
        const name = `metric_${offset + i}`;

        return {
          kind: Kind.Metric,
          metric: { id: name, name, fullyQualifiedName: name },
        };
      }
    ),
    paging: { offset, limit, total: TOTAL_METRICS },
  });

const lastHierarchyRequest = () =>
  mockGetMetricHierarchy.mock.calls.at(-1)?.[0] as MetricHierarchyListParams;

describe('MetricListPage pagination', () => {
  it('pages the metrics hierarchy by limit and offset', async () => {
    mockGetMetricHierarchy.mockImplementation(hierarchyPage);

    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }>
        <MemoryRouter>
          <MetricListPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText('metric_0')).toBeInTheDocument();
    expect(lastHierarchyRequest()).toEqual({ limit: 20, offset: 0 });
    expect(screen.getByTestId('metric-page-previous')).toBeDisabled();
    expect(screen.getByTestId('metric-page-next')).toBeEnabled();

    await act(async () => {
      fireEvent.click(screen.getByTestId('metric-page-next'));
    });

    expect(await screen.findByText('metric_20')).toBeInTheDocument();
    expect(lastHierarchyRequest()).toEqual({ limit: 20, offset: 20 });
    expect(screen.getByTestId('metric-page-previous')).toBeEnabled();
    expect(screen.getByTestId('metric-page-indicator')).toHaveTextContent(
      /2\s*label\.of-lowercase\s*\d+/
    );
  });
});
