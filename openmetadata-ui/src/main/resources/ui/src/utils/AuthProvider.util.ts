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
import { t } from './i18next/LocalUtil';
import { oidcTokenStorage } from './OidcTokenStorage';
import { setOidcToken } from './SwTokenStorageUtils';

const cookieStorage = new CookieStorage();

// 1 minutes for client auth approach
export const EXPIRY_THRESHOLD_MILLES = 1 * 60 * 1000;

const subPath = getBasePath();

export const getRedirectUri = (callbackUrl?: string) => {
  if (isDev()) {
    return `http://localhost:3000${subPath}/callback`;
  }

  if (isNil(callbackUrl) || isEmpty(callbackUrl)) {
    return `${globalThis.location.origin}${subPath}/callback`;
  }

  return callbackUrl;
};

export const getSilentRedirectUri = () => {
  return isDev()
    ? `http://localhost:3000${subPath}/silent-callback`
    : `${globalThis.location.origin}${subPath}/silent-callback`;
};

export const getUserManagerConfig = (
  authClient: AuthenticationConfigurationWithScope
): Record<string, string | boolean | WebStorageStateStore> => {
  const { authority = '', clientId = '', callbackUrl, scope } = authClient;

  return {
    authority,
    client_id: clientId,
    redirect_uri: getRedirectUri(callbackUrl),
    silent_redirect_uri: getSilentRedirectUri(),
    scope,
    userStore: oidcTokenStorage,
    stateStore: oidcTokenStorage,
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
    enableAutoRedirect,
    samlConfiguration,
    responseType = 'id_token',
    clientType = 'public',
  } = authClient;
  let config = {};
  const redirectUri = getRedirectUri(callbackUrl);
  switch (provider) {
    case AuthProvider.Okta:
      config = {
        clientId,
        issuer: authority,
        redirectUri,
        scopes: ['openid', 'profile', 'email', 'offline_access'],
        pkce: true,
        provider,
        clientType,
        enableSelfSignup,
        enableAutoRedirect,
      };

      break;
    case AuthProvider.CustomOidc:
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
        enableAutoRedirect,
      };

      break;
    case AuthProvider.Google:
      config = {
        authority,
        clientId,
        callbackUrl: redirectUri,
        provider,
        scope: 'openid email profile',
        responseType,
        clientType,
        enableSelfSignup,
        enableAutoRedirect,
      };

      break;
    case AuthProvider.Saml:
      config = {
        samlConfiguration,
        provider,
        clientType,
        enableSelfSignup,
        enableAutoRedirect,
      };

      break;
    case AuthProvider.AwsCognito:
      config = {
        authority,
        clientId,
        callbackUrl: redirectUri,
        provider,
        scope: 'openid email profile',
        responseType: 'code',
        clientType,
        enableSelfSignup,
        enableAutoRedirect,
      };

      break;
    case AuthProvider.Auth0: {
      config = {
        authority,
        clientId,
        callbackUrl: redirectUri,
        provider,
        clientType,
        enableSelfSignup,
        enableAutoRedirect,
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
        enableAutoRedirect,
        clientType,
      };

      break;
    }
    case AuthProvider.Azure:
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
        enableAutoRedirect,
      } as Configuration;

      break;
  }

  return config as AuthenticationConfigurationWithScope;
};

// Add here scopes for id token to be used at MS Identity Platform endpoints.
export const msalLoginRequest: PopupRequest = {
  scopes: ['openid', 'profile', 'email', 'offline_access'],
};

export const getNameFromEmail = (email: string) => {
  if (new RegExp(EMAIL_REG_EX).exec(email)) {
    return email.split('@')[0];
  } else {
    // if the string does not conform to email format return the string
    return email;
  }
};

/**
 * Extracts user name from SSO provider user profile with fallback strategy.
 * Works with all SSO providers (Auth0, Azure, SAML, Google, Okta, Custom OIDC, AWS Cognito).
 *
 * Priority order:
 * 1. user.name (direct name field from provider)
 * 2. user.given_name + user.family_name (first name + last name combination)
 * 3. user.given_name or user.family_name (either field if only one is available)
 * 4. user.preferred_username (extract username part before @)
 * 5. user.email (extract username part before @)
 * 6. user.sub (subject identifier as last resort)
 *
 * @param user - UserProfile object from SSO provider response (can contain standard OIDC claims)
 * @returns Extracted username string, or empty string if no valid field found
 *
 * @example
 * // Auth0 provider with name field
 * extractNameFromUserProfile({ name: 'John Doe', email: 'john@example.com' })
 * // Returns: 'John Doe'
 *
 * @example
 * // Provider with firstName and lastName (given_name, family_name)
 * extractNameFromUserProfile({ given_name: 'John', family_name: 'Doe' })
 * // Returns: 'John Doe'
 *
 * @example
 * // Azure provider with preferred_username
 * extractNameFromUserProfile({ preferred_username: 'john.doe@company.com' })
 * // Returns: 'john.doe'
 *
 * @example
 * // SAML provider with email only
 * extractNameFromUserProfile({ email: 'john@example.com' })
 * // Returns: 'john'
 */
export const extractNameFromUserProfile = (user: UserProfile): string => {
  if (!user) {
    return '';
  }

  if (user.name) {
    return user.name.trim();
  }

  const givenName = get(user, 'given_name', '');
  const familyName = get(user, 'family_name', '');

  if (givenName && familyName) {
    return `${givenName.trim()} ${familyName.trim()}`;
  }

  if (givenName) {
    return givenName.trim();
  }

  if (familyName) {
    return familyName.trim();
  }

  if (user.preferred_username) {
    return getNameFromEmail(user.preferred_username);
  }

  if (user.email) {
    return getNameFromEmail(user.email);
  }

  if (user.sub) {
    return user.sub;
  }

  return '';
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
    jwtPrincipalClaimsMapping.forEach((value) => {
      const [key, claim] = value.split(':');
      mappingObj[key] = claim;
    });

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

  return {
    name: userName,
    email: email,
    picture: user.picture,
    displayName: extractNameFromUserProfile(user),
  };
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
            // For confidential clients, backend handles displayName extraction
            // via AuthenticationCodeFlowHandler during OAuth2 code flow
            name: user.profile?.name ?? '',
            email: user.profile?.email ?? '',
          },
  } as OidcUser;

  return newUser;
};

// Responsible for parsing the response from MSAL AuthenticationResult
export const parseMSALResponse = async (
  response: AuthenticationResult
): Promise<OidcUser> => {
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

  await setOidcToken(idToken);

  return user;
};

export const requiredAuthFields = [
  'authority',
  'clientId',
  'callbackUrl',
  'provider',
];

export const validateAuthFields = (
  configJson: AuthenticationConfigurationWithScope
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
