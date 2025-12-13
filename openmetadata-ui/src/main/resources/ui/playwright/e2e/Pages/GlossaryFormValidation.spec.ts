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
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import {
  createNewPage,
  descriptionBox,
  INVALID_NAMES,
  NAME_VALIDATION_ERROR,
  redirectToHomePage,
  toastNotification,
} from '../../utils/common';

import { sidebarClick } from '../../utils/sidebar';

const GLOSSARY_NAME_MAX_LENGTH_ERROR = 'Name size must be between 1 and 128';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.describe('Glossary Form Validation', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossaryTerm.delete(apiContext);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
  });

  test('should show error for empty glossary name', async ({ page }) => {
    await page.click('[data-testid="add-glossary"]');
    await page.waitForSelector('[data-testid="form-heading"]');

    await expect(page.locator('[data-testid="form-heading"]')).toHaveText(
      'Add Glossary'
    );

    await page.locator(descriptionBox).fill('Test description');
    await page.click('[data-testid="save-glossary"]');

    await expect(page.locator('#name_help')).toHaveText('Name is required');
  });

  test('should show error for empty glossary description', async ({ page }) => {
    await page.click('[data-testid="add-glossary"]');
    await page.waitForSelector('[data-testid="form-heading"]');

    await page.fill('[data-testid="name"]', 'TestGlossary');
    await page.click('[data-testid="save-glossary"]');

    await expect(page.locator('#description_help')).toHaveText(
      'Description is required'
    );
  });

  test('should show error for glossary name exceeding max length', async ({
    page,
  }) => {
    await page.click('[data-testid="add-glossary"]');
    await page.waitForSelector('[data-testid="form-heading"]');

    await page.fill('[data-testid="name"]', INVALID_NAMES.MAX_LENGTH);

    await expect(page.locator('#name_help')).toHaveText(
      GLOSSARY_NAME_MAX_LENGTH_ERROR
    );
  });

  test('should show error for glossary name with special characters', async ({
    page,
  }) => {
    await page.click('[data-testid="add-glossary"]');
    await page.waitForSelector('[data-testid="form-heading"]');

    await page.fill('[data-testid="name"]', INVALID_NAMES.WITH_SPECIAL_CHARS);

    await expect(page.locator('#name_help')).toHaveText(NAME_VALIDATION_ERROR);
  });

  test('should show error for duplicate glossary name', async ({ page }) => {
    await page.click('[data-testid="add-glossary"]');
    await page.waitForSelector('[data-testid="form-heading"]');

    await page.fill('[data-testid="name"]', glossary.data.name);
    await page.locator(descriptionBox).fill('Test description');

    const glossaryResponse = page.waitForResponse('/api/v1/glossaries');
    await page.click('[data-testid="save-glossary"]');
    await glossaryResponse;

    await toastNotification(page, /already exists/);
  });

  test('should allow cancel glossary creation', async ({ page }) => {
    await page.click('[data-testid="add-glossary"]');
    await page.waitForSelector('[data-testid="form-heading"]');

    await page.fill('[data-testid="name"]', 'TestCancelGlossary');
    await page.locator(descriptionBox).fill('Test description');

    await page.click('[data-testid="cancel-glossary"]');

    await expect(
      page.locator('[data-testid="form-heading"]')
    ).not.toBeVisible();
  });

  test('should show error for empty term name', async ({ page }) => {
    await glossary.visitEntityPage(page);

    await page.click('[data-testid="add-new-tag-button-header"]');
    await page.waitForSelector('[role="dialog"].edit-glossary-modal');

    await page.locator(descriptionBox).fill('Test description');
    await page.click('[data-testid="save-glossary-term"]');

    await expect(page.locator('#name_help')).toHaveText('Name is required');
  });

  test('should show error for empty term description', async ({ page }) => {
    await glossary.visitEntityPage(page);

    await page.click('[data-testid="add-new-tag-button-header"]');
    await page.waitForSelector('[role="dialog"].edit-glossary-modal');

    await page.fill('[data-testid="name"]', 'TestTerm');
    await page.click('[data-testid="save-glossary-term"]');

    await expect(page.locator('#description_help')).toHaveText(
      'Description is required'
    );
  });

  test('should show error for term name exceeding max length', async ({
    page,
  }) => {
    await glossary.visitEntityPage(page);

    await page.click('[data-testid="add-new-tag-button-header"]');
    await page.waitForSelector('[role="dialog"].edit-glossary-modal');

    await page.fill('[data-testid="name"]', INVALID_NAMES.MAX_LENGTH);

    await expect(page.locator('#name_help')).toHaveText(
      GLOSSARY_NAME_MAX_LENGTH_ERROR
    );
  });

  test('should show error for term name with special characters', async ({
    page,
  }) => {
    await glossary.visitEntityPage(page);

    await page.click('[data-testid="add-new-tag-button-header"]');
    await page.waitForSelector('[role="dialog"].edit-glossary-modal');

    await page.fill('[data-testid="name"]', INVALID_NAMES.WITH_SPECIAL_CHARS);

    await expect(page.locator('#name_help')).toHaveText(NAME_VALIDATION_ERROR);
  });

  test('should allow cancel term creation', async ({ page }) => {
    await glossary.visitEntityPage(page);

    await page.click('[data-testid="add-new-tag-button-header"]');
    await page.waitForSelector('[role="dialog"].edit-glossary-modal');

    await page.fill('[data-testid="name"]', 'TestCancelTerm');
    await page.locator(descriptionBox).fill('Test description');

    // Click cancel button in footer
    await page.locator('.ant-modal-footer button').first().click();

    await expect(
      page.locator('[role="dialog"].edit-glossary-modal')
    ).not.toBeVisible();
  });
});
