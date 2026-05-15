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

import { APIRequestContext, expect, Page } from '@playwright/test';
import { GlobalSettingOptions } from '../constant/settings';
import { settingClick } from './sidebar';

export const TEST_LOGIN_LOCALSTORAGE_KEY = 'sso-test-login-result';
export const TEST_LOGIN_CAPTURE_WINDOW_KEY = '__capturedSsoTestLoginResult';
export const TEST_LOGIN_POPUP_TIMEOUT_MS = 60_000;
export const TEST_LOGIN_NETWORK_TIMEOUT_MS = 30_000;

/**
 * Install a localStorage.removeItem shim that snapshots the SSO Test Login
 * result onto window before the SUT clears it. Without this, the parent
 * page's storage listener consumes and removes the value before assertions
 * have a chance to read it.
 */
export const installTestLoginCapture = async (page: Page): Promise<void> => {
  await page.addInitScript(
    ({ key, captureKey }) => {
      const ls = window.localStorage;
      const originalRemove = ls.removeItem.bind(ls);
      const originalSet = ls.setItem.bind(ls);
      ls.setItem = (storageKey: string, value: string) => {
        if (storageKey === key) {
          (window as unknown as Record<string, unknown>)[captureKey] = value;
        }

        return originalSet(storageKey, value);
      };
      ls.removeItem = (storageKey: string) => {
        if (storageKey === key) {
          const existing = ls.getItem(key);
          if (existing) {
            (window as unknown as Record<string, unknown>)[captureKey] =
              existing;
          }
        }

        return originalRemove(storageKey);
      };
    },
    {
      key: TEST_LOGIN_LOCALSTORAGE_KEY,
      captureKey: TEST_LOGIN_CAPTURE_WINDOW_KEY,
    }
  );
};

export const clearCapturedTestLoginResult = async (
  page: Page
): Promise<void> => {
  await page.evaluate((captureKey) => {
    delete (window as unknown as Record<string, unknown>)[captureKey];
  }, TEST_LOGIN_CAPTURE_WINDOW_KEY);
};

export type TestLoginClaimValue = string | number | boolean | string[];

export interface TestLoginResultPayload {
  type: 'sso-test-login';
  success: boolean;
  error?: string;
  claims?: Record<string, TestLoginClaimValue>;
  suggestedEmailClaim?: string;
  derivedPrincipalDomain?: string;
  suggestedAdminPrincipal?: string;
  hasRefreshToken?: boolean;
}

export interface PopupLoginDriver {
  performProviderLogin(
    popup: Page,
    credentials: { username: string; password: string }
  ): Promise<void>;
}

export interface SSOConfig {
  authenticationConfiguration: {
    provider: string;
    providerName: string;
    authority: string;
    clientId: string;
    callbackUrl: string;
    publicKeyUrls: string[];
    tokenValidationAlgorithm?: string;
    jwtPrincipalClaims: string[];
    enableSelfSignup: boolean;
    clientType?: string;
    secret?: string;
    oidcConfiguration?: Record<string, any>;
  };
  authorizerConfiguration: {
    className: string;
    containerRequestFilter: string;
    adminPrincipals: string[];
    principalDomain: string;
    enforcePrincipalDomain: boolean;
    enableSecureSocketConnection: boolean;
    botPrincipals?: string[];
  };
}

export type GoogleSSOConfig = SSOConfig;
export type Auth0SSOConfig = SSOConfig;
export type OktaSSOConfig = SSOConfig;

/**
 * Navigate to SSO configuration page
 */
export const navigateToSSOConfiguration = async (page: Page) => {
  // Use existing settingClick function to navigate to SSO settings
  await settingClick(page, GlobalSettingOptions.SSO);

  // Wait for the SSO settings URL — covers all states:
  // provider selector (no config), overview (existing config), or form card
  await page.waitForURL(/settings\/sso/);
};

/**
 * Enable edit mode for SSO configuration
 */
export const enableSSOEditMode = async (page: Page) => {
  await navigateToSSOConfiguration(page);

  // Check if we're on the provider selection screen or configuration form
  const providerSelectorExists = await page
    .locator('.provider-selector-container')
    .count();
  if (providerSelectorExists === 0) {
    // We have an existing config, click edit button
    const editButton = page.getByTestId('edit-sso-configuration');
    if (await editButton.isVisible()) {
      await editButton.click();
      // Wait for form to be in edit mode
      await page.getByTestId('save-sso-configuration').isVisible();
      await page.getByTestId('cancel-sso-configuration').isVisible();
    }
  }
  // If provider selector exists, we're already in configuration mode
};

