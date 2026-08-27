/*
 *  Copyright 2023 Collate.
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
import { act, render, screen, waitFor } from '@testing-library/react';
import { permissionQueryKeys } from '../../hooks/useEntityPermissions/permissionQueryKeys';
import { queryClient } from '../../queryClient';
import {
  getEntityPermissionByFqn,
  getEntityPermissionById,
  getLoggedInUserPermissions,
  getResourcePermission,
} from '../../rest/permissionAPI';
import PermissionProvider, { usePermissionProvider } from './PermissionProvider';
import { ResourceEntity } from './PermissionProvider.interface';

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => jest.fn()),
}));

jest.mock('../../rest/permissionAPI', () => ({
  getLoggedInUserPermissions: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: [] })),
  getEntityPermissionById: jest
    .fn()
    .mockImplementation(() => Promise.resolve({})),
  // Shaped as a ResourcePermission so getOperationPermissions (called from
  // the provider's fetchQuery queryFn) can reduce over `.permissions`
  // without throwing.
  getEntityPermissionByFqn: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve({ resource: 'table', permissions: [] })
    ),
  getResourcePermission: jest
    .fn()
    .mockImplementation(() => Promise.resolve({})),
}));

let currentUser: { id: string; name: string } | null = {
  id: '123',
  name: 'Test User',
};

jest.mock('../../hooks/useApplicationStore', () => {
  return {
    useApplicationStore: jest.fn().mockImplementation(() => ({
      currentUser,
    })),
  };
});

jest.mock('../../components/common/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <p>Loader</p>);
});

describe('PermissionProvider', () => {
  it('Should render loader and call getLoggedInUserPermissions', async () => {
    render(
      <PermissionProvider>
        <div data-testid="children">Children</div>
      </PermissionProvider>
    );

    // Verify that the API methods were called
    expect(getLoggedInUserPermissions).toHaveBeenCalled();

    expect(screen.getByText('Loader')).toBeInTheDocument();
  });

  it('Should render children and call apis when current user is present', async () => {
    render(
      <PermissionProvider>
        <div data-testid="children">Children</div>
      </PermissionProvider>
    );

    // Verify that the API methods were called
    expect(getLoggedInUserPermissions).toHaveBeenCalled();
    expect(getEntityPermissionById).not.toHaveBeenCalled();
    expect(getEntityPermissionByFqn).not.toHaveBeenCalled();
    expect(getResourcePermission).not.toHaveBeenCalled();

    expect(await screen.findByTestId('children')).toBeInTheDocument();
  });

  it('Should not call apis when current user is undefined', async () => {
    currentUser = null;
    render(
      <PermissionProvider>
        <div data-testid="children">Children</div>
      </PermissionProvider>
    );

    // Verify that the API methods were not called
    expect(getLoggedInUserPermissions).not.toHaveBeenCalled();
    expect(getEntityPermissionById).not.toHaveBeenCalled();
    expect(getEntityPermissionByFqn).not.toHaveBeenCalled();
    expect(getResourcePermission).not.toHaveBeenCalled();

    expect(screen.queryByText('Loader')).not.toBeInTheDocument();
    expect(await screen.findByTestId('children')).toBeInTheDocument();
  });
});

const Probe = () => {
  const { getEntityPermissionByFqn: fetchByFqn } = usePermissionProvider();

  return (
    <button
      aria-label="fetch"
      data-testid="fetch"
      onClick={() => fetchByFqn(ResourceEntity.TABLE, 'fqn1')}
    />
  );
};

describe('PermissionProvider on the React Query cache', () => {
  beforeEach(() => {
    // A prior test in this file (`current user is undefined`) mutates the
    // shared `currentUser` closure and never restores it — reset here so
    // this block doesn't depend on suite execution order.
    currentUser = { id: '123', name: 'Test User' };
    queryClient.clear();
    jest.clearAllMocks();
  });

  it('caches through queryClient: second fetch is free, invalidation forces a refetch', async () => {
    render(
      <PermissionProvider>
        <Probe />
      </PermissionProvider>
    );

    await waitFor(() => screen.getByTestId('fetch'));

    await act(async () => screen.getByTestId('fetch').click());
    await act(async () => screen.getByTestId('fetch').click()); // warm cache

    expect(getEntityPermissionByFqn).toHaveBeenCalledTimes(1);

    // The cache entry lives under the SHARED key — the same one
    // useEntityPermissions uses — so hook-side invalidation reaches it.
    expect(
      queryClient.getQueryData(
        permissionQueryKeys.entity(ResourceEntity.TABLE, 'fqn1')
      )
    ).toBeDefined();

    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: permissionQueryKeys.entity(ResourceEntity.TABLE, 'fqn1'),
      });
    });

    await act(async () => screen.getByTestId('fetch').click());

    expect(getEntityPermissionByFqn).toHaveBeenCalledTimes(2);
  });
});
