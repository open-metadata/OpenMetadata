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

import { APIRequestContext, expect } from '@playwright/test';
import { createNewPage, uuid } from '../../utils/common';
import {
  createMemoryViaApi,
  MEMORIES_API,
  navigateToMemories,
  patchMemory,
} from '../../utils/ContextCenterUtil';
import { clickAndWaitFor } from '../../utils/waitHelpers';
import { test } from '../fixtures/pages';

test.use({ storageState: 'playwright/.auth/admin.json' });

interface Memory {
  id: string;
  name: string;
  title: string;
  answer: string;
}

const RESOLVE_TASK = /\/api\/v1\/tasks\/[^/]+\/resolve$/;
const CONFLICT_REASON = 'Five orders against three orders';

/** Each memory is recorded for cleanup as soon as it exists, so a failed setup leaks none. */
const createConflict = async (
  apiContext: APIRequestContext,
  created: Memory[]
) => {
  const create = async (
    kind: string,
    entityStatus: 'Approved' | 'Unprocessed'
  ) => {
    const memory = (await createMemoryViaApi(apiContext, {
      name: `cc_review_${kind}_${uuid()}`,
      title: `Customers need ${kind} orders`,
      question: 'Who qualifies as a customer?',
      answer: `A customer has at least ${kind} completed orders.`,
      entityStatus,
      shareConfig: { visibility: 'Entity' },
    })) as Memory;
    created.push(memory);

    return memory;
  };
  const disputed = await create('five', 'Approved');
  const reviewed = await create('three', 'Unprocessed');
  await patchMemory(apiContext, reviewed.id, [
    { op: 'replace', path: '/entityStatus', value: 'Draft' },
    {
      op: 'add',
      path: '/disputes',
      value: [
        {
          memory: { id: disputed.id, type: 'contextMemory' },
          reason: CONFLICT_REASON,
        },
      ],
    },
  ]);

  return { disputed, reviewed };
};

const memoryStatus = async (apiContext: APIRequestContext, id: string) => {
  const response = await apiContext.get(`${MEMORIES_API}/${id}`);
  expect(response.ok()).toBeTruthy();

  return response.json();
};

test.describe(
  'Context Center - Memory conflict review',
  { tag: ['@Features', '@Governance'] },
  () => {
    const created: Memory[] = [];

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      try {
        for (const memory of created.splice(0).reverse()) {
          const response = await apiContext.delete(
            `${MEMORIES_API}/${memory.id}?hardDelete=true`
          );
          expect([200, 404]).toContain(response.status());
        }
      } finally {
        await afterAction();
      }
    });

    test('keeping the memory in review supersedes the one it contradicts', async ({
      page,
      browser,
    }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      try {
        const { disputed, reviewed } = await createConflict(
          apiContext,
          created
        );

        await test.step('the conflict waits in Needs review as a task', async () => {
          await navigateToMemories(page);
          await page.getByTestId('memory-count-card-needs-review').click();

          await expect(
            page.getByTestId(`memory-review-${reviewed.id}`)
          ).toContainText(reviewed.title);
        });

        await test.step('opening it compares both memories as a diff', async () => {
          await page.getByTestId(`memory-review-${reviewed.id}`).click();
          const compare = page.getByTestId('memory-compare-modal');

          await expect(compare.getByTestId('compare-current-title')).toHaveText(
            disputed.title
          );
          await expect(
            compare.getByTestId('compare-proposed-title')
          ).toHaveText(reviewed.title);
          await expect(compare.getByTestId('diff-current-memory')).toHaveText(
            disputed.answer
          );
          await expect(compare.getByTestId('diff-proposed-memory')).toHaveText(
            reviewed.answer
          );
          await expect(compare.getByTestId('diff-row-memory')).toHaveAttribute(
            'data-changed',
            'true'
          );
          await expect(compare.getByTestId('compare-reason')).toContainText(
            CONFLICT_REASON
          );
        });

        await test.step('keeping the new claim retires the old one', async () => {
          const compare = page.getByTestId('memory-compare-modal');
          await clickAndWaitFor(
            page,
            compare.getByTestId('keep-reviewed-memory'),
            RESOLVE_TASK
          );

          await expect(compare).toHaveCount(0);
          await expect(
            page.getByTestId(`memory-review-${reviewed.id}`)
          ).toHaveCount(0);
          await expect
            .poll(
              async () =>
                (
                  await memoryStatus(apiContext, disputed.id)
                ).entityStatus
            )
            .toBe('Superseded');
          const approved = await memoryStatus(apiContext, reviewed.id);

          expect(approved.entityStatus).toBe('Approved');
          expect(
            (await memoryStatus(apiContext, disputed.id)).supersededBy.id
          ).toBe(reviewed.id);
        });
      } finally {
        await afterAction();
      }
    });

    test('keeping the approved memory rejects the one in review', async ({
      page,
      browser,
    }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      try {
        const { disputed, reviewed } = await createConflict(
          apiContext,
          created
        );

        await navigateToMemories(page);
        await page.getByTestId('memory-count-card-needs-review').click();
        const review = page.getByTestId(`memory-review-${reviewed.id}`);

        await review.click();
        const compare = page.getByTestId('memory-compare-modal');

        await expect(compare.getByTestId('diff-current-memory')).toHaveText(
          disputed.answer
        );

        await clickAndWaitFor(
          page,
          compare.getByTestId('keep-approved-memories'),
          RESOLVE_TASK
        );

        await expect(compare).toHaveCount(0);
        await expect(review).toHaveCount(0);
        await expect
          .poll(
            async () =>
              (
                await memoryStatus(apiContext, reviewed.id)
              ).entityStatus
          )
          .toBe('Rejected');

        expect((await memoryStatus(apiContext, disputed.id)).entityStatus).toBe(
          'Approved'
        );
      } finally {
        await afterAction();
      }
    });
  }
);
