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

import { expect, Page, test } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { SidebarItem } from '../../constant/sidebar';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  redirectToHomePage,
  uuid,
  visitGlossaryPage,
} from '../../utils/common';
import { selectActiveGlossaryTerm } from '../../utils/glossary';
import { sidebarClick } from '../../utils/sidebar';

const adminUser = new UserClass();

/**
 * Helper function to perform a rename operation via the UI
 */
async function performRename(
  page: Page,
  newName: string,
  apiEndpoint: string
): Promise<void> {
  // Click manage button to open rename modal
  await page.getByTestId('manage-button').click();

  // Always use the Rename menu item with rename-button to handle pages with multiple rename buttons
  await page
    .getByRole('menuitem', { name: /Rename.*Name/i })
    .getByTestId('rename-button')
    .click();

  // Wait for modal to appear
  await expect(page.locator('#name')).toBeVisible();

  // Clear and enter new name
  await page.locator('#name').clear();
  await page.locator('#name').fill(newName);

  // Save the rename
  const patchResponse = page.waitForResponse(
    (response) =>
      response.url().includes(apiEndpoint) &&
      response.request().method() === 'PATCH'
  );
  await page.getByTestId('save-button').click();
  await patchResponse;

  // Wait for the UI to update
  await page.waitForLoadState('networkidle');
}

