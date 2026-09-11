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
import { render, screen } from '@testing-library/react';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { Metric, MetricType } from '../../../generated/entity/data/metric';
import MetricHeaderInfo from './MetricHeaderInfo';

jest.mock('../../../rest/metricsAPI', () => ({
  getCustomUnitsOfMeasurement: jest.fn().mockResolvedValue([]),
}));

const mockMetricDetails: Metric = {
  id: 'metric-1',
  name: 'test-metric',
  fullyQualifiedName: 'test.metric',
  metricType: MetricType.Percentage,
  deleted: false,
} as unknown as Metric;

const EDIT_METRIC_TYPE_BUTTON = 'edit-label.metric-type-button';

const renderHeaderInfo = (
  metricPermissions: Partial<OperationPermission>,
  metricDetailsOverrides: Partial<Metric> = {}
) =>
  render(
    <MetricHeaderInfo
      metricDetails={{ ...mockMetricDetails, ...metricDetailsOverrides }}
      metricPermissions={metricPermissions as OperationPermission}
      onUpdateMetricDetails={jest.fn()}
    />
  );

describe('MetricHeaderInfo', () => {
  it('shows the edit affordance when EditAll is granted', () => {
    renderHeaderInfo({ EditAll: true });

    expect(screen.getByTestId(EDIT_METRIC_TYPE_BUTTON)).toBeInTheDocument();
  });

  it('hides the edit affordance when EditAll is not granted', () => {
    renderHeaderInfo({});

    expect(
      screen.queryByTestId(EDIT_METRIC_TYPE_BUTTON)
    ).not.toBeInTheDocument();
  });

  it('hides the edit affordance when the metric is deleted, even with EditAll true', () => {
    renderHeaderInfo({ EditAll: true }, { deleted: true });

    expect(
      screen.queryByTestId(EDIT_METRIC_TYPE_BUTTON)
    ).not.toBeInTheDocument();
  });
});
