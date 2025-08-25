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
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { createNewPage } from '../../utils/common';
import {
  confirmationDragAndDropGlossary,
  dragAndDropTerm,
} from '../../utils/glossary';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.describe('Large Glossary Performance Tests', () => {
  const TOTAL_TERMS = 100; // Reduced for test performance
  const glossary = new Glossary();
  const glossaryTerms: GlossaryTerm[] = [];

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(8 * 60 * 1000);

    const { apiContext, afterAction } = await createNewPage(browser);

    await glossary.create(apiContext);

    // Create many terms with nested structure
    for (let i = 0; i < TOTAL_TERMS; i++) {
      const term = new GlossaryTerm(glossary, undefined, `Term_${i + 1}`);
      await term.create(apiContext);
      glossaryTerms.push(term);

      // Create some child terms for every 5th term
      if (i % 5 === 0) {
        for (let j = 0; j < 3; j++) {
          const childTerm = new GlossaryTerm(
            glossary,
            term.responseData.fullyQualifiedName,
            `Term_${i + 1}_Child_${j + 1}`
          );
          await childTerm.create(apiContext);
          glossaryTerms.push(childTerm);
        }
      }
    }

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    test.setTimeout(8 * 60 * 1000);

    const { apiContext, afterAction } = await createNewPage(browser);

    // // Clean up all terms and glossary
    for (const term of glossaryTerms.reverse()) {
      await term.delete(apiContext);
    }
    await glossary.delete(apiContext);

    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await glossary.visitEntityPage(page);
    // Wait for terms to load
    await page.waitForSelector('[data-testid="glossary-terms-table"]');
  });

  test('should handle large number of glossary terms with pagination', async ({
    page,
  }) => {
    const initialTerms = await page.locator('tbody .ant-table-row').count();

    await page
      .locator('.glossary-terms-scroll-container [data-testid="loader"]')
      .waitFor({ state: 'detached' });

    expect(initialTerms).toBe(50);

    // Scroll to bottom to trigger infinite scroll
    await page.evaluate(() => {
      const scrollContainer = document.querySelector(
        '.glossary-terms-scroll-container'
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    });

    // Wait for more terms to load
    await page.waitForResponse('api/v1/glossaryTerms?directChildrenOf*');
    await page
      .locator('.glossary-terms-scroll-container [data-testid="loader"]')
      .waitFor({ state: 'detached' });

    // Verify more terms are loaded

    const afterScrollTerms = await page.locator('tbody .ant-table-row').count();

    expect(afterScrollTerms).toBe(100);
  });

  test('should search and filter glossary terms', async ({ page }) => {
    // Type in search box
    const searchInput = page.getByPlaceholder(/search.*term/i);
    await searchInput.fill('Term_5');

    await page.waitForResponse('api/v1/glossaryTerms/search?*');
    // Verify filtered results

    const filteredTerms = await page.locator('tbody .ant-table-row').count();

    expect(filteredTerms).toBeGreaterThan(0);
    expect(filteredTerms).toBeLessThan(20); // Should show Term_5, Term_50-59, etc.

    // Verify Term_5 is visible
    await expect(page.getByText('Term_5', { exact: true })).toBeVisible();

    // Clear search
    await searchInput.clear();
    await page.waitForResponse('api/v1/glossaryTerms?*');

    // Verify all terms are shown again

    const allTerms = await page.locator('tbody .ant-table-row').count();

    // 51 because there is one additional row which is not rendered
    expect(allTerms).toBeGreaterThanOrEqual(50);
  });

  test('should expand and collapse all terms', async ({ page }) => {
    // Click expand all button
    const expandAllButton = page.getByTestId('expand-collapse-all-button');

    await expect(expandAllButton).toBeVisible();
    await expect(expandAllButton).toContainText('Expand All');

    // Click to expand all
    await expandAllButton.click();
    await page.waitForFunction(() => {
      return (
        document.querySelectorAll(
          '.glossary-terms-scroll-container [data-testid="loader"]'
        ).length === 0
      );
    });

    // Wait for expansion to complete (max 30 seconds)
    await expect(expandAllButton).toBeEnabled({ timeout: 30000 });
    await expect(expandAllButton).toContainText('Collapse All');

    // Verify some child terms are visible
    await expect(page.getByText('Term_1_Child_1')).toBeVisible();

    // Click to collapse all
    await expandAllButton.click();

    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => {
      return (
        document.querySelectorAll(
          '.glossary-terms-scroll-container [data-testid="loader"]'
        ).length === 0
      );
    });

    // Verify child terms are hidden
    await expect(page.getByText('Term_1_Child_1')).not.toBeVisible();
  });

  test('should expand individual terms', async ({ page }) => {
    // Find a term with children (Term_5)
    const term5Row = page.locator('tr', { hasText: 'Term_1' }).first();
    const expandIcon = term5Row.locator('[data-testid="expand-icon"]');

    // Click to expand
    await expandIcon.click();

    // Wait for children to load
    await expect(page.getByText('Term_1_Child_1')).toBeVisible();
    await expect(page.getByText('Term_1_Child_2')).toBeVisible();
    await expect(page.getByText('Term_1_Child_3')).toBeVisible();

    // Click to collapse
    await expandIcon.click();

    // Verify children are hidden
    await expect(page.getByText('Term_1_Child_1')).not.toBeVisible();
  });

  test('should maintain scroll position when loading more terms', async ({
    page,
  }) => {
    // Get initial scroll position
    await page.evaluate(() => {
      const scrollContainer = document.querySelector(
        '.glossary-terms-scroll-container'
      );

      return scrollContainer?.scrollTop || 0;
    });

    // Scroll down partially
    await page.evaluate(() => {
      const scrollContainer = document.querySelector(
        '.glossary-terms-scroll-container'
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = 200;
      }
    });

    const scrollPositionBeforeLoad = await page.evaluate(() => {
      const scrollContainer = document.querySelector(
        '.glossary-terms-scroll-container'
      );

      return scrollContainer?.scrollTop || 0;
    });

    // Trigger infinite scroll

    await page.evaluate(() => {
      const scrollContainer = document.querySelector(
        '.glossary-terms-scroll-container'
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    });

    // Wait for more terms to load
    await page
      .locator('.glossary-terms-scroll-container [data-testid="loader"]')
      .waitFor({ state: 'detached' });

    // Scroll back to previous position
    await page.evaluate((scrollPos) => {
      const scrollContainer = document.querySelector(
        '.glossary-terms-scroll-container'
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollPos;
      }
    }, scrollPositionBeforeLoad);

    // Verify we can still see the same content

    const currentScrollTop = await page.evaluate(() => {
      const scrollContainer = document.querySelector(
        '.glossary-terms-scroll-container'
      );

      return scrollContainer?.scrollTop || 0;
    });

    expect(Math.abs(currentScrollTop - scrollPositionBeforeLoad)).toBeLessThan(
      10
    );
  });

  test('should handle status filtering', async ({ page }) => {
    // Click status dropdown
    const statusDropdown = page.getByText('Status').first();
    await statusDropdown.click();

    // Wait for dropdown menu
    await page.waitForSelector('.status-selection-dropdown');

    // Check if status options are available
    const approvedCheckbox = page.locator('text=Approved').first();
    const draftCheckbox = page.locator('text=Draft').first();

    await expect(approvedCheckbox).toBeVisible();
    await expect(draftCheckbox).toBeVisible();

    // Close dropdown
    await page.keyboard.press('Escape');
  });

  test('should show term count in glossary listing', async ({ page }) => {
    // Verify term count is displayed
    const termCountElement = page.getByTestId('terms').getByTestId('count');
    const termCountText = await termCountElement.textContent();

    // Should show a count greater than 0
    expect(termCountText).toMatch(/\d+/);

    const count = parseInt(termCountText?.match(/\d+/)?.[0] || '0');

    expect(count).toBeGreaterThan(0);
  });

  test('should handle drag and drop for term reordering', async ({ page }) => {
    await dragAndDropTerm(page, 'Term_10', 'Term_1');

    await confirmationDragAndDropGlossary(page, 'Term_10', 'Term_1');

    await expect(
      page.getByRole('cell', {
        name: 'Term_10',
        exact: true,
      })
    ).not.toBeVisible();

    const termRes = page.waitForResponse('/api/v1/glossaryTerms?*');

    // verify the term is moved under the parent term
    await page.getByTestId('expand-collapse-all-button').click();
    await termRes;

    await expect(
      page.getByRole('cell', {
        name: 'Term_10',
        exact: true,
      })
    ).toBeVisible();
  });
});
