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

  constructor() {
    this.clearRefreshInProgress();
    this.refreshToken = this.refreshToken.bind(this);
    this.setupServiceWorkerListener();
  }

  // Setup Service Worker listener for token updates (if available)
  private setupServiceWorkerListener() {
    if ('serviceWorker' in navigator && 'indexedDB' in window) {
      try {
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data.type === 'TOKEN_UPDATE') {
            // Token was updated via Service Worker, notify other tabs
            this.refreshSuccessCallback && this.refreshSuccessCallback();
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
    window.addEventListener('storage', (event) => {
      if (event.key === REFRESHED_KEY && event.newValue === 'true') {
        callback(); // Notify the tab that the token was refreshed
        // Clear once notified
        localStorage.removeItem(REFRESHED_KEY);
      }
    });
  }

  // Refresh the token if it is expired
  async refreshToken() {
    // eslint-disable-next-line no-console
    console.timeLog('refreshToken', 'Token initiated refresh');

    if (this.isTokenUpdateInProgress()) {
      return;
    }

    // Set refresh in progress immediately to prevent race conditions
    this.setRefreshInProgress();

    try {
      const token = await getOidcToken();
      const { isExpired, timeoutExpiry } = extractDetailsFromToken(token);

      // If token is expired or timeoutExpiry is less than 0 then try to silent signIn
      if (isExpired || timeoutExpiry <= 0) {
        // Logic to refresh the token
        const newToken = await this.fetchNewToken();
        if (newToken) {
          // Wait briefly for token to be persisted in SW+IndexedDB before notifying
          await new Promise((resolve) => setTimeout(resolve, 100));
          this.refreshSuccessCallback && this.refreshSuccessCallback();
          // To update all the tabs on updating channel token
          // Notify all tabs that the token has been refreshed
          localStorage.setItem(REFRESHED_KEY, 'true');
        }

        return newToken;
      } else {
        // Token doesn't need refreshing, clear the flag
        this.clearRefreshInProgress();

        return null;
      }
    } catch (error) {
      // Clear refresh flag on error to prevent deadlock
      this.clearRefreshInProgress();

      throw error;
    }
  }

  // Call renewal method according to the provider
  async fetchNewToken() {
    let response: string | AccessTokenResponse | null | void = null;
    if (typeof this.renewToken === 'function') {
      try {
        response = await this.renewToken();
      } catch (error) {
        // Silent Frame window timeout error since it doesn't affect refresh token process
        if ((error as AxiosError).message !== 'Frame window timed out') {
          // Perform logout for any error
          this.clearRefreshInProgress();

          throw new Error(
            `Failed to refresh token: ${(error as Error).message}`
          );
        }
        // Do nothing
      } finally {
        // If response is not null then clear the refresh flag
        // For Callback based refresh token, response will be void
        response && this.clearRefreshInProgress();
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
}

export default TokenService;
