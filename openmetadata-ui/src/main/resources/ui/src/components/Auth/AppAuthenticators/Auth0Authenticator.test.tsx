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
import React, { createRef } from 'react';
import { AuthProvider } from '../../../generated/settings/settings';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { AccessTokenResponse } from '../../../rest/auth-API';
import { setOidcToken } from '../../../utils/LocalStorageUtils';
import { AuthenticatorRef } from '../AuthProviders/AuthProvider.interface';
import Auth0Authenticator from './Auth0Authenticator';

// Mocks
const loginWithRedirect = jest.fn().mockImplementation(() => Promise.resolve());
const mockGetAccessTokenSilently = jest
  .fn()
  .mockImplementation(() => Promise.resolve());
const mockGetIdTokenClaims = jest.fn(() =>
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

const setIsAuthenticated = jest.fn();
const authConfig = { provider: AuthProvider.Auth0 };

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest
    .fn()
    .mockImplementation(() => ({ setIsAuthenticated, authConfig })),
}));

const handleSuccessfulLogout = jest.fn();
jest.mock('../AuthProviders/AuthProvider', () => ({
  useAuthProvider: () => ({ handleSuccessfulLogout }),
}));

jest.mock('../../../utils/LocalStorageUtils', () => ({
  setOidcToken: jest.fn(),
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
    expect(setIsAuthenticated).toHaveBeenCalledWith(false);
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

  it('should reject if provider is not Auth0', async () => {
    // Override useApplicationStore to return a different provider

    (useApplicationStore as unknown as jest.Mock).mockImplementationOnce(
      () => ({
        setIsAuthenticated,
        authConfig: { provider: 'other' },
      })
    );

    const ref = createRef<any>();
    render(
      <Auth0Authenticator ref={ref}>
        <div>Child</div>
      </Auth0Authenticator>
    );

    await expect(ref.current.renewIdToken()).rejects.toMatch(
      'server.auth-provider-not-supported-renewing'
    );
  });

  it('should reject if authConfig is missing', async () => {
    (useApplicationStore as unknown as jest.Mock).mockImplementationOnce(
      () => ({
        setIsAuthenticated,
        authConfig: undefined,
      })
    );

    const ref = createRef<AuthenticatorRef>();
    render(
      <Auth0Authenticator ref={ref}>
        <div>Child</div>
      </Auth0Authenticator>
    );

    await expect(ref.current?.renewIdToken()).rejects.toMatch(
      'server.can-not-renew-token-authentication-not-present'
    );
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

    await expect(ref.current?.renewIdToken()).rejects.toMatch(
      'server.error-while-renewing-id-token-with-message'
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

    await expect(ref.current?.renewIdToken()).rejects.toMatch(
      'server.error-while-renewing-id-token-with-message'
    );
  });
});
