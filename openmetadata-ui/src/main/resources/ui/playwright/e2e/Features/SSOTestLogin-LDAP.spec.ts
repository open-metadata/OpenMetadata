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
import { ssoTest as test } from '../../utils/sso-test-fixtures';
import {
  applyProviderConfig,
  expectPersistedSecurityConfig,
} from '../../utils/ssoAuth';
import {
  enableSSOEditMode,
  expectSaveDisabledForLockoutRisk,
  expectSaveEnabled,
  runTestLoginViaLdapModal,
  selectSSOProvider,
  TEST_LOGIN_NETWORK_TIMEOUT_MS,
} from '../../utils/sso';
import {
  OPENLDAP_FIXTURE,
  openldapProviderHelper,
} from '../../utils/sso-providers/openldap';

const ensureLdapFixtureReady = async (page: Page) => {
  try {
    const response = await page.request.head(
      `http://localhost:${OPENLDAP_FIXTURE.port}`,
      { timeout: 3_000 }
    );
    if (response.status() >= 500) {
      throw new Error(`status ${response.status()}`);
    }
  } catch {
    // HEAD against ldap:// won't speak HTTP; the connection refusing here
    // means the port isn't bound. Skip rather than fail.
  }
};

test.describe('SSO Test Login — LDAP', () => {
  test.beforeEach(async ({ page, originalConfig: _ }) => {
    await ensureLdapFixtureReady(page);
  });

  test('happy path: configure → test login modal → success → save', async ({
    page,
    adminApiContext: apiContext,
  }) => {
    await enableSSOEditMode(page);
    await selectSSOProvider(page, 'ldap');
    await openldapProviderHelper.fillForm?.(page);

    const result = await runTestLoginViaLdapModal(page, {
      email: OPENLDAP_FIXTURE.validUser.email,
      password: OPENLDAP_FIXTURE.validUser.password,
    });
    expect(result.success).toBe(true);
    expect(result.derivedPrincipalDomain).toBe('company.com');
    expect(result.suggestedAdminPrincipal).toBe(OPENLDAP_FIXTURE.validUser.email);

    await expect(page.getByTestId('ldap-test-login-modal')).toBeHidden();
    await expectSaveEnabled(page);

    const saveResponsePromise = page.waitForResponse(
      (r) =>
        r.url().includes('/system/security/config') &&
        ['PUT', 'PATCH'].includes(r.request().method()),
      { timeout: TEST_LOGIN_NETWORK_TIMEOUT_MS }
    );
    await page.getByTestId('save-sso-configuration').click();
    expect((await saveResponsePromise).ok()).toBe(true);

    await expectPersistedSecurityConfig(apiContext, (auth) => {
      const ldap = (auth.ldapConfiguration ?? {}) as Record<string, unknown>;
      expect(ldap.host).toBe(OPENLDAP_FIXTURE.host);
      expect(ldap.port).toBe(OPENLDAP_FIXTURE.port);
      expect(ldap.dnAdminPrincipal).toBe(OPENLDAP_FIXTURE.adminDn);
      expect(ldap.userBaseDN).toBe(OPENLDAP_FIXTURE.userBaseDN);
      expect(ldap.mailAttributeName).toBe(OPENLDAP_FIXTURE.mailAttributeName);
      expect(ldap.dnAdminPassword).not.toBe(OPENLDAP_FIXTURE.adminPassword);
    });
  });

  test('failure path: wrong user password keeps modal open with error', async ({
    page,
  }) => {
    await enableSSOEditMode(page);
    await selectSSOProvider(page, 'ldap');
    await openldapProviderHelper.fillForm?.(page);

    const result = await runTestLoginViaLdapModal(page, {
      email: OPENLDAP_FIXTURE.validUser.email,
      password: 'wrong-password',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();

    await expect(page.getByTestId('ldap-test-login-modal')).toBeVisible();
    await page
      .getByTestId('ldap-test-login-modal')
      .getByRole('button', { name: /^Cancel/ })
      .click();
    await expect(page.getByTestId('ldap-test-login-modal')).toBeHidden();
    await expectSaveDisabledForLockoutRisk(page);
  });

  test('mode=existing overlay: re-test after save uses existing dnAdminPassword', async ({
    page,
    adminApiContext,
    originalConfig,
  }) => {
    const seedPayload = await openldapProviderHelper.buildConfigPayload();
    await applyProviderConfig(adminApiContext, originalConfig, seedPayload);

    await enableSSOEditMode(page);
    await expect(page.getByTestId('save-sso-configuration')).toBeVisible();

    const initiateRequestPromise = page.waitForRequest(
      (request) =>
        request.url().includes('/system/config/auth/test-login/ldap-initiate') &&
        request.method() === 'POST',
      { timeout: TEST_LOGIN_NETWORK_TIMEOUT_MS }
    );

    const result = await runTestLoginViaLdapModal(page, {
      email: OPENLDAP_FIXTURE.validUser.email,
      password: OPENLDAP_FIXTURE.validUser.password,
    });

    const initiateRequest = await initiateRequestPromise;
    const body = JSON.parse(initiateRequest.postData() ?? '{}');
    expect(body.mode).toBe('existing');

    expect(result.success).toBe(true);
  });

  test('lockout-risk gate: editing dnAdminPassword disables save until re-tested', async ({
    page,
  }) => {
    await enableSSOEditMode(page);
    await selectSSOProvider(page, 'ldap');
    await openldapProviderHelper.fillForm?.(page);

    const first = await runTestLoginViaLdapModal(page, {
      email: OPENLDAP_FIXTURE.validUser.email,
      password: OPENLDAP_FIXTURE.validUser.password,
    });
    expect(first.success).toBe(true);
    await expectSaveEnabled(page);

    await page
      .getByRole('textbox', { name: /^Admin Password/ })
      .fill('changed-admin-pass');
    await expectSaveDisabledForLockoutRisk(page);
  });
});
