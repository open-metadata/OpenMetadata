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
import {
  forwardRef,
  Fragment,
  ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
} from 'react';
import { authCoordinator } from '../../../utils/Auth/AuthCoordinator/AuthCoordinator';
import {
  getAuthErrorCode,
  isInteractionRequiredCode,
  ReauthRequiredError,
} from '../../../utils/Auth/AuthCoordinator/ReauthRequiredError';
import type { Renewer } from '../../../utils/Auth/AuthCoordinator/types';
import { EXPIRY_THRESHOLD_MILLES } from '../../../utils/AuthProvider.util';
import { setOidcToken } from '../../../utils/SwTokenStorageUtils';
import { useAuthProvider } from '../AuthProviders/AuthProvider';
import { AuthenticatorRef } from '../AuthProviders/AuthProvider.interface';

interface Props {
  children: ReactNode;
}

// Beyond the OIDC interaction codes: the in-memory cache loses its refresh
// token on reload (missing_refresh_token), a refresh token can expire or be
// rotated away (invalid_grant), and the iframe fallback times out when
// third-party cookies are blocked. A top-level redirect recovers all of them
// while the Auth0 session is alive.
const AUTH0_REAUTH_ERROR_CODES = new Set([
  'missing_refresh_token',
  'invalid_grant',
  'timeout',
]);

const isReauthRequired = (error: unknown): boolean => {
  const code = getAuthErrorCode(error);

  return (
    isInteractionRequiredCode(code) || AUTH0_REAUTH_ERROR_CODES.has(code ?? '')
  );
};

const Auth0Authenticator = forwardRef<AuthenticatorRef, Props>(
  ({ children }: Props, ref) => {
    const { handleSuccessfulLogout } = useAuthProvider();
    const {
      loginWithRedirect,
      getAccessTokenSilently,
      getIdTokenClaims,
      logout,
    } = useAuth0();

    // Bridges to the AuthCoordinator Renewer contract (auth-coordinator-refactor
    // Task 11). Kept alongside renewIdToken until every authenticator is
    // migrated and the old TokenService path is deleted. Reads the raw
    // IdToken claims directly instead of going through the setOidcToken side
    // effect renewIdToken performs — the AuthCoordinator owns storage now.
    //
    // Under @auth0/auth0-spa-js v2 (PR #35717), the default
    // `getAccessTokenSilently()` (cacheMode: 'on') short-circuits to the
    // cache whenever the ACCESS token is still valid — it never checks the
    // ID token's `exp` — and `getIdTokenClaims()` reads the cached ID token
    // with no expiry validation either. So a bare "getAccessTokenSilently()
    // then getIdTokenClaims()" renewal can resolve successfully with a
    // long-dead ID token while the cached access token is still valid
    // (default Auth0 lifetimes leave a ~14h window where the ID token is
    // expired but the access token is not). The coordinator would then
    // persist the dead token and re-arm the proactive timer with its past
    // expiry, driving a self-sustaining renew loop that ends in an
    // involuntary sign-out even though the Auth0 session and refresh token
    // are still alive.
    //
    // Read the cached ID-token claims first; only when they are missing or
    // inside the pre-expiry window do we force a real refresh grant with
    // `cacheMode: 'off'` (verified to bypass the SDK fast path and mint a
    // fresh, verified ID token) and re-read the claims. Sibling renewers
    // force a round-trip unconditionally (Okta `renewTokens()`, MSAL
    // `forceRefresh: true`, OIDC `signinSilent()`); this is the Auth0
    // equivalent.
    const getRenewer = useCallback(
      (): Renewer => async () => {
        try {
          let claims = await getIdTokenClaims();
          const expMs = (claims?.exp ?? 0) * 1000;

          // A cached-but-dead (or near-dead, or missing) ID token means the
          // SDK fast path skipped the refresh grant. Force one with
          // cacheMode: 'off' and re-read the claims it minted.
          if (!claims?.__raw || expMs <= Date.now() + EXPIRY_THRESHOLD_MILLES) {
            await getAccessTokenSilently({ cacheMode: 'off' });
            claims = await getIdTokenClaims();
          }

          if (!claims?.__raw) {
            throw new Error('Auth0 renewal returned no idToken');
          }

          return {
            idToken: claims.__raw,
            expiresAt: (claims.exp ?? 0) * 1000,
          };
        } catch (error) {
          if (isReauthRequired(error)) {
            throw new ReauthRequiredError(
              'Auth0 silent renewal needs an interactive visit to Auth0',
              error
            );
          }

          throw error;
        }
      },
      [getAccessTokenSilently, getIdTokenClaims]
    );

    useImperativeHandle(ref, () => ({
      invokeLogin() {
        loginWithRedirect().catch((error) => {
          // eslint-disable-next-line no-console
          console.error(error);
        });
      },
      async invokeLogout() {
        try {
          logout({
            openUrl: false,
          });
        } finally {
          // This will cleanup the application state
          handleSuccessfulLogout();
        }
      },
      async renewIdToken(): Promise<string> {
        let idToken = '';

        // Need to emmit error if this fails
        await getAccessTokenSilently();

        const claims = await getIdTokenClaims();
        if (claims) {
          idToken = claims.__raw;
          await setOidcToken(idToken);
        }

        return idToken;
      },
      // Auth0Callback completes it; a login_required answer signs the user
      // out there.
      async invokeSilentReauth() {
        await loginWithRedirect({
          authorizationParams: { prompt: 'none' },
          appState: {
            returnTo: `${window.location.pathname}${window.location.search}`,
          },
        });
      },
    }));

    // Register the coordinator renewer directly from this authenticator's
    // own mount effect (avoids the ref-based race in the parent).
    useEffect(() => {
      authCoordinator.registerRenewer(getRenewer());

      return () => authCoordinator.registerRenewer(null);
    }, [getRenewer]);

    return <Fragment>{children}</Fragment>;
  }
);

Auth0Authenticator.displayName = 'Auth0Authenticator';

export default Auth0Authenticator;
