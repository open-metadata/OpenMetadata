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

import { APIRequestContext, expect } from '@playwright/test';
import {
  resetMockOidc,
  setTokenEndpointError,
  waitForMockOidcReady,
} from '../../utils/mockOidc';
import {
  clickTestLoginButton,
  enableSSOEditMode,
  expectEmailClaimStatusSet,
  expectSaveBlockedAtClick,
  expectSaveDisabledForLockoutRisk,
  expectSaveEnabled,
  pickEmailClaim,
  readTestLoginResultFromStorage,
  runTestLoginViaPopup,
  selectSSOProvider,
  TEST_LOGIN_CAPTURE_WINDOW_KEY,
  TEST_LOGIN_NETWORK_TIMEOUT_MS,
} from '../../utils/sso';
import { customOidcProviderHelper } from '../../utils/sso-providers/custom-oidc';
import { ssoTest as test } from '../../utils/sso-test-fixtures';
import {
  applyProviderConfig,
  expectPersistedSecurityConfig,
} from '../../utils/ssoAuth';

const PROVIDER_CREDENTIALS = { username: 'admin', password: 'unused' };

const ensureFixtureReady = async (request: APIRequestContext) => {
  try {
    await waitForMockOidcReady(request, 5_000);
  } catch (error) {
    // eslint-disable-next-line playwright/no-skipped-test -- conditional skip when the mock OIDC fixture isn't reachable; this spec only runs against the sso-test docker profile
    test.skip(
      true,
      `Mock OIDC provider not reachable at localhost:9090. ` +
        `Bring it up with 'docker compose --profile sso-test up -d' first. ` +
        `Underlying error: ${(error as Error).message}`
    );
  }
};

test.describe('SSO Test Login — Custom OIDC', () => {
  test.beforeEach(async ({ adminApiContext, originalConfig: _ }) => {
    await ensureFixtureReady(adminApiContext);
    await resetMockOidc(adminApiContext);
  });

  test('happy path: configure → test login → claim selector → save', async ({
    page,
    adminApiContext: apiContext,
  }) => {
    await enableSSOEditMode(page);
    await selectSSOProvider(page, 'custom-oidc');
    await customOidcProviderHelper.fillForm?.(page);

    const result = await runTestLoginViaPopup(
      page,
      customOidcProviderHelper,
      PROVIDER_CREDENTIALS
    );

    expect(result.type).toBe('sso-test-login');
    expect(result.success).toBe(true);
    expect(result.claims).toBeDefined();
    expect(Object.keys(result.claims ?? {}).length).toBeGreaterThan(0);

    if (result.suggestedEmailClaim) {
      await pickEmailClaim(page, result.suggestedEmailClaim);
      await expectEmailClaimStatusSet(page, result.suggestedEmailClaim);
    } else {
      await page.getByTestId('sso-claim-selector-modal').waitFor({
        state: 'visible',
      });
      await page.keyboard.press('Escape');
    }
    await expectSaveEnabled(page);

    const saveResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/system/security/config') &&
        ['PUT', 'PATCH'].includes(response.request().method()),
      { timeout: TEST_LOGIN_NETWORK_TIMEOUT_MS }
    );
    await page.getByTestId('save-sso-configuration').click();
    const saveResponse = await saveResponsePromise;
    expect(saveResponse.ok()).toBe(true);

    await expectPersistedSecurityConfig(apiContext, (auth) => {
      expect(auth.provider).toBe('custom-oidc');
      expect(auth.emailClaim).toBe('email');
    });
  });

  test('failure path: invalid client secret surfaces error and disables save', async ({
    page,
    adminApiContext,
  }) => {
    await setTokenEndpointError(adminApiContext, 'invalid_client', 401);

    await enableSSOEditMode(page);
    await selectSSOProvider(page, 'custom-oidc');
    await customOidcProviderHelper.fillForm?.(page, { secret: 'wrong-secret' });

    await runTestLoginViaPopup(
      page,
      customOidcProviderHelper,
      PROVIDER_CREDENTIALS
    );
    const stored = await readTestLoginResultFromStorage(page);
    expect(stored.success).toBe(false);
    expect(stored.error).toBeTruthy();

    await expectSaveBlockedAtClick(page);
  });

  test('mode=existing overlay: re-test after save without retyping secret', async ({
    page,
    adminApiContext,
    originalConfig,
  }) => {
    const seedPayload = await customOidcProviderHelper.buildConfigPayload();
    await applyProviderConfig(adminApiContext, originalConfig, seedPayload);

    await enableSSOEditMode(page);
    await expect(page.getByTestId('save-sso-configuration')).toBeVisible();

    let initiateBody: string | undefined;
    const initiateSeenPromise = new Promise<void>((resolve) => {
      page.context().on('request', (request) => {
        if (
          request.url().includes('/system/config/auth/test-login/initiate') &&
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
          () => reject(new Error('initiate POST never observed')),
          TEST_LOGIN_NETWORK_TIMEOUT_MS
        )
      ),
    ]);
    expect(initiateBody ?? '').toContain('mode=existing');

    const popup = await popupPromise;
    const closePromise = popup.waitForEvent('close', { timeout: 60_000 });
    await popup.waitForLoadState('domcontentloaded').catch(() => undefined);
    await closePromise;

    const stored = await readTestLoginResultFromStorage(page);
    expect(stored.success).toBe(true);
  });

  test('lockout-risk gate: editing clientId disables save until re-tested', async ({
    page,
  }) => {
    await enableSSOEditMode(page);
    await selectSSOProvider(page, 'custom-oidc');
    await customOidcProviderHelper.fillForm?.(page);

    const first = await runTestLoginViaPopup(
      page,
      customOidcProviderHelper,
      PROVIDER_CREDENTIALS
    );
    expect(first.success).toBe(true);
    await pickEmailClaim(page, 'email');
    await expectSaveEnabled(page);

    await page
      .getByRole('textbox', { name: /^Client ID/ })
      .fill('changed-client-id');
    await expectSaveDisabledForLockoutRisk(page);

    const captured = await page.evaluate(
      (captureKey) =>
        (window as unknown as Record<string, unknown>)[captureKey] ?? null,
      TEST_LOGIN_CAPTURE_WINDOW_KEY
    );
    expect(captured).not.toBeNull();
  });
});
