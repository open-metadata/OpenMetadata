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
import { expect, Page } from '@playwright/test';
import path from 'path';
import {
  BASIC_CONFIG,
  configureProvider,
  EXISTING_OKTA_CONFIG,
  openProfileSso,
  ssoField,
  stubSecurityConfig,
} from '../../utils/profileSso';
import { test } from '../fixtures/pages';

const VALID_SAML_XML = path.join(
  __dirname,
  '../../test-data/saml-metadata-valid.xml'
);
const SAML_ENTITY_ID =
  'https://sts.example.com/00000000-0000-0000-0000-000000000000/';

const waitForSecurityConfigWrite = (page: Page, method: 'PUT' | 'PATCH') =>
  page.waitForRequest(
    (request) =>
      request.url().includes('/api/v1/system/security/config') &&
      request.method() === method
  );

test.describe(
  'Profile SSO Settings',
  { tag: ['@Platform', '@Features'] },
  () => {
    test('saving a new provider sends the configuration and signs the admin out', async ({
      page,
    }) => {
      await stubSecurityConfig(page, BASIC_CONFIG);
      await openProfileSso(page);
      await configureProvider(page, 'google');

      // The radio input is visually hidden; its label is the hit target.
      await page.getByText('Public', { exact: true }).click();
      await ssoField(page, 'authenticationConfiguration/clientId').fill(
        'pw-google-client'
      );

      const putRequest = waitForSecurityConfigWrite(page, 'PUT');
      await page.getByTestId('save-anyway-sso-configuration').click();
      const put = await putRequest;

      expect(put.postDataJSON()).toMatchObject({
        authenticationConfiguration: {
          provider: 'google',
          clientType: 'public',
          clientId: 'pw-google-client',
        },
      });

      await page.waitForURL('**/signin');
    });

    test('an existing configuration patches self signup and discards unsaved edits', async ({
      page,
    }) => {
      const writes = await stubSecurityConfig(page, EXISTING_OKTA_CONFIG);
      await openProfileSso(page);

      await test.step('self signup is patched from the Overview tab', async () => {
        const patchRequest = waitForSecurityConfigWrite(page, 'PATCH');
        await page.getByTestId('sso-self-signup-toggle').click();
        const patch = await patchRequest;

        expect(patch.postDataJSON()).toEqual([
          {
            op: 'replace',
            path: '/authenticationConfiguration/enableSelfSignup',
            value: false,
          },
        ]);
      });

      await test.step('discarding restores the saved values without writing', async () => {
        await page.getByTestId('sso-tab-configure').click();
        const clientId = ssoField(page, 'authenticationConfiguration/clientId');

        await expect(clientId).toHaveValue('okta-client-id');

        await clientId.fill('changed-client-id');
        await page.getByTestId('cancel-sso-configuration').click();
        await page.getByTestId('sso-unsaved-changes-discard').click();

        await expect(clientId).toHaveValue('okta-client-id');
        expect(writes.puts).toHaveLength(0);
      });
    });

    test('SAML metadata upload fills the IdP fields', async ({ page }) => {
      await stubSecurityConfig(page, BASIC_CONFIG);
      await openProfileSso(page);
      await configureProvider(page, 'saml');

      await page
        .getByTestId('sso-saml-metadata-input')
        .setInputFiles(VALID_SAML_XML);

      await expect(
        ssoField(
          page,
          'authenticationConfiguration/samlConfiguration/idp/entityId'
        )
      ).toHaveValue(SAML_ENTITY_ID);
    });

    test('LDAP role mappings and reassigned roles are saved with the configuration', async ({
      page,
    }) => {
      await stubSecurityConfig(page, BASIC_CONFIG);
      await openProfileSso(page);
      await configureProvider(page, 'ldap');

      await page
        .getByRole('textbox', { name: /Auth Roles Mapping/ })
        .fill('{"cn=admins,ou=groups,dc=example,dc=com":["DataConsumer"]}');
      const reassignRoles = ssoField(
        page,
        'authenticationConfiguration/ldapConfiguration/authReassignRoles'
      );
      await reassignRoles.fill('DataSteward');
      await reassignRoles.press('Enter');

      const putRequest = waitForSecurityConfigWrite(page, 'PUT');
      await page.getByTestId('save-anyway-sso-configuration').click();
      const put = await putRequest;
      const { ldapConfiguration } =
        put.postDataJSON().authenticationConfiguration;

      expect(JSON.parse(ldapConfiguration.authRolesMapping)).toEqual({
        'cn=admins,ou=groups,dc=example,dc=com': ['DataConsumer'],
      });
      expect(ldapConfiguration.authReassignRoles).toEqual(['DataSteward']);
    });
  }
);
