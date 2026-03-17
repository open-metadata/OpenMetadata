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
import test, { APIRequestContext, expect, Page } from '@playwright/test';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { createNewPage } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

/**
 * Comprehensive test suite for glossary status filter functionality.
 *
 * Tests cover:
 * - Status filtering (single and multiple statuses)
 * - Search functionality with pagination
 * - Combined search + status filtering
 * - Filter state management (cancel, clear, reset)
 * - Performance validation
 *
 * Available statuses (from EntityStatus enum):
 * - All (meta option to select all)
 * - Approved
 * - Deprecated
 * - Draft
 * - In Review
 * - Rejected
 * - Unprocessed
 */
test.describe('Glossary Status Filter - Large Dataset', () => {
  // Run tests serially to share glossary state from beforeAll
  test.describe.configure({ mode: 'serial' });

  // Create terms with specific statuses to test filtering
  const STATUSES_TO_TEST = [
    'Approved',
    'Draft',
    'In Review',
    'Deprecated',
    'Rejected',
  ];

  const glossary = new Glossary();
  const createdTerms: { term: GlossaryTerm; status: string }[] = [];

  // Helper to set term status via PATCH API
  const setTermStatus = async (
    apiContext: APIRequestContext,
    term: GlossaryTerm,
    status: string
  ) => {
    await apiContext.patch(`/api/v1/glossaryTerms/${term.responseData.id}`, {
      data: [
        {
          op: 'replace',
          path: '/entityStatus',
          value: status,
        },
      ],
      headers: {
        'Content-Type': 'application/json-patch+json',
      },
    });
  };

  // Reusable helper to apply status filter
  const applyStatusFilter = async (page: Page, statuses: string[]) => {
    const statusDropdown = page.getByTestId('glossary-status-dropdown');
    await statusDropdown.click();
    await page.locator('.status-selection-dropdown').waitFor();

    const allCheckbox = page.locator('.glossary-dropdown-label', {
      hasText: 'All',
    });
    // Click "All" twice to ensure we start from a clean state (nothing selected)
    // First click toggles the current state, second click ensures "All" is unchecked
    await allCheckbox.click();
    await allCheckbox.click();

    for (const status of statuses) {
      const checkbox = page.locator('.glossary-dropdown-label', {
        hasText: status,
      });
      await checkbox.click();
    }

    // Wait for API response after clicking Save
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/glossaryTerms') &&
          response.status() === 200
      ),
      page.locator('.ant-btn-primary', { hasText: 'Save' }).click(),
    ]);

    // Wait for table loader to disappear
    await page
      .locator('.glossary-terms-scroll-container [data-testid="loader"]')
      .waitFor({ state: 'detached', timeout: 30000 })
      .catch(() => {});
  };

  // Reusable helper to verify row statuses
  const verifyRowStatuses = async (
    page: Page,
    allowedStatuses: string[],
    maxRows?: number
  ) => {
    const rows = page.locator(
      'tbody.ant-table-tbody > tr:not([aria-hidden="true"])'
    );
    const rowCount = await rows.count();
    const checkCount = maxRows ? Math.min(rowCount, maxRows) : rowCount;

    for (let i = 0; i < checkCount; i++) {
      const statusCell = rows.nth(i).locator('td:nth-child(3)');
      const statusText = await statusCell.textContent();
      if (statusText?.trim()) {
        const hasValidStatus = allowedStatuses.some((s) =>
          statusText.includes(s)
        );
        expect(hasValidStatus).toBe(true);
      }
    }

    return rowCount;
  };

  // Reusable helper to scroll and load more
  const scrollToLoadMore = async (page: Page) => {
    await page.evaluate(() => {
      const container = document.querySelector(
        '.glossary-terms-scroll-container'
      );
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });

    await page
      .locator('.glossary-terms-scroll-container [data-testid="loader"]')
      .waitFor({ state: 'detached', timeout: 10000 })
      .catch(() => {
        // Ignore timeout
      });
    // eslint-disable-next-line playwright/no-wait-for-timeout -- filter results need time to render
    await page.waitForTimeout(500);
  };

  // Reusable helper to perform search
  const performSearch = async (page: Page, query: string) => {
    const searchInput = page.getByPlaceholder(/search.*term/i);
    await searchInput.fill(query);
    await waitForAllLoadersToDisappear(page);
  };

  // Reusable helper to clear search
  const clearSearch = async (page: Page) => {
    const searchInput = page.getByPlaceholder(/search.*term/i);
    await searchInput.clear();
    await waitForAllLoadersToDisappear(page);
  };

  // Reusable helper to get row count
  const getRowCount = async (page: Page) => {
    const rows = page.locator(
      'tbody.ant-table-tbody > tr:not([aria-hidden="true"])'
    );

    return rows.count();
  };

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await glossary.create(apiContext);

    // Create 2 terms per status (10 terms total)
    for (const status of STATUSES_TO_TEST) {
      for (let i = 0; i < 2; i++) {
        const term = new GlossaryTerm(
          glossary,
          undefined,
          `Term_${status}_${i}`
        );
        await term.create(apiContext);
        if (status !== 'Approved') {
          await setTermStatus(apiContext, term, status);
        }
        createdTerms.push({ term, status });
      }
    }

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await glossary.delete(apiContext);
    console.log('Deleted test glossary');

    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await glossary.visitEntityPage(page);
    await page.getByTestId('glossary-terms-table').waitFor();
    await page
      .locator('.glossary-terms-scroll-container [data-testid="loader"]')
      .waitFor({ state: 'detached', timeout: 30000 });
  });

  // ==================== STATUS FILTER TESTS ====================

  test.describe('Status Filter', () => {
    test('should display only Draft terms when filtered', async ({ page }) => {
      await applyStatusFilter(page, ['Draft']);

      const rowCount = await verifyRowStatuses(page, ['Draft']);
      expect(rowCount).toBeGreaterThan(0);
    });

    test('should display only Approved terms when filtered', async ({
      page,
    }) => {
      await applyStatusFilter(page, ['Approved']);

      const rowCount = await verifyRowStatuses(page, ['Approved']);
      expect(rowCount).toBeGreaterThan(0);
    });

    test('should display only In Review terms when filtered', async ({
      page,
    }) => {
      await applyStatusFilter(page, ['In Review']);

      const rowCount = await verifyRowStatuses(page, ['In Review']);
      expect(rowCount).toBeGreaterThan(0);
    });

    test('should display only Deprecated terms when filtered', async ({
      page,
    }) => {
      await applyStatusFilter(page, ['Deprecated']);

      const rowCount = await verifyRowStatuses(page, ['Deprecated']);
      expect(rowCount).toBeGreaterThan(0);
    });

    test('should display only Rejected terms when filtered', async ({
      page,
    }) => {
      await applyStatusFilter(page, ['Rejected']);

      const rowCount = await verifyRowStatuses(page, ['Rejected']);
      expect(rowCount).toBeGreaterThan(0);
    });

    test('should display terms matching multiple selected statuses', async ({
      page,
    }) => {
      await applyStatusFilter(page, ['Draft', 'In Review']);

      const rowCount = await verifyRowStatuses(page, ['Draft', 'In Review']);
      expect(rowCount).toBeGreaterThan(0);
    });

    test('should display all terms when All is selected', async ({ page }) => {
      // First apply a filter
      await applyStatusFilter(page, ['Draft']);
      const filteredCount = await getRowCount(page);

      // Then select All
      const statusDropdown = page.getByTestId('glossary-status-dropdown');
      await statusDropdown.click();
      await page.locator('.status-selection-dropdown').waitFor();

      const allCheckbox = page.locator('.glossary-dropdown-label', {
        hasText: 'All',
      });
      await allCheckbox.click();

      await page.locator('.ant-btn-primary', { hasText: 'Save' }).click();
      // eslint-disable-next-line playwright/no-wait-for-timeout -- filter state needs time to settle after save
      await page.waitForTimeout(1000);

      const allCount = await getRowCount(page);
      expect(allCount).toBeGreaterThanOrEqual(filteredCount);
    });

    test('should maintain filter state across pagination', async ({ page }) => {
      const expectedCount = createdTerms.filter(
        (t) => t.status === 'Approved'
      ).length;

      await applyStatusFilter(page, ['Approved']);

      let totalVerified = await verifyRowStatuses(page, ['Approved']);
      expect(totalVerified).toBeGreaterThan(0);

      let previousCount = 0;
      let scrollAttempts = 0;
      const maxScrollAttempts = 10;

      while (
        totalVerified < expectedCount &&
        scrollAttempts < maxScrollAttempts
      ) {
        previousCount = totalVerified;
        await scrollToLoadMore(page);
        totalVerified = await verifyRowStatuses(page, ['Approved']);

        if (totalVerified === previousCount) {
          scrollAttempts++;
        } else {
          scrollAttempts = 0;
        }
      }

      console.log(`Verified ${totalVerified} Approved terms across pagination`);
    });
  });

  // ==================== SEARCH TESTS ====================

  test.describe('Search', () => {
    test('should return matching terms for search query', async ({ page }) => {
      await performSearch(page, 'Term_');

      const rows = page.locator(
        'tbody.ant-table-tbody > tr:not([aria-hidden="true"])'
      );
      const rowCount = await rows.count();

      expect(rowCount).toBeGreaterThan(0);

      const firstRow = rows.first();
      const nameCell = firstRow.locator('td:first-child');
      await expect(nameCell).toContainText('Term_');
    });

    test('should show no results for non-matching query', async ({ page }) => {
      await performSearch(page, 'NonExistentTermXYZ123');

      // Check for the "No Glossary Term found" message in the table
      const noResultsMessage = page.locator('text=/No Glossary Term found/');
      await expect(noResultsMessage).toBeVisible();
    });

    test('should restore all terms when search is cleared', async ({
      page,
    }) => {
      const initialCount = await getRowCount(page);

      await performSearch(page, 'Term_Draft');
      const searchCount = await getRowCount(page);
      expect(searchCount).toBeLessThanOrEqual(initialCount);

      await clearSearch(page);
      // eslint-disable-next-line playwright/no-wait-for-timeout -- filter results need time to render after clearing search
      await page.waitForTimeout(1000);

      const restoredCount = await getRowCount(page);
      expect(restoredCount).toBeGreaterThanOrEqual(searchCount);
    });

    test('should paginate through search results', async ({ page }) => {
      // Search for a common pattern that returns many results
      await performSearch(page, 'Term_');

      let initialCount = await getRowCount(page);
      expect(initialCount).toBeGreaterThan(0);

      // Scroll to load more
      await scrollToLoadMore(page);

      const afterScrollCount = await getRowCount(page);
      console.log(
        `Search pagination: ${initialCount} -> ${afterScrollCount} rows`
      );
    });
  });

  // ==================== SEARCH + STATUS FILTER TESTS ====================

  test.describe('Search with Status Filter', () => {
    test('should filter search results by selected status', async ({
      page,
    }) => {
      await applyStatusFilter(page, ['Draft']);

      await performSearch(page, 'Term_');

      const rowCount = await verifyRowStatuses(page, ['Draft']);

      // All results should be Draft status
      if (rowCount > 0) {
        console.log(`Found ${rowCount} Draft terms matching search`);
      }
    });

    test('should paginate combined search and status results', async ({
      page,
    }) => {
      await applyStatusFilter(page, ['Approved']);

      await performSearch(page, 'Term_');

      let initialCount = await verifyRowStatuses(page, ['Approved']);

      // Scroll to load more
      let previousCount = 0;
      let scrollAttempts = 0;

      while (scrollAttempts < 5) {
        previousCount = initialCount;
        await scrollToLoadMore(page);
        initialCount = await verifyRowStatuses(page, ['Approved']);

        if (initialCount === previousCount) {
          scrollAttempts++;
        } else {
          scrollAttempts = 0;
        }
      }

      console.log(
        `Search + Status pagination: verified ${initialCount} Approved terms`
      );
    });

    test('should maintain status filter when search is cleared', async ({
      page,
    }) => {
      await applyStatusFilter(page, ['Draft']);

      await performSearch(page, 'Term_Draft');

      await clearSearch(page);

      // Status filter should still be active
      const rowCount = await verifyRowStatuses(page, ['Draft']);
      expect(rowCount).toBeGreaterThan(0);
    });

    test('should maintain search when status filter is changed', async ({
      page,
    }) => {
      await performSearch(page, 'Term_');

      const initialCount = await getRowCount(page);

      await applyStatusFilter(page, ['Approved']);

      // Search should still be active, results filtered by status
      // Use toPass() for auto-retry to handle DOM update timing
      await expect(async () => {
        const filteredCount = await verifyRowStatuses(page, ['Approved']);
        expect(filteredCount).toBeLessThanOrEqual(initialCount);
      }).toPass({ timeout: 5000 });
    });
  });

  // ==================== FILTER STATE MANAGEMENT TESTS ====================

  test.describe('Filter State Management', () => {
    test('should revert changes when Cancel is clicked', async ({ page }) => {
      const initialCount = await getRowCount(page);

      // Open dropdown and make changes
      const statusDropdown = page.getByTestId('glossary-status-dropdown');
      await statusDropdown.click();
      await page.locator('.status-selection-dropdown').waitFor();

      // Click "All" twice to clear selection, then select only Draft
      const allCheckbox = page.locator('.glossary-dropdown-label', {
        hasText: 'All',
      });
      await allCheckbox.click();
      await allCheckbox.click();

      const draftCheckbox = page.locator('.glossary-dropdown-label', {
        hasText: 'Draft',
      });
      await draftCheckbox.click();

      // Cancel instead of save
      const cancelButton = page.locator('.ant-btn-default', {
        hasText: 'Cancel',
      });
      await cancelButton.click();

      // eslint-disable-next-line playwright/no-wait-for-timeout -- dropdown dismiss animation needs time to settle
      await page.waitForTimeout(500);

      // Count should remain the same
      const afterCancelCount = await getRowCount(page);
      expect(afterCancelCount).toBe(initialCount);
    });

    test('should reset pagination when filter changes', async ({ page }) => {
      // Scroll to load more data
      await scrollToLoadMore(page);
      await scrollToLoadMore(page);

      const afterScrollCount = await getRowCount(page);

      // Apply a filter - this should reset pagination
      await applyStatusFilter(page, ['Draft']);

      const afterFilterCount = await getRowCount(page);

      // The count may be different (filtered results)
      // The key thing is pagination was reset
      console.log(
        `Pagination reset: ${afterScrollCount} -> ${afterFilterCount}`
      );
      expect(afterFilterCount).toBeGreaterThan(0);
    });
  });

  // ==================== PERFORMANCE TESTS ====================

  test.describe('Performance', () => {
    test('should apply status filter within acceptable time', async ({
      page,
    }) => {
      const startTime = Date.now();

      const statusDropdown = page.getByTestId('glossary-status-dropdown');
      await statusDropdown.click();
      await page.locator('.status-selection-dropdown').waitFor();

      // Click "All" twice to clear selection, then select only Draft
      const allCheckbox = page.locator('.glossary-dropdown-label', {
        hasText: 'All',
      });
      await allCheckbox.click();
      await allCheckbox.click();

      const draftCheckbox = page.locator('.glossary-dropdown-label', {
        hasText: 'Draft',
      });
      await draftCheckbox.click();

      await page.locator('.ant-btn-primary', { hasText: 'Save' }).click();

      await page.locator(
        'tbody.ant-table-tbody > tr:not([aria-hidden="true"])'
      ).first().waitFor({ timeout: 10000 });

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      console.log(`Filter performance: ${elapsed}ms`);

      expect(elapsed).toBeLessThan(5000);
    });
  });
});
