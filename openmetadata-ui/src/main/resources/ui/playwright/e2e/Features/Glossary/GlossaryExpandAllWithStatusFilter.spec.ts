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
import test, { expect, Page } from '@playwright/test';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { createNewPage } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

const applyStatusFilter = async (page: Page, statuses: string[]) => {
  await page.getByTestId('glossary-status-dropdown').click();

  const statusDropdown = page.locator('.status-selection-dropdown');
  await expect(statusDropdown).toBeVisible();

  await statusDropdown.getByText('All', { exact: true }).click();
  await statusDropdown.getByText('All', { exact: true }).click();

  for (const status of statuses) {
    await statusDropdown.getByText(status, { exact: true }).click();
  }

  const apiResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/glossaryTerms') &&
      response.status() === 200
  );
  await page.getByRole('button', { name: /save/i }).click();
  const response = await apiResponse;
  expect(response.status()).toBe(200);

  await waitForAllLoadersToDisappear(page);
};

const clickExpandAll = async (page: Page) => {
  const expandButton = page.getByTestId('expand-collapse-all-button');
  await expect(expandButton).toBeEnabled();

  const termRes = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/glossaryTerms') &&
      response.status() === 200
  );
  await expandButton.click();
  const response = await termRes;
  expect(response.status()).toBe(200);

  await waitForAllLoadersToDisappear(page);
};

const clickCollapseAll = async (page: Page) => {
  const collapseButton = page.getByTestId('expand-collapse-all-button');
  await expect(collapseButton).toBeEnabled();

  const termRes = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/glossaryTerms') &&
      response.status() === 200
  );
  await collapseButton.click();
  await termRes;

  await waitForAllLoadersToDisappear(page);
};

