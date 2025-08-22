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

import { expect, Page } from '@playwright/test';
import { GlobalSettingOptions } from '../constant/settings';
import { settingClick } from './sidebar';

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

  // Wait for SSO configuration page to load
  await page.waitForSelector('[data-testid="sso-configuration-form-card"]');
};

/**
 * Enable edit mode for SSO configuration
 */
export const enableSSOEditMode = async (page: Page) => {
  await navigateToSSOConfiguration(page);
  await page.getByTestId('edit-sso-configuration').click();

  // Wait for form to be in edit mode
  await page.getByTestId('save-sso-configuration').isVisible();
  await page.getByTestId('cancel-sso-configuration').isVisible();
};

/**
 * Select SSO provider
 */
export const selectSSOProvider = async (page: Page, provider: string) => {
  await page.getByTestId('select-widget').nth(1).click();

  await page.getByTestId(`select-option-${provider}`).click();
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
  };

  // Verify visible fields
  for (const field of expectedVisibleFields) {
    const labelLocator = page.getByLabel(field);
    const labelCount = await labelLocator.count();

    if (labelCount > 0) {
      await expect(labelLocator.first()).toBeVisible();
    } else {
      const testId = ARRAY_FIELD_TESTIDS[field];

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
      const testId = ARRAY_FIELD_TESTIDS[field];

      if (testId) {
        await expect(page.getByTestId(testId)).not.toBeVisible();
      }
    }
  }
};

/**
 * Fill basic SSO fields for testing
 */
export const fillBasicSSOFields = async (page: Page, providerName: string) => {
  await page.getByLabel('Provider Name').fill(providerName);
  await page.getByLabel('Authority').fill('https://test.com');
  await page.getByLabel('Client ID').fill('test-client-id');
  await page.getByLabel('Callback URL').fill('http://localhost:8585/callback');
};

/**
 * Test data for Google SSO configuration
 */
export const GOOGLE_SSO_TEST_CONFIG: SSOConfig = {
  authenticationConfiguration: {
    provider: 'google',
    providerName: 'google',
    clientType: 'public',
    authority: 'https://accounts.google.com',
    clientId:
      '709849217090-n7s8oc4cvpffubraoi5vbr1s0qfboqvv.apps.googleusercontent.com',
    callbackUrl: 'http://localhost:8585/callback',
    publicKeyUrls: [
      'https://www.googleapis.com/oauth2/v3/certs',
      'http://localhost:8585/api/v1/config/jwks',
    ],
    tokenValidationAlgorithm: 'RS256',
    jwtPrincipalClaims: ['email', 'preferred_username', 'sub'],
    enableSelfSignup: true,
  },
  authorizerConfiguration: {
    className: 'org.openmetadata.service.security.DefaultAuthorizer',
    containerRequestFilter: 'org.openmetadata.service.security.JwtFilter',
    adminPrincipals: ['admin'],
    principalDomain: 'openmetadata.org',
    enforcePrincipalDomain: false,
    enableSecureSocketConnection: false,
  },
};

/**
 * Test data for Auth0 SSO configuration
 */
export const AUTH0_SSO_TEST_CONFIG: SSOConfig = {
  authenticationConfiguration: {
    provider: 'auth0',
    providerName: 'auth0',
    publicKeyUrls: [
      'https://dev-fm6plpomp4ugra64.us.auth0.com/.well-known/jwks.json',
    ],
    authority: 'https://dev-fm6plpomp4ugra64.us.auth0.com',
    clientId: 'qtOjswIB35z0w2ziJDKgOMLBsh9hQvoQ',
    callbackUrl: 'http://localhost:8585/callback',
    clientType: 'public',
    jwtPrincipalClaims: ['email', 'preferred_username', 'sub'],
    tokenValidationAlgorithm: 'RS256',
    enableSelfSignup: true,
    oidcConfiguration: {
      id: 'qtOjswIB35z0w2ziJDKgOMLBsh9hQvoQ',
      type: 'auth0',
      discoveryUri:
        'https://dev-fm6plpomp4ugra64.us.auth0.com/.well-known/openid-configuration',
      scope: 'openid email profile',
      responseType: 'id_token',
      useNonce: true,
      preferredJwsAlgorithm: 'RS256',
      disablePkce: false,
      callbackUrl: 'http://localhost:8585/callback',
      serverUrl: 'http://localhost:8585',
      maxClockSkew: '',
      tokenValidity: '3600',
      maxAge: '0',
      prompt: 'consent',
      sessionExpiry: '604800',
    },
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

/**
 * Test data for Okta SSO configuration
 */
export const OKTA_SSO_TEST_CONFIG: SSOConfig = {
  authenticationConfiguration: {
    provider: 'okta',
    providerName: 'okta',
    publicKeyUrls: [
      'https://dev-86341365.okta.com/oauth2/v1/keys',
      'https://dev-86341365.okta.com/oauth2/default/v1/keys',
    ],
    authority: 'https://dev-86341365.okta.com/oauth2/default',
    clientId: '0oa64ehcb2BAwXtuF5d7',
    callbackUrl: 'http://localhost:8585/callback',
    jwtPrincipalClaims: ['email', 'preferred_username', 'sub'],
    enableSelfSignup: true,
  },
  authorizerConfiguration: {
    className: 'org.openmetadata.service.security.DefaultAuthorizer',
    containerRequestFilter: 'org.openmetadata.service.security.JwtFilter',
    adminPrincipals: ['admin'],
    botPrincipals: ['ingestion-bot'],
    principalDomain: 'open-metadata.org',
    enforcePrincipalDomain: false,
    enableSecureSocketConnection: false,
  },
};
