/*
 *  Copyright 2022 Collate.
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

import { useAuth0 } from '@auth0/auth0-react';
import { render, screen } from '@testing-library/react';

import { MemoryRouter } from 'react-router-dom';
import Auth0Callback from './Auth0Callback';

const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem(key: string) {
      return store[key] || '';
    },
    setItem(key: string, value: string) {
      store[key] = value.toString();
    },
    removeItem(key: string) {
      delete store[key];
    },
    clear() {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

const mockUseAuth0 = useAuth0 as jest.Mock;
const mockHandleSuccessfulLogin = jest.fn();

jest.mock('@auth0/auth0-react', () => ({
  useAuth0: jest.fn(),
}));

jest.mock('../../../../hooks/useApplicationStore', () => {
  return {
    useApplicationStore: jest.fn(() => ({
      authConfig: {},
    })),
  };
});

jest.mock('../../AuthProviders/AuthProvider', () => ({
  useAuthProvider: jest.fn().mockImplementation(() => ({
    handleSuccessfulLogin: mockHandleSuccessfulLogin,
  })),
}));

jest.mock('../../../../utils/LocalStorageUtils', () => ({
  setOidcToken: jest.fn(),
}));

describe('Test Auth0Callback component', () => {
  afterEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  it('Check if the Auth0Callback renders error from Auth0', async () => {
    mockUseAuth0.mockReturnValue({
      isAuthenticated: false,
      error: { message: 'unknown error' },
      user: {},
    });
    render(<Auth0Callback />, {
      wrapper: MemoryRouter,
    });
    const error = screen.getByTestId('auth0-error');

    expect(error).toHaveTextContent('server.unexpected-error');
    expect(error).toHaveTextContent('unknown error');
  });

  it('Should call successful login handler on Success', async () => {
    mockUseAuth0.mockReturnValue({
      isAuthenticated: true,
      getIdTokenClaims: jest.fn(() =>
        Promise.resolve({ __raw: 'raw_id_token' })
      ),
      user: {
        email: 'test_email',
        name: 'test_user',
        picture: 'test_picture',
        locale: 'test_locale',
      },
    });
    render(<Auth0Callback />, {
      wrapper: MemoryRouter,
    });

    expect(screen.queryByTestId('auth0-error')).not.toBeInTheDocument();

    // wait until all the promises in the component have been resolved
    // eslint-disable-next-line no-undef
    await new Promise(process.nextTick);

    expect(mockHandleSuccessfulLogin).toHaveBeenCalledTimes(1);
    expect(mockHandleSuccessfulLogin).toHaveBeenCalledWith({
      id_token: 'raw_id_token',
      profile: {
        email: 'test_email',
        name: 'test_user',
        picture: 'test_picture',
        locale: 'test_locale',
        sub: '',
      },
      scope: '',
    });
  });
});
