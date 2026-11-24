/*
 *  Copyright 2026 Collate.
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
  AuthenticationConfiguration,
  ClientType,
  ResponseType,
} from '../../../generated/configuration/authenticationConfiguration';
import { AuthProvider } from '../../../generated/settings/settings';
import { AuthenticationConfigurationWithScope } from '../../Auth/AuthProviders/AuthProvider.interface';
import { getCandidateUserManagerConfig } from './candidateUserManagerConfig';

const withScope = (
  overrides: Partial<AuthenticationConfigurationWithScope> = {}
): AuthenticationConfigurationWithScope =>
  ({
    provider: AuthProvider.AwsCognito,
    providerName: 'aws-cognito',
    clientType: ClientType.Public,
    authority: 'https://cognito-idp.us-east-1.amazonaws.com/pool',
    clientId: 'client-id',
    callbackUrl: 'https://app.example.com/callback',
    jwtPrincipalClaims: ['email'],
    scope: 'openid email profile',
    ...overrides,
  } as AuthenticationConfiguration as AuthenticationConfigurationWithScope);

describe('getCandidateUserManagerConfig — the tested identity leaves nothing behind', () => {
  afterEach(() => {
    globalThis.localStorage.clear();
  });

  it('keeps the tested identity out of storage and does not monitor its session', async () => {
    const config = getCandidateUserManagerConfig(withScope());

    await config.userStore?.set('user:tested', 'tested-identity-tokens');

    expect(config.monitorSession).toBe(false);
    expect(await config.userStore?.get('user:tested')).toBe(
      'tested-identity-tokens'
    );
    expect(globalThis.localStorage.length).toBe(0);
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
