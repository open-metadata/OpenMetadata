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

import { act, render } from '@testing-library/react';
import { createRef } from 'react';
import { AccessTokenResponse } from '../../../rest/auth-API';
import { setOidcToken } from '../../../utils/SwTokenStorageUtils';
import { AuthenticatorRef } from '../AuthProviders/AuthProvider.interface';
import Auth0Authenticator from './Auth0Authenticator';

// Mocks
const loginWithRedirect = jest.fn().mockImplementation(() => Promise.resolve());
const mockGetAccessTokenSilently = jest
  .fn()
  .mockImplementation(() => Promise.resolve());
const mockGetIdTokenClaims = jest.fn(
  (): Promise<{ __raw: string; exp?: number } | undefined> =>
    Promise.resolve({ __raw: 'mock-id-token' })
);
const logout = jest.fn();

jest.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    loginWithRedirect,
    getAccessTokenSilently: mockGetAccessTokenSilently,
    getIdTokenClaims: mockGetIdTokenClaims,
    logout,
  }),
}));

const handleSuccessfulLogout = jest.fn();
jest.mock('../AuthProviders/AuthProvider', () => ({
  useAuthProvider: () => ({ handleSuccessfulLogout }),
}));

jest.mock('../../../utils/SwTokenStorageUtils', () => ({
  setOidcToken: jest.fn(),
}));

const registerRenewer = jest.fn();

jest.mock('../../../utils/Auth/AuthCoordinator', () => ({
  authCoordinator: {
    registerRenewer: (renewer: unknown) => registerRenewer(renewer),
  },
}));

describe('Auth0Authenticator', () => {
  it('should render children', () => {
    const { getByText } = render(
      <Auth0Authenticator ref={null}>
        <div>Child</div>
      </Auth0Authenticator>
    );

    expect(getByText('Child')).toBeInTheDocument();
  });

  it('should call loginWithRedirect on invokeLogin', () => {
    const ref = createRef<AuthenticatorRef>();
    render(
      <Auth0Authenticator ref={ref}>
        <div>Child</div>
      </Auth0Authenticator>
    );
    act(() => {
      ref.current?.invokeLogin();
    });

    expect(loginWithRedirect).toHaveBeenCalled();
  });

  it('should call logout, setIsAuthenticated(false), and handleSuccessfulLogout on invokeLogout', () => {
    const ref = createRef<AuthenticatorRef>();
    render(
      <Auth0Authenticator ref={ref}>
        <div>Child</div>
      </Auth0Authenticator>
    );
    act(() => {
      ref.current?.invokeLogout();
    });

    expect(logout).toHaveBeenCalled();
    expect(handleSuccessfulLogout).toHaveBeenCalled();
  });

  it('should resolve with id token and setOidcToken on renewIdToken (Auth0)', async () => {
    const ref = createRef<AuthenticatorRef>();
    mockGetIdTokenClaims.mockImplementationOnce(() =>
      Promise.resolve({ __raw: 'mock-id-token' })
    );
    render(
      <Auth0Authenticator ref={ref}>
        <div>Child</div>
      </Auth0Authenticator>
    );
    let result: string | AccessTokenResponse | void = '';
    await act(async () => {
      result = await ref.current?.renewIdToken();
    });

    expect(mockGetAccessTokenSilently).toHaveBeenCalled();
    expect(mockGetIdTokenClaims).toHaveBeenCalled();
    expect(setOidcToken).toHaveBeenCalledWith('mock-id-token');
    expect(result).toBe('mock-id-token');
  });

  it('should reject if getAccessTokenSilently throws', async () => {
    mockGetAccessTokenSilently.mockImplementationOnce(() =>
      Promise.reject(new Error('access error'))
    );
    const ref = createRef<AuthenticatorRef>();
    render(
      <Auth0Authenticator ref={ref}>
        <div>Child</div>
      </Auth0Authenticator>
    );

    await expect(ref.current?.renewIdToken()).rejects.toThrow(
      new Error('access error')
    );
  });

  it('should reject if getIdTokenClaims throws', async () => {
    mockGetIdTokenClaims.mockImplementationOnce(() =>
      Promise.reject(new Error('claims error'))
    );
    const ref = createRef<AuthenticatorRef>();
    render(
      <Auth0Authenticator ref={ref}>
        <div>Child</div>
      </Auth0Authenticator>
    );

    await expect(ref.current?.renewIdToken()).rejects.toThrow(
      new Error('claims error')
    );
  });

  describe('getRenewer', () => {
    it('should return a fresh idToken and expiresAt (ms) on success', async () => {
      const exp = Math.floor(Date.now() / 1000) + 300;
      mockGetIdTokenClaims.mockImplementationOnce(() =>
        Promise.resolve({ __raw: 'auth0-fresh-token', exp })
      );
      const ref = createRef<AuthenticatorRef>();
      render(
        <Auth0Authenticator ref={ref}>
          <div>Child</div>
        </Auth0Authenticator>
      );

      const renewer = registerRenewer.mock.calls.at(-1)?.[0];

      expect(renewer).toBeDefined();

      const result = await renewer?.();

      expect(mockGetAccessTokenSilently).toHaveBeenCalled();
      expect(mockGetIdTokenClaims).toHaveBeenCalled();
      expect(result).toEqual({
        idToken: 'auth0-fresh-token',
        expiresAt: exp * 1000,
      });
    });

    it('should throw when claims have no __raw token', async () => {
      mockGetIdTokenClaims.mockImplementationOnce(() =>
        Promise.resolve(undefined)
      );
      const ref = createRef<AuthenticatorRef>();
      render(
        <Auth0Authenticator ref={ref}>
          <div>Child</div>
        </Auth0Authenticator>
      );

      const renewer = registerRenewer.mock.calls.at(-1)?.[0];

      await expect(renewer?.()).rejects.toThrow(
        'Auth0 renewal returned no idToken'
      );
    });
  });
});
