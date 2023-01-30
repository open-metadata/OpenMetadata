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
  BrowserCacheLocation,
  Configuration,
  IPublicClientApplication,
  PopupRequest,
  PublicClientApplication,
} from '@azure/msal-browser';
import { UserProfile } from 'components/authentication/auth-provider/AuthProvider.interface';
import jwtDecode, { JwtPayload } from 'jwt-decode';
import { first, isNil } from 'lodash';
import { WebStorageStateStore } from 'oidc-client';
import { oidcTokenKey, ROUTES } from '../constants/constants';
import { validEmailRegEx } from '../constants/regex.constants';
import { AuthTypes } from '../enums/signin.enum';
import { AuthenticationConfiguration } from '../generated/configuration/authenticationConfiguration';
import { isDev } from './EnvironmentUtils';

export let msalInstance: IPublicClientApplication;

export const EXPIRY_THRESHOLD_MILLES = 5 * 60 * 1000;

export const getRedirectUri = (callbackUrl: string) => {
  return isDev()
    ? 'http://localhost:3000/callback'
    : !isNil(callbackUrl)
    ? callbackUrl
    : `${window.location.origin}/callback`;
};

export const getSilentRedirectUri = () => {
  return isDev()
    ? 'http://localhost:3000/silent-callback'
    : `${window.location.origin}/silent-callback`;
};

export const getUserManagerConfig = (
  authClient: Record<string, string> = {}
): Record<string, string | boolean | WebStorageStateStore> => {
  const { authority, clientId, callbackUrl, responseType, scope } = authClient;

  return {
    authority,
    client_id: clientId,
    response_type: responseType,
    redirect_uri: getRedirectUri(callbackUrl),
    silent_redirect_uri: getSilentRedirectUri(),
    scope,
    userStore: new WebStorageStateStore({ store: localStorage }),
  };
};

export const getAuthConfig = (
  authClient: AuthenticationConfiguration
): Record<string, string | boolean> => {
  const {
    authority,
    clientId,
    callbackUrl,
    provider,
    providerName,
    enableSelfSignup,
  } = authClient;
  let config = {};
  const redirectUri = getRedirectUri(callbackUrl);
  switch (provider) {
    case AuthTypes.OKTA:
      {
        config = {
          clientId,
          issuer: authority,
          redirectUri,
          scopes: ['openid', 'profile', 'email', 'offline_access'],
          pkce: true,
          provider,
        };
      }

      break;
    case AuthTypes.CUSTOM_OIDC:
      {
        config = {
          authority,
          clientId,
          callbackUrl: redirectUri,
          provider,
          providerName,
          scope: 'openid email profile',
          responseType: 'id_token',
        };
      }

      break;
    case AuthTypes.GOOGLE:
      {
        config = {
          authority,
          clientId,
          callbackUrl: redirectUri,
          provider,
          scope: 'openid email profile',
          responseType: 'id_token',
        };
      }

      break;
    case AuthTypes.AWS_COGNITO:
      {
        config = {
          authority,
          clientId,
          callbackUrl: redirectUri,
          provider,
          scope: 'openid email profile',
          responseType: 'code',
        };
      }

      break;
    case AuthTypes.AUTH0: {
      config = {
        authority,
        clientId,
        callbackUrl: redirectUri,
        provider,
      };

      break;
    }
    case AuthTypes.LDAP:
    case AuthTypes.BASIC: {
      config = {
        auth: {
          authority,
          clientId,
          callbackUrl,
          postLogoutRedirectUri: '/',
        },
        cache: {
          cacheLocation: BrowserCacheLocation.LocalStorage,
        },
        provider,
        enableSelfSignUp: enableSelfSignup,
      } as Configuration;

      break;
    }
    case AuthTypes.AZURE:
      {
        config = {
          auth: {
            authority,
            clientId,
            redirectUri,
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
  scopes: ['openid', 'profile', 'email', 'offline_access'],
};
// Add here the endpoints for MS Graph API services you would like to use.
export const msalGraphConfig = {
  graphMeEndpoint: 'https://graph.microsoft.com',
};

export const getNameFromEmail = (email: string) => {
  if (email?.match(validEmailRegEx)) {
    return email.split('@')[0];
  } else {
    // if the string does not conform to email format return the string
    return email;
  }
};

export const getNameFromUserData = (
  user: UserProfile,
  jwtPrincipalClaims: AuthenticationConfiguration['jwtPrincipalClaims'] = []
) => {
  // filter and extract the present claims in user profile
  const jwtClaims = jwtPrincipalClaims.reduce(
    (prev: string[], curr: string) => {
      const currentClaim = user[curr as keyof UserProfile];
      if (currentClaim) {
        return [...prev, currentClaim];
      } else {
        return prev;
      }
    },
    []
  );

  // get the first claim from claims list
  const firstClaim = first(jwtClaims);

  let userName = '';

  // if claims contains the "@" then split it out otherwise assign it to username as it is
  if (firstClaim?.includes('@')) {
    userName = getNameFromEmail(firstClaim);
  } else {
    userName = firstClaim ?? '';
  }

  return userName;
};

export const isProtectedRoute = (pathname: string) => {
  return (
    [
      ROUTES.SIGNUP,
      ROUTES.SIGNIN,
      ROUTES.FORGOT_PASSWORD,
      ROUTES.CALLBACK,
      ROUTES.SILENT_CALLBACK,
      ROUTES.REGISTER,
      ROUTES.RESET_PASSWORD,
      ROUTES.ACCOUNT_ACTIVATION,
    ].indexOf(pathname) === -1
  );
};

export const isTourRoute = (pathname: string) => {
  return pathname === ROUTES.TOUR;
};

export const getUrlPathnameExpiry = () => {
  return new Date(Date.now() + 60 * 60 * 1000);
};

export const getUrlPathnameExpiryAfterRoute = () => {
  return new Date(Date.now() + 1000);
};

/**
 * @exp expiry of token
 * @isExpired wether token is already expired or not
 * @diff Difference between token expiry & current time in ms
 * @timeoutExpiry time in ms for try to silent sign-in
 * @returns exp, isExpired, diff, timeoutExpiry
 */
export const extractDetailsFromToken = () => {
  const token = localStorage.getItem(oidcTokenKey) || '';
  if (token) {
    try {
      const { exp } = jwtDecode<JwtPayload>(token);
      const dateNow = Date.now();

      const diff = exp && exp * 1000 - dateNow;
      const timeoutExpiry =
        diff && diff > EXPIRY_THRESHOLD_MILLES
          ? diff - EXPIRY_THRESHOLD_MILLES
          : 0;

      return {
        exp,
        isExpired: exp && dateNow >= exp * 1000,
        diff,
        timeoutExpiry,
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error parsing id token.', error);
    }
  }

  return {
    exp: 0,
    isExpired: true,
    diff: 0,
    timeoutExpiry: 0,
  };
};
