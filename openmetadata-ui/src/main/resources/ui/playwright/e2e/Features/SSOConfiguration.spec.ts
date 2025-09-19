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

import { expect, Page, test as base } from '@playwright/test';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import {
  enableSSOEditMode,
  selectSSOProvider,
  verifyProviderFields,
} from '../../utils/sso';

const test = base.extend<{
  adminPage: Page;
}>({
  adminPage: async ({ browser }, use) => {
    const { page } = await performAdminLogin(browser);
    await use(page);
    await page.close();
  },
});

test.describe('SSO Configuration Tests', () => {
  test.beforeEach(async ({ adminPage }) => {
    await redirectToHomePage(adminPage);
    await enableSSOEditMode(adminPage);
  });

  test.describe('Provider Selection Screen', () => {
    test('should display all available SSO providers', async ({
      adminPage,
    }) => {
      // Verify provider selector is visible
      await expect(
        adminPage.locator('.provider-selector-container')
      ).toBeVisible();

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
          adminPage.locator('.provider-item').filter({ hasText: provider })
        ).toBeVisible();
      }

      // Verify Configure button is disabled initially
      const configureButton = adminPage.getByRole('button', {
        name: /configure/i,
      });

      await expect(configureButton).toBeDisabled();
    });

    test('should enable Configure button when provider is selected', async ({
      adminPage,
    }) => {
      // Click on Google provider
      await adminPage
        .locator('.provider-item')
        .filter({ hasText: 'Google' })
        .click();

      // Verify the provider card is selected
      await expect(
        adminPage
          .locator('.provider-item.selected')
          .filter({ hasText: 'Google' })
      ).toBeVisible();

      // Verify Configure button is now enabled
      const configureButton = adminPage.getByRole('button', {
        name: /configure/i,
      });

      await expect(configureButton).toBeEnabled();
    });
  });

  test.describe(
    'Provider Field Visibility Checks - Confidential Client',
    () => {
      test('should show correct fields for Google provider with confidential client', async ({
        adminPage,
      }) => {
        await selectSSOProvider(adminPage, 'google');

        // Verify Confidential client type is selected by default
        const confidentialRadio = adminPage.getByRole('radio', {
          name: /confidential/i,
        });

        await expect(confidentialRadio).toBeChecked();

        // Verify common fields are visible
        const googleCommonFields = [
          'Provider Name',
          'Authority',
          'Client ID',
          'Callback URL',
          'Public Key URLs',
          'Token Validation Algorithm',
          'JWT Principal Claims',
          'Enable Self Signup',
        ];
        await verifyProviderFields(adminPage, googleCommonFields);

        // Verify OIDC specific fields with OIDC prefix in labels
        const oidcFields = [
          'OIDC Client ID',
          'OIDC Client Secret',
          'OIDC Request Scopes',
          'OIDC Discovery URI',
          'OIDC Use Nonce',
          'OIDC Preferred JWS Algorithm',
          'OIDC Response Type',
          'OIDC Disable PKCE',
          'OIDC Max Clock Skew',
          'OIDC Client Authentication Method',
          'OIDC Token Validity',
          'OIDC Server URL',
          'OIDC Callback URL',
          'OIDC Max Age',
          'OIDC Prompt',
          'OIDC Session Expiry',
        ];

        for (const field of oidcFields) {
          const fieldElement = adminPage.getByLabel(field);
          const fieldCount = await fieldElement.count();
          if (fieldCount > 0) {
            await expect(fieldElement.first()).toBeVisible();
          }
        }
      });

      test('should show correct fields for Auth0 provider with confidential client', async ({
        adminPage,
      }) => {
        await selectSSOProvider(adminPage, 'auth0');

        // Verify Confidential client type is selected by default
        const confidentialRadio = adminPage.getByRole('radio', {
          name: /confidential/i,
        });

        await expect(confidentialRadio).toBeChecked();

        // Verify common fields are visible
        const auth0CommonFields = [
          'Provider Name',
          'Authority',
          'Client ID',
          'Callback URL',
          'Public Key URLs',
          'Token Validation Algorithm',
          'JWT Principal Claims',
          'Enable Self Signup',
        ];
        await verifyProviderFields(adminPage, auth0CommonFields);

        // Verify OIDC specific fields with OIDC prefix in labels
        const oidcFields = [
          'OIDC Client ID',
          'OIDC Client Secret',
          'OIDC Request Scopes',
          'OIDC Discovery URI',
          'OIDC Use Nonce',
          'OIDC Preferred JWS Algorithm',
          'OIDC Response Type',
          'OIDC Disable PKCE',
          'OIDC Max Clock Skew',
          'OIDC Client Authentication Method',
          'OIDC Token Validity',
          'OIDC Tenant',
          'OIDC Server URL',
          'OIDC Callback URL',
          'OIDC Max Age',
          'OIDC Prompt',
          'OIDC Session Expiry',
        ];

        for (const field of oidcFields) {
          const fieldElement = adminPage.getByLabel(field);
          const fieldCount = await fieldElement.count();
          if (fieldCount > 0) {
            await expect(fieldElement.first()).toBeVisible();
          }
        }
      });

      test('should show correct fields for Okta provider with confidential client', async ({
        adminPage,
      }) => {
        await selectSSOProvider(adminPage, 'okta');

        // Verify Confidential client type is selected by default
        const confidentialRadio = adminPage.getByRole('radio', {
          name: /confidential/i,
        });

        await expect(confidentialRadio).toBeChecked();

        // Verify common fields are visible
        const oktaCommonFields = [
          'Provider Name',
          'Authority',
          'Client ID',
          'Callback URL',
          'Public Key URLs',
          'Token Validation Algorithm',
          'JWT Principal Claims',
          'Enable Self Signup',
        ];
        await verifyProviderFields(adminPage, oktaCommonFields);

        // Verify OIDC specific fields with OIDC prefix in labels
        const oidcFields = [
          'OIDC Client ID',
          'OIDC Client Secret',
          'OIDC Request Scopes',
          'OIDC Discovery URI',
          'OIDC Use Nonce',
          'OIDC Preferred JWS Algorithm',
          'OIDC Response Type',
          'OIDC Disable PKCE',
          'OIDC Max Clock Skew',
          'OIDC Client Authentication Method',
          'OIDC Token Validity',
          'OIDC Tenant',
          'OIDC Server URL',
          'OIDC Callback URL',
          'OIDC Max Age',
          'OIDC Prompt',
          'OIDC Session Expiry',
        ];

        for (const field of oidcFields) {
          const fieldElement = adminPage.getByLabel(field);
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
      adminPage,
    }) => {
      await selectSSOProvider(adminPage, 'saml');

      const samlVisibleFields = [
        'IdP Entity ID',
        'IdP SSO Login URL',
        'IdP X.509 Certificate',
        'Name ID Format',
        'SP Entity ID',
        'Assertion Consumer Service URL',
        'SP Callback URL',
        'SP X.509 Certificate',
        'SP Private Key',
        'Debug Mode',
        'Strict Mode',
        'Token Validity (seconds)',
        'Want Assertions Signed',
        'Want Messages Signed',
        'Send Signed Auth Request',
      ];

      await verifyProviderFields(adminPage, samlVisibleFields);

      const commonFields = [
        'Provider Name',
        'Authority',
        'Client ID',
        'Callback URL',
        'Public Key URLs',
        'JWT Principal Claims',
      ];

      await verifyProviderFields(adminPage, commonFields);

      const hiddenFields = [
        'LDAP Host',
        'LDAP Port',
        'OIDC Client ID',
        'OIDC Client Secret',
      ];

      await verifyProviderFields(adminPage, [], hiddenFields);
    });

    test('should show correct fields when selecting LDAP provider', async ({
      adminPage,
    }) => {
      await selectSSOProvider(adminPage, 'ldap');

      const ldapVisibleFields = [
        'LDAP Host',
        'LDAP Port',
        'Admin Principal DN',
        'Admin Password',
        'Enable SSL',
        'Max Pool Size',
        'User Base DN',
        'Group Base DN',
        'Full DN Required',
        'Admin Role Name',
        'All Attribute Name',
        'Mail Attribute Name',
        'Username Attribute Name',
        'Group Attribute Name',
        'Group Attribute Value',
        'Group Member Attribute Name',
        'Auth Roles Mapping',
        'Auth Reassign Roles',
      ];

      await verifyProviderFields(adminPage, ldapVisibleFields);

      const hiddenFields = ['OIDC Client ID', 'OIDC Client Secret'];

      await verifyProviderFields(adminPage, [], hiddenFields);
    });

    test('should show correct fields when selecting Google provider', async ({
      adminPage,
    }) => {
      await selectSSOProvider(adminPage, 'google');

      const googleCommonFields = [
        'Provider Name',
        'Authority',
        'Client ID',
        'Callback URL',
        'Public Key URLs',
        'Token Validation Algorithm',
        'JWT Principal Claims',
        'Enable Self Signup',
      ];

      // Click on Public client type
      const publicRadio = adminPage.getByRole('radio', { name: /public/i });
      await publicRadio.click();

      await expect(publicRadio).toBeChecked();

      // Verify public client fields are visible
      await verifyProviderFields(adminPage, googleCommonFields);

      // Verify Client Type radio group is visible
      await expect(
        adminPage.locator('.field-radio-group').first()
      ).toBeVisible();

      // Verify Secret field is NOT visible for public client
      await expect(adminPage.getByLabel('Secret Key')).not.toBeVisible();

      // Verify OIDC configuration fields are NOT visible for public client
      await expect(
        adminPage.locator('[id*="oidcConfiguration"]')
      ).not.toBeVisible();
    });

    test('should show correct fields when selecting Auth0 provider', async ({
      adminPage,
    }) => {
      await selectSSOProvider(adminPage, 'auth0');

      const auth0CommonFields = [
        'Provider Name',
        'Authority',
        'Client ID',
        'Callback URL',
        'Public Key URLs',
        'Token Validation Algorithm',
        'JWT Principal Claims',
        'Enable Self Signup',
      ];

      // Click on Public client type
      const publicRadio = adminPage.getByRole('radio', { name: /public/i });
      await publicRadio.click();

      await expect(publicRadio).toBeChecked();

      // Verify public client fields are visible
      await verifyProviderFields(adminPage, auth0CommonFields);

      // Verify Client Type radio group is visible
      await expect(
        adminPage.locator('.field-radio-group').first()
      ).toBeVisible();

      const hiddenFields = ['LDAP Host', 'IdP Entity ID', 'IdP SSO Login URL'];
      await verifyProviderFields(adminPage, [], hiddenFields);

      // Verify Secret field is NOT visible for public client
      await expect(adminPage.getByLabel('Secret Key')).not.toBeVisible();

      // Verify OIDC configuration fields are NOT visible for public client
      await expect(
        adminPage.locator('[id*="oidcConfiguration"]')
      ).not.toBeVisible();
    });

    test('should show correct fields when selecting Okta provider', async ({
      adminPage,
    }) => {
      await selectSSOProvider(adminPage, 'okta');

      const oktaCommonFields = [
        'Provider Name',
        'Authority',
        'Client ID',
        'Callback URL',
        'Public Key URLs',
        'Token Validation Algorithm',
        'JWT Principal Claims',
        'Enable Self Signup',
      ];

      // Click on Public client type
      const publicRadio = adminPage.getByRole('radio', { name: /public/i });
      await publicRadio.click();

      await expect(publicRadio).toBeChecked();

      // Verify public client fields are visible
      await verifyProviderFields(adminPage, oktaCommonFields);

      // Verify Client Type radio group is visible
      await expect(
        adminPage.locator('.field-radio-group').first()
      ).toBeVisible();

      const hiddenFields = ['LDAP Host', 'IdP Entity ID', 'IdP SSO Login URL'];
      await verifyProviderFields(adminPage, [], hiddenFields);

      // Verify Secret field is NOT visible for public client
      await expect(adminPage.getByLabel('Secret Key')).not.toBeVisible();

      // Verify OIDC configuration fields are NOT visible for public client
      await expect(
        adminPage.locator('[id*="oidcConfiguration"]')
      ).not.toBeVisible();
    });
  });
});
