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

import { BrowserContext, expect, Page, test } from '@playwright/test';
import { SSO_ENV } from '../../constant/ssoAuth';
import { performAdminLogin } from '../../utils/admin';
import { getAuthContext } from '../../utils/common';
import { getProviderHelper, ProviderHelper } from '../../utils/sso-providers';
import {
  applyProviderConfig,
  fetchSecurityConfig,
  restoreSecurityConfig,
  SecurityConfigSnapshot,
} from '../../utils/ssoAuth';
import { getToken } from '../../utils/tokenStorage';

const providerType = process.env[SSO_ENV.PROVIDER_TYPE] ?? '';
const username = process.env[SSO_ENV.USERNAME] ?? '';
const password = process.env[SSO_ENV.PASSWORD] ?? '';

const CLAIM_SCENARIOS = [
  {
    title: 'first-match claims order',
    auth: { jwtPrincipalClaims: ['email', 'preferred_username', 'sub'] },
  },
  {
    title: 'principal claims mapping (username:preferred_username)',
    auth: {
      jwtPrincipalClaims: ['preferred_username', 'email', 'sub'],
      jwtPrincipalClaimsMapping: ['username:preferred_username', 'email:email'],
    },
  },
];

for (const scenario of CLAIM_SCENARIOS) {
  test.describe(
    `Okta self-signup username resolution — ${scenario.title} (issue #26591)`,
    { tag: ['@sso', '@Platform'] },
    () => {
      test.slow();
      // eslint-disable-next-line playwright/no-skipped-test
      test.skip(
        providerType !== 'okta' || !username || !password,
        `Requires ${SSO_ENV.PROVIDER_TYPE}=okta with ${SSO_ENV.USERNAME}/${SSO_ENV.PASSWORD}`
      );

      test.describe.configure({ mode: 'serial' });

      let helper: ProviderHelper;
      let adminJwt: string | undefined;
      let originalSecurityConfig: SecurityConfigSnapshot | undefined;
      let userContext: BrowserContext | undefined;
      let userPage: Page | undefined;

      test.beforeAll(
        'Apply the Okta public config for this claim scenario',
        async ({ browser }) => {
          helper = getProviderHelper(providerType);
          const { apiContext, afterAction, page } = await performAdminLogin(
            browser
          );

          try {
            adminJwt = await getToken(page);

            if (!adminJwt) {
              throw new Error(
                'Failed to capture admin JWT before SSO swap — aborting to avoid leaving server in SSO mode'
              );
            }

            originalSecurityConfig = await fetchSecurityConfig(apiContext);
            const baseConfig = await helper.buildConfigPayload();

            await applyProviderConfig(apiContext, originalSecurityConfig, {
              ...baseConfig,
              authenticationConfiguration: {
                ...baseConfig.authenticationConfiguration,
                ...scenario.auth,
              },
            });
          } finally {
            await afterAction();
          }

          userContext = await browser.newContext();
          userPage = await userContext.newPage();
        }
      );

      test.afterAll('Restore original security configuration', async () => {
        await userPage?.close();
        await userContext?.close();

        if (!adminJwt || !originalSecurityConfig) {
          return;
        }

        const adminContext = await getAuthContext(adminJwt);

        try {
          await restoreSecurityConfig(adminContext, originalSecurityConfig);
        } finally {
          await adminContext.dispose();
        }
      });

      test('resolves a non-empty username on /signup', async () => {
        const page = userPage!;

        await test.step('Authenticate at Okta', async () => {
          await page.goto('/signin');

          const signInButton = page.locator('button.signin-button');

          await expect(signInButton).toBeVisible();
          await signInButton.click();
          await page.waitForURL(helper.loginUrlPattern, { timeout: 45_000 });
          await helper.performProviderLogin(page, { username, password });
        });

        await test.step('Verify the resolved username on /signup', async () => {
          await page.waitForURL(
            (url) =>
              url.pathname.endsWith('/signup') ||
              url.pathname.endsWith('/my-data'),
            { timeout: 60_000 }
          );

          expect(page.url()).toContain('/signup');

          await expect(page.getByTestId('username-input')).not.toHaveValue('');
        });
      });
    }
  );
}
