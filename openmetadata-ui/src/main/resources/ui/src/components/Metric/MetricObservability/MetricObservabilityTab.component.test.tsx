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
/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import {
  Health,
  ReasonCode,
} from '../../../generated/api/data/metricObservability';
import type { Metric } from '../../../generated/entity/data/metric';
import { useMetricObservability } from '../../../hooks/useMetricObservability';
import MetricObservabilityTab from './MetricObservabilityTab.component';

jest.mock('../../../hooks/useMetricObservability');

const metric: Metric = {
  fullyQualifiedName: 'revenue',
  id: 'metric-1',
  name: 'revenue',
};
const refetch = jest.fn();
const mockUseMetricObservability = useMetricObservability as jest.Mock;

describe('MetricObservabilityTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMetricObservability.mockReturnValue({
      error: undefined,
      isFetching: false,
      isPending: false,
      observability: undefined,
      refetch,
    });
  });

  it('keeps complete global aggregates visible when every source detail is restricted', () => {
    mockUseMetricObservability.mockReturnValue({
      error: undefined,
      isFetching: false,
      isPending: false,
      observability: {
        assets: [],
        dimensions: [
          {
            dimension: 'Business rule',
            failed: 1,
            passed: 3,
            score: 75,
            total: 4,
          },
        ],
        evaluatedAt: 1_720_000_000_000,
        health: Health.AtRisk,
        partial: true,
        incidents: [],
        reasonCode: ReasonCode.PartialDetails,
        score: 75,
        sourceCoverage: {
          coveragePercent: 100,
          partial: true,
          restrictedTables: 2,
          testedTables: 2,
          upstreamTables: 2,
          visibleTables: 0,
        },
        statusCounts: {
          aborted: 2,
          failed: 3,
          missing: 5,
          passed: 7,
          queued: 11,
          terminal: 12,
        },
        tests: [],
      },
      refetch,
    });

    render(<MetricObservabilityTab metric={metric} />);

    expect(screen.getByTestId('metric-observability-tab')).toHaveClass(
      'tw:px-4',
      'tw:py-6',
      'tw:md:px-8'
    );
    expect(screen.getByTestId('metric-health-summary')).toHaveTextContent(
      '75%'
    );
    expect(screen.getByTestId('metric-rollup-reason')).toHaveTextContent(
      'message.metric-observability-score-explanation'
    );
    expect(
      screen.getByTestId('metric-observability-evaluated-at')
    ).toHaveTextContent('label.updated-at');
    expect(screen.getByTestId('metric-observability-partial')).toBeVisible();
    expect(screen.getByTestId('metric-observability-redacted')).toBeVisible();
    expect(screen.getByTestId('metric-global-status-counts')).toHaveTextContent(
      'label.passed7label.failed3label.aborted2label.queued11label.missing5'
    );
    expect(
      screen.getByTestId('metric-dimension-Business rule')
    ).toHaveTextContent('Business rule');
    expect(
      screen.queryByText('restricted_orders_not_null')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('label.freshness')).not.toBeInTheDocument();
    expect(screen.queryByText('label.trend')).not.toBeInTheDocument();
    expect(screen.queryByText('label.value')).not.toBeInTheDocument();
  });

  it('shows detail rows only for visible sources in a partial response', () => {
    mockUseMetricObservability.mockReturnValue({
      error: undefined,
      isFetching: false,
      isPending: false,
      observability: {
        assets: [
          {
            asset: { id: 'visible-table', name: 'orders', type: 'table' },
            health: Health.Healthy,
          },
          {
            asset: { id: 'restricted-table', type: 'table' },
            health: Health.Degraded,
            redacted: true,
          },
        ],
        health: Health.AtRisk,
        incidents: [
          {
            asset: { id: 'visible-table', name: 'orders', type: 'table' },
            id: 'visible-incident',
            severity: 'Critical',
            status: 'Open',
            testCase: {
              id: 'visible-incident-test',
              name: 'visible_incident_test',
              type: 'testCase',
            },
          },
          {
            asset: { id: 'restricted-table', type: 'table' },
            id: 'restricted-incident',
            severity: 'Critical',
            status: 'Open',
            testCase: {
              id: 'restricted-incident-test',
              name: 'restricted_incident_test',
              type: 'testCase',
            },
          },
        ],
        partial: true,
        reasonCode: ReasonCode.PartialDetails,
        score: 75,
        sourceCoverage: {
          coveragePercent: 100,
          partial: true,
          restrictedTables: 1,
          testedTables: 2,
          upstreamTables: 2,
          visibleTables: 1,
        },
        statusCounts: {
          aborted: 0,
          failed: 1,
          missing: 0,
          passed: 3,
          queued: 0,
          terminal: 4,
        },
        tests: [
          {
            asset: { id: 'visible-table', name: 'orders', type: 'table' },
            status: 'Passed',
            testCase: {
              id: 'visible-test',
              name: 'visible_orders_not_null',
              type: 'testCase',
            },
          },
          {
            asset: { id: 'restricted-table', type: 'table' },
            status: 'Failed',
            testCase: {
              id: 'restricted-test',
              name: 'restricted_orders_not_null',
              type: 'testCase',
            },
          },
        ],
      },
      refetch,
    });

    render(<MetricObservabilityTab metric={metric} />);

    expect(screen.getByText('visible_orders_not_null')).toBeVisible();
    expect(screen.getByText('visible_incident_test')).toBeVisible();
    expect(
      screen.queryByText('restricted_orders_not_null')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('restricted_incident_test')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('metric-rollup-reason')).toHaveTextContent(
      'message.metric-observability-score-explanation'
    );
  });

  it('exposes loading and score semantics and contains empty placeholders', () => {
    mockUseMetricObservability.mockReturnValue({
      error: undefined,
      isFetching: false,
      isPending: true,
      observability: undefined,
      refetch,
    });
    const { rerender } = render(<MetricObservabilityTab metric={metric} />);

    expect(screen.getByTestId('metric-observability-loading')).toHaveClass(
      'tw:px-4',
      'tw:py-6',
      'tw:md:px-8'
    );
    expect(screen.getByRole('status', { name: 'label.loading' })).toBeVisible();

    mockUseMetricObservability.mockReturnValue({
      error: undefined,
      isFetching: false,
      isPending: false,
      observability: {
        health: Health.Healthy,
        reasonCode: ReasonCode.Healthy,
        score: 100,
        sourceCoverage: {
          coveragePercent: 100,
          partial: false,
          restrictedTables: 0,
          testedTables: 1,
          upstreamTables: 1,
          visibleTables: 1,
        },
        statusCounts: {
          aborted: 0,
          failed: 0,
          missing: 0,
          passed: 1,
          queued: 0,
          terminal: 1,
        },
      },
      refetch,
    });
    rerender(<MetricObservabilityTab metric={metric} />);

    expect(
      screen.getByRole('progressbar', { name: 'label.health' })
    ).toHaveAttribute('aria-valuenow', '100');
    expect(
      screen.getByTestId('metric-tests').querySelector('.tw\\:relative')
    ).not.toBeNull();
  });

  it('does not infer partial coverage from a source with no terminal result', () => {
    mockUseMetricObservability.mockReturnValue({
      error: undefined,
      isFetching: false,
      isPending: false,
      observability: {
        assets: [
          {
            asset: { id: 'table-1', name: 'orders', type: 'table' },
            health: Health.Unknown,
          },
        ],
        health: Health.Unknown,
        partial: false,
        reasonCode: ReasonCode.NoTerminalResults,
        sourceCoverage: {
          coveragePercent: 0,
          partial: false,
          restrictedTables: 0,
          testedTables: 0,
          upstreamTables: 1,
          visibleTables: 1,
        },
        statusCounts: {
          aborted: 0,
          failed: 0,
          missing: 1,
          passed: 0,
          queued: 0,
          terminal: 0,
        },
      },
      refetch,
    });

    render(<MetricObservabilityTab metric={metric} />);

    expect(
      screen.queryByTestId('metric-observability-partial')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('metric-health-score-unknown')).toHaveTextContent(
      'label.unknown'
    );
    expect(screen.getByTestId('metric-health-summary')).not.toHaveTextContent(
      '0%'
    );
    expect(screen.getByTestId('metric-rollup-reason')).toHaveTextContent(
      'message.metric-observability-reason-no-terminal-results'
    );
    expect(screen.getByTestId('metric-asset-rollups')).toHaveTextContent(
      'message.metric-observability-reason-no-terminal-results'
    );
  });

  it('renders the Unknown health summary when no assets are linked', () => {
    mockUseMetricObservability.mockReturnValue({
      error: undefined,
      isFetching: false,
      isPending: false,
      observability: {
        assets: [],
        dimensions: [],
        health: Health.Unknown,
        incidents: [],
        reasonCode: ReasonCode.NoLinkedAssets,
        sourceCoverage: {
          coveragePercent: 0,
          partial: false,
          restrictedTables: 0,
          testedTables: 0,
          upstreamTables: 0,
          visibleTables: 0,
        },
        statusCounts: {
          aborted: 0,
          failed: 0,
          missing: 0,
          passed: 0,
          queued: 0,
          terminal: 0,
        },
        tests: [],
      },
      refetch,
    });

    render(<MetricObservabilityTab metric={metric} />);

    expect(screen.getByTestId('metric-health-pill')).toBeVisible();
    expect(screen.getByTestId('metric-health-score-unknown')).toHaveTextContent(
      'label.unknown'
    );
    expect(screen.getByTestId('metric-rollup-reason')).toHaveTextContent(
      'label.no-assets-linked-yet'
    );
    expect(
      screen.queryByTestId('metric-observability-empty')
    ).not.toBeInTheDocument();
  });

  it('offers retry for transport errors but not for permission errors', () => {
    mockUseMetricObservability.mockReturnValue({
      error: new Error('network'),
      isFetching: false,
      isPending: false,
      observability: undefined,
      refetch,
    });
    const { rerender } = render(<MetricObservabilityTab metric={metric} />);

    fireEvent.click(screen.getByText('label.try-again'));

    expect(refetch).toHaveBeenCalledTimes(1);

    const forbidden = new AxiosError(
      'forbidden',
      undefined,
      undefined,
      undefined,
      {
        config: { headers: new AxiosHeaders() },
        data: undefined,
        headers: {},
        status: 403,
        statusText: 'Forbidden',
      }
    );
    mockUseMetricObservability.mockReturnValue({
      error: forbidden,
      isFetching: false,
      isPending: false,
      observability: undefined,
      refetch,
    });
    rerender(<MetricObservabilityTab metric={metric} />);

    const error = screen.getByTestId('metric-observability-error');

    expect(error).toHaveClass('tw:px-4', 'tw:py-6', 'tw:md:px-8');
    expect(within(error).getByText('label.access-denied')).toBeVisible();
    expect(
      within(error).queryByText('label.try-again')
    ).not.toBeInTheDocument();
  });
});
