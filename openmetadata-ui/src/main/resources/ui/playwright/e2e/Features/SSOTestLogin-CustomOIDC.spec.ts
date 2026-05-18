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

import { APIRequestContext, expect, Page } from '@playwright/test';
import {
  MOCK_OIDC_CLIENT_ID,
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
    expect(result.suggestedEmailClaim).toBe('email');

    const pickedEmailClaim = result.suggestedEmailClaim ?? 'email';
    await pickEmailClaim(page, pickedEmailClaim);
    await expectEmailClaimStatusSet(page, pickedEmailClaim);
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
      expect(auth.emailClaim).toBe(pickedEmailClaim);
      expect(auth.clientId).toBe(MOCK_OIDC_CLIENT_ID);
      const oidc = (auth.oidcConfiguration ?? {}) as Record<string, unknown>;
      expect(oidc.id).toBe(MOCK_OIDC_CLIENT_ID);
      expect(oidc.secret).not.toBe('openmetadata-test-secret');
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
    expect(stored.error ?? '').toMatch(/invalid_client|client|token|401|oidc/i);

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
    adminApiContext: apiContext,
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
    await pickEmailClaim(page, first.suggestedEmailClaim ?? 'email');
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

    await page
      .getByRole('textbox', { name: /^Client ID/ })
      .fill(MOCK_OIDC_CLIENT_ID);

    const retry = await runTestLoginViaPopup(
      page,
      customOidcProviderHelper,
      PROVIDER_CREDENTIALS
    );
    expect(retry.success).toBe(true);
    await pickEmailClaim(page, retry.suggestedEmailClaim ?? 'email');
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
      expect(auth.clientId).toBe(MOCK_OIDC_CLIENT_ID);
    });
  });

  test('mode=existing overlay preserves saved secret across save cycle', async ({
    page,
    adminApiContext,
    originalConfig,
  }) => {
    const seedPayload = await customOidcProviderHelper.buildConfigPayload();
    await applyProviderConfig(adminApiContext, originalConfig, seedPayload);

    await enableSSOEditMode(page);
    await expect(page.getByTestId('save-sso-configuration')).toBeVisible();

    const first = await runTestLoginViaPopup(
      page,
      customOidcProviderHelper,
      PROVIDER_CREDENTIALS
    );
    expect(first.success).toBe(true);
    await pickEmailClaim(page, first.suggestedEmailClaim ?? 'email');
    await expectSaveEnabled(page);

    const saveResponsePromise = page.waitForResponse(
      (r) =>
        r.url().includes('/system/security/config') &&
        ['PUT', 'PATCH'].includes(r.request().method()),
      { timeout: TEST_LOGIN_NETWORK_TIMEOUT_MS }
    );
    await page.getByTestId('save-sso-configuration').click();
    expect((await saveResponsePromise).ok()).toBe(true);

    await enableSSOEditMode(page);
    await expect(page.getByTestId('save-sso-configuration')).toBeVisible();

    const second = await runTestLoginViaPopup(
      page,
      customOidcProviderHelper,
      PROVIDER_CREDENTIALS
    );
    expect(second.success).toBe(true);
    expect(second.error ?? '').toBe('');
  });

  const EMAIL_CLAIM_BANNER_DISMISSED_KEY = 'sso-emailClaim-banner-dismissed';

  const clearEmailClaimBannerDismiss = (page: Page) =>
    page.evaluate((key) => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* noop */
      }
    }, EMAIL_CLAIM_BANNER_DISMISSED_KEY);

  test('upgrade: existing OIDC config hydrates form, shows EmailClaimStatus=not-set and EmailClaimRecommendation banner', async ({
    page,
    adminApiContext,
    originalConfig,
  }) => {
    const seedPayload = await customOidcProviderHelper.buildConfigPayload();
    await applyProviderConfig(adminApiContext, originalConfig, seedPayload);
    await clearEmailClaimBannerDismiss(page);

    await enableSSOEditMode(page);

    await expect(page.getByTestId('save-sso-configuration')).toBeVisible();
    await expect(page.getByTestId('cancel-sso-configuration')).toBeVisible();

    await expect(page.getByRole('textbox', { name: /^Client ID/ })).toHaveValue(
      MOCK_OIDC_CLIENT_ID
    );
    await expect(
      page.getByRole('textbox', { name: /^Discovery URI/ })
    ).toHaveValue(/openid-configuration/);

    await expect(page.getByTestId('email-claim-status')).toBeVisible();
    await expect(page.getByTestId('email-claim-status-not-set')).toBeVisible();
    await expect(page.getByTestId('email-claim-status-set')).toBeHidden();
    await expect(page.getByTestId('email-claim-recommendation')).toBeVisible();
  });

  test('upgrade: save with non-lockout edit preserves every originally-seeded field on GET round-trip', async ({
    page,
    adminApiContext,
    originalConfig,
  }) => {
    const seedPayload = await customOidcProviderHelper.buildConfigPayload();
    await applyProviderConfig(adminApiContext, originalConfig, seedPayload);

    const seededAuth = seedPayload.authenticationConfiguration as Record<
      string,
      unknown
    >;
    const seededOidc = seededAuth.oidcConfiguration as Record<string, unknown>;
    const seededAuthorizer = seedPayload.authorizerConfiguration as Record<
      string,
      unknown
    >;
    const originalDomain = seededAuthorizer.principalDomain as string;
    const editedDomain = `edited-${originalDomain}`;

    await enableSSOEditMode(page);
    await expect(page.getByTestId('save-sso-configuration')).toBeVisible();

    await page
      .getByRole('textbox', { name: /^Principal Domain/ })
      .fill(editedDomain);

    const saveResponsePromise = page.waitForResponse(
      (r) =>
        r.url().includes('/system/security/config') &&
        ['PUT', 'PATCH'].includes(r.request().method()),
      { timeout: TEST_LOGIN_NETWORK_TIMEOUT_MS }
    );
    await page.getByTestId('save-sso-configuration').click();
    expect((await saveResponsePromise).ok()).toBe(true);

    await expectPersistedSecurityConfig(adminApiContext, (auth) => {
      expect(auth.provider).toBe(seededAuth.provider);
      expect(auth.clientId).toBe(seededAuth.clientId);
      expect(auth.callbackUrl).toBe(seededAuth.callbackUrl);
      expect(auth.tokenValidationAlgorithm).toBe(
        seededAuth.tokenValidationAlgorithm
      );
      expect(auth.jwtPrincipalClaims).toEqual(seededAuth.jwtPrincipalClaims);
      expect(auth.enableSelfSignup).toBe(seededAuth.enableSelfSignup);
      const oidc = (auth.oidcConfiguration ?? {}) as Record<string, unknown>;
      expect(oidc.id).toBe(seededOidc.id);
      expect(oidc.type).toBe(seededOidc.type);
      expect(oidc.scope).toBe(seededOidc.scope);
      expect(oidc.callbackUrl).toBe(seededOidc.callbackUrl);
      expect(oidc.secret).not.toBe(seededOidc.secret);
    });

    const verifyResponse = await adminApiContext.get(
      '/api/v1/system/security/config'
    );
    const persisted = (await verifyResponse.json()) as {
      authorizerConfiguration: Record<string, unknown>;
    };
    expect(persisted.authorizerConfiguration.principalDomain).toBe(
      editedDomain
    );
  });

  test('upgrade: running Test Login on existing config sets emailClaim and preserves original fields', async ({
    page,
    adminApiContext,
    originalConfig,
  }) => {
    const seedPayload = await customOidcProviderHelper.buildConfigPayload();
    await applyProviderConfig(adminApiContext, originalConfig, seedPayload);

    const seededAuth = seedPayload.authenticationConfiguration as Record<
      string,
      unknown
    >;
    const seededOidc = seededAuth.oidcConfiguration as Record<string, unknown>;

    await enableSSOEditMode(page);

    const result = await runTestLoginViaPopup(
      page,
      customOidcProviderHelper,
      PROVIDER_CREDENTIALS
    );
    expect(result.success).toBe(true);

    const pickedEmailClaim = result.suggestedEmailClaim ?? 'email';
    await pickEmailClaim(page, pickedEmailClaim);
    await expectEmailClaimStatusSet(page, pickedEmailClaim);
    await expectSaveEnabled(page);

    const saveResponsePromise = page.waitForResponse(
      (r) =>
        r.url().includes('/system/security/config') &&
        ['PUT', 'PATCH'].includes(r.request().method()),
      { timeout: TEST_LOGIN_NETWORK_TIMEOUT_MS }
    );
    await page.getByTestId('save-sso-configuration').click();
    expect((await saveResponsePromise).ok()).toBe(true);

    await expectPersistedSecurityConfig(adminApiContext, (auth) => {
      expect(auth.emailClaim).toBe(pickedEmailClaim);
      expect(auth.clientId).toBe(seededAuth.clientId);
      expect(auth.jwtPrincipalClaims).toEqual(seededAuth.jwtPrincipalClaims);
      const oidc = (auth.oidcConfiguration ?? {}) as Record<string, unknown>;
      expect(oidc.id).toBe(seededOidc.id);
      expect(oidc.scope).toBe(seededOidc.scope);
    });
  });

  test('upgrade: EmailClaimRecommendation banner dismissal persists across reload', async ({
    page,
    adminApiContext,
    originalConfig,
  }) => {
    const seedPayload = await customOidcProviderHelper.buildConfigPayload();
    await applyProviderConfig(adminApiContext, originalConfig, seedPayload);
    await clearEmailClaimBannerDismiss(page);

    await enableSSOEditMode(page);
    const banner = page.getByTestId('email-claim-recommendation');
    await expect(banner).toBeVisible();

    await page.getByTestId('email-claim-recommendation-dismiss').click();
    await expect(banner).toBeHidden();

    await page.reload();
    await enableSSOEditMode(page);
    await expect(page.getByTestId('email-claim-recommendation')).toBeHidden();

    await clearEmailClaimBannerDismiss(page);
  });

  test('pre-flight validate failure with unreachable discoveryUri surfaces toast AND popup does not open', async ({
    page,
  }) => {
    await enableSSOEditMode(page);
    await selectSSOProvider(page, 'custom-oidc');
    await customOidcProviderHelper.fillForm?.(page);
    await page
      .getByRole('textbox', { name: /^Discovery URI/ })
      .fill('http://unreachable.invalid/.well-known/openid-configuration');

    let popupOpened = false;
    const popupListener = () => {
      popupOpened = true;
    };
    page.context().on('page', popupListener);

    try {
      await clickTestLoginButton(page);

      const errorIndicator = page
        .locator('.ant-message-error')
        .or(page.locator('.ant-notification-notice-error'))
        .or(page.getByRole('alert'))
        .first();
      await expect(errorIndicator).toBeVisible({ timeout: 15_000 });
      await expect(errorIndicator).toContainText(
        /discovery|uri|reach|unreachable|invalid|404|fetch/i
      );
      expect(popupOpened).toBe(false);
    } finally {
      page.context().off('page', popupListener);
    }
  });

  test('discoveryUri placeholder (e.g. {tenant-id}) is rejected client-side before any network call', async ({
    page,
  }) => {
    await enableSSOEditMode(page);
    await selectSSOProvider(page, 'custom-oidc');
    await customOidcProviderHelper.fillForm?.(page);
    await page
      .getByRole('textbox', { name: /^Discovery URI/ })
      .fill(
        'https://login.microsoftonline.com/{tenant-id}/v2.0/.well-known/openid-configuration'
      );

    let validateCalls = 0;
    let initiateCalls = 0;
    const requestListener = (request: import('@playwright/test').Request) => {
      const url = request.url();
      if (url.includes('/system/security/validate')) {
        validateCalls += 1;
      }
      if (url.includes('/system/config/auth/test-login/initiate')) {
        initiateCalls += 1;
      }
    };
    page.on('request', requestListener);

    try {
      await clickTestLoginButton(page);

      const errorIndicator = page
        .locator('.ant-message-error')
        .or(page.locator('.ant-notification-notice-error'))
        .or(page.getByRole('alert'))
        .first();
      await expect(errorIndicator).toBeVisible({ timeout: 5_000 });
      await expect(errorIndicator).toContainText(
        /placeholder|discovery|replace|\{|tenant/i
      );

      expect(validateCalls).toBe(0);
      expect(initiateCalls).toBe(0);
    } finally {
      page.off('request', requestListener);
    }
  });

  test('popup-blocked: window.open returns null surfaces toast, no popup opens, button re-enables', async ({
    page,
  }) => {
    await enableSSOEditMode(page);
    await selectSSOProvider(page, 'custom-oidc');
    await customOidcProviderHelper.fillForm?.(page);

    await page.evaluate(() => {
      (
        window as unknown as { open: (...args: unknown[]) => Window | null }
      ).open = () => null;
    });

    let popupOpened = false;
    const popupListener = () => {
      popupOpened = true;
    };
    page.context().on('page', popupListener);

    try {
      await clickTestLoginButton(page);

      const errorIndicator = page
        .locator('.ant-message-error')
        .or(page.locator('.ant-notification-notice-error'))
        .or(page.getByRole('alert'))
        .first();
      await expect(errorIndicator).toBeVisible({ timeout: 15_000 });
      await expect(errorIndicator).toContainText(/popup|blocked|allow/i);

      expect(popupOpened).toBe(false);
      await expect(page.getByTestId('test-login-button')).toBeEnabled();
    } finally {
      page.context().off('page', popupListener);
    }
  });

  test('popup-closed: user closes popup before completion triggers close-watch toast', async ({
    page,
  }) => {
    await enableSSOEditMode(page);
    await selectSSOProvider(page, 'custom-oidc');
    await customOidcProviderHelper.fillForm?.(page);

    await page
      .context()
      .route('**/test-login/initiate**', (route) => route.abort());

    const popupPromise = page.context().waitForEvent('page', {
      timeout: TEST_LOGIN_NETWORK_TIMEOUT_MS,
    });
    await clickTestLoginButton(page);
    const popup = await popupPromise;

    await popup.close();

    const errorIndicator = page
      .locator('.ant-message-error')
      .or(page.locator('.ant-notification-notice-error'))
      .or(page.getByRole('alert'))
      .first();
    await expect(errorIndicator).toBeVisible({ timeout: 15_000 });
    await expect(errorIndicator).toContainText(/closed|window|completed/i);

    await expect(page.getByTestId('test-login-button')).toBeEnabled();
  });

  test('timeout: popup never resolves within 60s, failTimeout closes popup and surfaces toast', async ({
    page,
  }) => {
    test.slow();

    await enableSSOEditMode(page);
    await selectSSOProvider(page, 'custom-oidc');
    await customOidcProviderHelper.fillForm?.(page);

    await page
      .context()
      .route(
        '**/test-login/initiate**',
        () => new Promise<void>(() => undefined)
      );

    const popupPromise = page.context().waitForEvent('page', {
      timeout: TEST_LOGIN_NETWORK_TIMEOUT_MS,
    });
    await clickTestLoginButton(page);
    const popup = await popupPromise;

    const errorIndicator = page
      .locator('.ant-message-error')
      .or(page.locator('.ant-notification-notice-error'))
      .or(page.getByRole('alert'))
      .first();
    await expect(errorIndicator).toBeVisible({ timeout: 75_000 });
    await expect(errorIndicator).toContainText(/timeout|timed out|try again/i);

    await expect.poll(() => popup.isClosed(), { timeout: 10_000 }).toBe(true);
    await expect(page.getByTestId('test-login-button')).toBeEnabled();
  });

  test('ClaimSelector cancel keeps the Save gate armed (no emailClaim bypass)', async ({
    page,
  }) => {
    await enableSSOEditMode(page);
    await selectSSOProvider(page, 'custom-oidc');
    await customOidcProviderHelper.fillForm?.(page);

    const result = await runTestLoginViaPopup(
      page,
      customOidcProviderHelper,
      PROVIDER_CREDENTIALS
    );
    expect(result.success).toBe(true);

    const modal = page.getByTestId('sso-claim-selector-modal');
    await expect(modal).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();

    await expectSaveBlockedAtClick(page);
  });
});
