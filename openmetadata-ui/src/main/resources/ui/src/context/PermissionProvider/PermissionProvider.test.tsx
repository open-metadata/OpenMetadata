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
import { render, screen, waitFor } from '@testing-library/react';
import { REDIRECT_PATHNAME } from '../../constants/router.constants';
import {
  getEntityPermissionByFqn,
  getEntityPermissionById,
  getLoggedInUserPermissions,
  getResourcePermission,
} from '../../rest/permissionAPI';
import PermissionProvider from './PermissionProvider';

const mockNavigate = jest.fn();
const mockGetCookie = jest.fn().mockReturnValue(null);
const mockRemoveCookie = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

jest.mock('cookie-storage', () => ({
  CookieStorage: jest.fn().mockImplementation(() => ({
    getItem: mockGetCookie,
    removeItem: mockRemoveCookie,
  })),
}));

jest.mock('../../rest/permissionAPI', () => ({
  getLoggedInUserPermissions: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: [] })),
  getEntityPermissionById: jest
    .fn()
    .mockImplementation(() => Promise.resolve({})),
  getEntityPermissionByFqn: jest
    .fn()
    .mockImplementation(() => Promise.resolve({})),
  getResourcePermission: jest
    .fn()
    .mockImplementation(() => Promise.resolve({})),
}));

let currentUser: {
  id: string;
  name: string;
  teams?: { id: string }[];
} | null = {
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
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCookie.mockReturnValue(null);
    currentUser = { id: '123', name: 'Test User' };
  });

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

  it('Should consume the stored redirect path only once and delete the cookie', async () => {
    mockGetCookie.mockReturnValue('/glossary/sample');

    const { rerender } = render(
      <PermissionProvider>
        <div data-testid="children">Children</div>
      </PermissionProvider>
    );

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/glossary/sample')
    );

    expect(mockRemoveCookie).toHaveBeenCalledWith(REDIRECT_PATHNAME, {
      path: '/',
    });

    // A later permission refetch — triggered by a teams/roles identity change,
    // e.g. a persona save — must not replay the redirect
    currentUser = { id: '123', name: 'Test User', teams: [] };

    rerender(
      <PermissionProvider>
        <div data-testid="children">Children</div>
      </PermissionProvider>
    );

    await waitFor(() =>
      expect(getLoggedInUserPermissions).toHaveBeenCalledTimes(2)
    );

    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('Should not navigate when the stored path is the current location', async () => {
    // jsdom's default location is http://localhost/
    mockGetCookie.mockReturnValue('/');

    render(
      <PermissionProvider>
        <div data-testid="children">Children</div>
      </PermissionProvider>
    );

    await waitFor(() => expect(getLoggedInUserPermissions).toHaveBeenCalled());

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockRemoveCookie).toHaveBeenCalledWith(REDIRECT_PATHNAME, {
      path: '/',
    });
  });
});
