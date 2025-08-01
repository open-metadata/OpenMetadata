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
  AuthenticationResult,
  BrowserCacheLocation,
  Configuration,
  PopupRequest,
} from '@azure/msal-browser';
import { CookieStorage } from 'cookie-storage';
import jwtDecode, { JwtPayload } from 'jwt-decode';
import { first, get, isEmpty, isNil } from 'lodash';
import { WebStorageStateStore } from 'oidc-client';
import {
  AuthenticationConfigurationWithScope,
  OidcUser,
  UserProfile,
} from '../components/Auth/AuthProviders/AuthProvider.interface';
import { REDIRECT_PATHNAME, ROUTES } from '../constants/constants';
import { EMAIL_REG_EX } from '../constants/regex.constants';
import {
  AuthenticationConfiguration,
  ClientType,
} from '../generated/configuration/authenticationConfiguration';
import { AuthProvider } from '../generated/settings/settings';
import { isDev } from './EnvironmentUtils';
import { getBasePath } from './HistoryUtils';
import { setOidcToken } from './LocalStorageUtils';

const cookieStorage = new CookieStorage();

// 1 minutes for client auth approach
export const EXPIRY_THRESHOLD_MILLES = 1 * 60 * 1000;

const subPath = getBasePath();

export const getRedirectUri = (callbackUrl: string) => {
  return isDev()
    ? `http://localhost:3000${subPath}/callback`
    : !isNil(callbackUrl)
    ? callbackUrl
    : `${window.location.origin}${subPath}/callback`;
};

export const getSilentRedirectUri = () => {
  return isDev()
    ? `http://localhost:3000${subPath}/silent-callback`
    : `${window.location.origin}${subPath}/silent-callback`;
};

export const getUserManagerConfig = (
  authClient: AuthenticationConfigurationWithScope
): Record<string, string | boolean | WebStorageStateStore> => {
  const { authority, clientId, callbackUrl, scope } = authClient;

  return {
    authority,
    client_id: clientId,
    redirect_uri: getRedirectUri(callbackUrl),
    silent_redirect_uri: getSilentRedirectUri(),
    scope,
    userStore: new WebStorageStateStore({ store: localStorage }),
  };
};

export const getAuthConfig = (
  authClient: AuthenticationConfiguration
): AuthenticationConfigurationWithScope => {
  const {
    authority,
    clientId,
    callbackUrl,
    provider,
    providerName,
    enableSelfSignup,
    samlConfiguration,
    responseType = 'id_token',
    clientType = 'public',
  } = authClient;
  let config = {};
  const redirectUri = getRedirectUri(callbackUrl);
  switch (provider) {
    case AuthProvider.Okta:
      {
        config = {
          clientId,
          issuer: authority,
          redirectUri,
          scopes: ['openid', 'profile', 'email', 'offline_access'],
          pkce: true,
          provider,
          clientType,
          enableSelfSignup,
        };
      }

      break;
    case AuthProvider.CustomOidc:
      {
        config = {
          authority,
          clientId,
          callbackUrl: redirectUri,
          provider,
          providerName,
          scope: 'openid email profile',
          responseType,
          clientType,
          enableSelfSignup,
        };
      }

      break;
    case AuthProvider.Google:
      {
        config = {
          authority,
          clientId,
          callbackUrl: redirectUri,
          provider,
          scope: 'openid email profile',
          responseType,
          clientType,
          enableSelfSignup,
        };
      }

      break;
    case AuthProvider.Saml:
      {
        config = {
          samlConfiguration,
          provider,
          clientType,
          enableSelfSignup,
        };
      }

      break;
    case AuthProvider.AwsCognito:
      {
        config = {
          authority,
          clientId,
          callbackUrl: redirectUri,
          provider,
          scope: 'openid email profile',
          responseType: 'code',
          clientType,
          enableSelfSignup,
        };
      }

      break;
    case AuthProvider.Auth0: {
      config = {
        authority,
        clientId,
        callbackUrl: redirectUri,
        provider,
        clientType,
        enableSelfSignup,
      };

      break;
    }
    case AuthProvider.LDAP:
    case AuthProvider.Basic: {
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
        enableSelfSignup,
        clientType,
      };

      break;
    }
    case AuthProvider.Azure:
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
          clientType,
          enableSelfSignup,
        } as Configuration;
      }

      break;
  }

  return config as AuthenticationConfigurationWithScope;
};

// Add here scopes for id token to be used at MS Identity Platform endpoints.
export const msalLoginRequest: PopupRequest = {
  scopes: ['openid', 'profile', 'email', 'offline_access'],
};

export const getNameFromEmail = (email: string) => {
  if (email?.match(EMAIL_REG_EX)) {
    return email.split('@')[0];
  } else {
    // if the string does not conform to email format return the string
    return email;
  }
};

