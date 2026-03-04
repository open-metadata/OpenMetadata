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
import test, { APIRequestContext, expect, Page } from '@playwright/test';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { createNewPage } from '../../../utils/common';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

/**
 * Test suite for verifying that "Expand All" respects the active status filter.
 *
 * Regression test for a bug where fetchExpadedTree did not pass the entityStatus
 * parameter, causing "Expand All" to show all terms regardless of the active filter.
 */
test.describe('Glossary Expand All with Status Filter', () => {
  test.describe.configure({ mode: 'serial' });

  const glossary = new Glossary();

  // Approved hierarchy: ApprovedParent -> [ApprovedChild1, ApprovedChild2]
  let approvedParent: GlossaryTerm;
  let approvedChild1: GlossaryTerm;
  let approvedChild2: GlossaryTerm;

  // Draft hierarchy: DraftParent -> DraftChild
  let draftParent: GlossaryTerm;
  let draftChild: GlossaryTerm;

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

  const applyStatusFilter = async (page: Page, statuses: string[]) => {
    const statusDropdown = page.getByTestId('glossary-status-dropdown');
    await statusDropdown.click();
    await page.waitForSelector('.status-selection-dropdown');

    const allCheckbox = page.locator('.glossary-dropdown-label', {
      hasText: 'All',
    });
    await allCheckbox.click();
    await allCheckbox.click();

    for (const status of statuses) {
      const checkbox = page.locator('.glossary-dropdown-label', {
        hasText: status,
      });
      await checkbox.click();
    }

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

  const clickExpandAll = async (page: Page) => {
    const termRes = page.waitForResponse('/api/v1/glossaryTerms?*');
    await page.getByTestId('expand-collapse-all-button').click();
    await termRes;

    await page
      .locator('[data-testid="loader"]')
      .waitFor({ state: 'detached', timeout: 30000 })
      .catch(() => {});
  };

  const clickCollapseAll = async (page: Page) => {
    await page.getByTestId('expand-collapse-all-button').click();

    await page
      .locator('.glossary-terms-scroll-container [data-testid="loader"]')
      .waitFor({ state: 'detached', timeout: 30000 })
      .catch(() => {});
  };

  const verifyRowStatuses = async (
    page: Page,
    allowedStatuses: string[]
  ): Promise<number> => {
    const rows = page.locator(
      'tbody.ant-table-tbody > tr:not([aria-hidden="true"])'
    );
    const rowCount = await rows.count();

    for (let i = 0; i < rowCount; i++) {
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

  const getRowCount = async (page: Page): Promise<number> => {
    const rows = page.locator(
      'tbody.ant-table-tbody > tr:not([aria-hidden="true"])'
    );

    return rows.count();
  };

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await glossary.create(apiContext);

    // Create Approved hierarchy
    approvedParent = new GlossaryTerm(
      glossary,
      undefined,
      'ApprovedParent'
    );
    await approvedParent.create(apiContext);

    approvedChild1 = new GlossaryTerm(
      glossary,
      undefined,
      'ApprovedChild1'
    );
    approvedChild1.data.parent =
      approvedParent.responseData.fullyQualifiedName;
    await approvedChild1.create(apiContext);

    approvedChild2 = new GlossaryTerm(
      glossary,
      undefined,
      'ApprovedChild2'
    );
    approvedChild2.data.parent =
      approvedParent.responseData.fullyQualifiedName;
    await approvedChild2.create(apiContext);

    // Create Draft hierarchy
    draftParent = new GlossaryTerm(glossary, undefined, 'DraftParent');
    await draftParent.create(apiContext);
    await setTermStatus(apiContext, draftParent, 'Draft');

    draftChild = new GlossaryTerm(glossary, undefined, 'DraftChild');
    draftChild.data.parent = draftParent.responseData.fullyQualifiedName;
    await draftChild.create(apiContext);
    await setTermStatus(apiContext, draftChild, 'Draft');

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

  test('Expand All with Draft filter shows only Draft terms', async ({
    page,
  }) => {
    await applyStatusFilter(page, ['Draft']);

    await clickExpandAll(page);

    const rowCount = await verifyRowStatuses(page, ['Draft']);
    expect(rowCount).toBeGreaterThan(0);

    // Approved terms should not be visible
    const approvedParentEl = page.getByTestId(
      approvedParent.data.displayName
    );
    await expect(approvedParentEl).not.toBeVisible();
  });

  test('Expand All with Approved filter shows only Approved terms', async ({
    page,
  }) => {
    await applyStatusFilter(page, ['Approved']);

    await clickExpandAll(page);

    const rowCount = await verifyRowStatuses(page, ['Approved']);
    expect(rowCount).toBeGreaterThan(0);

    // Draft terms should not be visible
    const draftParentEl = page.getByTestId(draftParent.data.displayName);
    await expect(draftParentEl).not.toBeVisible();
  });

  test('Expand All with no filter shows all terms', async ({ page }) => {
    await clickExpandAll(page);

    const rowCount = await getRowCount(page);

    // Should include all 5 terms (2 parents + 3 children)
    expect(rowCount).toBe(5);
  });

  test('Expand All then Collapse All then re-expand with different filter', async ({
    page,
  }) => {
    // Expand with Approved filter
    await applyStatusFilter(page, ['Approved']);
    await clickExpandAll(page);
    await verifyRowStatuses(page, ['Approved']);

    // Collapse all
    await clickCollapseAll(page);

    // Switch to Draft filter and expand again
    await applyStatusFilter(page, ['Draft']);
    await clickExpandAll(page);

    const rowCount = await verifyRowStatuses(page, ['Draft']);
    expect(rowCount).toBeGreaterThan(0);

    // Approved terms should not be visible after switching filter
    const approvedParentEl = page.getByTestId(
      approvedParent.data.displayName
    );
    await expect(approvedParentEl).not.toBeVisible();
  });
});
