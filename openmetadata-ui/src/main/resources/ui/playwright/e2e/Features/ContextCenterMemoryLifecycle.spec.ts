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
    let superseded: { id: string; name: string; title: string };
    let invalidated: { id: string; name: string; title: string };
    const supersededReason = 'Replaced by the corrected guidance';
    const invalidatedReason = 'The source fact was disproven';

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      try {
        const createMemory = async (kind: string) => {
          const name = `cc_lifecycle_${kind}_${uuid()}`;

          return createMemoryViaApi(apiContext, {
            name,
            title: name,
            question: `What is ${name}?`,
            answer: `Verified content for ${name}.`,
            shareConfig: { visibility: 'Entity' },
          });
        };

        successor = await createMemory('successor');
        superseded = await createMemory('superseded');
        invalidated = await createMemory('invalidated');

        await patchMemory(apiContext, superseded.id, [
          { op: 'replace', path: '/entityStatus', value: 'Deprecated' },
          {
            op: 'add',
            path: '/supersededBy',
            value: { id: successor.id, type: 'contextMemory' },
          },
          { op: 'add', path: '/statusReason', value: supersededReason },
        ]);
        await patchMemory(apiContext, invalidated.id, [
          { op: 'replace', path: '/entityStatus', value: 'Rejected' },
          { op: 'add', path: '/statusReason', value: invalidatedReason },
        ]);
      } finally {
        await afterAction();
      }
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      try {
        for (const memory of [superseded, invalidated, successor]) {
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
        'Approved'
      );
      await expect(
        await searchAndGetMemoryRow(page, successor.title, successor.id)
      ).toBeVisible();
      await expect(
        await searchAndGetMemoryRow(page, superseded.title, superseded.id)
      ).not.toBeVisible();

      await page.getByTestId('memory-status-filter').click();
      await page.getByRole('menuitemcheckbox', { name: 'Deprecated' }).click();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('memory-status-filter')).toContainText(
        '2 Statuses'
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

    test('retired details show reasons and successor while proposal actions stay hidden', async ({
      page,
    }) => {
      test.slow();
      await navigateToMemories(page);
      await page.getByTestId('memory-status-filter').click();
      await page.getByRole('menuitemcheckbox', { name: 'Deprecated' }).click();
      await page.keyboard.press('Escape');

      const supersededRow = await searchAndGetMemoryRow(
        page,
        superseded.title,
        superseded.id
      );
      await expect(
        supersededRow.getByTestId(`memory-status-${superseded.id}`)
      ).toContainText('Deprecated');
      await expect(
        supersededRow.getByTestId(`memory-status-reason-${superseded.id}`)
      ).toContainText(supersededReason);
      await supersededRow.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog.getByTestId('memory-lifecycle-status')).toContainText(
        'Deprecated'
      );
      await expect(dialog.getByTestId('memory-lifecycle-reason')).toContainText(
        supersededReason
      );
      await expect(
        dialog.getByRole('button', { name: /propose term/i })
      ).not.toBeVisible();
      await dialog.getByTestId('memory-lifecycle-successor').click();
      await expect(page).toHaveURL(new RegExp(`memory=${successor.name}`));
      await expect(
        dialog.getByText(successor.title, { exact: true })
      ).toBeVisible();

      await page.goto(`${MEMORIES_URL}?memory=${invalidated.name}`);
      await waitForAllLoadersToDisappear(page);
      await expect(dialog.getByTestId('memory-lifecycle-status')).toContainText(
        'Rejected'
      );
      await expect(dialog.getByTestId('memory-lifecycle-reason')).toContainText(
        invalidatedReason
      );
      await expect(
        dialog.getByRole('button', { name: /propose term/i })
      ).not.toBeVisible();
    });
  }
);
