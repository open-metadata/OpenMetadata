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
import { getApiEndPointByFQN } from '../../rest/apiEndpointsAPI';
import { renderWithQueryClient } from '../../test/unit/test-utils';
import { getDerivedPermissionFlags } from '../../utils/PermissionDerivation';
import APIEndpointPage from './APIEndpointPage';

const mockApiEndpoint = {
  id: 'api-endpoint-id',
  name: 'test-api-endpoint',
  fullyQualifiedName: 'sample_api_service.test-api-endpoint',
  displayName: 'Test API Endpoint',
  version: 1,
  followers: [],
};

const mockAPIEndpointDetails = jest.fn().mockImplementation((props) => (
  <div>
    APIEndpointDetails.component
    <span data-testid="edit-all-permission">
      {String(props.apiEndpointPermissions?.EditAll)}
    </span>
  </div>
));

jest.mock('../../rest/apiEndpointsAPI', () => ({
  getApiEndPointByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockApiEndpoint)),
  patchApiEndPoint: jest.fn().mockImplementation(() => Promise.resolve({})),
  addApiEndpointFollower: jest
    .fn()
    .mockImplementation(() => Promise.resolve({})),
  removeApiEndpointFollower: jest
    .fn()
    .mockImplementation(() => Promise.resolve({})),
  updateApiEndPointVote: jest
    .fn()
    .mockImplementation(() => Promise.resolve({})),
}));

jest.mock(
  '../../components/APIEndpoint/APIEndpointDetails/APIEndpointDetails',
  () => jest.fn().mockImplementation((props) => mockAPIEndpointDetails(props))
);

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest
    .fn()
    .mockImplementation(() => ({ entityFqn: 'testApiEndpointFqn' })),
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
      <APIEndpointPage />
    </MemoryRouter>
  );

describe('APIEndpointPage component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMockPermissions({ ViewAll: true, ViewBasic: true });
  });

  it('should render APIEndpointDetails once permissions and data resolve', async () => {
    await act(async () => {
      renderPage();
    });

    await waitFor(() =>
      expect(
        screen.getByText('APIEndpointDetails.component')
      ).toBeInTheDocument()
    );
  });

  it('calls useEntityPermissions with the resource and decoded fqn', async () => {
    await act(async () => {
      renderPage();
    });

    expect(mockUseEntityPermissions).toHaveBeenCalledWith(
      ResourceEntity.API_ENDPOINT,
      'testApiEndpointFqn',
      expect.objectContaining({ enabled: true })
    );
  });

  it('passes the raw permissions object through to APIEndpointDetails', async () => {
    setMockPermissions({ ViewAll: true, ViewBasic: true, EditAll: true });

    await act(async () => {
      renderPage();
    });

    await waitFor(() =>
      expect(screen.getByTestId('edit-all-permission')).toHaveTextContent(
        'true'
      )
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
    expect(getApiEndPointByFQN).not.toHaveBeenCalled();
  });
});
