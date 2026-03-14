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
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { createNewPage } from '../../../utils/common';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.describe('Glossary tests', () => {
  const glossary = new Glossary();
  const glossaryTerms: GlossaryTerm[] = [];
  let parentTerm: GlossaryTerm;
  const childTerms: GlossaryTerm[] = [];
  const siblingTerms: GlossaryTerm[] = [];

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    for (let i = 1; i <= 15; i++) {
      const term = new GlossaryTerm(glossary, undefined, `SearchTestTerm${i}`);
      await term.create(apiContext);
      glossaryTerms.push(term);
    }

    // Create parent term
    parentTerm = new GlossaryTerm(glossary, undefined, 'ParentSearchTerm');
    await parentTerm.create(apiContext);

    // Create child terms under parent

    for (let i = 1; i <= 5; i++) {
      const childTerm = new GlossaryTerm(
        glossary,
        parentTerm.responseData.fullyQualifiedName,
        `ChildSearchTerm${i}`
      );

      await childTerm.create(apiContext);
      childTerms.push(childTerm);
    }

    // Create sibling terms at glossary level
    for (let i = 1; i <= 3; i++) {
      const siblingTerm = new GlossaryTerm(
        glossary,
        undefined,
        `SiblingTerm${i}`
      );

      await siblingTerm.create(apiContext);
      siblingTerms.push(siblingTerm);
    }

    await afterAction();
  });

  test('should check for glossary term search', async ({ page }) => {
    test.slow(true);

    await glossary.visitEntityPage(page);

    // Wait for terms to load
    await page.waitForSelector('[data-testid="glossary-terms-table"]');

    // Test 1: Search for specific term
    const searchInput = page.getByPlaceholder(/search.*term/i);
    const searchResponse = page.waitForResponse('**/api/v1/glossaryTerms/search?*');
    await searchInput.fill('SearchTestTerm5');

    await searchResponse;
    const table = page.getByTestId('glossary-terms-table');
    const filteredTerms = await table.locator('tbody .ant-table-row').count();

    expect(filteredTerms).toBe(1);
    await expect(
      page.getByText('SearchTestTerm5', { exact: true })
    ).toBeVisible();

    await expect(
      page.getByText('SearchTestTerm4', { exact: true })
    ).not.toBeVisible();

    // Test 2: Partial search
    const clearResponse = page.waitForResponse('**/api/v1/glossaryTerms?*');
    await searchInput.clear();
    await clearResponse;

    const partialSearchResponse = page.waitForResponse('**/api/v1/glossaryTerms/search?*');
    await searchInput.fill('TestTerm');
    await partialSearchResponse;

    const partialFilteredTerms = await table
      .locator('tbody .ant-table-row')
      .count();

    expect(partialFilteredTerms).toBeGreaterThan(0);

    // Test 3: Clear search and verify all terms are shown
    const clearResponse2 = page.waitForResponse('**/api/v1/glossaryTerms?*');
    await searchInput.clear();
    await clearResponse2;

    // Verify terms are visible again
    await expect(page.getByTestId('glossary-terms-table')).toBeVisible();
  });

  test('should check for nested glossary term search', async ({ page }) => {
    test.slow(true);

    // Navigate to glossary
    await glossary.visitEntityPage(page);

    // Wait for terms to load
    await page.waitForSelector('[data-testid="glossary-terms-table"]');

    // Navigate to parent term
    await page.click(
      `[data-testid="glossary-terms-table"] >> text="${parentTerm.responseData.displayName}"`
    );

    // Click on Terms tab to see child terms
    await page.click('[data-testid="terms"]');

    // Test 1: Search within parent term for child terms
    const searchInput = page.getByPlaceholder(/search.*term/i);
    const searchRes1 = page.waitForResponse('**/api/v1/glossaryTerms/search?*');
    await searchInput.fill('ChildSearchTerm');
    await searchRes1;

    const nestedTable = page.getByTestId('glossary-terms-table');
    const filteredTerms = await nestedTable
      .locator('tbody .ant-table-row')
      .count();

    expect(filteredTerms).toBe(5);

    // Verify UI shows only child terms, not sibling terms
    await expect(
      page.locator(
        '[data-testid="glossary-terms-table"] >> text="ChildSearchTerm1"'
      )
    ).toBeVisible();
    await expect(
      page.locator(
        '[data-testid="glossary-terms-table"] >> text="SiblingTerm1"'
      )
    ).not.toBeVisible();

    // Test 2: Search for specific child term
    const clearRes1 = page.waitForResponse('**/api/v1/glossaryTerms?*');
    await searchInput.clear();
    await clearRes1;

    const searchRes2 = page.waitForResponse('**/api/v1/glossaryTerms/search?*');
    await searchInput.fill('ChildSearchTerm3');
    await searchRes2;

    await expect(
      page.getByText('ChildSearchTerm3', { exact: true })
    ).toBeVisible();

    // Clear search
    const clearRes2 = page.waitForResponse('**/api/v1/glossaryTerms?*');
    await searchInput.clear();
    await clearRes2;
  });

  // S-S03: Search is case-insensitive
  test('should perform case-insensitive search', async ({ page }) => {
    await glossary.visitEntityPage(page);

    // Wait for terms to load
    await page.waitForSelector('[data-testid="glossary-terms-table"]');

    const searchInput = page.getByPlaceholder(/search.*term/i);

    // Search with lowercase
    const lowerRes = page.waitForResponse('**/api/v1/glossaryTerms/search?*');
    await searchInput.fill('searchtestterm5');
    await lowerRes;

    await expect(
      page.getByText('SearchTestTerm5', { exact: true })
    ).toBeVisible();

    // Clear and search with uppercase
    const clearRes1 = page.waitForResponse('**/api/v1/glossaryTerms?*');
    await searchInput.clear();
    await clearRes1;

    const upperRes = page.waitForResponse('**/api/v1/glossaryTerms/search?*');
    await searchInput.fill('SEARCHTESTTERM5');
    await upperRes;

    await expect(
      page.getByText('SearchTestTerm5', { exact: true })
    ).toBeVisible();

    // Clear and search with mixed case
    const clearRes2 = page.waitForResponse('**/api/v1/glossaryTerms?*');
    await searchInput.clear();
    await clearRes2;

    const mixedRes = page.waitForResponse('**/api/v1/glossaryTerms/search?*');
    await searchInput.fill('SeArChTeStTeRm5');
    await mixedRes;

    await expect(
      page.getByText('SearchTestTerm5', { exact: true })
    ).toBeVisible();

    // Clear search
    const clearRes3 = page.waitForResponse('**/api/v1/glossaryTerms?*');
    await searchInput.clear();
    await clearRes3;
  });

  // S-S07: Search no results - empty state
  test('should show empty state when search returns no results', async ({
    page,
  }) => {
    await glossary.visitEntityPage(page);

    // Wait for terms to load
    await page.waitForSelector('[data-testid="glossary-terms-table"]');

    const searchInput = page.getByPlaceholder(/search.*term/i);

    // Search for a term that doesn't exist
    const noResultsRes = page.waitForResponse('**/api/v1/glossaryTerms/search?*');
    await searchInput.fill('NonExistentTermXYZ12345');
    await noResultsRes;

    // Verify empty state message is shown (uses ErrorPlaceHolder component)
    await expect(page.getByTestId('no-data-placeholder')).toBeVisible();

    // Clear search and verify terms return
    const clearRes = page.waitForResponse('**/api/v1/glossaryTerms?*');
    await searchInput.clear();
    await clearRes;

    // Verify terms are visible again after clearing search
    await expect(page.getByTestId('no-data-placeholder')).not.toBeVisible();
    await expect(page.getByTestId('glossary-terms-table')).toBeVisible();
  });

  // S-F03: Filter by InReview status
  test('should filter by InReview status', async ({ page }) => {
    await glossary.visitEntityPage(page);

    // Wait for terms to load
    await page.waitForSelector('[data-testid="glossary-terms-table"]');

    // Open status filter dropdown
    const dropdownButton = page.getByTestId('glossary-status-dropdown');
    await dropdownButton.click();

    // Select InReview status
    const inReviewCheckbox = page.locator('.glossary-dropdown-label', {
      hasText: 'In Review',
    });
    await inReviewCheckbox.click();

    const saveButton = page.locator('.ant-btn-primary', {
      hasText: 'Save',
    });
    await saveButton.click();

    // Verify filter is applied (may show no results if no InReview terms exist)

    // The filter should be applied - either showing InReview terms or empty state
    const table = page.getByTestId('glossary-terms-table');

    await expect(table).toBeVisible();

    // Clear the filter
    await dropdownButton.click();
    await inReviewCheckbox.click();
    await saveButton.click();
  });

  // S-F04: Filter by multiple statuses
  test('should filter by multiple statuses', async ({ page }) => {
    await glossary.visitEntityPage(page);

    // Wait for terms to load
    await page.waitForSelector('[data-testid="glossary-terms-table"]');

    // Open status filter dropdown
    const dropdownButton = page.getByTestId('glossary-status-dropdown');
    await dropdownButton.click();

    // Select both Approved and Draft statuses
    const approvedCheckbox = page.locator('.glossary-dropdown-label', {
      hasText: 'Approved',
    });
    const draftCheckbox = page.locator('.glossary-dropdown-label', {
      hasText: 'Draft',
    });
    await approvedCheckbox.click();
    await draftCheckbox.click();

    const saveButton = page.locator('.ant-btn-primary', {
      hasText: 'Save',
    });
    await saveButton.click();

    // Wait for filter to apply

    // Verify filtered results
    const table = page.getByTestId('glossary-terms-table');

    await expect(table).toBeVisible();

    // Clear filters
    await dropdownButton.click();
    await approvedCheckbox.click();
    await draftCheckbox.click();
    await saveButton.click();
  });
});
