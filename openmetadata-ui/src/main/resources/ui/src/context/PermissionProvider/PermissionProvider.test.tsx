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
import { render, screen } from '@testing-library/react';
import { CookieStorage } from 'cookie-storage';
import { BrowserRouter } from 'react-router-dom';
import { REDIRECT_PATHNAME } from '../../constants/router.constants';
import {
  getEntityPermissionByFqn,
  getEntityPermissionById,
  getLoggedInUserPermissions,
  getResourcePermission,
} from '../../rest/permissionAPI';
import PermissionProvider from './PermissionProvider';

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
  beforeEach(() => {
    currentUser = { id: '123', name: 'Test User' };
    window.history.replaceState(null, '', '/');
    new CookieStorage().removeItem(REDIRECT_PATHNAME, { path: '/' });
  });

  afterEach(() => {
    new CookieStorage().removeItem(REDIRECT_PATHNAME, { path: '/' });
  });

  it('Should render loader and call getLoggedInUserPermissions', async () => {
    render(
      <PermissionProvider>
        <div data-testid="children">Children</div>
      </PermissionProvider>,
      { wrapper: BrowserRouter }
    );

    // Verify that the API methods were called
    expect(getLoggedInUserPermissions).toHaveBeenCalled();

    expect(screen.getByText('Loader')).toBeInTheDocument();
  });

  it('Should render children and call apis when current user is present', async () => {
    render(
      <PermissionProvider>
        <div data-testid="children">Children</div>
      </PermissionProvider>,
      { wrapper: BrowserRouter }
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
      </PermissionProvider>,
      { wrapper: BrowserRouter }
    );

    // Verify that the API methods were not called
    expect(getLoggedInUserPermissions).not.toHaveBeenCalled();
    expect(getEntityPermissionById).not.toHaveBeenCalled();
    expect(getEntityPermissionByFqn).not.toHaveBeenCalled();
    expect(getResourcePermission).not.toHaveBeenCalled();

    expect(screen.queryByText('Loader')).not.toBeInTheDocument();
    expect(await screen.findByTestId('children')).toBeInTheDocument();
  });

  it('preserves the current graph view when permissions replay its pathname', async () => {
    const pathname = '/table/warehouse.orders/knowledge_graph';
    const search = '?fullscreen=true&graphMode=ontology';
    window.history.replaceState(null, '', pathname + search + '#graph');
    new CookieStorage().setItem(REDIRECT_PATHNAME, pathname, { path: '/' });

    render(
      <PermissionProvider>
        <div data-testid="children">Children</div>
      </PermissionProvider>,
      { wrapper: BrowserRouter }
    );

    expect(await screen.findByTestId('children')).toBeInTheDocument();
    expect(window.location.pathname).toBe(pathname);
    expect(window.location.search).toBe(search);
    expect(window.location.hash).toBe('#graph');
  });

  it('redirects to the stored pathname when permissions load on another page', async () => {
    const pathname = '/table/warehouse.orders/knowledge_graph';
    window.history.replaceState(null, '', '/signin');
    new CookieStorage().setItem(REDIRECT_PATHNAME, pathname, { path: '/' });

    render(
      <PermissionProvider>
        <div data-testid="children">Children</div>
      </PermissionProvider>,
      { wrapper: BrowserRouter }
    );

    expect(await screen.findByTestId('children')).toBeInTheDocument();
    expect(window.location.pathname).toBe(pathname);
  });
});