test.describe(
  'Glossary Expand All with Status Filter',
  { tag: ['@Features', '@Governance'] },
  () => {
    const glossary = new Glossary();

    let approvedParent: GlossaryTerm;
    let approvedChild1: GlossaryTerm;
    let approvedChild2: GlossaryTerm;
    let draftParent: GlossaryTerm;
    let draftChild: GlossaryTerm;
    let mixedStatusChild: GlossaryTerm;

    test.beforeAll('Setup glossary with mixed-status terms', async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      await glossary.create(apiContext);

      approvedParent = new GlossaryTerm(glossary, undefined, 'ApprovedParent');
      await approvedParent.create(apiContext);

      approvedChild1 = new GlossaryTerm(glossary, undefined, 'ApprovedChild1');
      approvedChild1.data.parent =
        approvedParent.responseData.fullyQualifiedName;
      await approvedChild1.create(apiContext);

      approvedChild2 = new GlossaryTerm(glossary, undefined, 'ApprovedChild2');
      approvedChild2.data.parent =
        approvedParent.responseData.fullyQualifiedName;
      await approvedChild2.create(apiContext);

      // Draft child under Approved parent (mixed-status hierarchy)
      mixedStatusChild = new GlossaryTerm(glossary, undefined, 'MixedStatusChild');
      mixedStatusChild.data.parent =
        approvedParent.responseData.fullyQualifiedName;
      await mixedStatusChild.create(apiContext);

      const mixedStatusChildPatch = await apiContext.patch(
        `/api/v1/glossaryTerms/${mixedStatusChild.responseData.id}`,
        {
          data: [{ op: 'replace', path: '/entityStatus', value: 'Draft' }],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }
      );
      expect(mixedStatusChildPatch.status()).toBe(200);

      draftParent = new GlossaryTerm(glossary, undefined, 'DraftParent');
      await draftParent.create(apiContext);

      const draftParentPatch = await apiContext.patch(
        `/api/v1/glossaryTerms/${draftParent.responseData.id}`,
        {
          data: [{ op: 'replace', path: '/entityStatus', value: 'Draft' }],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }
      );
      expect(draftParentPatch.status()).toBe(200);

      draftChild = new GlossaryTerm(glossary, undefined, 'DraftChild');
      draftChild.data.parent = draftParent.responseData.fullyQualifiedName;
      await draftChild.create(apiContext);

      const draftChildPatch = await apiContext.patch(
        `/api/v1/glossaryTerms/${draftChild.responseData.id}`,
        {
          data: [{ op: 'replace', path: '/entityStatus', value: 'Draft' }],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }
      );
      expect(draftChildPatch.status()).toBe(200);

      await afterAction();
    });

    test.afterAll('Cleanup glossary', async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await glossary.delete(apiContext);
      await afterAction();
    });

    test.beforeEach(async ({ page }) => {
      await glossary.visitEntityPage(page);
      await expect(page.getByTestId('glossary-terms-table')).toBeVisible();
      await waitForAllLoadersToDisappear(page);
    });

    test('Expand All with Draft filter shows all terms including children of non-matching parents', async ({
      page,
    }) => {
      test.slow();

      await test.step('Apply Draft status filter', async () => {
        await applyStatusFilter(page, ['Draft']);
      });

      await test.step('Expand all and verify all terms are visible', async () => {
        await clickExpandAll(page);

        await expect(page.getByTestId('ApprovedParent')).toBeVisible();
        await expect(page.getByTestId('ApprovedChild1')).toBeVisible();
        await expect(page.getByTestId('ApprovedChild2')).toBeVisible();
        await expect(page.getByTestId('MixedStatusChild')).toBeVisible();
        await expect(page.getByTestId('DraftParent')).toBeVisible();
        await expect(page.getByTestId('DraftChild')).toBeVisible();
      });
    });

    test('Expand All with Approved filter shows all terms', async ({
      page,
    }) => {
      test.slow();

      await test.step('Apply Approved status filter', async () => {
        await applyStatusFilter(page, ['Approved']);
      });

      await test.step('Expand all and verify all terms are visible', async () => {
        await clickExpandAll(page);

        await expect(page.getByTestId('ApprovedParent')).toBeVisible();
        await expect(page.getByTestId('ApprovedChild1')).toBeVisible();
        await expect(page.getByTestId('ApprovedChild2')).toBeVisible();
        await expect(page.getByTestId('MixedStatusChild')).toBeVisible();
        await expect(page.getByTestId('DraftParent')).toBeVisible();
        await expect(page.getByTestId('DraftChild')).toBeVisible();
      });
    });

    test('Expand All with default filter shows all terms', async ({
      page,
    }) => {
      test.slow();

      await test.step('Expand all and verify all terms are visible', async () => {
        await clickExpandAll(page);

        await expect(page.getByTestId('ApprovedParent')).toBeVisible();
        await expect(page.getByTestId('ApprovedChild1')).toBeVisible();
        await expect(page.getByTestId('ApprovedChild2')).toBeVisible();
        await expect(page.getByTestId('MixedStatusChild')).toBeVisible();
        await expect(page.getByTestId('DraftParent')).toBeVisible();
        await expect(page.getByTestId('DraftChild')).toBeVisible();
      });
    });

    test('Expand All shows all children regardless of status filter', async ({
      page,
    }) => {
      test.slow();

      await test.step('Apply Draft filter and expand all', async () => {
        await applyStatusFilter(page, ['Draft']);
        await clickExpandAll(page);
      });

      await test.step('Verify MixedStatusChild (Draft) appears under ApprovedParent', async () => {
        await expect(page.getByTestId('ApprovedParent')).toBeVisible();
        await expect(page.getByTestId('MixedStatusChild')).toBeVisible();
      });

      await test.step('Collapse all and verify filter re-applies', async () => {
        await clickCollapseAll(page);

        await expect(page.getByTestId('DraftParent')).toBeVisible();
      });

      await test.step('Switch to Approved filter and expand again', async () => {
        await applyStatusFilter(page, ['Approved']);
        await clickExpandAll(page);

        await expect(page.getByTestId('ApprovedParent')).toBeVisible();
        await expect(page.getByTestId('ApprovedChild1')).toBeVisible();
        await expect(page.getByTestId('ApprovedChild2')).toBeVisible();
        await expect(page.getByTestId('MixedStatusChild')).toBeVisible();
        await expect(page.getByTestId('DraftParent')).toBeVisible();
        await expect(page.getByTestId('DraftChild')).toBeVisible();
      });
    });
  }
);
