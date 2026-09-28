/*
 *  Copyright 2025 Collate.
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
import { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { getDashboardByFqn } from '../../rest/dashboardAPI';
import { renderWithQueryClient } from '../../test/unit/test-utils';
import { getDerivedPermissionFlags } from '../../utils/PermissionDerivation';
import DashboardDetailsPage from './DashboardDetailsPage.component';

// Mock the required dependencies
jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue({ fqn: 'test-dashboard' }),
  useNavigate: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../../rest/dashboardAPI');
jest.mock(
  '../../components/Dashboard/DashboardDetails/DashboardDetails.component',
  () => {
    return jest
      .fn()
      .mockImplementation(() => <div>Dashboard Details Component</div>);
  }
);

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

const mockDashboard = {
  id: '123',
  name: 'test-dashboard',
  fullyQualifiedName: 'test-dashboard',
  displayName: 'Test Dashboard',
  version: 1,
};

describe('DashboardDetailsPage', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    setMockPermissions({ ViewAll: true, ViewBasic: true });
  });

  it('should render loading state initially', async () => {
    (getDashboardByFqn as jest.Mock).mockImplementation(() =>
      Promise.resolve(mockDashboard)
    );
    // The mocked hook otherwise resolves synchronously on first render (no microtask
    // gap the way the old imperative fetch had) — force isLoading so this still
    // observes a genuine "still loading" render, per the Batch 7 TeamsPage precedent.
    setMockPermissions({ ViewAll: true, ViewBasic: true }, { isLoading: true });

    renderWithQueryClient(<DashboardDetailsPage />);

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('should render dashboard details when data is loaded', async () => {
    (getDashboardByFqn as jest.Mock).mockResolvedValue(mockDashboard);

    await act(async () => {
      renderWithQueryClient(<DashboardDetailsPage />);
    });

    await waitFor(() =>
      expect(
        screen.getByText('Dashboard Details Component')
      ).toBeInTheDocument()
    );
  });

  it('should show error placeholder when dashboard is not found', async () => {
    (getDashboardByFqn as jest.Mock).mockImplementation(() =>
      Promise.reject(
        new AxiosError('Not Found', '404', undefined, undefined, {
          status: 404,
          data: {},
          statusText: 'Not Found',
          headers: {},
          config: {} as InternalAxiosRequestConfig,
        })
      )
    );
    setMockPermissions({ ViewAll: true, ViewBasic: true });

    await act(async () => {
      renderWithQueryClient(<DashboardDetailsPage />);
    });

    await waitFor(() =>
      expect(getDashboardByFqn).toHaveBeenCalledWith('test-dashboard', {
        fields:
          'domains,owners, followers, tags, charts,votes,dataProducts,extension,usageSummary',
      })
    );

    await waitFor(() =>
      expect(screen.getByTestId('no-data-placeholder')).toBeInTheDocument()
    );
  });

  it('should show permission error when user lacks view permissions', async () => {
    setMockPermissions({ ViewAll: false, ViewBasic: false });

    await act(async () => {
      renderWithQueryClient(<DashboardDetailsPage />);
    });

    await waitFor(() =>
      expect(
        screen.getByTestId('permission-error-placeholder')
      ).toBeInTheDocument()
    );
  });
});
