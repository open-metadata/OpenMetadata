/*
 *  Copyright 2021 Collate
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

import { CookieStorage } from 'cookie-storage';
import { isNil } from 'lodash';
import { WebStorageStateStore } from 'oidc-client';
import { isDev } from '../utils/EnvironmentUtils';

const cookieStorage = new CookieStorage();

export const getOidcExpiry = () => {
  return new Date(Date.now() + 60 * 60 * 24 * 1000);
};

export const getUserManagerConfig = (
  authClient: Record<string, string> = {}
): Record<string, string | boolean | WebStorageStateStore> => {
  const { authority, clientId, callbackUrl } = authClient;

  return {
    authority,
    automaticSilentRenew: true,
    // eslint-disable-next-line @typescript-eslint/camelcase
    client_id: clientId,
    // eslint-disable-next-line @typescript-eslint/camelcase
    response_type: 'id_token',
    // eslint-disable-next-line @typescript-eslint/camelcase
    redirect_uri: isDev()
      ? 'http://localhost:3000/callback'
      : !isNil(callbackUrl)
      ? callbackUrl
      : `${window.location.origin}/callback`,
    scope: 'openid email profile',
    userStore: new WebStorageStateStore({ store: cookieStorage }),
  };
};

export const getNameFromEmail = (email: string) => {
  if (email?.match(/^\S+@\S+\.\S+$/)) {
    return email.split('@')[0];
  } else {
    return '';
  }
};
