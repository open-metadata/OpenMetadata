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
  getUserManagerConfig,
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