/**
 * Select SSO provider
 */
export const selectSSOProvider = async (page: Page, provider: string) => {
  // Wait for provider selector to be visible
  await page.locator('.provider-selector-container').waitFor();

  // Click on the provider card in the selection screen
  const providerLabel = getProviderLabel(provider);
  const providerCard = page
    .locator('.provider-item')
    .filter({ hasText: providerLabel });
  await providerCard.click();

  // Wait for the card to be selected
  await page
    .locator(`.provider-item.selected:has-text("${providerLabel}")`)
    .waitFor();

  // Click the Configure button to proceed to the form
  const configureButton = page.getByRole('button', { name: /configure/i });
  await configureButton.waitFor({ state: 'visible' });
  await configureButton.click();

  // Wait for the SSO configuration form to load
  await page.getByTestId('sso-configuration-form-card').waitFor({
    timeout: 10000,
  });
};

/**
 * Helper function to get provider label from provider key
 */
const getProviderLabel = (provider: string): string => {
  const providerLabels: Record<string, string> = {
    google: 'Google',
    azure: 'Azure AD',
    okta: 'Okta',
    auth0: 'Auth0',
    'aws-cognito': 'AWS-Cognito',
    'custom-oidc': 'Custom-OIDC',
    ldap: 'LDAP',
    saml: 'SAML',
  };

  return providerLabels[provider] || provider;
};

export const fillSSOAuthConfig = async (
  page: Page,
  config: SSOConfig['authenticationConfiguration']
) => {
  // Fill basic fields
  await page.getByLabel('Provider Name').fill(config.providerName);
  await page.getByLabel('Authority').first().fill(config.authority);
  await page.getByLabel('Client ID').first().fill(config.clientId);
  await page.getByLabel('Callback URL').first().fill(config.callbackUrl);

  // Add public key URLs (array field)
  if (config.publicKeyUrls.length > 0) {
    const publicKeyUrlsField = page.getByTestId(
      'sso-configuration-form-array-field-template-publicKeyUrls'
    );
    await publicKeyUrlsField.click();
    for (const url of config.publicKeyUrls) {
      await publicKeyUrlsField.locator('input').fill(url);
      await publicKeyUrlsField.locator('input').press('Enter');
    }
  }

  // Add JWT principal claims (array field)
  if (config.jwtPrincipalClaims.length > 0) {
    const jwtClaimsField = page.getByTestId(
      'sso-configuration-form-array-field-template-jwtPrincipalClaims'
    );
    await jwtClaimsField.click();
    for (const claim of config.jwtPrincipalClaims) {
      await jwtClaimsField.locator('input').fill(claim);
      await jwtClaimsField.locator('input').press('Enter');
    }
  }

  if (config.enableSelfSignup) {
    await page.getByLabel('Enable Self Signup').check();
  } else {
    await page.getByLabel('Enable Self Signup').uncheck();
  }
};

export const fillSSOAuthorizerConfig = async (
  page: Page,
  config: GoogleSSOConfig['authorizerConfiguration']
) => {
  // Fill admin principals (array field)
  if (config.adminPrincipals.length > 0) {
    const adminPrincipalsField = page.getByTestId(
      'sso-configuration-form-array-field-template-adminPrincipals'
    );
    await adminPrincipalsField.click();
    await adminPrincipalsField.locator('input').fill('admin');
    await adminPrincipalsField.locator('input').press('Enter');
  }

  // Fill principal domain
  await page
    .getByLabel('Principal Domain')
    .first()
    .fill(config.principalDomain);

  // Set enforce principal domain
  if (config.enforcePrincipalDomain) {
    await page.getByLabel('Enforce Principal Domain').check();
  } else {
    await page.getByLabel('Enforce Principal Domain').uncheck();
  }

  // Set secure socket connection
  if (config.enableSecureSocketConnection) {
    await page.getByLabel('Enable Secure Socket Connection').check();
  } else {
    await page.getByLabel('Enable Secure Socket Connection').uncheck();
  }

  // Add bot principals if provided (array field)
  if (config.botPrincipals && config.botPrincipals.length > 0) {
    // Try to find bot principals field by looking for the label first
    const botPrincipalsSection = page
      .locator('div')
      .filter({ hasText: 'Bot Principals' });
    const botPrincipalsField = botPrincipalsSection.locator(
      '[data-testid="sso-configuration-form-array-field-template"]'
    );

    if ((await botPrincipalsField.count()) > 0) {
      await botPrincipalsField.first().click();
      for (const principal of config.botPrincipals) {
        await botPrincipalsField.first().locator('input').fill(principal);
        await botPrincipalsField.first().locator('input').press('Enter');
      }
    }
  }
};

