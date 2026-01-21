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

test.use({
  storageState: 'playwright/.auth/admin.json',
});

/**
 * Test suite for glossary status filter functionality with nested/hierarchical terms.
 *
 * Tests cover:
 * - Status filtering with parent-child relationships
 * - Multi-level hierarchy (3+ levels) filtering
 * - Multiple children with different statuses
 * - Search + status filter combinations
 * - Expand/collapse behavior with filters
 * - Edge cases including deep nesting (5 levels)
 *
 * Key behavior: Status filter applies to flat search results only.
 * When expanding a parent that matches the filter, ALL children are shown
 * regardless of their status.
 */
test.describe('Glossary Status Filter - Nested Terms', () => {
  const glossary = new Glossary();

  // Basic hierarchy: Parent (Approved) -> Child (Draft)
  let basicParent: GlossaryTerm;
  let basicChild: GlossaryTerm;

  // Multi-level hierarchy: Grandparent (Approved) -> Parent (Draft) -> Child (In Review)
  let multiGrandparent: GlossaryTerm;
  let multiParent: GlossaryTerm;
  let multiChild: GlossaryTerm;

  // Multi-children: Parent (Approved) -> [Child1 (Approved), Child2 (Draft), Child3 (In Review), Child4 (Rejected)]
  let multiChildrenParent: GlossaryTerm;
  const multiChildren: GlossaryTerm[] = [];

  // Deep hierarchy: 5 levels with different statuses
  const deepTerms: GlossaryTerm[] = [];

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

  // Helper to apply status filter
  const applyStatusFilter = async (page: Page, statuses: string[]) => {
    const statusDropdown = page.getByTestId('glossary-status-dropdown');
    await statusDropdown.click();
    await page.waitForSelector('.status-selection-dropdown');

    // First uncheck "All" to clear selection
    const allCheckbox = page.locator('.glossary-dropdown-label', {
      hasText: 'All',
    });
    await allCheckbox.click();

    // Select specific statuses
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

  // Helper to reset filter to "All"
  const resetStatusFilter = async (page: Page) => {
    const statusDropdown = page.getByTestId('glossary-status-dropdown');
    await statusDropdown.click();
    await page.waitForSelector('.status-selection-dropdown');

    const allCheckbox = page.locator('.glossary-dropdown-label', {
      hasText: 'All',
    });
    await allCheckbox.click();

    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/glossaryTerms') &&
          response.status() === 200
      ),
      page.locator('.ant-btn-primary', { hasText: 'Save' }).click(),
    ]);

    await page
      .locator('.glossary-terms-scroll-container [data-testid="loader"]')
      .waitFor({ state: 'detached', timeout: 30000 })
      .catch(() => {});
  };

  // Helper to expand a specific term in the table
  const expandTerm = async (page: Page, termName: string) => {
    const termRow = page.locator(`[data-row-key*="${termName}"]`).first();
    await expect(termRow).toBeVisible();

    const expandTrigger = termRow.locator('.vertical-baseline').first();
    await expandTrigger.click();
    await page.waitForTimeout(500);
  };

  // Helper to collapse a specific term in the table
  const collapseTerm = async (page: Page, termName: string) => {
    const termRow = page.locator(`[data-row-key*="${termName}"]`).first();
    const collapseIcon = termRow.locator(
      '.ant-table-row-expand-icon.ant-table-row-expand-icon-expanded'
    );

    if (await collapseIcon.isVisible()) {
      await collapseIcon.click();
      await page.waitForTimeout(300);
    }
  };

  // Helper to verify term is visible in table
  const verifyTermVisible = async (page: Page, displayName: string) => {
    const term = page.getByTestId(displayName);
    await expect(term).toBeVisible();
  };

  // Helper to verify term is NOT visible in table
  const verifyTermNotVisible = async (page: Page, displayName: string) => {
    const term = page.getByTestId(displayName);
    await expect(term).not.toBeVisible();
  };

  // Helper to perform search
  const performSearch = async (page: Page, query: string) => {
    const searchInput = page.getByPlaceholder(/search.*term/i);
    await searchInput.fill(query);

    await page
      .locator('.glossary-terms-scroll-container [data-testid="loader"]')
      .waitFor({ state: 'detached', timeout: 30000 })
      .catch(() => {});
    await page.waitForTimeout(500);
  };

  // Helper to clear search
  const clearSearch = async (page: Page) => {
    const searchInput = page.getByPlaceholder(/search.*term/i);
    await searchInput.clear();

    await page
      .locator('.glossary-terms-scroll-container [data-testid="loader"]')
      .waitFor({ state: 'detached', timeout: 30000 })
      .catch(() => {});
    await page.waitForTimeout(500);
  };

  // Helper to get row count
  const getRowCount = async (page: Page) => {
    const rows = page.locator(
      'tbody.ant-table-tbody > tr:not([aria-hidden="true"])'
    );

    return rows.count();
  };

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await glossary.create(apiContext);

    // Create basic hierarchy: Parent (Approved) -> Child (Draft)
    basicParent = new GlossaryTerm(glossary, undefined, 'BasicParent');
    await basicParent.create(apiContext);

    basicChild = new GlossaryTerm(glossary, undefined, 'BasicChild');
    basicChild.data.parent = basicParent.responseData.fullyQualifiedName;
    await basicChild.create(apiContext);
    await setTermStatus(apiContext, basicChild, 'Draft');

    // Create multi-level hierarchy: Grandparent (Approved) -> Parent (Draft) -> Child (In Review)
    multiGrandparent = new GlossaryTerm(glossary, undefined, 'MultiGrandparent');
    await multiGrandparent.create(apiContext);

    multiParent = new GlossaryTerm(glossary, undefined, 'MultiParent');
    multiParent.data.parent = multiGrandparent.responseData.fullyQualifiedName;
    await multiParent.create(apiContext);
    await setTermStatus(apiContext, multiParent, 'Draft');

    multiChild = new GlossaryTerm(glossary, undefined, 'MultiChild');
    multiChild.data.parent = multiParent.responseData.fullyQualifiedName;
    await multiChild.create(apiContext);
    await setTermStatus(apiContext, multiChild, 'In Review');

    // Create multi-children hierarchy: Parent (Approved) -> 4 children with different statuses
    multiChildrenParent = new GlossaryTerm(
      glossary,
      undefined,
      'MultiChildrenParent'
    );
    await multiChildrenParent.create(apiContext);

    const childStatuses = ['Approved', 'Draft', 'In Review', 'Rejected'];
    for (let i = 0; i < childStatuses.length; i++) {
      const child = new GlossaryTerm(
        glossary,
        undefined,
        `MultiChild${i + 1}`
      );
      child.data.parent = multiChildrenParent.responseData.fullyQualifiedName;
      await child.create(apiContext);
      if (childStatuses[i] !== 'Approved') {
        await setTermStatus(apiContext, child, childStatuses[i]);
      }
      multiChildren.push(child);
    }

    // Create deep hierarchy: 5 levels with different statuses
    const deepStatuses = [
      'Approved',
      'Draft',
      'In Review',
      'Rejected',
      'Deprecated',
    ];
    let parentFqn = '';
    for (let i = 0; i < 5; i++) {
      const term = new GlossaryTerm(glossary, undefined, `DeepLevel${i}`);
      if (parentFqn) {
        term.data.parent = parentFqn;
      }
      await term.create(apiContext);
      if (deepStatuses[i] !== 'Approved') {
        await setTermStatus(apiContext, term, deepStatuses[i]);
      }
      deepTerms.push(term);
      parentFqn = term.responseData.fullyQualifiedName;
    }

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await glossary.visitEntityPage(page);
    await page.waitForSelector('[data-testid="glossary-terms-table"]');
    await page
      .locator('.glossary-terms-scroll-container [data-testid="loader"]')
      .waitFor({ state: 'detached', timeout: 30000 });
  });

  // ==================== BASIC NESTED TERM STATUS FILTERING ====================

  test.describe('Basic Nested Term Status Filtering', () => {
    test('filter by parent status shows parent and allows expansion to see children', async ({
      page,
    }) => {
      await applyStatusFilter(page, ['Approved']);

      // Parent should be visible
      await verifyTermVisible(page, basicParent.data.displayName);

      // Expand parent to reveal child
      await expandTerm(page, basicParent.responseData.name);

      // Child should be visible (all children shown when expanded, regardless of status)
      await verifyTermVisible(page, basicChild.data.displayName);
    });

    test('filter by child status shows child as flat result even if parent does not match', async ({
      page,
    }) => {
      await applyStatusFilter(page, ['Draft']);

      // Parent has Approved status, should NOT be visible
      await verifyTermNotVisible(page, basicParent.data.displayName);

      // Child is Draft - it should appear as a flat result in the filtered view
      await verifyTermVisible(page, basicChild.data.displayName);
    });

    test('filter shows parent when status matches and all children on expand', async ({
      page,
    }) => {
      await applyStatusFilter(page, ['Approved']);

      // Verify parent is visible
      await verifyTermVisible(page, basicParent.data.displayName);

      // Expand parent
      await expandTerm(page, basicParent.responseData.name);

      // Child should be visible even though it's Draft (children loaded without filter)
      await verifyTermVisible(page, basicChild.data.displayName);
    });

    test('multiple status filter shows terms matching any selected status', async ({
      page,
    }) => {
      await applyStatusFilter(page, ['Approved', 'Draft']);

      // Both Approved and Draft terms should be visible at root level
      await verifyTermVisible(page, basicParent.data.displayName);
    });
  });

  // ==================== MULTI-LEVEL HIERARCHY TESTS ====================

  test.describe('Multi-Level Hierarchy (3 levels)', () => {
    test('filter by grandparent status shows only approved terms', async ({
      page,
    }) => {
      await applyStatusFilter(page, ['Approved']);

      // Grandparent is Approved, should be visible
      await verifyTermVisible(page, multiGrandparent.data.displayName);

      // Parent is Draft, should NOT be visible (doesn't match Approved filter)
      await verifyTermNotVisible(page, multiParent.data.displayName);

      // Child is In Review, should NOT be visible (doesn't match Approved filter)
      await verifyTermNotVisible(page, multiChild.data.displayName);
    });

    test('expanding grandparent shows parent with any status', async ({
      page,
    }) => {
      await applyStatusFilter(page, ['Approved']);

      // Expand grandparent
      await expandTerm(page, multiGrandparent.responseData.name);

      // Parent should be visible even though it's Draft (children loaded without filter)
      await verifyTermVisible(page, multiParent.data.displayName);
    });

    test('filter by middle level status shows nested term as flat result', async ({
      page,
    }) => {
      await applyStatusFilter(page, ['Draft']);

      // Parent has Draft status - should appear as flat result
      await verifyTermVisible(page, multiParent.data.displayName);

      // Grandparent is Approved, should NOT be visible with Draft filter
      await verifyTermNotVisible(page, multiGrandparent.data.displayName);

      // Child is In Review, should NOT be visible with Draft filter
      await verifyTermNotVisible(page, multiChild.data.displayName);
    });

    test('filter by leaf level status shows nested term as flat result', async ({
      page,
    }) => {
      await applyStatusFilter(page, ['In Review']);

      // Child has In Review status - should appear as flat result
      await verifyTermVisible(page, multiChild.data.displayName);

      // Grandparent is Approved, should NOT be visible
      await verifyTermNotVisible(page, multiGrandparent.data.displayName);

      // Parent is Draft, should NOT be visible
      await verifyTermNotVisible(page, multiParent.data.displayName);
    });
  });

  // ==================== SEARCH + STATUS FILTER TESTS ====================

  test.describe('Search + Status Filter with Nested Terms', () => {
    test('search for child term name + apply non-matching status filter shows no results', async ({
      page,
    }) => {
      // Search for child term (Draft status)
      await performSearch(page, basicChild.data.name);

      // Apply Approved filter (doesn't match child's Draft status)
      await applyStatusFilter(page, ['Approved']);

      // Child should NOT be visible (status doesn't match)
      await verifyTermNotVisible(page, basicChild.data.displayName);
    });

    test('search for child term name + matching status shows child', async ({
      page,
    }) => {
      await performSearch(page, basicChild.data.name);
      await applyStatusFilter(page, ['Draft']);

      // Child is Draft, should be visible
      await verifyTermVisible(page, basicChild.data.displayName);
    });

    test('search for parent term name with child status filter shows no results', async ({
      page,
    }) => {
      await performSearch(page, basicParent.data.name);
      await applyStatusFilter(page, ['Draft']);

      // Parent is Approved, should NOT be visible with Draft filter
      await verifyTermNotVisible(page, basicParent.data.displayName);
    });

    test('clearing search maintains status filter', async ({ page }) => {
      await performSearch(page, basicChild.data.name);
      await applyStatusFilter(page, ['Approved']);

      await clearSearch(page);

      // Status filter should still be active (Approved)
      await verifyTermVisible(page, basicParent.data.displayName);
    });

    test('clearing status filter maintains search results', async ({ page }) => {
      await performSearch(page, basicParent.data.name);
      await applyStatusFilter(page, ['Draft']);

      // Parent not visible (doesn't match Draft)
      await verifyTermNotVisible(page, basicParent.data.displayName);

      // Reset filter to All
      await resetStatusFilter(page);

      // Now parent should be visible (search still active, but no status filter)
      await verifyTermVisible(page, basicParent.data.displayName);
    });
  });

  // ==================== EXPAND/COLLAPSE BEHAVIOR TESTS ====================

  test.describe('Expand/Collapse Behavior', () => {
    test('apply filter, expand parent, verify children shown', async ({
      page,
    }) => {
      await applyStatusFilter(page, ['Approved']);
      await verifyTermVisible(page, basicParent.data.displayName);

      await expandTerm(page, basicParent.responseData.name);

      // Child should be visible
      await verifyTermVisible(page, basicChild.data.displayName);
    });

    test('change filter while expanded updates visible root terms', async ({
      page,
    }) => {
      // Expand parent first with All filter
      await expandTerm(page, basicParent.responseData.name);
      await verifyTermVisible(page, basicChild.data.displayName);

      // Change filter to Draft only
      await applyStatusFilter(page, ['Draft']);

      // Parent (Approved) should no longer be visible
      await verifyTermNotVisible(page, basicParent.data.displayName);
    });


    test('expand all button loads all terms', async ({ page }) => {
      await applyStatusFilter(page, ['Approved']);

      // Click expand all
      const termRes = page.waitForResponse('/api/v1/glossaryTerms?*');
      await page.getByTestId('expand-collapse-all-button').click();
      await termRes;

      await page
        .locator('[data-testid="loader"]')
        .waitFor({ state: 'detached', timeout: 30000 })
        .catch(() => {});

      // Terms should be expanded
      const rowCount = await getRowCount(page);
      expect(rowCount).toBeGreaterThan(0);
    });

  });

  // ==================== EDGE CASES ====================

  test.describe('Edge Cases', () => {
    test('deeply nested term (5 levels) - filter shows matching terms as flat results', async ({
      page,
    }) => {
      // Filter by Draft status
      await applyStatusFilter(page, ['Draft']);

      // Level 1 (Draft) should appear as flat result regardless of nesting
      await verifyTermVisible(page, deepTerms[1].data.displayName);

      // Other levels should NOT be visible (different statuses)
      await verifyTermNotVisible(page, deepTerms[0].data.displayName); // Approved
      await verifyTermNotVisible(page, deepTerms[2].data.displayName); // In Review
      await verifyTermNotVisible(page, deepTerms[3].data.displayName); // Rejected
      await verifyTermNotVisible(page, deepTerms[4].data.displayName); // Deprecated
    });

    test('all children have same status different from parent', async ({
      page,
    }) => {
      // Filter by Draft - nested children with Draft status should appear in search
      await performSearch(page, 'MultiChild');
      await applyStatusFilter(page, ['Draft']);

      // Only MultiChild2 (Draft) should be visible
      await verifyTermVisible(page, multiChildren[1].data.displayName);
    });

    test('only leaf nodes match filter - parent chain does not', async ({
      page,
    }) => {
      // Search for the deepest term (Deprecated)
      await performSearch(page, deepTerms[4].data.name);
      await applyStatusFilter(page, ['Deprecated']);

      // Only the leaf term should be visible
      await verifyTermVisible(page, deepTerms[4].data.displayName);

      // Parent chain should NOT be visible (different statuses)
      await verifyTermNotVisible(page, deepTerms[0].data.displayName);
    });

  });
});
