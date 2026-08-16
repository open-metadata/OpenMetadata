/*
 *  Copyright 2025 Collate.
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
import { AuthenticationConfigurationWithScope } from '../components/Auth/AuthProviders/AuthProvider.interface';
import {
  AuthenticationConfiguration,
  ClientType,
  ResponseType,
} from '../generated/configuration/authenticationConfiguration';
import { AuthProvider } from '../generated/settings/settings';
import {
  getAuthConfig,
  getCandidateUserManagerConfig,
  getUserManagerConfig,
  isRefreshableAuthError,
} from './AuthProvider.util';

const baseAuthConfig = (
  overrides: Partial<AuthenticationConfiguration> = {}
): AuthenticationConfiguration =>
  ({
    provider: AuthProvider.AwsCognito,
    providerName: 'aws-cognito',
    clientType: ClientType.Public,
    authority: 'https://cognito-idp.us-east-1.amazonaws.com/pool',
    clientId: 'client-id',
    callbackUrl: 'https://app.example.com/callback',
    jwtPrincipalClaims: ['email'],
    ...overrides,
  } as AuthenticationConfiguration);

const withScope = (
  overrides: Partial<AuthenticationConfigurationWithScope> = {}
): AuthenticationConfigurationWithScope =>
  ({
    ...baseAuthConfig(),
    scope: 'openid email profile',
    ...overrides,
  } as AuthenticationConfigurationWithScope);

describe('getUserManagerConfig — forwards responseType to the OIDC UserManager', () => {
  it('should forward a configured response_type of "code"', () => {
    const config = getUserManagerConfig(
      withScope({ responseType: ResponseType.Code })
    );

    expect(config.response_type).toBe('code');
  });

  it('should forward a configured response_type of "id_token"', () => {
    const config = getUserManagerConfig(
      withScope({ responseType: ResponseType.IDToken })
    );

    expect(config.response_type).toBe('id_token');
  });

  it('should fall back to the schema default when responseType is absent', () => {
    const config = getUserManagerConfig(withScope({ responseType: undefined }));

    expect(config.response_type).toBe('id_token');
  });
});

describe('getAuthConfig — every OIDC provider respects the server-provided responseType', () => {
  it('should respect a server responseType of "code" for AWS Cognito', () => {
    const config = getAuthConfig(
      baseAuthConfig({
        provider: AuthProvider.AwsCognito,
        responseType: ResponseType.Code,
      })
    );

    expect(config.responseType).toBe('code');
  });

  it('should respect a server responseType of "id_token" for AWS Cognito (not hardcode "code")', () => {
    const config = getAuthConfig(
      baseAuthConfig({
        provider: AuthProvider.AwsCognito,
        responseType: ResponseType.IDToken,
      })
    );

    expect(config.responseType).toBe('id_token');
  });

  it('should fall back to the schema default for AWS Cognito when the server omits responseType', () => {
    const config = getAuthConfig(
      baseAuthConfig({
        provider: AuthProvider.AwsCognito,
        responseType: undefined,
      })
    );

    expect(config.responseType).toBe('id_token');
  });

  it('should respect a server responseType of "code" for Google', () => {
    const config = getAuthConfig(
      baseAuthConfig({
        provider: AuthProvider.Google,
        responseType: ResponseType.Code,
      })
    );

    expect(config.responseType).toBe('code');
  });

  it('should respect a server responseType of "code" for Custom OIDC', () => {
    const config = getAuthConfig(
      baseAuthConfig({
        provider: AuthProvider.CustomOidc,
        providerName: 'Keycloak',
        responseType: ResponseType.Code,
      })
    );

    expect(config.responseType).toBe('code');
  });
});

describe('getCandidateUserManagerConfig — SSO test-login popup respects responseType', () => {
  it('should use the configured response_type instead of a hardcoded "id_token"', () => {
    const config = getCandidateUserManagerConfig(
      withScope({ responseType: ResponseType.Code })
    );

    expect(config.response_type).toBe('code');
  });
});

describe('isRefreshableAuthError — 401 allow-list semantics (auth-coordinator-refactor Bug 2)', () => {
  it('returns false for any non-401 status', () => {
    expect(isRefreshableAuthError(403, '/tables/name/foo', {})).toBe(false);
    expect(isRefreshableAuthError(500, '/users/loggedInUser', {})).toBe(false);
  });

  it('returns false for every excluded path regardless of message', () => {
    expect(isRefreshableAuthError(401, '/users/refresh', {})).toBe(false);
    expect(isRefreshableAuthError(401, 'auth/refresh', {})).toBe(false);
    expect(isRefreshableAuthError(401, '/auth/refresh', {})).toBe(false);
    expect(isRefreshableAuthError(401, '/users/login', {})).toBe(false);
  });

  it('returns false for a /users/loggedInUser 401 whose message is not refreshable', () => {
    expect(
      isRefreshableAuthError(401, '/users/loggedInUser', {
        message: 'token not valid',
      })
    ).toBe(false);
  });

  it('returns false for a /users/loggedInUser 401 with no body at all', () => {
    expect(isRefreshableAuthError(401, '/users/loggedInUser', undefined)).toBe(
      false
    );
  });

  it('returns true for a /users/loggedInUser 401 whose message is "Expired token!"', () => {
    expect(
      isRefreshableAuthError(401, '/users/loggedInUser', {
        message: 'Expired token!',
      })
    ).toBe(true);
  });

  it('returns true for a /users/loggedInUser 401 whose message contains "Token signing key not found"', () => {
    expect(
      isRefreshableAuthError(401, '/users/loggedInUser', {
        message:
          'Not Authorized! Token signing key not found in configured public keys',
      })
    ).toBe(true);
  });

  it('returns true for a normal 401 on any other endpoint', () => {
    expect(isRefreshableAuthError(401, '/tables/name/foo', {})).toBe(true);
  });
});
