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

import test, { expect, type APIRequestContext } from '@playwright/test';
import { SidebarItem } from '../../../constant/sidebar';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage, toastNotification } from '../../../utils/common';
import {
  getGlossaryApprovalWorkflowSnapshot,
  performExpandAll,
  selectActiveGlossary,
  verifyTaskCreated,
} from '../../../utils/glossary';
import { sidebarClick } from '../../../utils/sidebar';
import { waitForTaskResolveResponse } from '../../../utils/task';
import { performUserLogin } from '../../../utils/user';

const reviewerUser = new UserClass();

const queryOpenApprovalTasks = async (
  apiContext: APIRequestContext,
  termFqn: string
): Promise<{ count: number; taskId: string | null }> => {
  const res = await apiContext
    .get(
      `/api/v1/tasks?aboutEntity=${encodeURIComponent(
        termFqn
      )}&status=Open&category=Approval&limit=100&fields=about,assignees`
    )
    .then((r) => r.json());
  const data: { id?: string | number }[] = res?.data ?? [];

  return { count: data.length, taskId: data[0]?.id?.toString() ?? null };
};

// Returns every stage of the newest GlossaryTermApprovalWorkflow instance anchored to the given
// term FQN, newest first, or null when no instance has recorded a stage yet.
// Used both to gate the move on workflow readiness (waitForApprovalWorkflowReady)
// and as diagnostics when the term fails to reach its expected status.
const queryApprovalWorkflowStages = async (
  apiContext: APIRequestContext,
  termFqn: string
): Promise<string | null> => {
  const snapshot = await getGlossaryApprovalWorkflowSnapshot(
    apiContext,
    termFqn
  );
  const stages = snapshot.instances[0]?.stages ?? [];

  // Stage rows are ordered by timestamp DESC with no tie-break, so report all of them rather than
  // whichever won the millisecond. Empty stays null so the readiness gate below keeps treating
  // "instance exists but recorded nothing" as not-ready.
  return stages.length > 0 ? stages.join(' | ') : null;
};
const waitForApprovalWorkflowReady = async (
  apiContext: APIRequestContext,
  termFqn: string
) => {
  await expect
    .poll(
      async () => {
        const [stages, { count }] = await Promise.all([
          queryApprovalWorkflowStages(apiContext, termFqn),
          queryOpenApprovalTasks(apiContext, termFqn),
        ]);

        return stages !== null && count === 1;
      },
      {
        message: `approval workflow for ${termFqn} to be parked at the review task before moving`,
        timeout: 120_000,
        intervals: [3_000, 5_000, 10_000],
      }
    )
    .toBe(true);
};

const waitForTermStatus = async (
  apiContext: APIRequestContext,
  termId: string,
  termFqn: string,
  expectedStatus: string
) => {
  try {
    await expect
      .poll(
        async () => {
          const res = await apiContext
            .get(`/api/v1/glossaryTerms/${termId}?fields=entityStatus`)
            .then((r) => r.json());

          return res?.entityStatus;
        },
        {
          message: `term ${termId} to reach ${expectedStatus}`,
          timeout: 120_000,
          intervals: [5_000],
        }
      )
      .toBe(expectedStatus);
  } catch (error) {
    const [stages, { count }] = await Promise.all([
      queryApprovalWorkflowStages(apiContext, termFqn),
      queryOpenApprovalTasks(apiContext, termFqn),
    ]);

    throw new Error(
      `Term ${termId} never reached "${expectedStatus}". ` +
        `GlossaryTermApprovalWorkflow stages (newest first): ${
          stages ?? 'none recorded'
        }; ` +
        `open approval tasks remaining at ${termFqn}: ${count}. ` +
        `If the workflow is still at "Review" with 0 open tasks, the approval did not ` +
        `resume after the move (backend issue), not test slowness.\n` +
        `Original error: ${(error as Error).message}`
    );
  }
};

const reviewerRef = () => ({
  id: reviewerUser.responseData.id,
  type: 'user' as const,
  displayName: reviewerUser.responseData.displayName,
  fullyQualifiedName: reviewerUser.responseData.fullyQualifiedName,
  name: reviewerUser.responseData.name,
});

