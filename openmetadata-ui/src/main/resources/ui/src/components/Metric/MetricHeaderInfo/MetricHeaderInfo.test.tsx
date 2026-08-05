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
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Health } from '../../../generated/api/data/metricObservability';
import {
  Metric,
  MetricGranularity,
  MetricType,
  UnitOfMeasurement,
} from '../../../generated/entity/data/metric';
import MetricHeaderInfo from './MetricHeaderInfo';

const mockUseMetricObservability = jest.fn();

jest.mock('../../../hooks/useMetricObservability', () => ({
  useMetricObservability: (...args: unknown[]) =>
    mockUseMetricObservability(...args),
}));

const mockMetric = {
  id: 'metric-id',
  name: 'gross_margin_rate',
  metricType: MetricType.Percentage,
  unitOfMeasurement: UnitOfMeasurement.Percentage,
  granularity: MetricGranularity.Day,
} as Metric;

const renderHeaderInfo = (
  status?: ReactNode,
  metricDetails: Metric = mockMetric
) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }>
      <MetricHeaderInfo metricDetails={metricDetails} status={status} />
    </QueryClientProvider>
  );

describe('MetricHeaderInfo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMetricObservability.mockReturnValue({
      observability: undefined,
      isPending: false,
    });
  });

  it('surfaces the health rollup in the header so it is visible without opening a tab', () => {
    mockUseMetricObservability.mockReturnValue({
      observability: { health: Health.AtRisk, score: 82 },
      isPending: false,
    });

    renderHeaderInfo();

    expect(screen.getByTestId('metric-header-health-pill')).toHaveTextContent(
      '82label.at-risk'
    );
  });

  it('renders compact title metadata in the prototype order without the unit slab', () => {
    renderHeaderInfo(<span data-testid="metric-status-slot" />);

    const headerInfo = screen.getByRole('group', { name: 'label.metric' });
    const metricType = screen.getByTestId('metric-type');
    const granularity = screen.getByTestId('granularity');
    const status = screen.getByTestId('metric-status-slot');
    const health = screen.getByTestId('metric-header-health-pill');

    expect(headerInfo).toHaveClass(
      'tw:inline-flex',
      'tw:flex-wrap',
      'tw:items-center'
    );
    expect(headerInfo).not.toHaveClass(
      'tw:w-full',
      'tw:rounded-lg',
      'tw:bg-secondary',
      'tw:p-3'
    );
    expect(screen.getByTestId('metric-type')).toHaveTextContent(
      'label.percentage'
    );
    expect(screen.getByTestId('metric-type')).toHaveClass(
      'tw:font-mono',
      'tw:uppercase',
      'tw:tracking-wide',
      'tw:text-[10px]'
    );
    expect(screen.getByTestId('granularity')).toHaveTextContent('label.day');
    expect(screen.getByTestId('granularity')).toHaveClass(
      'tw:font-mono',
      'tw:uppercase',
      'tw:tracking-wide'
    );
    expect(screen.queryByTestId('unit-of-measurement')).not.toBeInTheDocument();
    expect(
      metricType.compareDocumentPosition(granularity) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      granularity.compareDocumentPosition(status) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      status.compareDocumentPosition(health) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('uses the mapped Untitled palette for the metric type', () => {
    renderHeaderInfo(undefined, {
      ...mockMetric,
      metricType: MetricType.Ratio,
    });

    expect(screen.getByTestId('metric-type')).toHaveClass(
      'tw:bg-utility-purple-50',
      'tw:text-utility-purple-700'
    );
  });

  it('shows unknown health when the rollup cannot be read', () => {
    mockUseMetricObservability.mockReturnValue({
      observability: undefined,
      error: new Error('observability down'),
      isPending: false,
    });
    renderHeaderInfo();

    expect(screen.getByTestId('metric-header-health-pill')).toHaveTextContent(
      'label.unknown'
    );
  });

  it('shows a stable loading placeholder while health is loading', () => {
    mockUseMetricObservability.mockReturnValue({
      observability: undefined,
      isPending: true,
    });

    renderHeaderInfo();

    expect(
      screen.getByTestId('metric-header-health-pill-loading')
    ).toBeInTheDocument();
  });
});
