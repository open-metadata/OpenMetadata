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
import { Page, Route } from '@playwright/test';
import { redirectToHomePage } from '../../utils/common';
import {
  enableSSOEditMode,
  navigateToSSOConfiguration,
  selectSSOProvider,
} from '../../utils/sso';
import { test } from '../fixtures/pages';

const { expect } = test;

const TEST_LOGIN_URL = '**/system/security/test-login';
const VALIDATE_TOKEN_URL = `${TEST_LOGIN_URL}/validate-token`;
const START_URL = `${TEST_LOGIN_URL}/start`;
const CREDENTIALS_URL = `${TEST_LOGIN_URL}/credentials`;
const RESULT_URL = `${TEST_LOGIN_URL}/result/**`;
const SECURITY_CONFIG_URL = '**/system/security/config';
const VALIDATE_URL = '**/system/security/validate';

// Mirrors E2E_INJECTED_ID_TOKEN_KEY in
// src/components/SettingsSso/SsoTestLogin/useSsoTestLogin.ts. Injecting a token
// here lets the success/failure round-trip be exercised without a real IdP popup
// (which cannot run headlessly); the backend response is mocked separately.
const E2E_ID_TOKEN_KEY = '__OM_E2E_SSO_TEST_ID_TOKEN__';

// Stands in for the identity provider a server-driven test sends its popup to.
const FAKE_AUTHORIZATION_URL = 'https://idp.e2e.test/authorize';

// OIDC providers whose public-client form flow is exercised by the existing SSO
// suite, so we can reliably switch them to a public client here.
const OIDC_PROVIDERS = ['google', 'okta', 'auth0'];

const SIGNED_IN_RESULT = {
  status: 'success',
  resolvedPrincipal: 'alice',
  resolvedEmail: 'alice@example.com',
  mappedRoles: ['DataConsumer'],
  mappedTeams: ['Engineering'],
  domainCheck: {
    enforced: true,
    principalDomain: 'example.com',
    resolvedDomain: 'example.com',
    passed: true,
  },
};

