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
import { OM_BASE_URL, SSO_ENV } from '../../constant/ssoAuth';
import { ProviderConfigOverride } from '../ssoAuth';
import { ProviderHelper } from './index';
import {
  assertSupportedBaseUrl,
  escapeRegExp,
  KEYCLOAK_SAML,
  performProviderLogin,
} from './keycloak-saml';

// Throwaway fixture credentials, committed like the realm user's password.
const CLIENT = {
  id: 'openmetadata-oidc-confidential',
  secret: 'openmetadata-oidc-secret',
} as const;

// OM fetches discovery and exchanges the code from inside its container, where
// localhost is its own loopback. Same split as mock-oidc-provider's
// ISSUER vs INTERNAL_BASE_URL.
const INTERNAL_BASE_URL =
  process.env[SSO_ENV.KEYCLOAK_INTERNAL_BASE_URL] ??
  'http://openmetadata-keycloak-saml:8080';

const buildConfigPayload = (): ProviderConfigOverride => {
  assertSupportedBaseUrl();

  const realm = KEYCLOAK_SAML.azureRealm;
  const authority = `${KEYCLOAK_SAML.baseUrl}/realms/${realm}`;
  const internal = `${INTERNAL_BASE_URL}/realms/${realm}`;

  return {
    authenticationConfiguration: {
      clientType: 'confidential',
      provider: 'custom-oidc',
      providerName: 'Keycloak',
      publicKeyUrls: [
        `${OM_BASE_URL}/api/v1/system/config/jwks`,
        `${internal}/protocol/openid-connect/certs`,
      ],
      tokenValidationAlgorithm: 'RS256',
      authority,
      clientId: CLIENT.id,
      callbackUrl: `${OM_BASE_URL}/callback`,
      jwtPrincipalClaims: ['email', 'preferred_username', 'sub'],
      enableSelfSignup: true,
      oidcConfiguration: {
        id: CLIENT.id,
        type: 'custom-oidc',
        secret: CLIENT.secret,
        scope: 'openid email profile',
        discoveryUri: `${internal}/.well-known/openid-configuration`,
        // Required by oidcClientConfig.json despite reading as Azure-only.
        tenant: realm,
        callbackUrl: `${OM_BASE_URL}/callback`,
        serverUrl: OM_BASE_URL,
        responseType: 'code',
        clientAuthenticationMethod: 'client_secret_basic',
        preferredJwsAlgorithm: 'RS256',
        disablePkce: true,
      },
    },
    authorizerConfiguration: {
      principalDomain: KEYCLOAK_SAML.principalDomain,
    },
  };
};

export const keycloakOidcConfidentialProviderHelper: ProviderHelper = {
  expectedButtonText: 'Sign in with Keycloak',
  loginUrlPattern: new RegExp(
    `/realms/${escapeRegExp(KEYCLOAK_SAML.azureRealm)}/`
  ),
  buildConfigPayload,
  performProviderLogin,
};
