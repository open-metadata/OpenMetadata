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
import { MemoryRouter } from 'react-router-dom';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { Metric } from '../../../generated/entity/data/metric';
import RelatedMetrics from './RelatedMetrics';

jest.mock(
  '../../common/WidgetActionButton/WidgetActionButton',
  () => ({
    WidgetPlusButton: (props: { 'data-testid'?: string }) => (
      <button data-testid={props['data-testid']}>plus</button>
    ),
    WidgetEditButton: (props: { 'data-testid'?: string }) => (
      <button data-testid={props['data-testid']}>edit</button>
    ),
  })
);

jest.mock('../../common/WidgetCard/WidgetCard', () =>
  jest.fn().mockImplementation(({ headerExtra, children }) => (
    <div data-testid="widget-card">
      <div data-testid="header-extra">{headerExtra}</div>
      {children}
    </div>
  ))
);

jest.mock('./RelatedMetricsForm', () => ({
  RelatedMetricsForm: jest.fn().mockImplementation(() => (
    <div data-testid="related-metrics-form" />
  )),
}));

const mockMetricDetails: Partial<Metric> = {
  id: 'metric-1',
  name: 'test-metric',
  fullyQualifiedName: 'test.metric',
  deleted: false,
  relatedMetrics: [],
};

const mockUseGenericContextResult = {
  data: mockMetricDetails as Metric,
  onUpdate: jest.fn(),
  permissions: {} as OperationPermission,
};

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: jest.fn(() => mockUseGenericContextResult),
}));

const renderRelatedMetrics = (
  metricOverrides: Partial<Metric> = {},
  permissions: Partial<OperationPermission> = {}
) => {
  mockUseGenericContextResult.data = {
    ...mockMetricDetails,
    ...metricOverrides,
  } as Metric;
  mockUseGenericContextResult.permissions = permissions as OperationPermission;

  return render(<RelatedMetrics />, { wrapper: MemoryRouter });
};

describe('RelatedMetrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGenericContextResult.data = mockMetricDetails as Metric;
    mockUseGenericContextResult.permissions = {} as OperationPermission;
  });

  it('shows the add-related-metrics button when EditAll is granted and the entity is not deleted', () => {
    renderRelatedMetrics({}, { EditAll: true });

    expect(
      screen.getByTestId('add-related-metrics-container')
    ).toBeInTheDocument();
  });

  it('hides the add-related-metrics button when there is no edit permission', () => {
    renderRelatedMetrics({}, {});

    expect(
      screen.queryByTestId('add-related-metrics-container')
    ).not.toBeInTheDocument();
  });

  // Regression coverage for the getDerivedPermissionFlags conversion (Task 8 Batch 9): the
  // old raw expression ANDed `!metricDetails.deleted` directly onto `permissions.EditAll` —
  // a soft-deleted metric must still read as edit-locked even when EditAll is granted.
  it('hides the add-related-metrics button when the metric is deleted, even with EditAll true', () => {
    renderRelatedMetrics({ deleted: true }, { EditAll: true });

    expect(
      screen.queryByTestId('add-related-metrics-container')
    ).not.toBeInTheDocument();
  });

  it('shows the edit-related-metrics button instead of add when related metrics already exist', () => {
    renderRelatedMetrics(
      {
        relatedMetrics: [
          { id: 'related-1', type: 'metric', fullyQualifiedName: 'other.metric' },
        ],
      },
      { EditAll: true }
    );

    expect(screen.getByTestId('edit-related-metrics')).toBeInTheDocument();
    expect(
      screen.queryByTestId('add-related-metrics-container')
    ).not.toBeInTheDocument();
  });
});
