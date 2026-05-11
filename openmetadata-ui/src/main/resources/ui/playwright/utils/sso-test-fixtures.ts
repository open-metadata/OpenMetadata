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
import { APIRequestContext } from '@playwright/test';
import { test as base } from '../e2e/fixtures/pages';
import { getAuthContext, getToken, redirectToHomePage } from './common';
import {
  fetchSecurityConfig,
  restoreSecurityConfig,
  SecurityConfigSnapshot,
} from './ssoAuth';
import { clearCapturedTestLoginResult, installTestLoginCapture } from './sso';

export type SsoFixtures = {
  adminApiContext: APIRequestContext;
  originalConfig: SecurityConfigSnapshot;
};

let cachedAdminContext: APIRequestContext | undefined;
let cachedOriginalConfig: SecurityConfigSnapshot | undefined;

const swallowRestoreFailure = (label: string) => (error: unknown) => {
  console.warn(
    `[${label}] restoreSecurityConfig failed: ${
      error instanceof Error ? error.message : String(error)
    }`
  );
};

export const ssoTest = base.extend<SsoFixtures>({
  page: async ({ page }, use) => {
    await installTestLoginCapture(page);
    await redirectToHomePage(page);
    await clearCapturedTestLoginResult(page);
    await use(page);
  },

  adminApiContext: async ({ page }, use) => {
    if (!cachedAdminContext) {
      cachedAdminContext = await getAuthContext(await getToken(page));
    }

    await use(cachedAdminContext);
  },

  originalConfig: async ({ adminApiContext }, use, testInfo) => {
    if (!cachedOriginalConfig) {
      cachedOriginalConfig = await fetchSecurityConfig(adminApiContext);
    } else {
      await restoreSecurityConfig(adminApiContext, cachedOriginalConfig).catch(
        swallowRestoreFailure(`${testInfo.title} beforeEach`)
      );
    }

    await use(cachedOriginalConfig);

    await restoreSecurityConfig(adminApiContext, cachedOriginalConfig).catch(
      swallowRestoreFailure(`${testInfo.title} afterEach`)
    );
  },
});