const setupGlossaryWithPendingApproval = async (
  adminApiContext: APIRequestContext
) => {
  const glossary = new Glossary();
  const parent = new GlossaryTerm(glossary); // Securities Lending
  const child = new GlossaryTerm(glossary); // Eligible Securities — has the open task
  const container = new GlossaryTerm(glossary); // Product and Service — move target

  await glossary.create(adminApiContext);
  await glossary.patch(adminApiContext, [
    { op: 'add', path: '/reviewers/0', value: reviewerRef() },
  ]);
  await parent.create(adminApiContext);
  child.data.parent = parent.responseData.fullyQualifiedName;
  await child.create(adminApiContext);
  await container.create(adminApiContext);

  return { glossary, parent, child, container };
};

const moveParentUnderContainer = async (
  adminApiContext: APIRequestContext,
  parent: GlossaryTerm,
  container: GlossaryTerm
) => {
  const res = await adminApiContext.put(
    `/api/v1/glossaryTerms/${parent.responseData.id}/moveAsync`,
    {
      data: {
        parent: {
          id: container.responseData.id,
          type: 'glossaryTerm',
          name: container.responseData.name,
          fullyQualifiedName: container.responseData.fullyQualifiedName,
        },
      },
    }
  );
  expect(res.ok()).toBeTruthy();
};

test.beforeAll(async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await reviewerUser.create(apiContext);
  await reviewerUser.setDataStewardRole(apiContext);
  await afterAction();
});

test.afterAll(async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await reviewerUser.delete(apiContext);
  await afterAction();
});

