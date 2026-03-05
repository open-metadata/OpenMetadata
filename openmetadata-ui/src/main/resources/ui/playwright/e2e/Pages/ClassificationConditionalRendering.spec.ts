/*
 *  Copyright 2026 Collate.
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
import { SidebarItem } from '../../constant/sidebar';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { sidebarClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

const classification1 = new ClassificationClass();
const classification2 = new ClassificationClass();
const tag1 = new TagClass({ classification: classification1.data.name });
const tag2 = new TagClass({ classification: classification2.data.name });

test.beforeAll(async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await classification1.create(apiContext);
  await classification2.create(apiContext);
  await tag1.create(apiContext);
  await tag2.create(apiContext);
  await afterAction();
});

test.afterAll(async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await tag1.delete(apiContext);
  await tag2.delete(apiContext);
  await classification1.delete(apiContext);
  await classification2.delete(apiContext);
  await afterAction();
});

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
});

test('Should show loader then render classification content on initial page load', async ({
  page,
}) => {
  const classificationsResponse = page.waitForResponse(
    '/api/v1/classifications?**'
  );
  const tagsResponse = page.waitForResponse('/api/v1/tags*');
  await sidebarClick(page, SidebarItem.TAGS);
  await classificationsResponse;
  await tagsResponse;

  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  await expect(page.getByTestId('header')).toBeVisible();
  await expect(page.getByTestId('description-container')).toBeVisible();
  await expect(page.getByTestId('table')).toBeVisible();
  await expect(
    page.getByTestId('side-panel-classification').first()
  ).toBeVisible();
});

test('Should render all classification detail sections after loading', async ({
  page,
}) => {
  await classification1.visitPage(page);

  await expect(page.getByTestId('header')).toBeVisible();
  await expect(page.getByTestId('description-container')).toBeVisible();
  await expect(page.getByTestId('table')).toBeVisible();
  await expect(page.getByTestId('table')).toContainText(tag1.data.name);
  await expect(
    page.getByTestId('classification-owner-name')
  ).toBeVisible();
});

test('Should render correct content when switching between classifications', async ({
  page,
}) => {
  await classification1.visitPage(page);

  await expect(page.locator('.activeCategory')).toContainText(
    classification1.data.displayName
  );
  await expect(page.getByTestId('table')).toContainText(tag1.data.name);

  const tagsResponse = page.waitForResponse(
    `/api/v1/tags?*parent=${classification2.responseData.name}*`
  );
  await page
    .locator('[data-testid="side-panel-classification"]')
    .filter({ hasText: classification2.responseData.displayName })
    .click();
  await tagsResponse;

  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  await expect(page.locator('.activeCategory')).toContainText(
    classification2.data.displayName
  );
  await expect(page.getByTestId('header')).toBeVisible();
  await expect(page.getByTestId('table')).toBeVisible();
  await expect(page.getByTestId('table')).toContainText(tag2.data.name);
  await expect(page.getByTestId('description-container')).toBeVisible();
});

test('Should render classification correctly after page reload', async ({
  page,
}) => {
  await classification1.visitPage(page);

  const classificationsResponse = page.waitForResponse(
    '/api/v1/classifications?**'
  );
  await page.reload();
  await classificationsResponse;

  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  await expect(
    page.getByTestId('side-panel-classification').first()
  ).toBeVisible();
  await expect(page.getByTestId('header')).toBeVisible();
  await expect(page.getByTestId('table')).toBeVisible();
});
