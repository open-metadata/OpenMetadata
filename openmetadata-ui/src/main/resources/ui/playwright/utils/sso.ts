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

/**
 * Navigate to SSO configuration page
 */
export const navigateToSSOConfiguration = async (page: Page) => {
  // Use existing settingClick function to navigate to SSO settings
  await settingClick(page, GlobalSettingOptions.SSO);

  // Wait for the SSO settings URL — covers all states:
  // provider selector (no config), overview (existing config), or form card
  await page.waitForURL(/settings\/sso/, { waitUntil: 'domcontentloaded' });
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
      await expect(page.getByTestId('save-sso-configuration')).toBeVisible();
      await expect(page.getByTestId('cancel-sso-configuration')).toBeVisible();
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