/**
 * Fill complete SSO configuration (generic for all providers)
 */
export const fillSSOConfig = async (page: Page, config: SSOConfig) => {
  await selectSSOProvider(page, config.authenticationConfiguration.provider);
  await fillSSOAuthConfig(page, config.authenticationConfiguration);
  await fillSSOAuthorizerConfig(page, config.authorizerConfiguration);
};

/**
 * Check if provider selector is visible
 */
export const isProviderSelectorVisible = async (
  page: Page
): Promise<boolean> => {
  const providerSelector = page.locator('.provider-selector-container');

  return (await providerSelector.count()) > 0;
};

/**
 * Reset SSO configuration to show provider selector
 */
export const resetToProviderSelector = async (page: Page) => {
  // Check if we have an existing configuration
  const editButton = page.getByTestId('edit-sso-configuration');
  if (await editButton.isVisible()) {
    // Click on Change Provider button if it exists
    const changeProviderButton = page.getByRole('button', {
      name: /change provider/i,
    });
    if (await changeProviderButton.isVisible()) {
      await changeProviderButton.click();
      await page.locator('.provider-selector-container').waitFor();
    }
  }
};

/**
 * Verify SSO configuration form is in read-only mode
 */
export const verifyReadOnlyMode = async (page: Page) => {
  await page.getByTestId('edit-sso-configuration').isVisible();
  await page.locator('input[disabled]').first().isVisible();
};

/**
 * Verify SSO configuration form is in edit mode
 */
export const verifyEditMode = async (page: Page) => {
  await page.getByTestId('save-sso-configuration').isVisible();
  await page.getByTestId('cancel-sso-configuration').isVisible();
  await page.locator('input:not([disabled])').first().isVisible();
};

/**
 * Verify Google SSO specific fields are visible
 */
export const verifyGoogleSSOFields = async (page: Page) => {
  const expectedFields = [
    'Provider Name',
    'Authority',
    'Client ID',
    'Callback URL',
    'Public Key URLs',
    'Token Validation Algorithm',
    'JWT Principal Claims',
    'Enable Self Signup',
    'Client Type',
  ];

  for (const field of expectedFields) {
    await page.getByText(field).isVisible();
  }
};

/**
 * Verify validation errors are displayed
 */
export const verifyValidationErrors = async (
  page: Page,
  expectedErrors: string[]
) => {
  for (const error of expectedErrors) {
    await page.getByText(error).isVisible();
  }
};

/**
 * Save SSO configuration and wait for redirect
 */
export const saveSSOConfiguration = async (page: Page) => {
  await page.getByTestId('save-sso-configuration').click();
  await page.waitForURL('**/signin');
};

/**
 * Save SSO configuration and verify actual API calls
 */
export const saveSSOConfigurationWithVerification = async (page: Page) => {
  // Wait for validation API call to complete
  const validationPromise = page.waitForResponse('**/system/security/validate');

  // Click save button
  await page.getByTestId('save-sso-configuration').click();

  // Wait for validation response
  const validationResponse = await validationPromise;

  // Wait for save API call to complete
  const savePromise = page.waitForResponse('**/system/security/config');

  // Wait for save response
  const saveResponse = await savePromise;

  // Verify we're redirected to signin page
  await page.waitForURL('**/signin');

  return {
    validationResponse,
    saveResponse,
  };
};

/**
 * Cancel SSO configuration edit
 */
export const cancelSSOConfiguration = async (page: Page) => {
  await page.getByTestId('cancel-sso-configuration').click();
  await verifyReadOnlyMode(page);
};

/**
 * Select client type for OAuth providers
 */
