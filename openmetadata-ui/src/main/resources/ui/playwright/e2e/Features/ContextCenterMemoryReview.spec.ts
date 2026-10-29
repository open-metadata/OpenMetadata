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

import { APIRequestContext, expect, Page } from '@playwright/test';
import {
  clickIgnoringToasts,
  createNewPage,
  getApiContext,
  uuid,
} from '../../utils/common';
import {
  createMemoryViaApi,
  getLoggedInUser,
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

interface Owner {
  id: string;
}

interface ConflictOwners {
  reviewed?: Owner;
  disputed?: Owner;
}

/** Each memory is recorded for cleanup as soon as it exists, so a failed setup leaks none. */
const createConflict = async (
  apiContext: APIRequestContext,
  created: Memory[],
  owners: ConflictOwners = {}
) => {
  const create = async (
    kind: string,
    entityStatus: 'Approved' | 'Unprocessed',
    owner?: Owner
  ) => {
    const memory = (await createMemoryViaApi(apiContext, {
      name: `cc_review_${kind}_${uuid()}`,
      title: `Customers need ${kind} orders`,
      question: 'Who qualifies as a customer?',
      answer: `A customer has at least ${kind} completed orders.`,
      entityStatus,
      shareConfig: { visibility: 'Entity' },
      ...(owner && { owners: [{ id: owner.id, type: 'user' }] }),
    })) as Memory;
    created.push(memory);

    return memory;
  };
  const disputed = await create('five', 'Approved', owners.disputed);
  const reviewed = await create('three', 'Unprocessed', owners.reviewed);
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

/** The role page's own session identifies its user, once the page has loaded the app. */
const loggedInUserOf = async (page: Page) => {
  await navigateToMemories(page);
  const { apiContext, afterAction } = await getApiContext(page);
  try {
    return await getLoggedInUser(apiContext);
  } finally {
    await afterAction();
  }
};

const openNeedsReview = async (page: Page) => {
  await navigateToMemories(page);
  await page.getByTestId('memory-count-card-needs-review').click();
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

    test('a memory owner reviews the conflict but may not retire a claim they do not own', async ({
      browser,
      dataConsumerPage,
      dataStewardPage,
      viewOnlyPage,
    }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      try {
        const { disputed, reviewed } = await createConflict(
          apiContext,
          created,
          {
            reviewed: await loggedInUserOf(dataConsumerPage),
            disputed: await loggedInUserOf(dataStewardPage),
          }
        );
        const review = dataConsumerPage.getByTestId(
          `memory-review-${reviewed.id}`
        );

        await test.step('the owner finds the review among their own', async () => {
          await openNeedsReview(dataConsumerPage);

          await expect(review).toContainText(reviewed.title);
        });

        await test.step('a user with no stake in either memory does not', async () => {
          await openNeedsReview(viewOnlyPage);

          await expect(
            viewOnlyPage.getByTestId(`memory-review-${reviewed.id}`)
          ).toHaveCount(0);
        });

        const compare = dataConsumerPage.getByTestId('memory-compare-modal');

        await test.step("keeping their claim would retire the steward's: refused, nothing changes", async () => {
          await review.click();
          await expect(compare.getByTestId('diff-current-memory')).toHaveText(
            disputed.answer
          );
          await clickAndWaitFor(
            dataConsumerPage,
            compare.getByTestId('keep-reviewed-memory'),
            RESOLVE_TASK,
            403
          );

          await expect(compare).toBeVisible();
          expect(
            (await memoryStatus(apiContext, reviewed.id)).entityStatus
          ).toBe('Draft');
          expect(
            (await memoryStatus(apiContext, disputed.id)).entityStatus
          ).toBe('Approved');
        });

        await test.step('withdrawing their own claim resolves the review', async () => {
          const resolved = dataConsumerPage.waitForResponse(RESOLVE_TASK);
          await clickIgnoringToasts(
            compare.getByTestId('keep-approved-memories')
          );

          expect((await resolved).status()).toBe(200);
          await expect(compare).toHaveCount(0);
          await expect
            .poll(
              async () =>
                (
                  await memoryStatus(apiContext, reviewed.id)
                ).entityStatus
            )
            .toBe('Rejected');

          await openNeedsReview(dataConsumerPage);

          await expect(review).toHaveCount(0);
        });
      } finally {
        await afterAction();
      }
    });
  }
);
