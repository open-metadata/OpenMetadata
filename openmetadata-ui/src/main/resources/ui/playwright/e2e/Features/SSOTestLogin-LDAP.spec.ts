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

import { expect } from '@playwright/test';
import * as net from 'net';
import {
  enableSSOEditMode,
  expandSSOAdvancedFields,
  expectSaveDisabledForLockoutRisk,
  expectSaveEnabled,
  runTestLoginViaLdapModal,
  selectSSOProvider,
  TEST_LOGIN_NETWORK_TIMEOUT_MS,
} from '../../utils/sso';
import {
  openldapProviderHelper,
  OPENLDAP_FIXTURE,
} from '../../utils/sso-providers/openldap';
import { ssoTest as test } from '../../utils/sso-test-fixtures';
import {
  applyProviderConfig,
  expectPersistedSecurityConfig,
} from '../../utils/ssoAuth';

const LDAP_HOST_PROBE_PORT = Number.parseInt(
  process.env.LDAP_HOST_PROBE_PORT ?? '1389',
  10
);

const probeLdapReachable = (): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (ok: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(2_000);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(LDAP_HOST_PROBE_PORT, 'localhost');
  });

const ensureLdapFixtureReady = async () => {
  const reachable = await probeLdapReachable();
  // eslint-disable-next-line playwright/no-skipped-test -- conditional skip when the OpenLDAP fixture isn't reachable; this spec only runs against the sso-test docker profile
  test.skip(
    !reachable,
    `OpenLDAP fixture not reachable at localhost:${LDAP_HOST_PROBE_PORT}. ` +
      `Bring it up with 'docker compose -f docker/development/docker-compose.yml --profile sso-test up -d' first.`
  );
};

test.describe('SSO Test Login — LDAP', () => {
  test.beforeEach(async ({ originalConfig: _ }) => {
    await ensureLdapFixtureReady();
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
    expect(result.suggestedAdminPrincipal).toBe(
      OPENLDAP_FIXTURE.validUser.email
    );

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
    expect(result.error ?? '').toMatch(/invalid|password|credential|ldap/i);

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
        request
          .url()
          .includes('/system/config/auth/test-login/ldap-initiate') &&
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
    adminApiContext: apiContext,
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

    await page
      .getByRole('textbox', { name: /^Admin Password/ })
      .fill(OPENLDAP_FIXTURE.adminPassword);

    const retry = await runTestLoginViaLdapModal(page, {
      email: OPENLDAP_FIXTURE.validUser.email,
      password: OPENLDAP_FIXTURE.validUser.password,
    });
    expect(retry.success).toBe(true);
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
      expect(ldap.dnAdminPassword).not.toBe('changed-admin-pass');
      expect(ldap.dnAdminPassword).not.toBe(OPENLDAP_FIXTURE.adminPassword);
    });
  });

  test('upgrade: existing LDAP config hydrates bind fields in main, advanced fields in Advanced accordion', async ({
    page,
    adminApiContext,
    originalConfig,
  }) => {
    const seedPayload = await openldapProviderHelper.buildConfigPayload();
    await applyProviderConfig(adminApiContext, originalConfig, seedPayload);

    await enableSSOEditMode(page);
    await expect(page.getByTestId('save-sso-configuration')).toBeVisible();

    await expect(page.getByRole('textbox', { name: /^LDAP Host/ })).toHaveValue(
      OPENLDAP_FIXTURE.host
    );
    await expect(
      page.getByRole('spinbutton', { name: /^LDAP Port/ })
    ).toHaveValue(String(OPENLDAP_FIXTURE.port));
    await expect(
      page.getByRole('textbox', { name: /^Admin Principal DN/ })
    ).toHaveValue(OPENLDAP_FIXTURE.adminDn);
    const adminPwField = page.getByRole('textbox', { name: /^Admin Password/ });
    await expect(adminPwField).toBeVisible();
    await expect(adminPwField).not.toHaveValue('');
    await expect(
      page.getByRole('textbox', { name: /^User Base DN/ })
    ).toHaveValue(OPENLDAP_FIXTURE.userBaseDN);
    await expect(
      page.getByRole('textbox', { name: /^Mail Attribute Name/ })
    ).toHaveValue(OPENLDAP_FIXTURE.mailAttributeName);

    await expandSSOAdvancedFields(page);
    await expect(
      page.getByRole('spinbutton', { name: /^Max Pool Size/ })
    ).toHaveValue('3');
  });
});
