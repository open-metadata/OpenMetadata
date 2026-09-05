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

import { act, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { getChartByFqn } from '../../rest/chartsAPI';
import { renderWithQueryClient } from '../../test/unit/test-utils';
import { getDerivedPermissionFlags } from '../../utils/PermissionDerivation';
import ChartDetailsPage from './ChartDetailsPage.component';

const mockChart = {
  id: 'chart-id',
  name: 'test-chart',
  fullyQualifiedName: 'sample_superset.test-chart',
  displayName: 'Test Chart',
  version: 1,
  followers: [],
};

jest.mock('../../rest/chartsAPI', () => ({
  getChartByFqn: jest.fn().mockImplementation(() => Promise.resolve(mockChart)),
  patchChartDetails: jest.fn().mockImplementation(() => Promise.resolve({})),
  addFollower: jest.fn().mockImplementation(() => Promise.resolve({})),
  removeFollower: jest.fn().mockImplementation(() => Promise.resolve({})),
  updateChartVotes: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../components/Chart/ChartDetails/ChartDetails.component', () =>
  jest.fn().mockImplementation(() => <div>ChartDetails.component</div>)
);

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockImplementation(() => ({ fqn: 'testFqn' })),
}));

jest.mock('../../utils/RecentActivityUtils', () => ({
  addToRecentViewed: jest.fn(),
}));

// Permissions now come from useEntityPermissions (Task 8 Batch 10) rather than an
// imperative usePermissionProvider().getEntityPermissionByFqn call — mock the hook
// directly, mirroring DataModelPage.test.tsx's approach.
const mockUseEntityPermissions = jest.fn();

const setMockPermissions = (
  overrides: Partial<OperationPermission> = {},
  {
    isLoading = false,
    error = null as unknown,
  }: { isLoading?: boolean; error?: unknown } = {}
) => {
  const permissions = overrides as OperationPermission;
  mockUseEntityPermissions.mockReturnValue({
    permissions,
    isLoading,
    error,
    refresh: jest.fn(),
    ...getDerivedPermissionFlags(permissions, false),
  });
};

jest.mock('../../hooks/useEntityPermissions/useEntityPermissions', () => ({
  useEntityPermissions: (...args: unknown[]) =>
    mockUseEntityPermissions(...args),
}));

const renderPage = () =>
  renderWithQueryClient(
    <MemoryRouter>
      <ChartDetailsPage />
    </MemoryRouter>
  );

describe('ChartDetailsPage component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMockPermissions({ ViewAll: true, ViewBasic: true, ViewUsage: true });
  });

  it('should render ChartDetails once permissions and data resolve', async () => {
    await act(async () => {
      renderPage();
    });

    await waitFor(() =>
      expect(screen.getByText('ChartDetails.component')).toBeInTheDocument()
    );
  });

  it('calls useEntityPermissions with the resource and decoded fqn', async () => {
    await act(async () => {
      renderPage();
    });

    expect(mockUseEntityPermissions).toHaveBeenCalledWith(
      ResourceEntity.CHART,
      'testFqn',
      expect.objectContaining({ enabled: true })
    );
  });

  it('shows the permission placeholder when view access is denied', async () => {
    setMockPermissions({});

    await act(async () => {
      renderPage();
    });

    expect(
      await screen.findByTestId('permission-error-placeholder')
    ).toBeInTheDocument();
    expect(getChartByFqn).not.toHaveBeenCalled();
  });
});
