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

import {
  InteractionRequiredAuthError,
  InteractionStatus,
} from '@azure/msal-browser';
import { useAccount, useMsal } from '@azure/msal-react';
import {
  forwardRef,
  Fragment,
  ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { authCoordinator } from '../../../utils/Auth/AuthCoordinator/AuthCoordinator';
import {
  getAuthErrorCode,
  ReauthRequiredError,
} from '../../../utils/Auth/AuthCoordinator/ReauthRequiredError';
import type { Renewer } from '../../../utils/Auth/AuthCoordinator/types';
import {
  msalLoginRequest,
  parseMSALResponse,
} from '../../../utils/AuthProvider.util';
import { isPlaywrightBuild } from '../../../utils/isPlaywrightBuild';
import Loader from '../../common/Loader/Loader';
import { useAuthProvider } from '../AuthProviders/AuthProvider';
import {
  AuthenticatorRef,
  OidcUser,
} from '../AuthProviders/AuthProvider.interface';
interface Props {
  children: ReactNode;
}

// Test-only escape hatch. Playwright's `msal-mock` fixture pre-populates
// `window.__omTestMsal` via `page.addInitScript` with a shim that returns the
// same shape `useMsal()` does — an `instance` exposing `loginRedirect`,
// `loginPopup`, `acquireTokenSilent`, `acquireTokenPopup`, and
// `handleRedirectPromise`. When present, we use that instead of the real
// react-msal context so the Playwright suite can exercise this component's
// login / renew / redirect branches without a live Azure AD tenant.
//
// Activation is guarded by a runtime opt-in only: the shim reads
// `window.__omTestMsal`, and that global is set exclusively by Playwright's
// `page.addInitScript`, which fires BEFORE any app JS in an isolated test
// browser context. A real prod user has no way to set it before the bundle
// runs — the only vectors (bookmarklet / dev-tools / pre-app XSS) already
// imply attacker JS execution, which is a bigger problem than swapping
// MSAL's return value. Previously this was gated on
// `process.env.NODE_ENV !== 'production'`, but Vite inlines NODE_ENV as
// 'production' for any `vite build` — including the CI SSO leg — so the
// entire branch tree-shook out of the SSO Playwright bundle and every
// mock-fixture scenario timed out on the sidebar. Keep the shim reachable
// in prod bundles; the runtime opt-in is what actually enforces
// test-only activation.
type MsalContextShape = ReturnType<typeof useMsal>;

const readTestMsalOverride = (): MsalContextShape | undefined => {
  // Second gate on top of the runtime `window.__omTestMsal` presence check.
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

  return (window as unknown as { __omTestMsal?: MsalContextShape })
    .__omTestMsal;
};

// MSAL reports "needs a visit to Entra" either as an
// InteractionRequiredAuthError (Entra's own answer) or as a BrowserAuthError
// when the hidden renewal iframe could not run at all (third-party cookies
// blocked, monitor_window_timeout). Matching on errorCode as well lets the
// Playwright MSAL mock, which cannot construct MSAL error classes, drive the
// same branch.
const MSAL_REAUTH_ERROR_CODES = new Set([
  'interaction_required',
  'login_required',
  'consent_required',
  'no_account_error',
  'monitor_window_timeout',
  'block_iframe_reload',
]);

const isReauthRequired = (error: unknown): boolean =>
  error instanceof InteractionRequiredAuthError ||
  MSAL_REAUTH_ERROR_CODES.has(getAuthErrorCode(error) ?? '');

// The bearer OpenMetadata sees is the ID token, so renewal is scheduled off its
// expiry; `expiresOn` belongs to the access token, which Entra often issues for
// longer.
const readIdTokenExpiresAt = (idTokenClaims: object | undefined) => {
  const exp = (idTokenClaims as { exp?: unknown } | undefined)?.exp;

  return typeof exp === 'number' ? exp * 1000 : undefined;
};

const MsalAuthenticator = forwardRef<AuthenticatorRef, Props>(
  ({ children }: Props, ref) => {
    const realMsal = useMsal();
    const testMsal = readTestMsalOverride();
    const { instance, accounts, inProgress } = testMsal ?? realMsal;
    const account = useAccount(accounts[0] || {});
    const { handleSuccessfulLogin, handleFailedLogin, handleSuccessfulLogout } =
      useAuthProvider();

    const login = async () => {
      try {
        const isInIframe = window.self !== window.top;

        if (isInIframe) {
          // Use popup login when in iframe to avoid redirect issues
          const response = await instance.loginPopup(msalLoginRequest);
          const msalResponse = await parseMSALResponse(response);

          handleSuccessfulLogin(msalResponse);
        } else {
          // Use login with redirect for normal window context
          await instance.loginRedirect(msalLoginRequest);
        }
      } catch {
        handleFailedLogin();
      }
    };

    const logout = async () => {
      try {
        for (const key in localStorage) {
          if (key.includes('-login.windows.net-') || key.startsWith('msal.')) {
            localStorage.removeItem(key);
          }
        }
      } finally {
        // Cleanup application state
        handleSuccessfulLogout();
      }
    };

    const fetchIdToken = async (
      shouldFallbackToPopup = false
    ): Promise<OidcUser> => {
      const tokenRequest = {
        account: account || accounts[0],
        scopes: msalLoginRequest.scopes,
        forceRefresh: shouldFallbackToPopup,
      };
      try {
        const response = await instance.acquireTokenSilent(tokenRequest);
        const msalResponse = await parseMSALResponse(response);

        return msalResponse;
      } catch (error) {
        if (
          error instanceof InteractionRequiredAuthError &&
          shouldFallbackToPopup
        ) {
          const response = await instance.acquireTokenPopup(tokenRequest);
          const msalResponse = await parseMSALResponse(response);

          return msalResponse;
        } else {
          // eslint-disable-next-line no-console
          console.error(error);

          throw error;
        }
      }
    };

    const renewIdToken = async () => {
      const user = await fetchIdToken(true);

      return user.id_token;
    };

    // Bridges to the AuthCoordinator Renewer contract (auth-coordinator-refactor
    // Task 10). Kept alongside fetchIdToken/renewIdToken until every
    // authenticator is migrated and the old TokenService path is deleted.
    // Reads the raw AuthenticationResult fields directly (idToken/expiresOn)
    // instead of going through parseMSALResponse, which writes the token to
    // storage as a side effect — the AuthCoordinator owns storage now.
    const getRenewer = useCallback(
      (): Renewer => async () => {
        // A page load that returns from a redirect must finish processing it
        // before renewing, or the renewal races it with the stale cache that
        // sent the user to Entra in the first place. MSAL memoizes this call.
        await instance.handleRedirectPromise().catch(() => null);
        const tokenRequest = {
          account: account || accounts[0],
          scopes: msalLoginRequest.scopes,
          forceRefresh: true,
        };

        let response;
        try {
          response = await instance.acquireTokenSilent(tokenRequest);
        } catch (error) {
          // A popup opened from a timer or a 401 has no user gesture, so
          // browsers block it; hand over to a top-level redirect instead.
          if (isReauthRequired(error)) {
            throw new ReauthRequiredError(
              'MSAL silent renewal needs an interactive visit to Entra',
              error
            );
          }

          throw error;
        }

        if (!response?.idToken || !response.expiresOn) {
          throw new Error('MSAL renewal returned no idToken or expiresOn');
        }

        return {
          idToken: response.idToken,
          expiresAt:
            readIdTokenExpiresAt(response.idTokenClaims) ??
            response.expiresOn.getTime(),
        };
      },
      [account, accounts, instance]
    );

    // Entra's SPA refresh tokens have a fixed 24-hour lifetime; past it MSAL
    // can only renew through a hidden iframe, which third-party cookie
    // blocking breaks. A top-level redirect carries the Entra session cookie
    // first-party, and prompt=none keeps it free of any user interaction.
    const silentReauth = async () => {
      const currentAccount = account || accounts[0];
      const request = {
        scopes: [...msalLoginRequest.scopes],
        prompt: 'none',
        redirectStartPage: window.location.href,
      };

      await (currentAccount
        ? instance.acquireTokenRedirect({ ...request, account: currentAccount })
        : instance.loginRedirect(request));
    };

    useImperativeHandle(ref, () => ({
      invokeLogin: login,
      invokeLogout: logout,
      renewIdToken: renewIdToken,
      invokeSilentReauth: silentReauth,
    }));

    // Register the coordinator renewer directly from this authenticator's
    // own mount effect (avoids the ref-based race in the parent).
    useEffect(() => {
      authCoordinator.registerRenewer(getRenewer());

      return () => authCoordinator.registerRenewer(null);
    }, [getRenewer]);

    // Need to capture redirect and parse ID token
    // Call login success callback.
    // `handledRedirectRef` gates against React StrictMode's dev-only double
    // effect invocation: without it, `instance.handleRedirectPromise()` is
    // called twice in flight for the same redirect, and both resolutions
    // race into `handleSuccessfulLogin(user)` — which surfaces as a double
    // `/users/loggedInUser` fetch (and a briefly-inconsistent app state).
    const handledRedirectRef = useRef(false);
    const handleRedirect = async () => {
      if (handledRedirectRef.current) {
        return;
      }
      handledRedirectRef.current = true;
      try {
        const response = await instance.handleRedirectPromise();

        if (response) {
          const user = await parseMSALResponse(response);

          handleSuccessfulLogin(user);
        }
      } catch {
        handleFailedLogin();
      }
    };

    // To add redirect callback
    useEffect(() => {
      instance && handleRedirect();
    }, [instance]);

    // Show loader until the interaction is completed
    if (inProgress !== InteractionStatus.None) {
      return <Loader />;
    }

    return <Fragment>{children}</Fragment>;
  }
);

MsalAuthenticator.displayName = 'MsalAuthenticator';

export default MsalAuthenticator;
