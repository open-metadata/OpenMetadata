/*
 *  Copyright 2024 Collate.
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
import { AxiosError } from 'axios';
import { getOidcToken } from '../../SwTokenStorageUtils';

const REFRESH_IN_PROGRESS_KEY = 'refreshInProgress'; // Key to track if refresh is in progress

// The renewer's return value is only used for a truthy check inside
// fetchNewToken / performRefresh — the caller reads the actual refreshed
// token back from storage (setOidcToken is a side effect of every renewer).
// Widening to `unknown` here lets each provider's renewer return its own
// SDK-native shape (AccessTokenResponse, RenewTokenResponse, an OIDC User,
// void, etc.) without a per-provider cast at the registration call site.
type RenewTokenCallback = () => Promise<unknown>;

const REFRESHED_KEY = 'tokenRefreshed';

class TokenService {
  renewToken: RenewTokenCallback | null = null;
  refreshSuccessCallback: (() => void) | null = null;
  private static _instance: TokenService;
  private inFlightRefresh: Promise<unknown> | null = null;

  constructor() {
    this.clearRefreshInProgress();
    this.refreshToken = this.refreshToken.bind(this);
    this.setupServiceWorkerListener();
  }

  // Setup Service Worker listener for token updates (if available)
  private setupServiceWorkerListener() {
    if ('serviceWorker' in navigator && 'indexedDB' in globalThis) {
      try {
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data.type === 'TOKEN_UPDATE') {
            // Token was updated via Service Worker, notify other tabs
            this.refreshSuccessCallback?.();
          } else if (event.data.type === 'TOKEN_CLEARED') {
            // Tokens were cleared (logout), don't trigger refresh callbacks
            // This prevents token restoration after logout
          }
        });
      } catch {
        // No need to handle this error as it will be handled by the controller
      }
    }
  }

  // Singleton instance of TokenService
  static getInstance() {
    if (!TokenService._instance) {
      TokenService._instance = new TokenService();
    }

    return TokenService._instance;
  }

  public updateRenewToken(renewToken: RenewTokenCallback | null) {
    this.renewToken = renewToken;
  }

  public updateRefreshSuccessCallback(callback: () => void) {
    globalThis.addEventListener('storage', (event) => {
      if (event.key === REFRESHED_KEY && event.newValue === 'true') {
        callback(); // Notify the tab that the token was refreshed
        // Clear once notified
        localStorage.removeItem(REFRESHED_KEY);
      }
    });
  }

  // Refresh the token, coalescing concurrent callers in this tab (the proactive
  // expiry timer, the visibility handler, the SSE stream and the 401 interceptor
  // can all fire together) onto a single in-flight refresh so each awaits the
  // SAME result — returning `undefined` to the losers previously made the 401
  // interceptor treat an in-progress refresh as a failure and log the user out.
  // There is no "skip if still valid" fast path: every caller invokes this only
  // when a refresh is actually needed (token at/near expiry, or a server 401),
  // and that check only ever blocked a genuinely-needed refresh on clock skew /
  // server-side revocation.
  async refreshToken() {
    if (!this.inFlightRefresh) {
      this.inFlightRefresh = this.performRefresh().finally(() => {
        this.inFlightRefresh = null;
      });
    }

    return this.inFlightRefresh;
  }

  private async performRefresh() {
    const oldToken = await getOidcToken();

    // Another tab is already refreshing: wait (bounded) for it to broadcast a new
    // token rather than racing a second /auth/refresh (which would rotate the
    // refresh token out from under the first request and 401 this tab). If the
    // sibling does not deliver in time, fall through and refresh here rather than
    // logging the user out.
    if (this.isTokenUpdateInProgress()) {
      const siblingToken = await this.waitForTokenPersistence(oldToken);
      if (siblingToken) {
        return siblingToken;
      }
    }

    this.setRefreshInProgress();
    const renewResult = await this.fetchNewToken();

    // A value renewer (MSAL/Okta/Auth0/Basic/Generic) returns the token directly
    // and has already awaited setOidcToken — that is success even if the SAME
    // id_token is re-issued (forceRefresh only refreshes the access token), so we
    // must not require the stored token to change. Public OIDC silent renew
    // instead returns null/void and delivers the new token asynchronously via an
    // iframe callback (OidcAuthenticator.signInSilently), so its result tells us
    // nothing — fall back to whatever actually lands in storage. Only a falsy
    // result with no token landing in the window is a genuine failure.
    const refreshedToken =
      renewResult || (await this.waitForTokenPersistence(oldToken));
    if (!refreshedToken) {
      // fetchNewToken only clears the flag when a renewer actually ran.
      this.clearRefreshInProgress();

      return null;
    }
    this.refreshSuccessCallback?.();
    // Notify all tabs that the token has been refreshed.
    localStorage.setItem(REFRESHED_KEY, 'true');

    return (await getOidcToken()) || refreshedToken;
  }

  // Call renewal method according to the provider
  async fetchNewToken() {
    // Wait briefly for the renewer to be registered by the lazy authenticator
    // wrapper (MSAL / Okta / Auth0 / OIDC / Basic / Generic). The wrapper's
    // mount effect races the first refresh call on cold-load — returning null
    // here would trigger AuthProvider's response interceptor to clear storage
    // (`resetUserDetails(true)`) and force the user to /signin on merely-slow
    // lazy-load, discarding a valid refresh credential.
    await this.awaitRenewerReady();
    let response: unknown = null;
    if (typeof this.renewToken === 'function') {
      try {
        response = await this.renewToken();
      } catch (error) {
        // Token renewal failures are usually caused by the user's session/browser
        // environment (e.g. popups blocked, frame window timeout, silent auth
        // interrupted). They don't require a thrown error — log for diagnostics
        // and return null so callers fall back to their normal auth flow.
        // eslint-disable-next-line no-console
        console.warn(
          `Failed to refresh token: ${(error as AxiosError | Error).message}`
        );

        return null;
      } finally {
        this.clearRefreshInProgress();
      }
    }

    return response;
  }

  /**
   * Poll `this.renewToken` until it is a function or the timeout elapses.
   * Only blocks the very first refresh on cold-load; subsequent calls
   * short-circuit because `renewToken` is already registered.
   *
   * The 10s cap covers slow lazy-chunk loads on poor networks without
   * hanging indefinitely if the authenticator module fails to load.
   */
  async awaitRenewerReady(maxWaitMs = 10_000, pollMs = 100): Promise<void> {
    if (typeof this.renewToken === 'function') {
      return;
    }
    const start = Date.now();
    while (
      typeof this.renewToken !== 'function' &&
      Date.now() - start < maxWaitMs
    ) {
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  }

  // Set refresh in progress (used by the tab that initiates the refresh)
  setRefreshInProgress() {
    localStorage.setItem(REFRESH_IN_PROGRESS_KEY, 'true');
  }

  // Clear the refresh flag (used after refresh is complete)
  clearRefreshInProgress() {
    localStorage.removeItem(REFRESH_IN_PROGRESS_KEY);
    localStorage.removeItem(REFRESHED_KEY);
  }

  // Check if a refresh is already in progress (used by other tabs)
  isTokenUpdateInProgress() {
    return localStorage.getItem(REFRESH_IN_PROGRESS_KEY) === 'true';
  }

  // Poll (bounded) until the stored token differs from oldToken, returning the
  // new token or null if it never changes in the window. Checks at t=0 first so a
  // token that already landed (a sibling tab that just wrote it, or a value
  // renewer that awaited setOidcToken) is returned without an artificial delay.
  private async waitForTokenPersistence(
    oldToken: string
  ): Promise<string | null> {
    const maxAttempts = 20;
    const delayMs = 50;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const currentToken = await getOidcToken();
      if (currentToken && currentToken !== oldToken) {
        return currentToken;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    return null;
  }
}

export default TokenService;
