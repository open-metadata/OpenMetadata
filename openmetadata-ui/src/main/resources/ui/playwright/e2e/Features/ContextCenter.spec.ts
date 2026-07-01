/*
 *  Copyright 2026 Collate.
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

import { expect } from '@playwright/test';
import { createNewPage, redirectToHomePage, uuid } from '../../utils/common';
import {
  MEMORIES_API,
  navigateToMemories
} from '../../utils/ContextCenterUtil';
import { test } from '../fixtures/pages';

// ─── Auth ─────────────────────────────────────────────────────────────────────

test.use({ storageState: 'playwright/.auth/admin.json' });

// ─── Memories fixtures ──────────────────────────────────────────────────────

let ownerMemoryId = '';
let ownerMemoryName = '';
const OWNER_MEMORY_TITLE = `CC Memory ${uuid()}`;

test.describe('Context Center', () => {
  test.slow(true);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);


    // Create a memory owned by admin for card/edit/delete action tests
    ownerMemoryName = `cc_memory_${uuid()}`;
    const memoryRes = await apiContext.post(MEMORIES_API, {
      data: {
        name: ownerMemoryName,
        title: OWNER_MEMORY_TITLE,
        question: 'What is the Playwright memory fixture for?',
        answer: 'It seeds a memory owned by admin for action button tests.',
        shareConfig: { visibility: 'Shared' },
      },
    });
    const memoryData = await memoryRes.json();
    ownerMemoryId = memoryData.id;

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    if (ownerMemoryId) {
      await apiContext.delete(
        `${MEMORIES_API}/${ownerMemoryId}?hardDelete=true`
      );
    }
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });


  test.describe('Memories Page', () => {
    test('shows header with title, breadcrumb and Add Memory button', async ({
      page,
    }) => {
      await navigateToMemories(page);

      const header = page.getByTestId('context-center-header');
      await expect(header).toBeVisible();
      await expect(header.getByTestId('breadcrumb')).toBeVisible();
      await expect(header.getByRole('heading')).toContainText('Memor');
      await expect(page.getByTestId('add-memory-btn')).toBeVisible();
    });

    // ─── Card actions ─────────────────────────────────────────────────────

    test('clicking a memory row opens the view-only modal', async ({
      page,
    }) => {
      await navigateToMemories(page);

      const row = page.getByTestId(`memory-row-${ownerMemoryId}`);
      await row.scrollIntoViewIfNeeded();
      await row.click();

      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(
        page.getByRole('dialog').getByText(OWNER_MEMORY_TITLE)
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`memory=${ownerMemoryName}`));
    });

    test('edit-memory button on the row opens the modal in edit mode', async ({
      page,
    }) => {
      await navigateToMemories(page);

      const row = page.getByTestId(`memory-row-${ownerMemoryId}`);
      await row.scrollIntoViewIfNeeded();
      await row.getByTestId('edit-memory-btn').click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByTestId('memory-content-input')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Edit' })
      ).not.toBeVisible();
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Save Changes' })
      ).toBeVisible();
    });

    test('delete button on the row deletes the memory after confirmation', async ({
      browser,
      page,
    }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      const disposableName = `cc_memory_delete_${uuid()}`;
      const createRes = await apiContext.post(MEMORIES_API, {
        data: {
          name: disposableName,
          title: `CC Memory Delete ${uuid()}`,
          question: 'Disposable memory for row delete test',
          answer: 'Disposable memory for row delete test',
          shareConfig: { visibility: 'Shared' },
        },
      });
      const disposable = await createRes.json();
      await afterAction();

      await navigateToMemories(page);

      const row = page.getByTestId(`memory-row-${disposable.id}`);
      await row.scrollIntoViewIfNeeded();
      await expect(row).toBeVisible();

      await row.getByLabel('Open menu').last().click();
      await page.getByTestId('delete-btn').click();

      const deleteResPromise = page.waitForResponse(
        new RegExp(`${MEMORIES_API}/${disposable.id}`)
      );
      await page.getByTestId('confirm-button').click();
      const deleteRes = await deleteResPromise;
      expect(deleteRes.status()).toBe(200);

      await expect(row).not.toBeVisible();
    });

    // ─── Create memory action ─────────────────────────────────────────────

    test('Add Memory button opens the create modal', async ({ page }) => {
      await navigateToMemories(page);

      await page.getByTestId('add-memory-btn').click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByTestId('memory-title-input')).toBeVisible();
      await expect(dialog.getByTestId('memory-content-input')).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Delete' })
      ).not.toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Edit' })
      ).not.toBeVisible();
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Create Memory' })
      ).toBeVisible();
    });

    // ─── Edit modal actions ───────────────────────────────────────────────

    test.describe('Edit modal actions', () => {
      let editableMemoryId: string;
      let editableMemoryName: string;

      test.beforeEach(async ({ browser }) => {
        const { apiContext, afterAction } = await createNewPage(browser);
        editableMemoryName = `cc_memory_edit_${uuid()}`;
        const res = await apiContext.post(MEMORIES_API, {
          data: {
            name: editableMemoryName,
            title: `CC Memory Edit ${uuid()}`,
            question: 'Editable memory seed question',
            answer: 'Editable memory seed answer',
            shareConfig: { visibility: 'Shared' },
          },
        });
        const data = await res.json();
        editableMemoryId = data.id;
        await afterAction();
      });

      test.afterEach(async ({ browser }) => {
        const { apiContext, afterAction } = await createNewPage(browser);
        await apiContext.delete(
          `${MEMORIES_API}/${editableMemoryId}?hardDelete=true`
        );
        await afterAction();
      });

      test('view modal switches to edit mode and saves changes', async ({
        page,
      }) => {
        await navigateToMemories(page);

        const row = page.getByTestId(`memory-row-${editableMemoryId}`);
        await row.scrollIntoViewIfNeeded();
        await row.click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        await dialog.getByRole('button', { name: /^edit$/i }).click();

        await dialog
          .getByTestId('memory-content-input')
          .locator('textarea')
          .fill('Updated answer via Playwright edit flow.');

        const updateResPromise = page.waitForResponse(
          new RegExp(`${MEMORIES_API}/${editableMemoryId}`)
        );
        await dialog.getByRole('button', { name: /^(save|create)/i }).click();
        const updateRes = await updateResPromise;
        expect(updateRes.status()).toBe(200);

        await expect(dialog).not.toBeVisible();
      });

      test('cancel button closes the modal without saving', async ({
        page,
      }) => {
        await navigateToMemories(page);

        const row = page.getByTestId(`memory-row-${editableMemoryId}`);
        await row.scrollIntoViewIfNeeded();
        await row.getByTestId('edit-memory-btn').click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        await dialog
          .getByTestId('memory-title-input')
          .locator('input')
          .fill('This change should be discarded');

        await dialog.getByRole('button', { name: /cancel/i }).click();
        await expect(dialog).not.toBeVisible();

        await navigateToMemories(page);
        const reopenedRow = page.getByTestId(`memory-row-${editableMemoryId}`);
        await reopenedRow.scrollIntoViewIfNeeded();
        await reopenedRow.click();
        await expect(
          dialog.getByTestId('memory-title-input').locator('input')
        ).not.toHaveValue('This change should be discarded');
      });

      test('delete button inside the modal deletes the memory', async ({
        page,
      }) => {
        await navigateToMemories(page);

        const row = page.getByTestId(`memory-row-${editableMemoryId}`);
        await row.scrollIntoViewIfNeeded();
        await row.getByTestId('edit-memory-btn').click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        const deleteResPromise = page.waitForResponse(
          new RegExp(`${MEMORIES_API}/${editableMemoryId}`)
        );
        await dialog.getByRole('button', { name: /^delete$/i }).click();
        const deleteRes = await deleteResPromise;
        expect(deleteRes.status()).toBe(200);

        await expect(dialog).not.toBeVisible();
        await expect(
          page.getByTestId(`memory-row-${editableMemoryId}`)
        ).not.toBeVisible();
      });
    });
  });
});