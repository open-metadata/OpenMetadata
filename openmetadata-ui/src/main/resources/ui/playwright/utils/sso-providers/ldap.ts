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
import { APIRequestContext, expect, Page } from '@playwright/test';
import {
  applyProviderConfig,
  fetchSecurityConfig,
  restoreSecurityConfig,
} from '../ssoAuth';
import { SsoBrokenConfigureResult, SsoProviderFixture } from './fixture';

// Credentials for the LDIF-seeded user. Must match
// docker/development/openldap/bootstrap.ldif exactly — the OpenLDAP container
// binds ldapuser via `mail` -> DN lookup, then does a simple bind against
// userPassword. If either half drifts, the /signin POST returns 401.
const LDAP_USER_EMAIL = 'ldapuser@openmetadata.org';
const LDAP_USER_PASSWORD = 'ldappass';

// The docker-compose service name — this is what the OpenMetadata server
// resolves inside the ometa_network bridge. Localhost only works from the
// host machine (Playwright), never from the backend container itself.
const LDAP_HOST_INTERNAL = 'openldap';
const LDAP_PORT = 1389;

const buildValidConfig = () => ({
  authenticationConfiguration: {
    clientType: 'public',
    provider: 'ldap',
    providerName: 'LDAP',
    publicKeyUrls: ['http://localhost:8585/api/v1/system/config/jwks'],
    tokenValidationAlgorithm: 'RS256',
    // For LDAP the "authority" field is informational; the real endpoint
    // lives under ldapConfiguration.host/port. Populate it with the LDAP URL
    // so the /system/config surface still shows something meaningful.
    authority: `http://${LDAP_HOST_INTERNAL}:${LDAP_PORT}`,
    clientId: '',
    callbackUrl: '',
    jwtPrincipalClaims: ['email'],
    enableSelfSignup: false,
    ldapConfiguration: {
      host: LDAP_HOST_INTERNAL,
      port: LDAP_PORT,
      dnAdminPrincipal: 'cn=admin,dc=openmetadata,dc=org',
      dnAdminPassword: 'adminpassword',
      userBaseDN: 'ou=users,dc=openmetadata,dc=org',
      mailAttributeName: 'mail',
      isFullDn: false,
      sslEnabled: false,
    },
  },
  authorizerConfiguration: {
    principalDomain: 'openmetadata.org',
    // ldapuser (not admin) is the seeded principal; grant it admin so the
    // authenticated app renders the sidebar the fixture waits on below.
    adminPrincipals: ['ldapuser'],
  },
});

const buildBrokenConfig = () => {
  const cfg = buildValidConfig();
  // Drop ldapConfiguration.host — validateAuthFields should surface this
  // before any bind is attempted. Scenario 9 asserts on /host/ in the log.
  delete (
    cfg.authenticationConfiguration.ldapConfiguration as Record<string, unknown>
  ).host;

  return cfg;
};

/**
 * LDAP (OpenLDAP) fixture. Backed by the openldap service in
 * docker/development/docker-compose.yml under the `sso-playwright` profile —
 * `docker compose --profile sso-playwright up openldap` before running the
 * scenarios spec locally.
 *
 * LDAP is a variant of the Generic authenticator with a form login on
 * /signin (see GenericAuthenticator.tsx): the UI POSTs email+password to
 * the backend, the backend binds against OpenLDAP, and on success mints a
 * per-user JWT signed with the local RSA key. That means cross-tab silent
 * refresh does not apply (there is no IdP session), matching the Basic
 * fixture's `supportsCrossTab: false` decision.
 */
export const ldapProviderFixture: SsoProviderFixture = {
  name: 'LDAP (OpenLDAP)',
  slug: 'ldap',
  clientType: 'public',
  loginKind: 'form',

  supportsCrossTab: false,
  supportsSelfSignup: false,
  supportsSilentCallback: false,

  // The compose service is expected up when this profile runs; when it is
  // not, the container is unreachable and the configureBackend PUT will
  // fail loudly rather than silently skipping.
  isAvailable: () => true,

  signInButtonPattern: /sign in/i,

  async configureBackend(apiContext: APIRequestContext) {
    const snapshot = await fetchSecurityConfig(apiContext);
    await applyProviderConfig(apiContext, snapshot, buildValidConfig());

    return {
      restore: async () => {
        await restoreSecurityConfig(apiContext, snapshot);
      },
    };
  },

  async configureBrokenBackend(
    apiContext: APIRequestContext
  ): Promise<SsoBrokenConfigureResult> {
    const snapshot = await fetchSecurityConfig(apiContext);
    await applyProviderConfig(apiContext, snapshot, buildBrokenConfig());

    return {
      restore: async () => {
        await restoreSecurityConfig(apiContext, snapshot);
      },
      // Validator must name the missing LDAP field before the bind attempt
      // — otherwise the operator sees a cryptic "connection refused" from
      // deep in the LDAP client and has no idea which knob to turn.
      expectedWarningPattern: /host/,
    };
  },

  async performLogin(page: Page) {
    await page.goto('/signin');
    await page.getByLabel(/email/i).fill(LDAP_USER_EMAIL);
    await page.getByLabel(/password/i).fill(LDAP_USER_PASSWORD);
    await page.getByRole('button', { name: /^(sign in|log in)$/i }).click();
    await expect(page.getByTestId('app-bar-item-my-data')).toBeVisible({
      timeout: 30_000,
    });
  },

  async performLogout(page: Page) {
    await page.getByTestId('dropdown-profile').click();
    await page.getByTestId('menu-item-logout').click();
    await expect(page).toHaveURL(/\/signin$/);
  },

  async forceTokenExpiry(page: Page) {
    // Same JWT-mangle as basic.ts. LDAP mints a locally-signed OM JWT (there
    // is no IdP session to invalidate remotely), so clobbering `exp` in
    // storage is sufficient — the next API call will 401 and the coordinator
    // will attempt a refresh against the local /auth/refresh endpoint.
    await page.evaluate(() => {
      const raw = localStorage.getItem('oidcIdToken');
      if (!raw) {
        return;
      }
      const [header, , sig] = raw.split('.');
      const payload = { exp: Math.floor(Date.now() / 1000) - 60 };
      const b64 = (obj: unknown) =>
        btoa(JSON.stringify(obj))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
      localStorage.setItem('oidcIdToken', `${header}.${b64(payload)}.${sig}`);
    });
  },
};
