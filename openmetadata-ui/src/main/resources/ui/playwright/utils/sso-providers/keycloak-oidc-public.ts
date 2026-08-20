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

// Public client — no secret. The browser (oidc-client UserManager) drives the
// whole authorization-code flow, so this is the fixture that exercises
// getUserManagerConfig. The realm client has implicit flow disabled, so a login
// that (wrongly) requests response_type=id_token is rejected by Keycloak — this
// is the front-channel regression guard for #29597.
const CLIENT_ID = 'openmetadata-oidc-public';

// OM validates the discovered JWKS from inside its container, where localhost is
// its own loopback — mirror keycloak-oidc.ts's ISSUER vs INTERNAL split.
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
      clientType: 'public',
      provider: 'custom-oidc',
      providerName: 'Keycloak',
      // Persisted as 'code'; the fix must carry it into the browser's authorize
      // request instead of falling back to oidc-client's 'id_token' default.
      responseType: 'code',
      publicKeyUrls: [
        `${OM_BASE_URL}/api/v1/system/config/jwks`,
        `${internal}/protocol/openid-connect/certs`,
      ],
      tokenValidationAlgorithm: 'RS256',
      authority,
      clientId: CLIENT_ID,
      callbackUrl: `${OM_BASE_URL}/callback`,
      jwtPrincipalClaims: ['email', 'preferred_username', 'sub'],
      enableSelfSignup: true,
    },
    authorizerConfiguration: {
      principalDomain: KEYCLOAK_SAML.principalDomain,
    },
  };
};

export const keycloakOidcPublicProviderHelper: ProviderHelper = {
  expectedButtonText: 'Sign in with Keycloak',
  loginUrlPattern: new RegExp(
    `/realms/${escapeRegExp(KEYCLOAK_SAML.azureRealm)}/`
  ),
  expectedResponseType: 'code',
  buildConfigPayload,
  performProviderLogin,
};
