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
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const classification = new ClassificationClass({
  provider: 'system',
  mutuallyExclusive: true,
});
const tag = new TagClass({
  classification: classification.data.name,
});

test.beforeAll(async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await classification.create(apiContext);
  await classification.patch(apiContext, [
    {
      op: 'add',
      path: '/description',
      value: 'Description for newly added service',
    },
  ]);
  await tag.create(apiContext);
  await afterAction();
});

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
  await classification.visitPage(page);
});

test('Classification version page', async ({ page }) => {
  // Click on version 0.2
  const versionDetailResponse = page.waitForResponse(
    `/api/v1/classifications/${classification.responseData?.id}/versions/0.2`
  );
  await page.click('[data-testid="version-button"]:has-text("0.2")');
  await versionDetailResponse;

  // Check for added description
  await expect(
    page.getByTestId('markdown-parser').getByText('Description')
  ).toBeVisible();

  // Toggle disable/enable
  const tagsDetailResponse = page.waitForResponse(
    `/api/v1/classifications/name/${classification.data.name}?fields=*`
  );
  await page.click('[data-testid="version-button"]');
  await tagsDetailResponse;
  await page.click('[data-testid="manage-button"]');

  const patchClassificationResponse = page.waitForResponse(
    `/api/v1/classifications/${classification.responseData?.id}`
  );
  await page.click('[data-testid="enable-disable"]');
  await patchClassificationResponse;

  // Verify disabled state
  await page.click('[data-testid="version-button"]:has-text("0.2")');

  await expect(page.locator('[data-testid="disabled"]')).toBeVisible();

  // Toggle back to enabled
  await page.click('[data-testid="version-button"]:has-text("0.2")');
  await page.click('[data-testid="manage-button"]');
  const patchClassificationResponse2 = page.waitForResponse(
    `/api/v1/classifications/${classification.responseData?.id}`
  );
  await page.click('[data-testid="enable-disable"]');
  await patchClassificationResponse2;

  // Verify enabled state
  await page.click('[data-testid="version-button"]:has-text("0.2")');

  await expect(
    page.locator(`[data-testid="classification-${classification.data.name}"]`)
  ).not.toContainText('disabled');
});
