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
import { authCoordinator, Renewer } from '../../../utils/Auth/AuthCoordinator';
import { isPlaywrightBuild } from '../../../utils/isPlaywrightBuild';
import { setOidcToken } from '../../../utils/SwTokenStorageUtils';
import { useAuthProvider } from '../AuthProviders/AuthProvider';
import { AuthenticatorRef } from '../AuthProviders/AuthProvider.interface';

interface Props {
  children: ReactNode;
}

// Test-only escape hatch. Playwright's `auth0-mock` fixture pre-populates
// `window.__omTestAuth0` via `page.addInitScript` with a shim exposing the
// same surface `useAuth0()` returns — `loginWithRedirect`,
// `getAccessTokenSilently`, `getIdTokenClaims`, and `logout`. When present,
// we use that instead of the real auth0-react context so the Playwright
// suite can exercise this component's login / renew branches without a live
// Auth0 tenant.
//
// Activation is a runtime-only opt-in — see MsalAuthenticator for the full
// rationale. Vite inlines NODE_ENV as 'production' for `vite build`
// (including the CI SSO leg), which previously tree-shook the shim entirely
// and made every auth0-mock scenario time out. Keep the branch reachable in
// prod; the `window.__omTestAuth0` runtime check is what actually enforces
// test-only activation (only Playwright's addInitScript sets it, pre-app).
// `useAuth0()` is still always called to satisfy the Rules of Hooks; only
// its return value is swapped.
type Auth0ContextShape = ReturnType<typeof useAuth0>;

const readTestAuth0Override = (): Auth0ContextShape | undefined => {
  // Second gate on top of the runtime `window.__omTestAuth0` presence check.
  // `isPlaywrightBuild()` reads Vite's build-time `PW_E2E_BUILD` flag (set
  // exclusively by the Playwright build pipelines) — in any other bundle,
  // including prod, the constant folds to `false` and this whole function
  // tree-shakes to `undefined`, so the shim can't be turned on even if an
  // attacker manages to set the window global. Isolated in its own module
  // so ts-jest doesn't have to parse `import.meta`.
  if (!isPlaywrightBuild()) {
    return undefined;
  }
  if (typeof window === 'undefined') {
    return undefined;
  }

  return (window as unknown as { __omTestAuth0?: Auth0ContextShape })
    .__omTestAuth0;
};

const Auth0Authenticator = forwardRef<AuthenticatorRef, Props>(
  ({ children }: Props, ref) => {
    const { handleSuccessfulLogout } = useAuthProvider();
    const realAuth0 = useAuth0();
    const testAuth0 = readTestAuth0Override();
    const {
      loginWithRedirect,
      getAccessTokenSilently,
      getIdTokenClaims,
      logout,
    } = testAuth0 ?? realAuth0;

    // Bridges to the AuthCoordinator Renewer contract (auth-coordinator-refactor
    // Task 11). Kept alongside renewIdToken until every authenticator is
    // migrated and the old TokenService path is deleted. Reads the raw
    // IdToken claims directly instead of going through the setOidcToken side
    // effect renewIdToken performs — the AuthCoordinator owns storage now.
    const getRenewer = useCallback(
      (): Renewer => async () => {
        await getAccessTokenSilently();

        const claims = await getIdTokenClaims();

        if (!claims?.__raw) {
          throw new Error('Auth0 renewal returned no idToken');
        }

        return {
          idToken: claims.__raw,
          expiresAt: (claims.exp ?? 0) * 1000,
        };
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
            localOnly: true,
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
