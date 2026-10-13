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
import { createNewPage, uuid } from '../../utils/common';
import {
  createMemoryViaApi,
  MEMORIES_API,
  MEMORIES_URL,
  navigateToMemories,
  patchMemory,
  searchAndGetMemoryRow,
} from '../../utils/ContextCenterUtil';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { test } from '../fixtures/pages';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe(
  'Context Center - Memory lifecycle',
  { tag: ['@Features', '@Governance'] },
  () => {
    let successor: { id: string; name: string; title: string };
    let unprocessed: { id: string; name: string; title: string };
    let superseded: { id: string; name: string; title: string };
    let invalidated: { id: string; name: string; title: string };
    const supersededReason = 'Replaced by the corrected guidance';
    const invalidatedReason = 'The source fact was disproven';

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      try {
        const createMemory = async (
          kind: string,
          entityStatus?: 'Approved'
        ) => {
          const name = `cc_lifecycle_${kind}_${uuid()}`;

          return createMemoryViaApi(apiContext, {
            name,
            title: name,
            question: `What is ${name}?`,
            answer: `Verified content for ${name}.`,
            entityStatus,
            shareConfig: { visibility: 'Entity' },
          });
        };

        unprocessed = await createMemory('unprocessed');
        successor = await createMemory('successor', 'Approved');
        superseded = await createMemory('superseded', 'Approved');
        invalidated = await createMemory('invalidated', 'Approved');

        await patchMemory(apiContext, superseded.id, [
          { op: 'replace', path: '/entityStatus', value: 'Superseded' },
          {
            op: 'add',
            path: '/supersededBy',
            value: { id: successor.id, type: 'contextMemory' },
          },
          { op: 'add', path: '/statusReason', value: supersededReason },
        ]);
        await patchMemory(apiContext, invalidated.id, [
          { op: 'replace', path: '/entityStatus', value: 'Invalidated' },
          { op: 'add', path: '/statusReason', value: invalidatedReason },
        ]);
      } finally {
        await afterAction();
      }
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      try {
        for (const memory of [
          superseded,
          invalidated,
          successor,
          unprocessed,
        ]) {
          if (memory) {
            const response = await apiContext.delete(
              `${MEMORIES_API}/${memory.id}?hardDelete=true`
            );
            expect([200, 404]).toContain(response.status());
          }
        }
      } finally {
        await afterAction();
      }
    });

    test('status filter combines with text search, author and sort', async ({
      page,
    }) => {
      test.slow();
      await navigateToMemories(page);
      await expect(page.getByTestId('memory-status-filter')).toContainText(
        '2 Statuses'
      );
      await expect(
        await searchAndGetMemoryRow(page, successor.title, successor.id)
      ).toBeVisible();
      await expect(
        await searchAndGetMemoryRow(page, superseded.title, superseded.id)
      ).not.toBeVisible();

      await page.getByTestId('memory-status-filter').click();
      await page.getByRole('menuitemcheckbox', { name: 'Superseded' }).click();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('memory-status-filter')).toContainText(
        '3 Statuses'
      );
      await expect(
        page.getByTestId(`memory-row-${superseded.id}`)
      ).toBeVisible();

      await page.getByTestId('memory-count-card-created-by-me').click();
      await expect(
        page.getByTestId(`memory-row-${superseded.id}`)
      ).toBeVisible();
      await page.getByRole('button', { name: /sort/i }).click();
      await page.getByRole('menuitemradio', { name: 'Most Used' }).click();
      await expect(
        page.getByTestId(`memory-row-${superseded.id}`)
      ).toBeVisible();
    });

    test('unprocessed memories appear by default and cannot propose terms', async ({
      page,
    }) => {
      await navigateToMemories(page);
      const row = await searchAndGetMemoryRow(
        page,
        unprocessed.title,
        unprocessed.id
      );
      await expect(
        row.getByTestId(`memory-status-${unprocessed.id}`)
      ).toContainText('Unprocessed');
      await row.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByTestId('memory-lifecycle-status')).toContainText(
        'Unprocessed'
      );
      await expect(
        dialog.getByRole('button', { name: /propose term/i })
      ).not.toBeVisible();
      await page.screenshot({
        path: test.info().outputPath('unprocessed-memory.png'),
      });
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.getByTestId('memory-status-filter').click();
      await page.getByRole('menuitemcheckbox', { name: 'Unprocessed' }).click();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('memory-status-filter')).toContainText(
        'Approved'
      );
      await expect(row).not.toBeVisible();
    });

    test('retired details show reasons and successor while proposal actions stay hidden', async ({
      page,
    }) => {
      test.slow();
      await navigateToMemories(page);
      await page.getByTestId('memory-status-filter').click();
      await page.getByRole('menuitemcheckbox', { name: 'Superseded' }).click();
      await page.keyboard.press('Escape');

      const supersededRow = await searchAndGetMemoryRow(
        page,
        superseded.title,
        superseded.id
      );
      await expect(
        supersededRow.getByTestId(`memory-status-${superseded.id}`)
      ).toContainText('Superseded');
      await expect(
        supersededRow.getByTestId(`memory-status-reason-${superseded.id}`)
      ).toContainText(supersededReason);
      await supersededRow.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog.getByTestId('memory-lifecycle-status')).toContainText(
        'Superseded'
      );
      await expect(dialog.getByTestId('memory-lifecycle-reason')).toContainText(
        supersededReason
      );
      await expect(
        dialog.getByRole('button', { name: /propose term/i })
      ).not.toBeVisible();
      await page.screenshot({
        path: test.info().outputPath('superseded-memory.png'),
        animations: 'disabled',
      });
      await dialog.getByTestId('memory-lifecycle-successor').click();
      await expect(page).toHaveURL(new RegExp(`memory=${successor.name}`));
      await expect(
        dialog.getByText(successor.title, { exact: true })
      ).toBeVisible();

      await page.goto(`${MEMORIES_URL}?memory=${invalidated.name}`);
      await waitForAllLoadersToDisappear(page);
      await expect(dialog.getByTestId('memory-lifecycle-status')).toContainText(
        'Invalidated'
      );
      await expect(dialog.getByTestId('memory-lifecycle-reason')).toContainText(
        invalidatedReason
      );
      await page.screenshot({
        path: test.info().outputPath('invalidated-memory.png'),
        animations: 'disabled',
      });
      await expect(
        dialog.getByRole('button', { name: /propose term/i })
      ).not.toBeVisible();
    });

    test('linked memory modals stay closed after cancel, escape, editing and successor navigation', async ({
      page,
    }) => {
      await page.goto(`${MEMORIES_URL}?memory=${superseded.name}`);
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByTestId('memory-lifecycle-status')).toContainText(
        'Superseded'
      );
      await dialog.getByTestId('memory-lifecycle-successor').click();
      await expect(
        dialog.getByText(successor.title, { exact: true })
      ).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(page).not.toHaveURL(/memory=/);
      await expect(dialog).not.toBeVisible();

      const preservedQuery = 'source=modal-regression';
      const memoryUrl = `${MEMORIES_URL}?memory=${successor.name}&${preservedQuery}`;
      await page.goto(memoryUrl);
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page).toHaveURL(new RegExp(`\\?${preservedQuery}$`));
      await expect(dialog).not.toBeVisible();

      await page.goto(memoryUrl);
      await dialog.getByRole('button', { name: 'Edit', exact: true }).click();
      await expect(
        dialog.getByRole('textbox', { name: 'Title', exact: true })
      ).toBeEditable();
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`\\?${preservedQuery}$`));
      await expect(dialog).not.toBeVisible();

      await page.goto(memoryUrl);
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`\\?${preservedQuery}$`));
      await expect(dialog).not.toBeVisible();
      await page.getByTestId('memory-status-filter').click();
      await expect(
        page.getByRole('menuitemcheckbox', { name: 'Approved' })
      ).toBeVisible();
    });
  }
);
