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
import { ClientType } from '../../../generated/configuration/authenticationConfiguration';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { AccessTokenResponse } from '../../../rest/auth-API';
import { extractDetailsFromToken } from '../../AuthProvider.util';
import { getOidcToken } from '../../LocalStorageUtils';

class TokenService {
  channel: BroadcastChannel;
  renewToken: () => Promise<string> | Promise<AccessTokenResponse>;
  tokeUpdateInProgress: boolean;

  constructor(
    renewToken: () => Promise<string> | Promise<AccessTokenResponse>
  ) {
    this.channel = new BroadcastChannel('auth_channel');
    this.renewToken = renewToken;
    this.channel.onmessage = this.handleTokenUpdate.bind(this);
    this.tokeUpdateInProgress = false;
  }

  // This method will update token across tabs on receiving message to the channel
  handleTokenUpdate(event: {
    data: { type: string; token: string | AccessTokenResponse };
  }) {
    const {
      data: { type, token },
    } = event;
    if (type === 'TOKEN_UPDATE') {
      if (typeof token !== 'string') {
        useApplicationStore.getState().setOidcToken(token.accessToken);
        useApplicationStore.getState().setRefreshToken(token.refreshToken);
        useApplicationStore.getState().updateAxiosInterceptors();
      } else {
        useApplicationStore.getState().setOidcToken(token);
      }
    }
  }

  // Refresh the token if it is expired
  async refreshToken() {
    const token = getOidcToken();
    const { isExpired } = extractDetailsFromToken(token, ClientType.Public);

    if (isExpired) {
      // Logic to refresh the token
      const newToken = await this.fetchNewToken();
      // To update all the tabs on updating channel token
      this.channel.postMessage({ type: 'TOKEN_UPDATE', token: newToken });

      return newToken;
    } else {
      return token;
    }
  }

  // Call renewal method according to the provider
  async fetchNewToken() {
    if (typeof this.renewToken === 'function') {
      this.tokeUpdateInProgress = true;
      const response = await this.renewToken();
      this.tokeUpdateInProgress = false;

      return response;
    }

    return null;
  }

  // Tracker for any ongoing token update
  isTokenUpdateInProgress() {
    return this.tokeUpdateInProgress;
  }
}

export default TokenService;
