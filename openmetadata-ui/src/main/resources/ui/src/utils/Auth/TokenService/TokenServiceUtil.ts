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
import { extractDetailsFromToken } from '../../AuthProvider.util';
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

  // Refresh the token when it is expired, or unconditionally when `force` is set
  // (the 401 path — the server has rejected the token regardless of local expiry
  // math). Concurrent callers in this tab share a single in-flight refresh so
  // every caller awaits the SAME result. Returning `undefined` to the losers
  // previously made the 401 interceptor treat an in-progress refresh as a
  // failure — and, with the cross-tab flag set, park the request forever.
  async refreshToken(force = false) {
    if (!this.inFlightRefresh) {
      this.inFlightRefresh = this.performRefresh(force).finally(() => {
        this.inFlightRefresh = null;
      });
    }

    return this.inFlightRefresh;
  }

  private async performRefresh(force: boolean) {
    const oldToken = await getOidcToken();

    // Another tab is already refreshing: wait for it to broadcast a new token
    // rather than racing a second /auth/refresh (which would rotate the refresh
    // token out from under the first request and 401 this tab).
    // ponytail: waits ~1s for the sibling then returns null so the caller logs
    // out cleanly — never an unbounded hang. Add cross-tab leader election if
    // multi-tab refresh churn ever shows up.
    if (this.isTokenUpdateInProgress()) {
      const persisted = await this.waitForTokenPersistence(oldToken);

      return persisted ? getOidcToken() : null;
    }

    // A 401 (`force`) must always refresh: the server has rejected the token, so
    // a "still valid locally" check (clock skew / server-side revocation) would
    // otherwise short-circuit to null and log the user out spuriously.
    if (!force) {
      const { isExpired, timeoutExpiry } = extractDetailsFromToken(oldToken);
      if (!isExpired && timeoutExpiry > 0) {
        return null;
      }
    }

    this.setRefreshInProgress();
    const renewResult = await this.fetchNewToken();
    if (renewResult === null) {
      // Explicit failure: the renewer threw, or none is configured.
      return null;
    }

    // Success is defined by a new token actually landing in storage, NOT by the
    // renewer's return value: OIDC silent renew resolves `void` and writes the
    // token via an iframe side effect, so keying on the return value would
    // mistake a successful renew for a failure and log the user out.
    const persisted = await this.waitForTokenPersistence(oldToken);
    if (!persisted) {
      return null;
    }
    this.refreshSuccessCallback?.();
    // Notify all tabs that the token has been refreshed.
    localStorage.setItem(REFRESHED_KEY, 'true');

    return getOidcToken();
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

  private async waitForTokenPersistence(oldToken: string): Promise<boolean> {
    const maxAttempts = 20;
    const delayMs = 50;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      const currentToken = await getOidcToken();

      if (currentToken && currentToken !== oldToken) {
        return true;
      }
    }

    return false;
  }
}

export default TokenService;
