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

import { APIRequestContext, expect, Response } from '@playwright/test';
import { clickIgnoringToasts, createNewPage, uuid } from '../../utils/common';
import {
  createMemoryViaApi,
  getMemoryDialog,
  getMemoryStatus,
  MEMORIES_API,
  MEMORIES_URL,
  navigateToMemories,
  patchMemory,
  searchAndGetMemoryRow,
} from '../../utils/ContextCenterUtil';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { waitForResponseWithStatus } from '../../utils/waitHelpers';
import { test } from '../fixtures/pages';

test.use({ storageState: 'playwright/.auth/admin.json' });

interface Memory {
  id: string;
  name: string;
  title: string;
}

/** The stages the Memories page lists until its status filter changes. */
const LISTED_STATUSES = 'Approved,Unprocessed,Draft';

/** The Memories list reads the search index, so a new memory shows only once it is indexed. */
const waitForMemoriesListed = async (
  apiContext: APIRequestContext,
  query: string,
  ids: string[]
) => {
  await expect
    .poll(
      async () => {
        const response = await apiContext.get(MEMORIES_API, {
          params: { q: query, statuses: LISTED_STATUSES, limit: 25 },
        });
        if (!response.ok()) {
          return `HTTP ${response.status()}`;
        }
        const { data } = (await response.json()) as { data: Memory[] };

        return data.map(({ id }) => id);
      },
      { message: `memories matching "${query}" are listed`, timeout: 30_000 }
    )
    .toEqual(expect.arrayContaining(ids));
};

const isStatusPatchOf = (id: string) => (response: Response) =>
  response.request().method() === 'PATCH' &&
  new URL(response.url()).pathname === `${MEMORIES_API}/${id}`;

const isListSearchFor = (query: string) => (response: Response) => {
  const url = new URL(response.url());

  return (
    response.request().method() === 'GET' &&
    url.pathname === MEMORIES_API &&
    url.searchParams.get('q') === query
  );
};

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
    // Memories a test decides are its own, named before they are created so cleanup finds them.
    const pendingMemoryNames = new Set<string>();

    const createPendingMemory = async (
      apiContext: APIRequestContext,
      kind: string,
      overrides: Record<string, unknown> = {}
    ): Promise<Memory> => {
      const name = `cc_lifecycle_${kind}_${uuid()}`;
      pendingMemoryNames.add(name);

      return createMemoryViaApi(apiContext, {
        name,
        title: name,
        question: `What is ${name}?`,
        answer: `Pending content for ${name}.`,
        entityStatus: 'Unprocessed',
        shareConfig: { visibility: 'Entity' },
        ...overrides,
      });
    };

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      try {
        const createMemory = async (
          kind: string,
          entityStatus?: 'Approved' | 'Unprocessed'
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

        unprocessed = await createMemory('unprocessed', 'Unprocessed');
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
        for (const name of pendingMemoryNames) {
          const response = await apiContext.delete(
            `${MEMORIES_API}/name/${encodeURIComponent(name)}?hardDelete=true`
          );
          expect([200, 404]).toContain(response.status());
        }
      } finally {
        pendingMemoryNames.clear();
        await afterAction();
      }
    });

    test('status filter combines with text search, author and sort', async ({
      page,
    }) => {
      test.slow();
      await navigateToMemories(page);
      await expect(page.getByTestId('memory-status-filter')).toContainText(
        '3 Statuses'
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
        '4 Statuses'
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

    test('unprocessed memories appear by default', async ({ page }) => {
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
      await page.screenshot({
        path: test.info().outputPath('unprocessed-memory.png'),
      });
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.getByTestId('memory-status-filter').click();
      await page.getByRole('menuitemcheckbox', { name: 'Unprocessed' }).click();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('memory-status-filter')).toContainText(
        '2 Statuses'
      );
      await expect(row).not.toBeVisible();
    });

    test('retired details show reasons and successor', async ({ page }) => {
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

    for (const { kind, verb, button, stage } of [
      {
        kind: 'approve',
        verb: 'approves',
        button: 'memory-approve-btn',
        stage: 'Approved',
      },
      {
        kind: 'reject',
        verb: 'rejects',
        button: 'memory-reject-btn',
        stage: 'Rejected',
      },
    ]) {
      test(`an admin ${verb} an unprocessed memory from its panel`, async ({
        browser,
        page,
      }) => {
        const { apiContext, afterAction } = await createNewPage(browser);
        try {
          const memory = await createPendingMemory(apiContext, kind);
          await waitForMemoriesListed(apiContext, memory.title, [memory.id]);

          await navigateToMemories(page);
          const row = await searchAndGetMemoryRow(
            page,
            memory.title,
            memory.id
          );
          await row.click();
          const dialog = getMemoryDialog(page);
          await expect(
            dialog.getByTestId('memory-lifecycle-status')
          ).toContainText('Unprocessed');
          await expect(dialog.getByTestId('memory-approve-btn')).toBeVisible();
          await expect(dialog.getByTestId('memory-reject-btn')).toBeVisible();

          const decided = waitForResponseWithStatus(
            page,
            isStatusPatchOf(memory.id),
            200
          );
          await clickIgnoringToasts(dialog.getByTestId(button));
          await decided;

          await expect(dialog).not.toBeVisible();
          expect(await getMemoryStatus(apiContext, memory.id)).toBe(stage);
        } finally {
          await afterAction();
        }
      });
    }

    test('approving the pending memories listed approves the unprocessed ones and leaves a draft alone', async ({
      browser,
      page,
    }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      try {
        // A search term only these memories carry keeps other workers' memories out of the count.
        const term = `cc_lifecycle_pending_${uuid()}`;
        const first = await createPendingMemory(apiContext, 'pending_first', {
          title: `${term} first`,
        });
        const second = await createPendingMemory(apiContext, 'pending_second', {
          title: `${term} second`,
        });
        const draft = await createPendingMemory(apiContext, 'pending_draft', {
          title: `${term} draft`,
          entityStatus: 'Draft',
        });
        await waitForMemoriesListed(apiContext, term, [
          first.id,
          second.id,
          draft.id,
        ]);

        await navigateToMemories(page);
        const draftRow = await searchAndGetMemoryRow(page, term, draft.id);
        await expect(
          draftRow.getByTestId(`memory-status-${draft.id}`)
        ).toContainText('Draft');
        for (const memory of [first, second]) {
          await expect(
            page.getByTestId(`memory-status-${memory.id}`)
          ).toContainText('Unprocessed');
        }
        const approvePending = page.getByTestId('approve-pending-memories-btn');
        await expect(approvePending).toHaveText(/\b2 pending\b/);

        const approvals = [first, second].map((memory) =>
          waitForResponseWithStatus(page, isStatusPatchOf(memory.id), 200)
        );
        // The list refetches once every approval has settled, so a write to the draft has landed too.
        const refreshed = waitForResponseWithStatus(
          page,
          isListSearchFor(term),
          200
        );
        await clickIgnoringToasts(approvePending);
        await Promise.all([...approvals, refreshed]);

        expect(await getMemoryStatus(apiContext, first.id)).toBe('Approved');
        expect(await getMemoryStatus(apiContext, second.id)).toBe('Approved');
        expect(await getMemoryStatus(apiContext, draft.id)).toBe('Draft');
      } finally {
        await afterAction();
      }
    });
  }
);
