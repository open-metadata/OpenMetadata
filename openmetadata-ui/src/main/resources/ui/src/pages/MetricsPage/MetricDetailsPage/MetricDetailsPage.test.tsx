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
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import MetricDetailsPage from './MetricDetailsPage';

// No prior test coverage existed for this page — this is a new characterization suite
// written as part of converting the permission fetch onto useEntityPermissions. Mirrors
// TableDetailsPageV1.test.tsx's approach: mock useEntityPermissions directly rather than
// wiring a real permissions REST boundary, since deriving flags is not this page's concern.
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

jest.mock('../../../hooks/useEntityPermissions/useEntityPermissions', () => ({
  useEntityPermissions: (...args: unknown[]) =>
    mockUseEntityPermissions(...args),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({
    fqn: 'sample_data.metric',
    entityFqn: 'sample_data.metric',
  }),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({
    currentUser: { id: 'user-1' },
  }),
}));

const mockMetric = {
  id: 'metric-id-1',
  name: 'metric',
  fullyQualifiedName: 'sample_data.metric',
  followers: [],
};

const mockGetMetricByFqn = jest.fn().mockResolvedValue(mockMetric);

jest.mock('../../../rest/metricsAPI', () => ({
  getMetricByFqn: (...args: unknown[]) => mockGetMetricByFqn(...args),
  addMetricFollower: jest.fn(),
  removeMetricFollower: jest.fn(),
  updateMetricVote: jest.fn(),
  patchMetric: jest.fn(),
}));

jest.mock('../../../utils/RecentActivityUtils', () => ({
  addToRecentViewed: jest.fn(),
}));

const mockShowErrorToast = jest.fn();
jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: (...args: unknown[]) => mockShowErrorToast(...args),
}));

jest.mock(
  '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder',
  () =>
    jest.fn().mockImplementation(({ type, permissionValue, children }) => (
      <div data-testid="error-placeholder" data-type={type}>
        {permissionValue}
        {children}
      </div>
    ))
);

jest.mock('../../../components/Metric/MetricDetails/MetricDetails', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(({ metricDetails, metricPermissions }) => (
      <div data-testid="metric-details">
        <span data-testid="metric-name">{metricDetails?.name}</span>
        <span data-testid="metric-permissions">
          {JSON.stringify(metricPermissions)}
        </span>
      </div>
    )),
}));

const renderPage = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }>
      <MemoryRouter>
        <MetricDetailsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );

describe('MetricDetailsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMetricByFqn.mockResolvedValue(mockMetric);
  });

  it('shows the page loader while permissions are loading', async () => {
    setMockPermissions({}, { isLoading: true });

    renderPage();

    expect(await screen.findByTestId('loader')).toBeInTheDocument();
    expect(mockGetMetricByFqn).not.toHaveBeenCalled();
  });

  it('surfaces a toast when the permission fetch fails', async () => {
    setMockPermissions({}, { error: new Error('permission fetch failed') });

    renderPage();

    await waitFor(() => expect(mockShowErrorToast).toHaveBeenCalled());
  });

  it('shows the permission placeholder when the user lacks view access', async () => {
    setMockPermissions({ ViewAll: false, ViewBasic: false });

    renderPage();

    const placeholder = await screen.findByTestId('error-placeholder');

    expect(placeholder).toHaveAttribute('data-type', 'PERMISSION');
    expect(mockGetMetricByFqn).not.toHaveBeenCalled();
  });

  it('fetches and renders the metric once view permission resolves', async () => {
    setMockPermissions({ ViewBasic: true, EditAll: true });

    renderPage();

    expect(await screen.findByTestId('metric-details')).toBeInTheDocument();
    expect(mockGetMetricByFqn).toHaveBeenCalledWith(
      'sample_data.metric',
      expect.objectContaining({ fields: expect.any(String) })
    );
    expect(screen.getByTestId('metric-name')).toHaveTextContent('metric');
  });

  it('passes the raw permissions object through to MetricDetails unchanged', async () => {
    setMockPermissions({
      ViewBasic: true,
      EditAll: true,
      EditDescription: false,
    });

    renderPage();

    await screen.findByTestId('metric-details');

    expect(screen.getByTestId('metric-permissions')).toHaveTextContent(
      JSON.stringify({ ViewBasic: true, EditAll: true, EditDescription: false })
    );
  });

  it('redirects to the forbidden route on a 403 entity fetch', async () => {
    setMockPermissions({ ViewBasic: true });
    mockGetMetricByFqn.mockRejectedValueOnce({
      response: { status: 403 },
    });

    renderPage();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/403', {
        replace: true,
      })
    );
  });

  it('shows the missing-entity placeholder on a 404 entity fetch', async () => {
    setMockPermissions({ ViewBasic: true });
    mockGetMetricByFqn.mockRejectedValueOnce({
      response: { status: 404 },
    });

    renderPage();

    const placeholder = await screen.findByTestId('error-placeholder');

    expect(placeholder).not.toHaveAttribute('data-type', 'PERMISSION');
    expect(screen.queryByTestId('metric-details')).not.toBeInTheDocument();
  });

  it('calls useEntityPermissions with the METRIC resource and current fqn', async () => {
    setMockPermissions({ ViewBasic: true });

    renderPage();

    await waitFor(() =>
      expect(mockUseEntityPermissions).toHaveBeenCalledWith(
        ResourceEntity.METRIC,
        'sample_data.metric',
        expect.objectContaining({ enabled: true })
      )
    );
  });
});
