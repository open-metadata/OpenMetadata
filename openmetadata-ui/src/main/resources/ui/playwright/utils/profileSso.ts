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
import { expect, Page, Route } from '@playwright/test';
import { enableAiAppMode } from '../e2e/Utils/appMode';
import { redirectToHomePage } from './common';

const SECURITY_CONFIG_URL = '**/api/v1/system/security/config';
const SECURITY_VALIDATE_URL = '**/api/v1/system/security/validate';

export const EXISTING_OKTA_CONFIG = {
  authenticationConfiguration: {
    provider: 'okta',
    providerName: 'Okta',
    clientType: 'public',
    authority: 'https://test.okta.com/oauth2/default',
    clientId: 'okta-client-id',
    callbackUrl: 'http://localhost:8585/callback',
    publicKeyUrls: ['https://test.okta.com/oauth2/default/v1/keys'],
    jwtPrincipalClaims: ['email'],
    enableSelfSignup: true,
  },
  authorizerConfiguration: {
    className: 'org.openmetadata.service.security.DefaultAuthorizer',
    containerRequestFilter: 'org.openmetadata.service.security.JwtFilter',
    adminPrincipals: ['admin'],
    principalDomain: 'open-metadata.org',
    enforcePrincipalDomain: false,
    enableSecureSocketConnection: false,
  },
};

export const BASIC_CONFIG = {
  authenticationConfiguration: {
    ...EXISTING_OKTA_CONFIG.authenticationConfiguration,
    provider: 'basic',
  },
  authorizerConfiguration: EXISTING_OKTA_CONFIG.authorizerConfiguration,
};

export interface SecurityConfigWrites {
  puts: Record<string, unknown>[];
}

/**
 * The security config is the server's auth setup — writing it for real would
 * sign every parallel worker out. GET serves `initial`, PUT/PATCH are captured
 * and answered, and validation always passes, so the UI round-trip is real
 * while the backend never changes.
 */
export const stubSecurityConfig = async (
  page: Page,
  initial: Record<string, unknown>
): Promise<SecurityConfigWrites> => {
  const writes: SecurityConfigWrites = { puts: [] };

  await page.route(SECURITY_CONFIG_URL, async (route: Route) => {
    const method = route.request().method();
    if (method === 'PUT') {
      writes.puts.push(route.request().postDataJSON());
    }
    await route.fulfill({ json: method === 'GET' ? initial : {} });
  });
  await page.route(SECURITY_VALIDATE_URL, (route) =>
    route.fulfill({
      json: { status: 'success', message: 'ok', results: [], errors: [] },
    })
  );

  return writes;
};

export const openProfileSso = async (page: Page) => {
  await enableAiAppMode(page);
  await redirectToHomePage(page, false);
  await page.getByTestId('ask-ai-user-menu-trigger').click();
  await page.getByTestId('ai-user-menu-profile').click();
  await expect(page.getByTestId('ai-profile-page')).toBeVisible();
  await page.getByTestId('profile-nav-sso').click();
  await expect(page.getByTestId('sso-panel')).toBeVisible();
};

/** Picks a provider on the grid and opens its setup form. */
export const configureProvider = async (page: Page, provider: string) => {
  await page.getByTestId(`sso-provider-${provider}`).click();
  await page
    .getByTestId('profile-content-header')
    .getByTestId('sso-configure-provider')
    .click();
  await expect(page.getByTestId('sso-configure-form')).toBeVisible();
};

/** A core-ui text input rendered by FormBuilderV1, addressed by its RJSF id. */
export const ssoField = (page: Page, path: string) =>
  page.locator(`[id="root/${path}"]`);
