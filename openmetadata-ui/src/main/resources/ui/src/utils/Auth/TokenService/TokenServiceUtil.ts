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
import { AccessTokenResponse } from '../../../rest/auth-API';
import { getOidcToken } from '../../SwTokenStorageUtils';

const REFRESH_IN_PROGRESS_KEY = 'refreshInProgress'; // Key to track if refresh is in progress

type RenewTokenCallback = () =>
  | Promise<string>
  | Promise<AccessTokenResponse>
  | Promise<void>;

const REFRESHED_KEY = 'tokenRefreshed';

class TokenService {
  renewToken: RenewTokenCallback | null = null;
  refreshSuccessCallback: (() => void) | null = null;
  private static _instance: TokenService;
  private inFlightRefresh: Promise<
    string | AccessTokenResponse | null | void
  > | null = null;

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

  public updateRenewToken(renewToken: RenewTokenCallback) {
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
    if (renewResult === null) {
      // The renewer threw, or none is configured — a genuine refresh failure.
      // fetchNewToken only clears the flag when a renewer actually ran.
      this.clearRefreshInProgress();

      return null;
    }

    // Success is the renewer resolving without throwing — NOT a token *change*:
    // MSAL/Okta/Auth0 silent renew can legitimately re-issue the same id_token.
    // A void-returning renewer (OIDC silent renew) writes the token via an iframe
    // side effect, so wait (bounded) for it to land before callers retry; a value
    // renewer already awaited setOidcToken, so this resolves on the first poll.
    if (renewResult === undefined) {
      await this.waitForTokenPersistence(oldToken);
    }
    this.refreshSuccessCallback?.();
    // Notify all tabs that the token has been refreshed.
    localStorage.setItem(REFRESHED_KEY, 'true');

    return (await getOidcToken()) || renewResult;
  }

  // Call renewal method according to the provider
  async fetchNewToken() {
    let response: string | AccessTokenResponse | null | void = null;
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
