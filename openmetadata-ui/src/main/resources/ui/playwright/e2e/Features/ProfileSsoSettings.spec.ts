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
import { expect, Locator, Page } from '@playwright/test';
import path from 'path';
import { selectOptionWithRetry } from '../../utils/common';
import {
  BASIC_CONFIG,
  configureProvider,
  EXISTING_OKTA_CONFIG,
  openProfileSso,
  ssoField,
  stubSecurityConfig,
} from '../../utils/profileSso';
import { waitForResponseWithStatus } from '../../utils/waitHelpers';
import { test } from '../fixtures/pages';

const VALID_SAML_XML = path.join(
  __dirname,
  '../../test-data/saml-metadata-valid.xml'
);
const SAML_ENTITY_ID =
  'https://sts.example.com/00000000-0000-0000-0000-000000000000/';

const pickRole = async (
  page: Page,
  input: Locator,
  roleName: string,
  displayName: string
) => {
  const searchResponse = waitForResponseWithStatus(
    page,
    (response) =>
      response.url().includes('/api/v1/roles/search') &&
      new URL(response.url()).searchParams.get('q') === roleName,
    200
  );
  await selectOptionWithRetry(
    input,
    page.getByRole('option', { name: displayName, exact: true }),
    () => input.fill(roleName)
  );
  await searchResponse;
  // Multi-select keeps its listbox open after a pick, which blocks the next field.
  await input.press('Escape');
  await expect(page.getByRole('listbox')).toBeHidden();
};

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

    test('Test Login opens as a sub page and Back keeps the edited values', async ({
      page,
    }) => {
      await stubSecurityConfig(page, EXISTING_OKTA_CONFIG);
      // The stubbed provider is not a real IdP, so the test sign-in fails fast instead of
      // opening a popup.
      await page.route('**/api/v1/system/security/test-login/start', (route) =>
        route.fulfill({ status: 400, json: { message: 'Stubbed test login' } })
      );
      await openProfileSso(page);
      const header = page.getByTestId('profile-content-header');
      const breadcrumb = header.getByRole('list', { name: 'Breadcrumb' });

      await header.getByTestId('sso-tab-configure').click();
      const clientId = ssoField(page, 'authenticationConfiguration/clientId');
      await clientId.fill('edited-client-id');

      await test.step('Test Login replaces the form with its own page', async () => {
        await page.getByTestId('test-login-sso-configuration').click();

        await expect(page.getByTestId('sso-test-login-page')).toBeVisible();
        await expect(page.getByTestId('sso-configure-form-body')).toBeHidden();
        await expect(page.getByTestId('sso-configure-footer')).toBeHidden();
        await expect(breadcrumb.getByText('Test Login')).toBeVisible();
        await expect(header.getByTestId('sso-tab-configure')).toBeHidden();
        await expect(header.getByTestId('show-hint-toggle')).toBeHidden();
      });

      await test.step('Back returns to the form with the edit kept', async () => {
        await page.getByTestId('sso-test-login-back').click();

        await expect(page.getByTestId('sso-test-login-page')).toBeHidden();
        await expect(clientId).toHaveValue('edited-client-id');
        await expect(header.getByTestId('sso-tab-configure')).toBeVisible();
      });

      await test.step('the provider crumb also leaves the sub page', async () => {
        await page.getByTestId('test-login-sso-configuration').click();
        await expect(page.getByTestId('sso-test-login-page')).toBeVisible();

        await breadcrumb.getByRole('link', { name: 'Okta' }).click();

        await expect(page.getByTestId('sso-test-login-page')).toBeHidden();
        await expect(clientId).toHaveValue('edited-client-id');
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

      await page.getByTestId('add-mapping-btn').click();
      await page
        .getByRole('textbox', { name: 'LDAP Group DN' })
        .fill('cn=admins,ou=groups,dc=example,dc=com');
      await pickRole(
        page,
        page
          .locator('[data-testid^="mapping-card-"]')
          .getByRole('combobox', { name: /Roles$/ }),
        'DataConsumer',
        'Data Consumer'
      );
      await pickRole(
        page,
        page
          .getByTestId(
            'sso-configuration-form-array-field-template-authReassignRoles'
          )
          .getByRole('combobox'),
        'DataSteward',
        'Data Steward'
      );

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
