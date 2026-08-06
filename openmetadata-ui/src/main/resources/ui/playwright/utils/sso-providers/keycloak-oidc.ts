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
import { OM_BASE_URL } from '../../constant/ssoAuth';
import { ProviderConfigOverride } from '../ssoAuth';
import { ProviderHelper } from './index';
import {
  assertSupportedBaseUrl,
  escapeRegExp,
  KEYCLOAK_SAML,
  performProviderLogin,
} from './keycloak-saml';

// Confidential OIDC against the local Keycloak fixture, which already backs the
// SAML legs. Keycloak hosts saml and openid-connect clients side by side in one
// realm, so this reuses the same container, realm and user — see
// docker/local-sso/keycloak-saml/realms/om-azure-saml-realm.json.
//
// Unlike Okta, the fixture *is* the tenant: the client secret is a committed
// throwaway rather than a GitHub secret, exactly as the fixture user's password
// is. That is what makes a confidential leg testable at all — no external app
// registration to provision.
const KEYCLOAK_OIDC_CLIENT = {
  id: 'openmetadata-oidc-confidential',
  secret: 'openmetadata-oidc-secret',
} as const;

/**
 * Points OpenMetadata at the Keycloak realm as a confidential OIDC client.
 *
 * `clientType: 'confidential'` is what moves renewal off the browser and onto
 * OpenMetadata's own GET /api/v1/auth/refresh, via AuthenticationCodeFlowHandler.
 *
 * The oidcConfiguration block is mandatory: authenticationConfiguration.json
 * requires it for confidential OIDC providers, and oidcClientConfig.json requires
 * id/secret/discoveryUri/tenant within it — `tenant` included, despite being
 * documented as Azure-only. Bean validation on PUT rejects the payload otherwise.
 */
export const buildKeycloakConfidentialConfigPayload =
  (): ProviderConfigOverride => {
    assertSupportedBaseUrl();

    const authority = `${KEYCLOAK_SAML.baseUrl}/realms/${KEYCLOAK_SAML.azureRealm}`;

    return {
      authenticationConfiguration: {
        clientType: 'confidential',
        provider: 'custom-oidc',
        providerName: 'Keycloak',
        publicKeyUrls: [
          `${OM_BASE_URL}/api/v1/system/config/jwks`,
          `${authority}/protocol/openid-connect/certs`,
        ],
        tokenValidationAlgorithm: 'RS256',
        authority,
        clientId: KEYCLOAK_OIDC_CLIENT.id,
        callbackUrl: `${OM_BASE_URL}/callback`,
        jwtPrincipalClaims: ['email', 'preferred_username', 'sub'],
        enableSelfSignup: true,
        oidcConfiguration: {
          id: KEYCLOAK_OIDC_CLIENT.id,
          type: 'custom-oidc',
          secret: KEYCLOAK_OIDC_CLIENT.secret,
          scope: 'openid email profile',
          discoveryUri: `${authority}/.well-known/openid-configuration`,
          tenant: KEYCLOAK_SAML.azureRealm,
          callbackUrl: `${OM_BASE_URL}/callback`,
          serverUrl: OM_BASE_URL,
          responseType: 'code',
          clientAuthenticationMethod: 'client_secret_basic',
          preferredJwsAlgorithm: 'RS256',
          // Mirrors conf/openmetadata.yaml's OIDC_DISABLE_PKCE default so the
          // suite exercises what a self-hosted deployment gets out of the box.
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
  // Matches both the authorize redirect and the login-actions form URL.
  loginUrlPattern: new RegExp(
    `/realms/${escapeRegExp(KEYCLOAK_SAML.azureRealm)}/`
  ),
  buildConfigPayload: buildKeycloakConfidentialConfigPayload,
  performProviderLogin,
};
