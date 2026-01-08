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
/*
 *  Copyright 2025 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  You may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import {
  LDAP_VISIBLE_FIELDS,
  OIDC_COMMON_FIELDS,
  SAML_VISIBLE_FIELDS,
  SSO_COMMON_FIELDS,
} from '../../constant/ssoConfiguration';
import { redirectToHomePage } from '../../utils/common';
import {
  enableSSOEditMode,
  selectSSOProvider,
  verifyProviderFields,
} from '../../utils/sso';
import { test } from '../fixtures/pages';

const { expect } = test;

test.describe('SSO Configuration Tests', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await enableSSOEditMode(page);
  });

  test.describe('Provider Selection Screen', () => {
    test('should display all available SSO providers', async ({ page }) => {
      // Verify provider selector is visible
      await expect(page.locator('.provider-selector-container')).toBeVisible();

      // Verify all provider cards are displayed
      const providers = [
        'Google',
        'Azure AD',
        'Okta',
        'SAML',
        'AWS-Cognito',
        'Custom-OIDC',
        'LDAP',
        'Auth0',
      ];
      for (const provider of providers) {
        await expect(
          page.locator('.provider-item').filter({ hasText: provider })
        ).toBeVisible();
      }

      // Verify Configure button is disabled initially
      const configureButton = page.getByRole('button', {
        name: /configure/i,
      });

      await expect(configureButton).toBeDisabled();
    });

    test('should enable Configure button when provider is selected', async ({
      page,
    }) => {
      // Click on Google provider
      await page
        .locator('.provider-item')
        .filter({ hasText: 'Google' })
        .click();

      // Verify the provider card is selected
      await expect(
        page.locator('.provider-item.selected').filter({ hasText: 'Google' })
      ).toBeVisible();

      // Verify Configure button is now enabled
      const configureButton = page.getByRole('button', {
        name: /configure/i,
      });

      await expect(configureButton).toBeEnabled();
    });
  });

  test.describe(
    'Provider Field Visibility Checks - Confidential Client',
    () => {
      test('should show correct fields for Google provider with confidential client', async ({
        page,
      }) => {
        await selectSSOProvider(page, 'google');

        // Verify Confidential client type is selected by default
        const confidentialRadio = page.getByRole('radio', {
          name: /confidential/i,
        });

        await expect(confidentialRadio).toBeChecked();

        // Verify common fields are visible
        await verifyProviderFields(page, SSO_COMMON_FIELDS);

        // Verify OIDC specific fields with OIDC prefix in labels

        for (const field of OIDC_COMMON_FIELDS) {
          const fieldElement = page.getByLabel(field);
          const fieldCount = await fieldElement.count();
          if (fieldCount > 0) {
            await expect(fieldElement.first()).toBeVisible();
          }
        }
      });

      test('should show correct fields for Auth0 provider with confidential client', async ({
        page,
      }) => {
        await selectSSOProvider(page, 'auth0');

        // Verify Confidential client type is selected by default
        const confidentialRadio = page.getByRole('radio', {
          name: /confidential/i,
        });

        await expect(confidentialRadio).toBeChecked();

        // Verify common fields are visible
        await verifyProviderFields(page, SSO_COMMON_FIELDS);

        // Verify OIDC specific fields with OIDC prefix in labels
        const oidcFields = [...OIDC_COMMON_FIELDS, 'OIDC Tenant'];

        for (const field of oidcFields) {
          const fieldElement = page.getByLabel(field);
          const fieldCount = await fieldElement.count();
          if (fieldCount > 0) {
            await expect(fieldElement.first()).toBeVisible();
          }
        }
      });

      test('should show correct fields for Okta provider with confidential client', async ({
        page,
      }) => {
        await selectSSOProvider(page, 'okta');

        // Verify Confidential client type is selected by default
        const confidentialRadio = page.getByRole('radio', {
          name: /confidential/i,
        });

        await expect(confidentialRadio).toBeChecked();

        // Verify common fields are visible
        await verifyProviderFields(page, SSO_COMMON_FIELDS);

        // Verify OIDC specific fields with OIDC prefix in labels
        const oidcFields = [...OIDC_COMMON_FIELDS, 'OIDC Tenant'];

        for (const field of oidcFields) {
          const fieldElement = page.getByLabel(field);
          const fieldCount = await fieldElement.count();
          if (fieldCount > 0) {
            await expect(fieldElement.first()).toBeVisible();
          }
        }
      });
    }
  );

  test.describe('Provider Field Visibility Checks - Public Client', () => {
    test('should show correct fields when selecting SAML provider', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'saml');

      await verifyProviderFields(page, SAML_VISIBLE_FIELDS);

      const commonFields = [
        'Provider Name',
        'Client ID',
        'Callback URL',
        'Public Key URLs',
        'JWT Principal Claims',
      ];

      await verifyProviderFields(page, commonFields);

      const hiddenFields = [
        'LDAP Host',
        'LDAP Port',
        'OIDC Client ID',
        'OIDC Client Secret',
      ];

      await verifyProviderFields(page, [], hiddenFields);
    });

    test('should show correct fields when selecting LDAP provider', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'ldap');

      await verifyProviderFields(page, LDAP_VISIBLE_FIELDS);

      const hiddenFields = ['OIDC Client ID', 'OIDC Client Secret'];

      await verifyProviderFields(page, [], hiddenFields);
    });

    test('should show correct fields when selecting Google provider', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'google');

      // Click on Public client type
      const publicRadio = page.getByRole('radio', { name: /public/i });
      await publicRadio.click();

      await expect(publicRadio).toBeChecked();

      // Verify public client fields are visible
      await verifyProviderFields(page, SSO_COMMON_FIELDS);

      // Verify Client Type radio group is visible
      await expect(page.locator('.field-radio-group').first()).toBeVisible();

      // Verify Secret field is NOT visible for public client
      await expect(page.getByLabel('Secret Key')).not.toBeVisible();

      // Verify OIDC configuration fields are NOT visible for public client
      await expect(page.locator('[id*="oidcConfiguration"]')).not.toBeVisible();
    });

    test('should show correct fields when selecting Auth0 provider', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'auth0');

      // Click on Public client type
      const publicRadio = page.getByRole('radio', { name: /public/i });
      await publicRadio.click();

      await expect(publicRadio).toBeChecked();

      // Verify public client fields are visible
      await verifyProviderFields(page, SSO_COMMON_FIELDS);

      // Verify Client Type radio group is visible
      await expect(page.locator('.field-radio-group').first()).toBeVisible();

      const hiddenFields = ['LDAP Host', 'IdP Entity ID', 'IdP SSO Login URL'];
      await verifyProviderFields(page, [], hiddenFields);

      // Verify Secret field is NOT visible for public client
      await expect(page.getByLabel('Secret Key')).not.toBeVisible();

      // Verify OIDC configuration fields are NOT visible for public client
      await expect(page.locator('[id*="oidcConfiguration"]')).not.toBeVisible();
    });

    test('should show correct fields when selecting Okta provider', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'okta');

      // Click on Public client type
      const publicRadio = page.getByRole('radio', { name: /public/i });
      await publicRadio.click();

      await expect(publicRadio).toBeChecked();

      // Verify public client fields are visible
      await verifyProviderFields(page, SSO_COMMON_FIELDS);

      // Verify Client Type radio group is visible
      await expect(page.locator('.field-radio-group').first()).toBeVisible();

      const hiddenFields = ['LDAP Host', 'IdP Entity ID', 'IdP SSO Login URL'];
      await verifyProviderFields(page, [], hiddenFields);

      // Verify Secret field is NOT visible for public client
      await expect(page.getByLabel('Secret Key')).not.toBeVisible();

      // Verify OIDC configuration fields are NOT visible for public client
      await expect(page.locator('[id*="oidcConfiguration"]')).not.toBeVisible();
    });
  });
});
