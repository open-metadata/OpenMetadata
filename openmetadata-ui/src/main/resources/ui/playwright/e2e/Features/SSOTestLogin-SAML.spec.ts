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
import { SSO_ENV } from '../../constant/ssoAuth';
import { ssoTest as test } from '../../utils/sso-test-fixtures';
import {
  applyProviderConfig,
  expectPersistedSecurityConfig,
  ProviderConfigOverride,
} from '../../utils/ssoAuth';
import {
  clickTestLoginButton,
  enableSSOEditMode,
  expectSaveDisabledForLockoutRisk,
  expectSaveEnabled,
  pickEmailClaim,
  readTestLoginResultFromStorage,
  runTestLoginViaPopup,
  selectSSOProvider,
  TEST_LOGIN_NETWORK_TIMEOUT_MS,
} from '../../utils/sso';
import { keycloakAzureSamlProviderHelper } from '../../utils/sso-providers/keycloak-saml';

const username = process.env[SSO_ENV.USERNAME] ?? '';
const password = process.env[SSO_ENV.PASSWORD] ?? '';

test.describe('SSO Test Login — SAML', () => {
  // eslint-disable-next-line playwright/no-skipped-test -- conditional skip when Keycloak SAML credentials aren't provided; the suite only runs when CI or the developer supplies them
  test.skip(
    !username || !password,
    `SAML Test Login spec needs ${SSO_ENV.USERNAME} and ${SSO_ENV.PASSWORD}` +
      ' (Keycloak realm credentials). Set them or run via the nightly workflow.'
  );

  let cachedSamlPayload: ProviderConfigOverride | undefined;
  const getSamlPayload = async (): Promise<ProviderConfigOverride> => {
    if (!cachedSamlPayload) {
      cachedSamlPayload =
        await keycloakAzureSamlProviderHelper.buildConfigPayload();
    }

    return cachedSamlPayload;
  };

  test.beforeEach(async ({ originalConfig: _ }) => {});

  test('happy path: configure → test login → claim selector → save', async ({
    page,
    adminApiContext: apiContext,
  }) => {
    const samlPayload = await getSamlPayload();

    await enableSSOEditMode(page);
    await selectSSOProvider(page, 'saml');
    await keycloakAzureSamlProviderHelper.fillForm?.(page);

    const result = await runTestLoginViaPopup(
      page,
      keycloakAzureSamlProviderHelper,
      { username, password }
    );

    expect(result.success).toBe(true);
    expect(result.claims).toBeDefined();
    const emailClaim = result.suggestedEmailClaim ?? 'email';
    await pickEmailClaim(page, emailClaim);
    await expectSaveEnabled(page);

    const saveResponsePromise = page.waitForResponse(
      (r) =>
        r.url().includes('/system/security/config') &&
        ['PUT', 'PATCH'].includes(r.request().method()),
      { timeout: TEST_LOGIN_NETWORK_TIMEOUT_MS }
    );
    await page.getByTestId('save-sso-configuration').click();
    expect((await saveResponsePromise).ok()).toBe(true);

    const expectedEntityId = (
      samlPayload.authenticationConfiguration as {
        samlConfiguration: { idp: { entityId: string } };
      }
    ).samlConfiguration.idp.entityId;
    await expectPersistedSecurityConfig(apiContext, (auth) => {
      expect(auth.provider).toBe('saml');
      const samlIdp = (
        auth.samlConfiguration as { idp?: { entityId?: string } } | undefined
      )?.idp;
      expect(samlIdp?.entityId).toBe(expectedEntityId);
    });
  });

  test('failure path: tampered IdP cert surfaces signature error', async ({
    page,
  }) => {
    await getSamlPayload();
    await enableSSOEditMode(page);
    await selectSSOProvider(page, 'saml');
    await keycloakAzureSamlProviderHelper.fillForm?.(page);

    const tamperedCert =
      '-----BEGIN CERTIFICATE-----\nMIIBIjANBg=\n-----END CERTIFICATE-----';
    await page
      .getByRole('textbox', { name: /^IdP X\.509 Certificate/ })
      .fill(tamperedCert);

    // java-saml's SettingsBuilder rejects malformed certs pre-flight, so the
    // popup never opens — wait for the inline error banner instead.
    await clickTestLoginButton(page);

    const errorBanner = page
      .getByRole('alert')
      .or(page.locator('.ant-message-error'))
      .or(page.locator('.ant-notification-notice-error'))
      .first();
    await expect(errorBanner).toBeVisible({ timeout: 15_000 });

    await expectSaveDisabledForLockoutRisk(page);
  });

  test('mode=existing overlay: re-test after save without retyping cert', async ({
    page,
    adminApiContext,
    originalConfig,
  }) => {
    const samlPayload = await getSamlPayload();
    await applyProviderConfig(adminApiContext, originalConfig, samlPayload);

    await enableSSOEditMode(page);
    await expect(page.getByTestId('save-sso-configuration')).toBeVisible();

    let initiateBody: string | undefined;
    const initiateSeenPromise = new Promise<void>((resolve) => {
      page.context().on('request', (request) => {
        if (
          request
            .url()
            .includes('/system/config/auth/test-login/saml-initiate') &&
          request.method() === 'POST'
        ) {
          initiateBody = request.postData() ?? '';
          resolve();
        }
      });
    });
    const popupPromise = page.context().waitForEvent('page', {
      timeout: TEST_LOGIN_NETWORK_TIMEOUT_MS,
    });
    await clickTestLoginButton(page);

    await Promise.race([
      initiateSeenPromise,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('saml-initiate POST never observed')),
          TEST_LOGIN_NETWORK_TIMEOUT_MS
        )
      ),
    ]);
    expect(initiateBody ?? '').toContain('mode=existing');

    const popup = await popupPromise;
    const closePromise = popup.waitForEvent('close', { timeout: 60_000 });
    await popup.waitForLoadState('domcontentloaded').catch(() => undefined);
    if (!popup.isClosed()) {
      await keycloakAzureSamlProviderHelper.performProviderLogin(popup, {
        username,
        password,
      });
    }
    await closePromise;

    const stored = await readTestLoginResultFromStorage(page);
    expect(stored.success).toBe(true);
  });

  test('lockout-risk gate: editing idpX509Certificate disables save until re-tested', async ({
    page,
  }) => {
    await getSamlPayload();
    await enableSSOEditMode(page);
    await selectSSOProvider(page, 'saml');
    await keycloakAzureSamlProviderHelper.fillForm?.(page);

    const first = await runTestLoginViaPopup(
      page,
      keycloakAzureSamlProviderHelper,
      { username, password }
    );
    expect(first.success).toBe(true);
    await pickEmailClaim(page, first.suggestedEmailClaim ?? 'email');
    await expectSaveEnabled(page);

    const altCert =
      '-----BEGIN CERTIFICATE-----\nMIICchanged=\n-----END CERTIFICATE-----';
    await page.getByRole('textbox', { name: /^IdP X\.509 Certificate/ }).fill(altCert);
    await expectSaveDisabledForLockoutRisk(page);
  });
});