const EXISTING_GOOGLE_CONFIG = {
  authenticationConfiguration: {
    provider: 'google',
    providerName: 'Google',
    clientType: 'public',
    authority: 'https://accounts.google.com',
    clientId: 'google-client-id',
    callbackUrl: 'http://localhost:8585/callback',
    publicKeyUrls: ['https://www.googleapis.com/oauth2/v3/certs'],
    jwtPrincipalClaims: ['email'],
    enableSelfSignup: false,
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

const fulfillJson = (body: unknown) => (route: Route) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

// Test Login starts with the checks a save runs; answer them so a test reaches the sign-in.
const mockConfigurationCheck = (page: Page, body: Record<string, unknown>) =>
  page.route(VALIDATE_URL, fulfillJson(body));

const switchToPublicClient = async (page: Page) => {
  const publicRadio = page.getByRole('radio', { name: /public/i }).first();
  await publicRadio.click();
  await expect(publicRadio).toBeChecked();
};

const injectTestIdToken = (page: Page) =>
  page.evaluate((key) => {
    (window as unknown as Record<string, string>)[key] = 'e2e-fake-id-token';
  }, E2E_ID_TOKEN_KEY);

const formField = (page: Page, path: string) =>
  page.locator(`[id="root/authenticationConfiguration/${path}"]`);

test.describe('SSO Test Login', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await enableSSOEditMode(page);
  });

  test('should offer one Test Login button, which replaces Test Configuration', async ({
    page,
  }) => {
    await selectSSOProvider(page, 'google');

    await expect(
      page.getByTestId('test-login-sso-configuration')
    ).toBeVisible();
    await expect(page.getByTestId('test-sso-configuration')).toHaveCount(0);
    await expect(page.locator('.sso-save-warning')).toBeVisible();
  });

  test('should stop at the configuration check and show its problems', async ({
    page,
  }) => {
    let signInStarted = false;
    await mockConfigurationCheck(page, {
      status: 'failed',
      errors: [
        {
          field: 'authenticationConfiguration.ldapConfiguration.host',
          error: 'The LDAP server is not reachable',
        },
      ],
    });
    await page.route(START_URL, (route) => {
      signInStarted = true;

      return route.abort();
    });

    await selectSSOProvider(page, 'ldap');

    const configurationChecked = page.waitForResponse(VALIDATE_URL);
    await page.getByTestId('test-login-sso-configuration').click();
    await configurationChecked;

    const dialog = page.getByRole('dialog');

    await expect(
      dialog.getByTestId('sso-test-login-stage-configuration')
    ).toContainText('The LDAP server is not reachable');
    await expect(dialog).toContainText(/stopped before signing in/i);
    await expect(page.getByTestId('save-sso-configuration')).toBeDisabled();
    expect(signInStarted).toBe(false);
  });

  for (const provider of OIDC_PROVIDERS) {
    test(`should offer Test Login for ${provider} as a public client`, async ({
      page,
    }) => {
      await selectSSOProvider(page, provider);
      await switchToPublicClient(page);

      await expect(
        page.getByTestId('test-login-sso-configuration')
      ).toBeVisible();
    });
  }

  test('should offer Test Login for a confidential client', async ({
    page,
  }) => {
    await selectSSOProvider(page, 'google');

    // Google defaults to the confidential client type.
    await expect(
      page.getByRole('radio', { name: /confidential/i })
    ).toBeChecked();
    await expect(
      page.getByTestId('test-login-sso-configuration')
    ).toBeVisible();
  });

  for (const provider of ['saml', 'ldap']) {
    test(`should offer Test Login for ${provider}`, async ({ page }) => {
      await selectSSOProvider(page, provider);

      await expect(
        page.getByTestId('test-login-sso-configuration')
      ).toBeVisible();
    });
  }

  test('should show the resolved identity when the test login succeeds', async ({
    page,
  }) => {
    await mockConfigurationCheck(page, { status: 'success' });
    await page.route(VALIDATE_TOKEN_URL, fulfillJson(SIGNED_IN_RESULT));

    await selectSSOProvider(page, 'google');
    await switchToPublicClient(page);
    await injectTestIdToken(page);

    const validateResponse = page.waitForResponse(VALIDATE_TOKEN_URL);
    await page.getByTestId('test-login-sso-configuration').click();
    await validateResponse;

    const dialog = page.getByRole('dialog');

    await expect(dialog.getByTestId('sso-test-login-details')).toBeVisible();
    await expect(dialog).toContainText('alice@example.com');
    await expect(dialog).toContainText('DataConsumer');
    await expect(dialog).toContainText('Engineering');
  });

  test('should show the failure reason when the configuration would reject the login', async ({
    page,
  }) => {
    await mockConfigurationCheck(page, { status: 'success' });
    await page.route(
      VALIDATE_TOKEN_URL,
      fulfillJson({
        status: 'failed',
        errors: [
          'The resolved identity does not satisfy the configured principal-domain rules.',
        ],
      })
    );

    await selectSSOProvider(page, 'google');
    await switchToPublicClient(page);
    await injectTestIdToken(page);

    const validateResponse = page.waitForResponse(VALIDATE_TOKEN_URL);
    await page.getByTestId('test-login-sso-configuration').click();
    await validateResponse;

    await expect(page.getByRole('dialog')).toContainText(
      /principal-domain rules/i
    );
  });

  test('should sign a confidential client in on the server and read the outcome back', async ({
    page,
  }) => {
    await mockConfigurationCheck(page, { status: 'success' });
    await page.route(
      START_URL,
      fulfillJson({
        testSessionId: 'e2e-session',
        protocol: 'oidc',
        authorizationUrl: FAKE_AUTHORIZATION_URL,
        requiresCredentials: false,
      })
    );
    await page.route(
      RESULT_URL,
      fulfillJson({ ...SIGNED_IN_RESULT, protocol: 'oidc' })
    );
    // The popup is a page of its own, so the identity provider is faked for the whole context.
    await page
      .context()
      .route(`${FAKE_AUTHORIZATION_URL}**`, (route) =>
        route.fulfill({ status: 200, contentType: 'text/html', body: '' })
      );

    await selectSSOProvider(page, 'google');

    const popupOpened = page.waitForEvent('popup');
    const resultResponse = page.waitForResponse(RESULT_URL);
    await page.getByTestId('test-login-sso-configuration').click();
    const popup = await popupOpened;
    await resultResponse;

    const dialog = page.getByRole('dialog');

    await expect(dialog.getByTestId('sso-test-login-details')).toBeVisible();
    await expect(dialog).toContainText('alice@example.com');
    await expect.poll(() => popup.isClosed()).toBe(true);
  });

  test('should hold a new configuration until an LDAP Test Login signs in', async ({
    page,
  }) => {
    await mockConfigurationCheck(page, { status: 'success' });
    await page.route(
      START_URL,
      fulfillJson({
        testSessionId: 'e2e-session',
        protocol: 'ldap',
        requiresCredentials: true,
      })
    );
    await page.route(
      CREDENTIALS_URL,
      fulfillJson({ ...SIGNED_IN_RESULT, protocol: 'ldap' })
    );

    await selectSSOProvider(page, 'ldap');

    const saveButton = page.getByTestId('save-sso-configuration');
    const saveAnywayButton = page.getByTestId('save-anyway-sso-configuration');

    await expect(saveButton).toBeDisabled();
    await expect(saveAnywayButton).toBeVisible();

    const configurationChecked = page.waitForRequest(VALIDATE_URL);
    await page.getByTestId('test-login-sso-configuration').click();
    await configurationChecked;
    const dialog = page.getByRole('dialog');
    await dialog
      .getByTestId('sso-test-login-email')
      .getByRole('textbox')
      .fill('alice@example.com');
    await dialog
      .getByTestId('sso-test-login-password')
      .locator('input')
      .fill('s3cret');

    const credentialsRequest = page.waitForRequest(CREDENTIALS_URL);
    await dialog.getByTestId('sso-test-login-submit-credentials').click();

    expect((await credentialsRequest).postDataJSON()).toEqual({
      testSessionId: 'e2e-session',
      email: 'alice@example.com',
      password: 's3cret',
    });
    await expect(dialog.getByTestId('sso-test-login-details')).toBeVisible();

    await dialog.getByTestId('sso-test-login-close').click();

    await expect(saveButton).toBeEnabled();
    await expect(saveAnywayButton).not.toBeVisible();
  });
});

test.describe('SSO Test Login save gate for an existing configuration', () => {
  test.beforeEach(async ({ page }) => {
    // Never persist: the configuration being edited is served by the mock, and nothing is saved.
    await page.route(SECURITY_CONFIG_URL, (route) =>
      route.request().method() === 'GET'
        ? fulfillJson(EXISTING_GOOGLE_CONFIG)(route)
        : route.fallback()
    );
    await redirectToHomePage(page);
    await navigateToSSOConfiguration(page);
    await page.getByTestId('edit-sso-configuration').click();
  });

  test('should gate an edit only when it changes how users sign in', async ({
    page,
  }) => {
    const saveButton = page.getByTestId('save-sso-configuration');
    const saveAnywayButton = page.getByTestId('save-anyway-sso-configuration');

    await formField(page, 'sessionExpiry').fill('7200');

    await expect(saveButton).toBeEnabled();
    await expect(saveAnywayButton).not.toBeVisible();

    await formField(page, 'clientId').fill('another-client-id');

    await expect(saveButton).toBeDisabled();
    await expect(saveAnywayButton).toBeVisible();
  });
});