test.describe('Multiple Rename Tests', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
  test.beforeAll('Setup admin user', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await adminUser.create(apiContext);
    await adminUser.setAdminRole(apiContext);
    await afterAction();
  });

  test.afterAll('Cleanup admin user', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await adminUser.delete(apiContext);
    await afterAction();
  });

  test('Glossary - should handle multiple consecutive renames', async ({
    browser,
  }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);

    // Create a glossary for this test
    const glossary = new Glossary();
    await glossary.create(apiContext);

    const page = await browser.newPage();
    let currentName = glossary.data.name;

    try {
      await adminUser.login(page);
      await redirectToHomePage(page);

      // Navigate to glossary using displayName
      await visitGlossaryPage(page, glossary.responseData.displayName);

      // Perform 3 consecutive renames
      for (let i = 1; i <= 3; i++) {
        const newName = `renamed-glossary-${i}-${uuid()}`;

        await performRename(page, newName, '/api/v1/glossaries/');

        // Verify the header shows the new name
        await expect(page.getByTestId('entity-header-name')).toContainText(
          newName
        );

        currentName = newName;
      }

      // Verify the glossary is still accessible
      await expect(page.getByTestId('entity-header-name')).toBeVisible();
    } finally {
      await page.close();

      // Cleanup
      try {
        await apiContext.delete(
          `/api/v1/glossaries/name/${encodeURIComponent(
            currentName
          )}?hardDelete=true&recursive=true`
        );
      } catch {
        try {
          await glossary.delete(apiContext);
        } catch {
          // Ignore cleanup errors
        }
      }
      await afterAction();
    }
  });

  test('GlossaryTerm - should handle multiple consecutive renames', async ({
    browser,
  }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);

    // Create a glossary and term for this test
    const glossary = new Glossary();
    await glossary.create(apiContext);

    const glossaryTerm = new GlossaryTerm(glossary);
    await glossaryTerm.create(apiContext);

    const page = await browser.newPage();

    try {
      await adminUser.login(page);
      await redirectToHomePage(page);

      // Navigate to glossary term using displayName
      await visitGlossaryPage(page, glossary.responseData.displayName);
      await selectActiveGlossaryTerm(
        page,
        glossaryTerm.responseData.displayName
      );

      // Perform 3 consecutive renames
      for (let i = 1; i <= 3; i++) {
        const newName = `renamed-term-${i}-${uuid()}`;

        await performRename(page, newName, '/api/v1/glossaryTerms/');

        // Verify the header shows the new name
        await expect(page.getByTestId('entity-header-name')).toContainText(
          newName
        );
      }

      // Verify the term is still accessible
      await expect(page.getByTestId('entity-header-name')).toBeVisible();
    } finally {
      await page.close();

      // Cleanup - delete the glossary which will cascade delete the term
      try {
        await glossary.delete(apiContext);
      } catch {
        // Ignore cleanup errors
      }
      await afterAction();
    }
  });

  test('Classification - should handle multiple consecutive renames', async ({
    browser,
  }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);

    // Create a classification for this test
    const classification = new ClassificationClass();
    await classification.create(apiContext);

    const page = await browser.newPage();
    let currentName = classification.data.name;

    try {
      await adminUser.login(page);
      await redirectToHomePage(page);

      // Navigate to classification using side panel and displayName
      await sidebarClick(page, SidebarItem.TAGS);
      await page.waitForSelector('[data-testid="side-panel-classification"]');
      await page
        .locator('[data-testid="side-panel-classification"]')
        .filter({ hasText: classification.data.displayName })
        .click();

      // Wait for page to load
      await expect(page.getByTestId('entity-header-name')).toBeVisible();

      // Perform 3 consecutive renames
      for (let i = 1; i <= 3; i++) {
        const newName = `renamed-class-${i}-${uuid()}`;

        await performRename(page, newName, '/api/v1/classifications/');

        // Verify the header shows the new name
        await expect(page.getByTestId('entity-header-name')).toContainText(
          newName
        );

        currentName = newName;

        // Wait a bit for the UI to stabilize
        await page.waitForTimeout(500);
      }

      // Verify the classification is still accessible
      await expect(page.getByTestId('entity-header-name')).toBeVisible();
    } finally {
      await page.close();

      // Cleanup
      try {
        await apiContext.delete(
          `/api/v1/classifications/name/${encodeURIComponent(
            currentName
          )}?hardDelete=true&recursive=true`
        );
      } catch {
        try {
          await classification.delete(apiContext);
        } catch {
          // Ignore cleanup errors
        }
      }
      await afterAction();
    }
  });

  test('Tag - should handle multiple consecutive renames', async ({
    browser,
  }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);

    // Create a classification and tag for this test
    const classification = new ClassificationClass();
    await classification.create(apiContext);

    const tag = new TagClass({ classification: classification.data.name });
    await tag.create(apiContext);

    const page = await browser.newPage();

    try {
      await adminUser.login(page);
      await redirectToHomePage(page);

      // Navigate to tag using side panel and displayName
      await sidebarClick(page, SidebarItem.TAGS);
      await page.waitForSelector('[data-testid="side-panel-classification"]');
      await page
        .locator('[data-testid="side-panel-classification"]')
        .filter({ hasText: classification.data.displayName })
        .click();

      // Click on the tag using test id
      await page.getByTestId(tag.data.name).waitFor({ state: 'visible' });
      await page.getByTestId(tag.data.name).click();

      // Wait for page to load
      await expect(page.getByTestId('entity-header-name')).toBeVisible();

      // Perform 3 consecutive renames - Tag page has different menu structure
      for (let i = 1; i <= 3; i++) {
        const newName = `renamed-tag-${i}-${uuid()}`;

        // Tag page has multiple rename-button elements (Rename and Style)
        // So we need to specifically target the Rename menu item
        await page.getByTestId('manage-button').click();
        await page
          .getByRole('menuitem', { name: /Rename.*Name/i })
          .getByTestId('rename-button')
          .click();

        // Wait for modal to appear
        await expect(page.locator('#name')).toBeVisible();

        // Clear and enter new name
        await page.locator('#name').clear();
        await page.locator('#name').fill(newName);

        // Save the rename
        const patchResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/tags/') &&
            response.request().method() === 'PATCH'
        );
        await page.getByTestId('save-button').click();
        await patchResponse;

        // Wait for the UI to update
        await page.waitForLoadState('networkidle');

        // Verify the header shows the new name
        await expect(page.getByTestId('entity-header-name')).toContainText(
          newName
        );

        // Wait a bit for the UI to stabilize
        await page.waitForTimeout(500);
      }

      // Verify the tag is still accessible
      await expect(page.getByTestId('entity-header-name')).toBeVisible();
    } finally {
      await page.close();

      // Cleanup - delete the classification which will cascade delete the tag
      try {
        await classification.delete(apiContext);
      } catch {
        // Ignore cleanup errors
      }
      await afterAction();
    }
  });
});
