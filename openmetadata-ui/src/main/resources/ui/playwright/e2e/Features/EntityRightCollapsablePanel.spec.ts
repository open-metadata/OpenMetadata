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
import test, { expect } from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const table = new TableClass();

test.beforeAll('Setup pre-requests', async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await table.create(apiContext);
  await afterAction();
});

test.afterAll('Cleanup', async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await table.delete(apiContext);
  await afterAction();
});

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
  await table.visitEntityPage(page);
});

test('Show and Hide Right Collapsable Panel', async ({ page }) => {
  // Click on the tab expand button to hide the right collapsable panel
  await page.click('[data-testid="tab-expand-button"]');

  await expect(
    page.locator('[data-testid="KnowledgePanel.DataProducts"]')
  ).not.toBeVisible();

  await expect(
    page.locator('[data-testid="KnowledgePanel.Tags"]')
  ).not.toBeVisible();

  await expect(
    page.locator('[data-testid="KnowledgePanel.GlossaryTerms"]')
  ).not.toBeVisible();

  await expect(
    page.locator('[data-testid="KnowledgePanel.TableConstraints"]')
  ).not.toBeVisible();

  // Click on the tab expand button to show the right collapsable panel
  await page.click('[data-testid="tab-expand-button"]');

  await expect(
    page.locator('[data-testid="KnowledgePanel.DataProducts"]')
  ).toBeVisible();

  await expect(
    page.locator('[data-testid="KnowledgePanel.Tags"]')
  ).toBeVisible();

  await expect(
    page.locator('[data-testid="KnowledgePanel.GlossaryTerms"]')
  ).toBeVisible();

  await expect(
    page.locator('[data-testid="KnowledgePanel.TableConstraints"]')
  ).toBeVisible();
});
