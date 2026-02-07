/*
 *  Copyright 2024 Collate.
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
import { expect, test } from '@playwright/test';
import { GlobalSettingOptions } from '../../constant/settings';
import { redirectToHomePage } from '../../utils/common';
import { settingClick } from '../../utils/sidebar';
import { PLAYWRIGHT_INGESTION_TAG_OBJ } from '../../constant/config';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Health Check for OpenMetadata', PLAYWRIGHT_INGESTION_TAG_OBJ, () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('All 5 checks should be successful', async ({ page }) => {
    const healthResponse = page.waitForResponse('/api/v1/system/status');
    await settingClick(page, GlobalSettingOptions.OM_HEALTH);

    await healthResponse;

    await expect(
      page.locator('[data-testid="database"] .success-status')
    ).toHaveText('Success');
    await expect(
      page.locator('[data-testid="searchInstance"] .success-status')
    ).toHaveText('Success');
    await expect(
      page.locator('[data-testid="pipelineServiceClient"] .success-status')
    ).toHaveText('Success');
    await expect(
      page.locator('[data-testid="jwks"] .success-status')
    ).toHaveText('Success');
    await expect(
      page.locator('[data-testid="migrations"] .success-status')
    ).toHaveText('Success');
  });
});