export const selectClientType = async (page: Page, clientType: string) => {
  await page.getByLabel('Client Type').click();
  await page.getByText(clientType).click();
};

export const expandSSOAdvancedFields = async (page: Page) => {
  const toggle = page.getByTestId('sso-advanced-fields-toggle');
  if ((await toggle.count()) === 0) {
    return;
  }
  const panel = page.getByTestId('sso-advanced-fields-panel');
  if (await panel.isVisible().catch(() => false)) {
    return;
  }
  await toggle.click();
  await expect(panel).toBeVisible();
};

export const clickTestLoginButton = async (page: Page) => {
  const button = page.getByTestId('test-login-button');
  await expect(button).toBeEnabled();
  await button.click();
};

export const runTestLoginViaPopup = async (
  page: Page,
  driver: PopupLoginDriver,
  credentials: { username: string; password: string }
): Promise<TestLoginResultPayload> => {
  // OIDC pre-flights /security/validate; SAML doesn't. Best-effort capture.
  const validatePromise = page
    .waitForResponse(
      (response) =>
        response.url().includes('/system/security/validate') &&
        response.request().method() === 'POST',
      { timeout: 5_000 }
    )
    .catch(() => undefined);
  const popupPromise = page.context().waitForEvent('page', {
    timeout: TEST_LOGIN_NETWORK_TIMEOUT_MS,
  });

  await clickTestLoginButton(page);
  await validatePromise;
  const popup = await popupPromise;

  // Attach close listener before any awaits — non-interactive IdPs (mock
  // OIDC) auto-close immediately and we'd miss the event otherwise.
  const closePromise = popup.waitForEvent('close', {
    timeout: TEST_LOGIN_POPUP_TIMEOUT_MS,
  });

  await popup.waitForLoadState('domcontentloaded').catch(() => undefined);

  if (!popup.isClosed()) {
    await driver.performProviderLogin(popup, credentials).catch((error) => {
      if (!popup.isClosed()) {
        throw error;
      }
    });
  }

  await closePromise;

  return readTestLoginResultFromStorage(page);
};

export const readTestLoginResultFromStorage = async (
  page: Page
): Promise<TestLoginResultPayload> => {
  const raw = await page.evaluate(
    ({ key, captureKey }) => {
      const captured = (window as unknown as Record<string, unknown>)[
        captureKey
      ];
      if (typeof captured === 'string') {
        return captured;
      }

      return window.localStorage.getItem(key);
    },
    {
      key: TEST_LOGIN_LOCALSTORAGE_KEY,
      captureKey: TEST_LOGIN_CAPTURE_WINDOW_KEY,
    }
  );
  if (!raw) {
    throw new Error(
      `Expected sso-test-login-result to be captured after popup closed, but it was empty. Make sure installTestLoginCapture(page) ran in beforeEach.`
    );
  }

  return JSON.parse(raw) as TestLoginResultPayload;
};

export const runTestLoginViaLdapModal = async (
  page: Page,
  credentials: { email: string; password: string }
): Promise<TestLoginResultPayload> => {
  await clickTestLoginButton(page);

  const modal = page.getByTestId('ldap-test-login-modal');
  await expect(modal).toBeVisible();

  // The Input core component places data-testid on a wrapper div; the actual
  // <input> element is a descendant. Drill into it explicitly so .fill works.
  await modal
    .getByTestId('ldap-test-login-email')
    .locator('input')
    .fill(credentials.email);
  await modal
    .getByTestId('ldap-test-login-password')
    .locator('input')
    .fill(credentials.password);

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/system/config/auth/test-login') &&
      response.request().method() === 'POST',
    { timeout: TEST_LOGIN_NETWORK_TIMEOUT_MS }
  );

  await modal.getByTestId('ldap-test-login-submit').click();

  const response = await responsePromise;

  return (await response.json()) as TestLoginResultPayload;
};

export const pickEmailClaim = async (page: Page, claimName: string) => {
  const modal = page.getByTestId('sso-claim-selector-modal');
  await expect(modal).toBeVisible();

  await modal.getByTestId(`sso-claim-row-${claimName}`).click();

  const confirmButton = modal.getByTestId('sso-claim-selector-confirm');
  await expect(confirmButton).toBeEnabled();
  await confirmButton.click();
  await expect(modal).toBeHidden();
};

