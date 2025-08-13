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
  fillSSOConfig,
  GOOGLE_SSO_TEST_CONFIG,
  saveSSOConfigurationWithVerification,
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
  // ✅ This runs before *each* test in the entire suite
  test.beforeEach(async ({ adminPage }) => {
    await redirectToHomePage(adminPage);
    await enableSSOEditMode(adminPage);
  });

  test.describe('Provider Field Visibility Checks', () => {
    test('should show correct fields when switching to SAML provider', async ({
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

    test('should show correct fields when switching to LDAP provider', async ({
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

    test('should show correct fields when switching to Google provider', async ({
      adminPage,
    }) => {
      await selectSSOProvider(adminPage, 'google');

      const googleVisibleFields = [
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

      await verifyProviderFields(adminPage, googleVisibleFields);
    });

    test('should show correct fields when switching to Auth0 provider', async ({
      adminPage,
    }) => {
      await selectSSOProvider(adminPage, 'auth0');

      const auth0VisibleFields = [
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

      await verifyProviderFields(adminPage, auth0VisibleFields);

      const hiddenFields = ['LDAP Host', 'IdP Entity ID', 'IdP SSO Login URL'];

      await verifyProviderFields(adminPage, [], hiddenFields);
    });

    test('should show correct fields when switching to Okta provider', async ({
      adminPage,
    }) => {
      await selectSSOProvider(adminPage, 'okta');

      const oktaVisibleFields = [
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

      await verifyProviderFields(adminPage, oktaVisibleFields);

      const hiddenFields = ['LDAP Host', 'IdP Entity ID', 'IdP SSO Login URL'];

      await verifyProviderFields(adminPage, [], hiddenFields);
    });
  });

  test.describe('Form Submission Test', () => {
    test('should fill and save valid Google SSO configuration', async ({
      adminPage,
    }) => {
      await fillSSOConfig(adminPage, GOOGLE_SSO_TEST_CONFIG);

      const { validationResponse, saveResponse } =
        await saveSSOConfigurationWithVerification(adminPage);

      expect(validationResponse.status()).toBe(200);
      expect(saveResponse.status()).toBe(200);
    });
  });
});