test.describe(
  'Glossary - Approval After Move',
  { tag: ['@Features', '@Governance'] },
  () => {
    test('approving an open task succeeds after the parent term is moved under a sibling', async ({
      browser,
    }) => {
      test.setTimeout(5 * 60 * 1000);

      const { apiContext: adminApiContext, afterAction: adminAfterAction } =
        await performAdminLogin(browser);
      const { page: reviewerPage, afterAction: reviewerAfterAction } =
        await performUserLogin(browser, reviewerUser);

      let originalTaskId: string | null = null;
      let newChildFqn = '';

      const { glossary, parent, child, container } =
        await setupGlossaryWithPendingApproval(adminApiContext);

      try {
        await test.step('Verify exactly one open approval task exists for Eligible Securities', async () => {
          await verifyTaskCreated(
            reviewerPage,
            child.responseData.fullyQualifiedName,
            child.data.name
          );
          const { count, taskId } = await queryOpenApprovalTasks(
            adminApiContext,
            child.responseData.fullyQualifiedName
          );
          expect(count).toBe(1);
          originalTaskId = taskId;
        });

        await test.step('Move Securities Lending under Product and Service', async () => {
          await waitForApprovalWorkflowReady(
            adminApiContext,
            child.responseData.fullyQualifiedName
          );
          await moveParentUnderContainer(adminApiContext, parent, container);
        });

        await test.step('Wait for task accessible at new FQN: count=1, same task ID (no duplicate or replacement)', async () => {
          await expect
            .poll(
              async () => {
                const res = await adminApiContext
                  .get(
                    `/api/v1/glossaryTerms/${child.responseData.id}?fields=fullyQualifiedName`
                  )
                  .then((r) => r.json());
                newChildFqn = res.fullyQualifiedName;

                return newChildFqn;
              },
              {
                message: 'child FQN to update after async move',
                timeout: 120_000,
                intervals: [3_000, 5_000, 10_000],
              }
            )
            .not.toBe(child.responseData.fullyQualifiedName);

          await verifyTaskCreated(reviewerPage, newChildFqn, child.data.name);

          const { count: countNew, taskId: taskIdNew } =
            await queryOpenApprovalTasks(adminApiContext, newChildFqn);
          expect(countNew).toBe(1);
          expect(taskIdNew).toBe(originalTaskId);
        });

        await test.step('Reviewer: expand tree and approve Eligible Securities', async () => {
          await redirectToHomePage(reviewerPage);
          await sidebarClick(reviewerPage, SidebarItem.GLOSSARY);
          await selectActiveGlossary(
            reviewerPage,
            glossary.responseData.displayName
          );
          await performExpandAll(reviewerPage);

          const approveButton = reviewerPage.getByTestId(
            `${child.data.name}-approve-btn`
          );
          await expect(approveButton).toBeVisible({ timeout: 60_000 });

          const taskResolve = waitForTaskResolveResponse(reviewerPage);
          await approveButton.click();
          await taskResolve;

          await toastNotification(
            reviewerPage,
            /Task resolved successfully|Vote recorded/
          );
        });

        await test.step('Verify Approved status and zero remaining open tasks', async () => {
          await waitForTermStatus(
            adminApiContext,
            child.responseData.id,
            newChildFqn,
            'Approved'
          );
          const { count } = await queryOpenApprovalTasks(
            adminApiContext,
            newChildFqn
          );
          expect(count).toBe(0);
        });
      } finally {
        await glossary.delete(adminApiContext);
        await adminAfterAction();
        await reviewerAfterAction();
      }
    });

    test('rejecting an open task succeeds after the parent term is moved under a sibling', async ({
      browser,
    }) => {
      test.setTimeout(5 * 60 * 1000);

      const { apiContext: adminApiContext, afterAction: adminAfterAction } =
        await performAdminLogin(browser);
      const { page: reviewerPage, afterAction: reviewerAfterAction } =
        await performUserLogin(browser, reviewerUser);

      let originalTaskId: string | null = null;
      let newChildFqn = '';

      const { glossary, parent, child, container } =
        await setupGlossaryWithPendingApproval(adminApiContext);

      try {
        await test.step('Verify exactly one open approval task exists for Eligible Securities', async () => {
          await verifyTaskCreated(
            reviewerPage,
            child.responseData.fullyQualifiedName,
            child.data.name
          );
          const { count, taskId } = await queryOpenApprovalTasks(
            adminApiContext,
            child.responseData.fullyQualifiedName
          );
          expect(count).toBe(1);
          originalTaskId = taskId;
        });

        await test.step('Move Securities Lending under Product and Service', async () => {
          await waitForApprovalWorkflowReady(
            adminApiContext,
            child.responseData.fullyQualifiedName
          );
          await moveParentUnderContainer(adminApiContext, parent, container);
        });

        await test.step('Wait for task accessible at new FQN: count=1, same task ID (no duplicate or replacement)', async () => {
          await expect
            .poll(
              async () => {
                const res = await adminApiContext
                  .get(
                    `/api/v1/glossaryTerms/${child.responseData.id}?fields=fullyQualifiedName`
                  )
                  .then((r) => r.json());
                newChildFqn = res.fullyQualifiedName;

                return newChildFqn;
              },
              {
                message: 'child FQN to update after async move',
                timeout: 120_000,
                intervals: [3_000, 5_000, 10_000],
              }
            )
            .not.toBe(child.responseData.fullyQualifiedName);

          await verifyTaskCreated(reviewerPage, newChildFqn, child.data.name);

          const { count: countNew, taskId: taskIdNew } =
            await queryOpenApprovalTasks(adminApiContext, newChildFqn);
          expect(countNew).toBe(1);
          expect(taskIdNew).toBe(originalTaskId);
        });

        await test.step('Reviewer: expand tree and reject Eligible Securities', async () => {
          await redirectToHomePage(reviewerPage);
          await sidebarClick(reviewerPage, SidebarItem.GLOSSARY);
          await selectActiveGlossary(
            reviewerPage,
            glossary.responseData.displayName
          );
          await performExpandAll(reviewerPage);

          const rejectButton = reviewerPage.getByTestId(
            `${child.data.name}-reject-btn`
          );
          await expect(rejectButton).toBeVisible({ timeout: 60_000 });

          const taskResolve = waitForTaskResolveResponse(reviewerPage);
          await rejectButton.click();
          const rejectDialog = reviewerPage.getByRole('dialog', {
            name: 'Reject',
          });
          const requiresComment = await Promise.race([
            rejectDialog
              .waitFor({ state: 'visible' })
              .then(() => true as const),
            taskResolve.then(() => false as const),
          ]);

          if (requiresComment) {
            await rejectDialog
              .getByRole('textbox', { name: 'Comment *' })
              .fill('Rejected after moving the parent glossary term');

            const confirmReject = rejectDialog.getByRole('button', {
              name: 'Reject',
              exact: true,
            });
            await expect(confirmReject).toBeEnabled();
            await confirmReject.click();
          }

          expect((await taskResolve).ok()).toBe(true);
        });

        await test.step('Verify term reaches Rejected status and zero remaining open tasks', async () => {
          await waitForTermStatus(
            adminApiContext,
            child.responseData.id,
            newChildFqn,
            'Rejected'
          );
          const { count } = await queryOpenApprovalTasks(
            adminApiContext,
            newChildFqn
          );
          expect(count).toBe(0);
        });
      } finally {
        await glossary.delete(adminApiContext);
        await adminAfterAction();
        await reviewerAfterAction();
      }
    });
  }
);
