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

import {
  BrowserCacheLocation,
  Configuration,
  IPublicClientApplication,
  PopupRequest,
  PublicClientApplication,
} from '@azure/msal-browser';
import { CookieStorage } from 'cookie-storage';
import { isNil } from 'lodash';
import { WebStorageStateStore } from 'oidc-client';
import { ROUTES } from '../constants/constants';
import { AuthTypes } from '../enums/signin.enum';
import { isDev } from '../utils/EnvironmentUtils';

const cookieStorage = new CookieStorage();

export let msalInstance: IPublicClientApplication;

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

export const getAuthConfig = (
  authClient: Record<string, string> = {}
): Record<string, string | boolean> => {
  const { authority, clientId, callbackUrl, provider } = authClient;
  let config = {};

  switch (provider) {
    case AuthTypes.OKTA:
      {
        config = {
          clientId,
          issuer: authority,
          redirectUri: isDev()
            ? 'http://localhost:3000/callback'
            : !isNil(callbackUrl)
            ? callbackUrl
            : `${window.location.origin}/callback`,
          scopes: ['openid', 'profile', 'email', 'offline_access'],
          pkce: true,
          provider,
        };
      }

      break;
    case AuthTypes.GOOGLE:
      {
        config = {
          clientId,
          provider,
        };
      }

      break;
    case AuthTypes.AZURE:
      {
        config = {
          auth: {
            authority,
            clientId,
            redirectUri: 'http://localhost:3000/callback',
            postLogoutRedirectUri: '/',
          },
          cache: {
            cacheLocation: BrowserCacheLocation.LocalStorage,
          },
          provider,
        } as Configuration;
      }

      break;
  }

  return config;
};

export const setMsalInstance = (configs: Configuration) => {
  msalInstance = new PublicClientApplication(configs);
};

// Add here scopes for id token to be used at MS Identity Platform endpoints.
export const msalLoginRequest: PopupRequest = {
  scopes: ['User.Read', 'openid', 'profile', 'email', 'offline_access'],
};
// Add here the endpoints for MS Graph API services you would like to use.
export const msalGraphConfig = {
  graphMeEndpoint: 'https://graph.microsoft.com',
};

export const getNameFromEmail = (email: string) => {
  if (email?.match(/^\S+@\S+\.\S+$/)) {
    return email.split('@')[0];
  } else {
    return '';
  }
};

export const isProtectedRoute = (pathname: string) => {
  return (
    pathname !== ROUTES.SIGNUP &&
    pathname !== ROUTES.SIGNIN &&
    pathname !== ROUTES.CALLBACK
  );
};

export const isTourRoute = (pathname: string) => {
  return pathname === ROUTES.TOUR;
};
