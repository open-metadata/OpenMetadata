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

import type { AuthenticationResult, Configuration } from '@azure/msal-browser';
import { CookieStorage } from 'cookie-storage';
import jwtDecode, { JwtPayload } from 'jwt-decode';
import { first, get, isEmpty, isNil } from 'lodash';
import { WebStorageStateStore } from 'oidc-client';
import {
  AuthenticationConfigurationWithScope,
  OidcUser,
  UserProfile,
} from '../components/Auth/AuthProviders/AuthProvider.interface';
import {
  REFRESHABLE_AUTH_ERRORS,
  UN_AUTHORIZED_EXCLUDED_PATHS,
} from '../constants/Auth.constants';
import { ROUTES } from '../constants/constants';
import { EMAIL_REG_EX } from '../constants/regex.constants';
import { REDIRECT_PATHNAME } from '../constants/router.constants';
import {
  AuthenticationConfiguration,
  ClientType,
} from '../generated/configuration/authenticationConfiguration';
import { AuthProvider } from '../generated/settings/settings';
import { isDev } from './EnvironmentUtils';
import { getBasePath } from './HistoryUtils';
import { t } from './i18next/LocalUtil';
import { oidcTokenStorage } from './OidcTokenStorage';
import { SSO_TEST_LOGIN_STORE_PREFIX } from './SsoTestLoginPopup';
import { setOidcToken } from './SwTokenStorageUtils';

export interface AuthFieldError {
  field: string;
  reason: string;
}

export interface AuthFieldValidationResult {
  valid: boolean;
  errors: AuthFieldError[];
}

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
  const {
    authority = '',
    clientId = '',
    callbackUrl,
    scope,
    responseType,
  } = authClient;

  return {
    authority,
    client_id: clientId,
    // Forward the server-configured response type; without it the oidc-client
    // UserManager silently drops the field and every provider requests the
    // implicit 'id_token' flow regardless of configuration (#29597).
    response_type: responseType ?? 'id_token',
    redirect_uri: getRedirectUri(callbackUrl),
    silent_redirect_uri: getSilentRedirectUri(),
    scope,
    userStore: oidcTokenStorage,
    stateStore: oidcTokenStorage,
  };
};

/**
 * Build an isolated UserManager config used ONLY for the SSO "Test Login" popup.
 * Tokens land in a dedicated prefixed store (never the app's oidcTokenStorage),
 * but the popup uses the SAME configured callback URL the real login uses — so
 * the test exercises the actual registered redirect URI and never requires the
 * admin to register an extra one. Isolation is achieved by diverting the popup
 * at the callback (see isSsoTestLoginPopup), not by using a separate route.
 */
