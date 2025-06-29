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
import { act, render, screen } from '@testing-library/react';
import { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { getDashboardByFqn } from '../../rest/dashboardAPI';
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

jest.mock('../../context/PermissionProvider/PermissionProvider');
jest.mock('../../rest/dashboardAPI');
jest.mock(
  '../../components/Dashboard/DashboardDetails/DashboardDetails.component',
  () => {
    return jest
      .fn()
      .mockImplementation(() => <div>Dashboard Details Component</div>);
  }
);

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

    // Mock the permission provider
    (usePermissionProvider as jest.Mock).mockReturnValue({
      getEntityPermissionByFqn: jest.fn().mockResolvedValue({
        ViewAll: true,
        ViewBasic: true,
      }),
    });
  });

  it('should render loading state initially', async () => {
    (getDashboardByFqn as jest.Mock).mockImplementation(() =>
      Promise.resolve(mockDashboard)
    );

    render(<DashboardDetailsPage />);

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('should render dashboard details when data is loaded', async () => {
    (getDashboardByFqn as jest.Mock).mockResolvedValue(mockDashboard);

    await act(async () => {
      render(<DashboardDetailsPage />);
    });

    expect(screen.getByText('Dashboard Details Component')).toBeInTheDocument();
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
    (usePermissionProvider as jest.Mock).mockReturnValue({
      getEntityPermissionByFqn: jest.fn().mockResolvedValue({
        ViewAll: true,
        ViewBasic: true,
      }),
    });

    await act(async () => {
      render(<DashboardDetailsPage />);
    });

    expect(getDashboardByFqn).toHaveBeenCalledWith('test-dashboard', {
      fields:
        'domain,owners, followers, tags, charts,votes,dataProducts,extension,usageSummary',
    });

    expect(screen.getByTestId('no-data-placeholder')).toBeInTheDocument();
  });

  it('should show permission error when user lacks view permissions', async () => {
    (usePermissionProvider as jest.Mock).mockReturnValue({
      getEntityPermissionByFqn: jest.fn().mockResolvedValue({
        ViewAll: false,
        ViewBasic: false,
      }),
    });

    await act(async () => {
      render(<DashboardDetailsPage />);
    });

    expect(
      screen.getByTestId('permission-error-placeholder')
    ).toBeInTheDocument();
  });
});