export const getNameFromUserData = (
  user: UserProfile,
  jwtPrincipalClaims: AuthenticationConfiguration['jwtPrincipalClaims'] = [],
  principleDomain = '',
  jwtPrincipalClaimsMapping: AuthenticationConfiguration['jwtPrincipalClaimsMapping'] = []
) => {
  let userName = '';
  let domain = principleDomain;
  let email = '';
  if (isEmpty(jwtPrincipalClaimsMapping)) {
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

    // if claims contains the "@" then split it out otherwise assign it to username as it is
    if (firstClaim?.includes('@')) {
      userName = firstClaim.split('@')[0];
      domain = firstClaim.split('@')[1];
    } else {
      userName = firstClaim ?? '';
    }

    email = userName + '@' + domain;
  } else {
    const mappingObj: Record<string, string> = {};
    jwtPrincipalClaimsMapping.reduce((acc, value) => {
      const [key, claim] = value.split(':');
      acc[key] = claim;

      return acc;
    }, mappingObj);

    if (mappingObj['username'] && mappingObj['email']) {
      userName = get(user, mappingObj['username'], '');
      email = get(user, mappingObj['email']);
    } else {
      // eslint-disable-next-line no-console
      console.error(
        'username or email is not present in jwtPrincipalClaimsMapping'
      );
    }
  }

  return { name: userName, email: email, picture: user.picture };
};

export const isTourRoute = (pathname: string) => {
  return pathname === ROUTES.TOUR;
};

export const getUrlPathnameExpiry = () => {
  return new Date(Date.now() + 60 * 60 * 1000);
};

/**
 * @exp expiry of token
 * @isExpired Whether token is already expired or not
 * @diff Difference between token expiry & current time in ms
 * @timeoutExpiry time in ms for try to silent sign-in
 * @returns exp, isExpired, diff, timeoutExpiry
 */
export const extractDetailsFromToken = (token: string) => {
  if (token) {
    try {
      const { exp } = jwtDecode<JwtPayload>(token);
      const dateNow = Date.now();

      if (isNil(exp)) {
        return {
          exp,
          isExpired: false,
          timeoutExpiry: 0,
        };
      }
      const threshouldMillis = EXPIRY_THRESHOLD_MILLES;

      const diff = exp && exp * 1000 - dateNow;
      const timeoutExpiry =
        diff && diff > threshouldMillis ? diff - threshouldMillis : 0;

      return {
        exp,
        isExpired: exp && dateNow >= exp * 1000,
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
    timeoutExpiry: 0,
  };
};

export const setUrlPathnameExpiryAfterRoute = (pathname: string) => {
  cookieStorage.setItem(REDIRECT_PATHNAME, pathname, {
    // 1 second expiry
    expires: new Date(Date.now() + 1000),
    path: '/',
  });
};

/**
 * We support Principle claim as: email,preferred_username,sub in any order
 * When Users are created from the initialAdmin we want to pick correct user details based on the principle claim
 * This method will ensure that name & email are correctly picked from the principle claim
 * @param user - User details extracted from Token
 * @param jwtPrincipalClaims - List of principle claims coming from auth API response
 * @param principalDomain - Principle Domain value coming from
 * @param jwtPrincipalClaimsMapping - Mapping of principle claims to user profile
 * @param clientType - Client Type Public or Confidential
 * @returns OidcUser with Profile info plucked based on the principle claim
 */
export const prepareUserProfileFromClaims = ({
  user,
  jwtPrincipalClaims,
  principalDomain,
  jwtPrincipalClaimsMapping,
  clientType,
}: {
  user: OidcUser;
  jwtPrincipalClaims: string[];
  principalDomain: string;
  jwtPrincipalClaimsMapping: string[];
  clientType: ClientType;
}): OidcUser => {
  const newUser = {
    ...user,
    profile:
      clientType === ClientType.Public
        ? getNameFromUserData(
            user.profile,
            jwtPrincipalClaims,
            principalDomain,
            jwtPrincipalClaimsMapping
          )
        : {
            name: user.profile?.name ?? '',
            email: user.profile?.email ?? '',
          },
  } as OidcUser;

  return newUser;
};

// Responsible for parsing the response from MSAL AuthenticationResult
export const parseMSALResponse = (response: AuthenticationResult): OidcUser => {
  // Call your API with the access token and return the data you need to save in state
  const { idToken, scopes, account } = response;

  const user = {
    id_token: idToken,
    scope: scopes.join(),
    profile: {
      email: get(account, 'idTokenClaims.email', ''),
      name: account?.name ?? '',
      picture: '',
      preferred_username: get(account, 'idTokenClaims.preferred_username', ''),
      sub: get(account, 'idTokenClaims.sub', ''),
    } as UserProfile,
  };

  setOidcToken(idToken);

  return user;
};

export const requiredAuthFields = [
  'authority',
  'clientId',
  'callbackUrl',
  'provider',
];

export const validateAuthFields = (
  configJson: AuthenticationConfigurationWithScope,
  t: (key: string, options?: any) => string
) => {
  requiredAuthFields.forEach((field) => {
    const value =
      configJson[field as keyof AuthenticationConfigurationWithScope];
    if (isEmpty(value)) {
      // eslint-disable-next-line no-console
      console.warn(t('message.missing-config-value', { field }));
    }
  });
};