export const getCandidateUserManagerConfig = (
  authClient: AuthenticationConfigurationWithScope
): Record<string, string | boolean | WebStorageStateStore> => {
  const {
    authority = '',
    clientId = '',
    callbackUrl,
    scope,
    responseType,
  } = authClient;
  const testStore = new WebStorageStateStore({
    store: globalThis.localStorage,
    prefix: SSO_TEST_LOGIN_STORE_PREFIX,
  });

  return {
    authority,
    client_id: clientId,
    redirect_uri: getRedirectUri(callbackUrl),
    response_type: responseType ?? 'id_token',
    scope: scope || 'openid email profile',
    loadUserInfo: false,
    userStore: testStore,
    stateStore: testStore,
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
    // eslint-disable-next-line sonarjs/no-duplicated-branches -- distinct auth provider; config kept separate
    case AuthProvider.AwsCognito:
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
          cacheLocation: 'localStorage',
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
          cacheLocation: 'localStorage',
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
export const msalLoginRequest = {
  scopes: ['openid', 'profile', 'email', 'offline_access'],
} as const;

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

  const givenName: string = get(user, 'given_name', '');
  const familyName: string = get(user, 'family_name', '');

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

/**
 * Per-provider required-field map used by `validateAuthFieldsDetailed`. Keys
 * are top-level `configJson` properties OR dotted paths into nested config
 * objects (`samlConfiguration.idp.entityId`, `ldapConfiguration.host`, ...).
 * Order within each list matches the diagnostic order the config-error page
 * renders, so put the most-visible/most-actionable field first.
 */
//
// IMPORTANT: only reference fields the *public* `/api/v1/system/config/auth`
// endpoint actually returns. The server strips nested configuration blocks
// (`ldapConfiguration.dnAdminPassword`, `samlConfiguration.security.*`,
// server-side OIDC secrets) so any `ldapConfiguration.host` /
// `samlConfiguration.idp.entityId` / `oidcConfiguration.discoveryUri`
// requirement here evaluates to undefined on real deployments and forces the
// SPA into `ConfigErrorPage` even when the backend is configured correctly.
// Verified against CI: with `provider: ldap` the public endpoint returns
// zero `ldapConfiguration.*` fields; the SPA form never rendered because
// the validator kept flagging them missing.
//
// Keep this validator focused on the top-level fields the SPA itself uses
// to bootstrap (authority for OIDC/OAuth, clientId to feed the SDK, etc.).
// Deep config correctness is the server's job — an invalid nested config
// surfaces as a real IdP-side error message, not a client short-circuit.
const REQUIRED_FIELDS_BY_PROVIDER: Record<string, string[]> = {
  // Basic + LDAP don't render an IdP sign-in button — `providerName` is a
  // display-only field for those, and `getAuthConfig` strips it out of the
  // returned shape. The runtime-blocking check is that a provider is set.
  [AuthProvider.Basic]: ['provider'],
  [AuthProvider.LDAP]: ['provider'],
  // IdP flows all need the four top-level fields to boot their client SDK:
  // authority (issuer/discovery root), clientId (OAuth client), callbackUrl
  // (redirect target), providerName (visible sign-in button text). Nested
  // configuration blocks are server-side and not exposed to the SPA.
  [AuthProvider.CustomOidc]: [
    'provider',
    'providerName',
    'clientId',
    'callbackUrl',
    'authority',
  ],
  [AuthProvider.Google]: [
    'provider',
    'providerName',
    'clientId',
    'callbackUrl',
    'authority',
  ],
  [AuthProvider.Auth0]: [
    'provider',
    'providerName',
    'clientId',
    'callbackUrl',
    'authority',
  ],
  [AuthProvider.Azure]: [
    'provider',
    'providerName',
    'clientId',
    'callbackUrl',
    'authority',
  ],
  [AuthProvider.Okta]: [
    'provider',
    'providerName',
    'clientId',
    'callbackUrl',
    'authority',
  ],
  // SAML's `getAuthConfig` branch above intentionally omits `providerName`
  // from the returned client shape (SAML renders a fixed "Sign in with SAML
  // SSO" label), so requiring it here would always trip ConfigErrorPage.
  [AuthProvider.Saml]: ['provider'],
};

/**
 * `isEmpty` from lodash treats `0` and `false` as empty, which is wrong for
 * numeric ports and boolean flags. We only want to flag `null`/`undefined`/
 * empty-string/empty-object/empty-array as missing.
 */
const isFieldMissing = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim() === '';
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return false;
  }

  return isEmpty(value);
};

/**
 * Rich validator used by the AuthProvider mount effect. Returns the list of
 * fields whose values are missing/empty for the current provider so the
 * config-error page can render actionable diagnostics. Errors are logged via
 * `console.warn` (matching the pre-existing style in this file — the codebase
 * has no shared logger utility) with an `[AuthConfig]` prefix so tests can
 * intercept the console cleanly.
 */
export const validateAuthFieldsDetailed = (
  configJson: AuthenticationConfigurationWithScope
): AuthFieldValidationResult => {
  const provider = configJson?.provider as string | undefined;
  const required =
    (provider && REQUIRED_FIELDS_BY_PROVIDER[provider]) ??
    // Fall back to the legacy required-field list when the provider is
    // unknown — the caller (AuthProvider) also independently short-circuits
    // on an unsupported provider, but this keeps the validator's contract
    // useful in isolation.
    requiredAuthFields;

  const errors: AuthFieldError[] = [];

  required.forEach((field) => {
    const value = get(configJson, field);
    if (isFieldMissing(value)) {
      const reason = t('message.missing-config-value', { field });
      errors.push({ field, reason });
      // eslint-disable-next-line no-console
      console.warn(`[AuthConfig] ${reason}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Boolean-returning validator kept for backwards compatibility — anything
 * still calling `validateAuthFields` gets the same warn-on-missing behavior,
 * with the richer diagnostics flowing through `validateAuthFieldsDetailed`.
 */
export const validateAuthFields = (
  configJson: AuthenticationConfigurationWithScope
): boolean => {
  return validateAuthFieldsDetailed(configJson).valid;
};

/**
 * Decides whether a 401 response is one the AuthCoordinator should try to
 * silently refresh, versus one that should propagate straight to the caller
 * (login/refresh endpoints themselves, or a `/users/loggedInUser` 401 whose
 * message doesn't match a known refreshable cause). Mirrors the allow-list
 * the legacy in-provider interceptor used to apply inline.
 */
export const isRefreshableAuthError = (
  status: number,
  url: string,
  body: unknown
): boolean => {
  if (status !== 401) {
    return false;
  }

  if (UN_AUTHORIZED_EXCLUDED_PATHS.includes(url)) {
    return false;
  }

  if (url === '/users/loggedInUser') {
    const message = (body as { message?: string } | undefined)?.message ?? '';

    return REFRESHABLE_AUTH_ERRORS.some((authError) =>
      message.includes(authError)
    );
  }

  return true;
};
