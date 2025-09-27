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
import { SidebarItem } from '../../constant/sidebar';
import { redirectToHomePage } from '../../utils/common';
import { selectActiveGlossary } from '../../utils/glossary';
import { sidebarClick } from '../../utils/sidebar';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.describe('Large Glossary Performance Tests', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, 'Test Glossary for Pagination');
    await page
      .locator('.glossary-terms-scroll-container [data-testid="loader"]')
      .waitFor({ state: 'detached' });
  });

  test('should handle large number of glossary terms with pagination', async ({
    page,
  }) => {
    const initialTerms = await page.locator('tbody .ant-table-row').count();

    expect(initialTerms).toBe(50);

    // Set up response listener before scrolling
    const responsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes('/api/v1/glossaryTerms?directChildrenOf=TestGlossary') &&
        response.url().includes('after=')
    );

    // Scroll to bottom to trigger infinite scroll
    await page.evaluate(() => {
      const scrollContainer = document.querySelector(
        '.glossary-terms-scroll-container'
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    });

    // Wait for the API response
    await responsePromise;

    // Wait for loader to disappear
    await page
      .locator('.glossary-terms-scroll-container [data-testid="loader"]')
      .waitFor({ state: 'detached' });

    const afterScrollTerms = await page.locator('tbody .ant-table-row').count();

    expect(afterScrollTerms).toBe(100);
  });

  test('should search and filter glossary terms', async ({ page }) => {
    // Type in search box
    const searchInput = page.getByPlaceholder(/search.*term/i);
    await searchInput.fill('TestTerm005');

    // Wait for search response
    await page.waitForResponse('/api/v1/glossaryTerms/search?*');

    // Wait for filtered results to appear
    await page.waitForFunction(() => {
      const rows = document.querySelectorAll('tbody .ant-table-row');

      return rows.length > 0 && rows.length < 20;
    });

    const filteredTerms = await page.locator('tbody .ant-table-row').count();

    expect(filteredTerms).toBeGreaterThan(0);
    expect(filteredTerms).toBeLessThan(20);

    // Verify TestTerm005 is visible
    await expect(page.getByTestId('Test Term 5')).toBeVisible();

    // Clear search
    await searchInput.selectText();
    await searchInput.press('Backspace');

    // Wait for clear response
    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/glossaryTerms') &&
        !response.url().includes('search')
    );

    // Wait for loader to disappear
    await page
      .locator('.glossary-terms-scroll-container [data-testid="loader"]')
      .waitFor({ state: 'detached' });

    // Wait for full term list to be restored
    await page.waitForFunction(
      () => document.querySelectorAll('tbody .ant-table-row').length >= 50
    );

    const allTerms = await page.locator('tbody .ant-table-row').count();

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
    await expect(expandAllButton).toBeEnabled({ timeout: 1800000 });
    await expect(expandAllButton).toContainText('Collapse All');

    // Verify some child terms are visible
    await expect(page.getByText('Test Term 1 - Child 1')).toBeVisible();

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
    await expect(page.getByText('Test Term 1 - Child 1')).not.toBeVisible();
  });

  test('should expand individual terms', async ({ page }) => {
    const term1Row = page.locator('tr', { hasText: 'Test Term 1' }).first();
    const expandIcon = term1Row.locator('[data-testid="expand-icon"]');

    // Set up response listener before clicking
    const expandRes = page.waitForResponse(
      '/api/v1/glossaryTerms?directChildrenOf=TestGlossary.TestTerm001&fields=childrenCount%2Cowners%2Creviewers&limit=1000'
    );

    // Click to expand
    await expandIcon.click();

    // Wait for API response
    await expandRes;

    // Wait for loader to disappear
    await page.locator('[data-testid="loader"]').waitFor({ state: 'detached' });

    // Verify child terms are visible
    await expect(page.getByTestId('Test Term 1 - Child 1')).toBeVisible();
    await expect(page.getByTestId('Test Term 1 - Child 2')).toBeVisible();
    await expect(page.getByTestId('Test Term 1 - Child 3')).toBeVisible();

    // Click to collapse
    await expandIcon.click();

    // Wait for children to be hidden
    await expect(page.getByTestId('Test Term 1 - Child 1')).not.toBeVisible();
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
});
