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

import path from 'path';
import { redirectToHomePage } from '../../utils/common';
import { enableSSOEditMode, selectSSOProvider } from '../../utils/sso';
import { test } from '../fixtures/pages';

const OKTA_SAML_XML = path.join(
  __dirname,
  '../../test-data/saml-metadata-okta.xml'
);

const OKTA_ENTITY_ID = 'http://www.okta.com/exk1a2b3c4d5';
const IDP_CERT_FIELD_PATH =
  'authenticationConfiguration.samlConfiguration.idp.idpX509Certificate';

const { expect } = test;

test.describe('SAML Metadata XML Upload', () => {
  // Issue #28619: metadata.xml parsing happens in the browser, so provider-specific certificate
  // rules are only reached once the form is submitted. Okta signs with CN=<org short name> against
  // an Entity ID of http://www.okta.com/{appId}; requiring those to match rejected every valid
  // Okta configuration at this exact step.
  test('should accept an Okta metadata XML upload when the form is submitted', async ({
    page,
  }) => {
    test.slow();

    // Never persist: this test drives real backend validation but must not repoint the running
    // instance at an unreachable IdP. Only the write is stubbed — the page's own GET must reach the
    // server, since enableSSOEditMode branches on whether a configuration already exists.
    await page.route('**/api/v1/system/security/config', (route) =>
      route.request().method() === 'PUT'
        ? route.fulfill({ status: 200, json: {} })
        : route.fallback()
    );

    await redirectToHomePage(page);
    await enableSSOEditMode(page);
    await selectSSOProvider(page, 'saml');

    await test.step('Upload Okta SAML metadata XML', async () => {
      await expect(page.getByTestId('file-upload-drop-zone')).toBeVisible();

      await page.getByTestId('file-uploader').setInputFiles(OKTA_SAML_XML);

      await expect(page.getByTestId('change-metadata-xml-btn')).toBeVisible();
      await expect(
        page.locator(
          '[id="root/authenticationConfiguration/samlConfiguration/idp/entityId"]'
        )
      ).toHaveValue(OKTA_ENTITY_ID);
    });

    await test.step('Submit and assert the IdP certificate is accepted', async () => {
      const validateResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/system/security/validate') &&
          response.request().method() === 'POST'
      );

      // A new configuration is held until Test Login passes; this test only needs the submit.
      await page.getByTestId('save-anyway-sso-configuration').click();

      const errors = (await (await validateResponse).json())?.errors ?? [];
      const certificateError = errors.find(
        (error: { field: string }) => error.field === IDP_CERT_FIELD_PATH
      );

      expect(
        certificateError,
        `Okta certificate was rejected: ${certificateError?.error}`
      ).toBeUndefined();
    });
  });
});