export const expectEmailClaimStatusSet = async (
  page: Page,
  expectedClaim: string
) => {
  const status = page.getByTestId('email-claim-status');
  await expect(status).toBeVisible();
  await expect(status.getByTestId('email-claim-status-set')).toContainText(
    expectedClaim
  );
};

export const getSavedSecurityConfig = async (
  request: APIRequestContext
): Promise<Record<string, unknown>> => {
  const response = await request.get('/api/v1/system/security/config');
  expect(response.ok()).toBeTruthy();

  return response.json();
};

// SSOConfigurationForm.tsx keeps Save enabled and gates at click-time
// (`isLockoutRiskEdit && !testLoginPassed` → toast, no PUT). Both helpers
// assert that contract; the alias keeps lockout-risk callsites readable.
export const expectSaveDisabledForLockoutRisk = async (page: Page) => {
  await expectSaveBlockedAtClick(page);
};

export const expectSaveBlockedAtClick = async (page: Page) => {
  const saveButton = page.getByTestId('save-sso-configuration');
  await expect(saveButton).toBeEnabled();

  let saveRequestSent = false;
  const onRequest = (request: import('@playwright/test').Request) => {
    if (
      request.url().includes('/system/security/config') &&
      ['PUT', 'PATCH'].includes(request.method())
    ) {
      saveRequestSent = true;
    }
  };
  page.on('request', onRequest);

  try {
    await saveButton.click();
    const errorIndicator = page
      .locator('.ant-message-error')
      .or(page.locator('.ant-notification-notice-error'))
      .or(page.getByRole('alert'))
      .first();
    await expect(errorIndicator).toBeVisible({ timeout: 10_000 });
    expect(saveRequestSent).toBe(false);
  } finally {
    page.off('request', onRequest);
  }
};

export const expectSaveEnabled = async (page: Page) => {
  const saveButton = page.getByTestId('save-sso-configuration');
  await expect(saveButton).toBeEnabled();
};

/**
 * Verify field visibility for a specific provider
 */
export const verifyProviderFields = async (
  page: Page,
  expectedVisibleFields: string[],
  expectedHiddenFields: string[] = []
) => {
  // Mapping for array fields rendered without label associations
  const ARRAY_FIELD_TESTIDS: Record<string, string> = {
    'Public Key URLs':
      'sso-configuration-form-array-field-template-publicKeyUrls',
    'JWT Principal Claims':
      'sso-configuration-form-array-field-template-jwtPrincipalClaims',
    'Admin Principals':
      'sso-configuration-form-array-field-template-adminPrincipals',
    'Bot Principals':
      'sso-configuration-form-array-field-template-botPrincipals',
    'Auth Reassign Roles':
      'sso-configuration-form-array-field-template-authReassignRoles',
    'Allowed Email Registration Domains':
      'sso-configuration-form-array-field-template-allowedEmailRegistrationDomains',
    'Allowed Domains':
      'sso-configuration-form-array-field-template-allowedDomains',
  };

  // CopyableUrlField widgets render as <div data-testid="<rjsf-id>"> instead
  // of as labelled inputs — see CallbackUrlWidget in SSOConfigurationForm.tsx.
  const COPYABLE_FIELD_TESTIDS: Record<string, string> = {
    'Callback URL': 'root/authenticationConfiguration/callbackUrl',
  };

  // Verify visible fields
  for (const field of expectedVisibleFields) {
    const labelLocator = page.getByLabel(field);
    const labelCount = await labelLocator.count();

    if (labelCount > 0) {
      await expect(labelLocator.first()).toBeVisible();
    } else {
      const testId =
        ARRAY_FIELD_TESTIDS[field] ?? COPYABLE_FIELD_TESTIDS[field];

      if (testId) {
        await expect(page.getByTestId(testId)).toBeVisible();
      } else {
        throw new Error(`Field not found: ${field}`);
      }
    }
  }

  // Verify hidden fields
  for (const field of expectedHiddenFields) {
    const labelLocator = page.getByLabel(field);
    const labelCount = await labelLocator.count();

    if (labelCount > 0) {
      await expect(labelLocator).not.toBeVisible();
    } else {
      const testId =
        ARRAY_FIELD_TESTIDS[field] ?? COPYABLE_FIELD_TESTIDS[field];

      if (testId) {
        await expect(page.getByTestId(testId)).not.toBeVisible();
      }
    }
  }
};
