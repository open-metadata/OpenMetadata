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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import type { Metric } from '../../../generated/entity/data/metric';
import { Operation } from '../../../generated/entity/policies/accessControl/resourcePermission';
import { useMetricObservability } from '../../../hooks/useMetricObservability';
import MetricAssetsTab from './MetricAssetsTab.component';
import { useMetricAssetsTab } from './useMetricAssetsTab';

jest.mock('../../../hooks/useMetricObservability');
jest.mock('./useMetricAssetsTab');

const metric: Metric = {
  fullyQualifiedName: 'revenue',
  id: 'metric-1',
  name: 'revenue',
};
const refetch = jest.fn();
const baseState = {
  activeAssetId: undefined,
  areAllPageAssetsSelected: false,
  assets: [],
  bulkResult: undefined,
  clearBulkResult: jest.fn(),
  detailErrorIds: new Set(),
  detailLoadingIds: new Set(),
  detailsById: new Map(),
  error: undefined,
  filters: { direction: 'all', search: '', type: 'all' },
  isActiveDetailsLoading: false,
  isLoading: false,
  isRefetching: false,
  isUnlinking: false,
  page: 1,
  pageAssets: [],
  refetch,
  refetchAssetDetails: jest.fn(),
  selectedIds: new Set(),
  setActiveAssetId: jest.fn(),
  setFilters: jest.fn(),
  setPage: jest.fn(),
  toggleAsset: jest.fn(),
  togglePage: jest.fn(),
  totalAssets: 0,
  totalPages: 1,
  unlinkError: undefined,
  unlinkSelected: jest.fn(),
};
const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>
    <QueryClientProvider client={new QueryClient()}>
      {children}
    </QueryClientProvider>
  </MemoryRouter>
);

describe('MetricAssetsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useMetricAssetsTab as jest.Mock).mockReturnValue(baseState);
    (useMetricObservability as jest.Mock).mockReturnValue({
      observability: undefined,
    });
  });

  it('exposes an accessible loading state without edit controls for read-only users', () => {
    (useMetricAssetsTab as jest.Mock).mockReturnValue({
      ...baseState,
      isLoading: true,
    });
    render(
      <MetricAssetsTab
        metric={metric}
        permissions={{} as OperationPermission}
      />,
      { wrapper }
    );

    expect(screen.getByTestId('metric-assets-tab')).toHaveAttribute(
      'aria-busy',
      'true'
    );
    expect(screen.getByTestId('metric-assets-tab')).toHaveClass(
      'tw:px-4',
      'tw:py-6',
      'tw:md:px-8'
    );
    expect(screen.queryByTestId('metric-assets-add')).not.toBeInTheDocument();
  });

  it('renders a retry action for a failed page request', () => {
    (useMetricAssetsTab as jest.Mock).mockReturnValue({
      ...baseState,
      error: new Error('network'),
    });
    render(
      <MetricAssetsTab
        metric={metric}
        permissions={{} as OperationPermission}
      />,
      { wrapper }
    );

    fireEvent.click(screen.getByText('label.try-again'));

    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('metric-assets-results')).toHaveClass(
      'tw:relative',
      'tw:min-h-80'
    );
  });

  it('does not enable relationship mutations against stale page data', () => {
    (useMetricAssetsTab as jest.Mock).mockReturnValue({
      ...baseState,
      isRefetching: true,
      pageAssets: [
        {
          asset: { id: 'table-1', name: 'orders', type: 'table' },
          direction: 'upstream',
        },
      ],
      selectedIds: new Set(['table-1']),
      totalAssets: 1,
    });
    render(
      <MetricAssetsTab
        metric={metric}
        permissions={{ [Operation.EditAll]: true } as OperationPermission}
      />,
      { wrapper }
    );

    expect(screen.getByTestId('metric-assets-add')).toBeDisabled();
    expect(screen.getByTestId('metric-assets-bulk-unlink')).toBeDisabled();
    expect(
      screen.queryByTestId('metric-asset-card-table-1')
    ).not.toBeInTheDocument();
  });

  it('renders visible enriched assets as a semantic list', () => {
    const relation = {
      asset: { id: 'table-1', name: 'orders', type: 'table' },
      direction: 'upstream',
    };
    (useMetricAssetsTab as jest.Mock).mockReturnValue({
      ...baseState,
      detailsById: new Map([
        [
          'table-1',
          {
            asset: relation.asset,
            columns: [],
            containment: [],
            description: 'Canonical orders table',
            domains: [{ id: 'domain-1', name: 'Commerce', type: 'domain' }],
            glossaryTerms: [],
            owners: [{ id: 'user-1', name: 'Alice', type: 'user' }],
            tags: [],
            tier: 'Tier.Tier1',
            usageCount: 42,
          },
        ],
      ]),
      pageAssets: [relation],
      totalAssets: 1,
    });
    render(
      <MetricAssetsTab
        metric={metric}
        permissions={{} as OperationPermission}
      />,
      { wrapper }
    );

    expect(
      screen.getByRole('list', { name: 'label.asset-plural' })
    ).toBeVisible();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByTestId('metric-asset-card-table-1')).toHaveTextContent(
      'label.owner-plural: Alice'
    );
  });
});
