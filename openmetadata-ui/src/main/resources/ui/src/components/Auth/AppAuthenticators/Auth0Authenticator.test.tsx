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
import { ReauthRequiredError } from '../../../utils/Auth/AuthCoordinator/ReauthRequiredError';
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

jest.mock('../../../utils/Auth/AuthCoordinator/AuthCoordinator', () => ({
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

    // openUrl: false is v2's local-only logout; anything else navigates to
    // Auth0's /v2/logout and ends the user's Auth0 session.
    expect(logout).toHaveBeenCalledWith({ openUrl: false });
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
    it('returns the cached fresh idToken without a refresh grant when it is still valid', async () => {
      // Under @auth0/auth0-spa-js v2 the SDK cache fast path is anchored to
      // the ACCESS token's expiry, not the ID token's. When the cached ID
      // token is still outside the pre-expiry buffer the renewer must hand
      // it straight back WITHOUT a network round-trip — otherwise every
      // proactive renewal would hit Auth0 even when the cache is healthy.
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

      // The fast path reads the cached claims exactly once and skips
      // getAccessTokenSilently entirely on this branch.
      expect(mockGetIdTokenClaims).toHaveBeenCalledTimes(1);
      expect(mockGetAccessTokenSilently).not.toHaveBeenCalled();
      expect(result).toEqual({
        idToken: 'auth0-fresh-token',
        expiresAt: exp * 1000,
      });
    });

    it('forces a refresh grant with cacheMode "off" when the cached ID token is already expired', async () => {
      // The v2 regression from PR #35717: with cacheMode 'on' the SDK
      // returns from cache whenever the ACCESS token is still valid — it
      // never checks the ID token's exp. So a bare getAccessTokenSilently()
      // would no-op and the renewer would hand back a dead ID token. The
      // fix forces cacheMode:'off' (a real refresh grant) when the cached
      // ID token is already in the past, and re-reads the claims it minted.
      const pastExp = Math.floor(Date.now() / 1000) - 3_600; // 1h ago
      const futureExp = Math.floor(Date.now() / 1000) + 3_600;
      mockGetIdTokenClaims
        .mockResolvedValueOnce({ __raw: 'auth0-dead-token', exp: pastExp })
        .mockResolvedValueOnce({ __raw: 'auth0-fresh-token', exp: futureExp });
      mockGetAccessTokenSilently.mockResolvedValueOnce(undefined);

      render(
        <Auth0Authenticator ref={createRef<AuthenticatorRef>()}>
          <div>Child</div>
        </Auth0Authenticator>
      );

      const renewer = registerRenewer.mock.calls.at(-1)?.[0];

      const result = await renewer?.();

      expect(mockGetAccessTokenSilently).toHaveBeenCalledWith({
        cacheMode: 'off',
      });
      expect(mockGetIdTokenClaims).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        idToken: 'auth0-fresh-token',
        expiresAt: futureExp * 1000,
      });
    });

    it('forces a refresh grant when the cached ID token is inside the pre-expiry buffer', async () => {
      // Even though not yet past, a token inside EXPIRY_THRESHOLD_MILLES
      // must be rotated rather than handed back — the proactive timer
      // would otherwise re-fire inside the buffer and the next 401 would
      // carry a token already on the brink.
      const nearExp = Math.floor(Date.now() / 1000) + 30; // 30s out < 60s leeway
      const futureExp = Math.floor(Date.now() / 1000) + 3_600;
      mockGetIdTokenClaims
        .mockResolvedValueOnce({ __raw: 'auth0-near-token', exp: nearExp })
        .mockResolvedValueOnce({ __raw: 'auth0-fresh-token', exp: futureExp });
      mockGetAccessTokenSilently.mockResolvedValueOnce(undefined);

      render(
        <Auth0Authenticator ref={createRef<AuthenticatorRef>()}>
          <div>Child</div>
        </Auth0Authenticator>
      );

      const renewer = registerRenewer.mock.calls.at(-1)?.[0];

      const result = await renewer?.();

      expect(mockGetAccessTokenSilently).toHaveBeenCalledWith({
        cacheMode: 'off',
      });
      expect(result).toEqual({
        idToken: 'auth0-fresh-token',
        expiresAt: futureExp * 1000,
      });
    });

    it('forces a refresh grant when no cached ID token is present', async () => {
      // A cold cache (or one evicted by a service-worker restart) returns
      // undefined from getIdTokenClaims() — the renewer must still mint a
      // fresh token instead of bailing out.
      const futureExp = Math.floor(Date.now() / 1000) + 3_600;
      mockGetIdTokenClaims
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ __raw: 'auth0-fresh-token', exp: futureExp });
      mockGetAccessTokenSilently.mockResolvedValueOnce(undefined);

      render(
        <Auth0Authenticator ref={createRef<AuthenticatorRef>()}>
          <div>Child</div>
        </Auth0Authenticator>
      );

      const renewer = registerRenewer.mock.calls.at(-1)?.[0];

      const result = await renewer?.();

      expect(mockGetAccessTokenSilently).toHaveBeenCalledWith({
        cacheMode: 'off',
      });
      expect(result).toEqual({
        idToken: 'auth0-fresh-token',
        expiresAt: futureExp * 1000,
      });
    });

    it('throws when no idToken is available even after forcing a refresh grant', async () => {
      // The forced grant ran but the SDK still handed back no claims —
      // the renewer must not synthesise a fake token, it must throw so
      // the coordinator surfaces refresh-failed.
      mockGetIdTokenClaims
        .mockResolvedValueOnce(undefined) // nothing cached → force the grant
        .mockResolvedValueOnce(undefined); // grant ran, still no token
      mockGetAccessTokenSilently.mockResolvedValueOnce(undefined);

      render(
        <Auth0Authenticator ref={createRef<AuthenticatorRef>()}>
          <div>Child</div>
        </Auth0Authenticator>
      );

      const renewer = registerRenewer.mock.calls.at(-1)?.[0];

      await expect(renewer?.()).rejects.toThrow(
        'Auth0 renewal returned no idToken'
      );
      expect(mockGetAccessTokenSilently).toHaveBeenCalledWith({
        cacheMode: 'off',
      });
    });

    it('translates a reauth error from the forced refresh grant into ReauthRequiredError', async () => {
      // The forced grant is the call that can now fail with interaction-
      // required codes (the cache fast path used to mask them). Those must
      // still surface as ReauthRequiredError so AuthProvider silent-reauths
      // instead of signing the user out.
      const pastExp = Math.floor(Date.now() / 1000) - 3_600;
      mockGetIdTokenClaims.mockResolvedValueOnce({
        __raw: 'auth0-dead-token',
        exp: pastExp,
      });
      mockGetAccessTokenSilently.mockImplementationOnce(() =>
        Promise.reject(
          Object.assign(new Error('login_required'), {
            error: 'login_required',
          })
        )
      );

      render(
        <Auth0Authenticator ref={createRef<AuthenticatorRef>()}>
          <div>Child</div>
        </Auth0Authenticator>
      );

      const renewer = registerRenewer.mock.calls.at(-1)?.[0];

      await expect(renewer?.()).rejects.toBeInstanceOf(ReauthRequiredError);
      expect(mockGetAccessTokenSilently).toHaveBeenCalledWith({
        cacheMode: 'off',
      });
    });

    it('rethrows non-reauth errors from the forced refresh grant', async () => {
      // A network failure inside the forced grant is not something a
      // redirect can fix; surface it verbatim so the coordinator's
      // refresh-failed path drives the (bounded) circuit-breaker.
      const pastExp = Math.floor(Date.now() / 1000) - 3_600;
      mockGetIdTokenClaims.mockResolvedValueOnce({
        __raw: 'auth0-dead-token',
        exp: pastExp,
      });
      const networkError = new Error('Failed to fetch');
      mockGetAccessTokenSilently.mockImplementationOnce(() =>
        Promise.reject(networkError)
      );

      render(
        <Auth0Authenticator ref={createRef<AuthenticatorRef>()}>
          <div>Child</div>
        </Auth0Authenticator>
      );

      const renewer = registerRenewer.mock.calls.at(-1)?.[0];

      await expect(renewer?.()).rejects.toBe(networkError);
      expect(mockGetAccessTokenSilently).toHaveBeenCalledWith({
        cacheMode: 'off',
      });
    });

    it.each([
      'login_required',
      'consent_required',
      'interaction_required',
      'missing_refresh_token',
      'invalid_grant',
      'timeout',
    ])(
      'should ask for re-authentication when Auth0 answers %s',
      async (error) => {
        // With cacheLocation "memory" a reload loses the refresh token, and
        // the iframe fallback is blocked with third-party cookies; a
        // top-level redirect still rides the Auth0 session.
        mockGetAccessTokenSilently.mockImplementationOnce(() =>
          Promise.reject(Object.assign(new Error(error), { error }))
        );
        render(
          <Auth0Authenticator ref={createRef<AuthenticatorRef>()}>
            <div>Child</div>
          </Auth0Authenticator>
        );

        const renewer = registerRenewer.mock.calls.at(-1)?.[0];

        await expect(renewer?.()).rejects.toBeInstanceOf(ReauthRequiredError);
      }
    );

    it('should rethrow failures a redirect cannot fix', async () => {
      const networkError = new Error('Failed to fetch');
      mockGetAccessTokenSilently.mockImplementationOnce(() =>
        Promise.reject(networkError)
      );
      render(
        <Auth0Authenticator ref={createRef<AuthenticatorRef>()}>
          <div>Child</div>
        </Auth0Authenticator>
      );

      const renewer = registerRenewer.mock.calls.at(-1)?.[0];

      await expect(renewer?.()).rejects.toBe(networkError);
    });
  });

  it('invokeSilentReauth redirects to Auth0 with prompt=none and returns to the current page', async () => {
    const ref = createRef<AuthenticatorRef>();
    render(
      <Auth0Authenticator ref={ref}>
        <div>Child</div>
      </Auth0Authenticator>
    );

    await act(async () => {
      await ref.current?.invokeSilentReauth?.();
    });

    expect(loginWithRedirect).toHaveBeenCalledWith({
      authorizationParams: { prompt: 'none' },
      appState: {
        returnTo: `${window.location.pathname}${window.location.search}`,
      },
    });
  });
});
