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
import { redirectToHomePage } from '../../utils/common';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('API docs should work properly', () => {
  test.beforeEach('Visit entity details page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('API docs should work properly', async ({ page }) => {
    await page.locator('[data-testid="help-icon"]').click();
    await page.getByRole('link', { name: 'API', exact: true }).click();

    await page.getByTestId('loader').waitFor({ state: 'detached' });

    await expect(
      page.getByRole('link', {
        name: 'openmetadata-dev@googlegroups.com',
        exact: true,
      })
    ).toBeVisible();
    await expect(
      page.getByRole('link', {
        name: 'https://open-metadata.org',
        exact: true,
      })
    ).toBeVisible();
  });
});
