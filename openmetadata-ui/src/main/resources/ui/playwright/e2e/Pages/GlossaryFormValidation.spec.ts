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
import test, { expect } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { Glossary } from '../../support/glossary/Glossary';
import {
  descriptionBox,
  getApiContext,
  redirectToHomePage,
} from '../../utils/common';
import {
  openAddGlossaryTermModal,
  selectActiveGlossary,
} from '../../utils/glossary';
import { sidebarClick } from '../../utils/sidebar';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.describe('Glossary Form Validation', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should show error when glossary name is empty', async ({ page }) => {
    await sidebarClick(page, SidebarItem.GLOSSARY);

    await page.click('[data-testid="add-glossary"]');
    await page.waitForSelector('[data-testid="form-heading"]');

    // Fill description but leave name empty
    await page.locator(descriptionBox).fill('Test description');

    // Try to save
    await page.click('[data-testid="save-glossary"]');

    // Verify error message appears
    await expect(page.locator('.ant-form-item-explain-error')).toBeVisible();
  });

  test('should show error when glossary description is empty', async ({
    page,
  }) => {
    await sidebarClick(page, SidebarItem.GLOSSARY);

    await page.click('[data-testid="add-glossary"]');
    await page.waitForSelector('[data-testid="form-heading"]');

    // Fill name but leave description empty
    await page.fill('[data-testid="name"]', 'TestGlossary');

    // Try to save
    await page.click('[data-testid="save-glossary"]');

    // Verify error message appears for description
    await expect(
      page.locator('.ant-form-item-explain-error').first()
    ).toBeVisible();
  });

  test('should show error when creating glossary with duplicate name', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();

    try {
      await glossary.create(apiContext);

      await sidebarClick(page, SidebarItem.GLOSSARY);

      await page.click('[data-testid="add-glossary"]');
      await page.waitForSelector('[data-testid="form-heading"]');

      // Use the same name as existing glossary
      await page.fill('[data-testid="name"]', glossary.data.name);
      await page.locator(descriptionBox).fill('Test description');

      // Try to save
      await page.click('[data-testid="save-glossary"]');

      // Verify error toast or inline error appears
      await expect(
        page.getByText(/already exists|duplicate/i).first()
      ).toBeVisible({ timeout: 10000 });
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  test('should show error when term name is empty', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();

    try {
      await glossary.create(apiContext);

      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      await openAddGlossaryTermModal(page);

      // Fill description but leave name empty
      await page.locator(descriptionBox).fill('Test term description');

      // Try to save
      await page.click('[data-testid="save-glossary-term"]');

      // Verify error message appears
      await expect(page.locator('.ant-form-item-explain-error')).toBeVisible();
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  test('should show error when term description is empty', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();

    try {
      await glossary.create(apiContext);

      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      await openAddGlossaryTermModal(page);

      // Fill name but leave description empty
      await page.fill('[data-testid="name"]', 'TestTerm');

      // Try to save
      await page.click('[data-testid="save-glossary-term"]');

      // Verify error message appears
      await expect(
        page.locator('.ant-form-item-explain-error').first()
      ).toBeVisible();
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });
});
