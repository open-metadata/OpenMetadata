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
  const entityLink = `<#E::glossaryTerm::${termFqn}>`;
  const res = await apiContext
    .get(
      `/api/v1/feed?entityLink=${encodeURIComponent(
        entityLink
      )}&type=Task&taskStatus=Open&limit=100`
    )
    .then((r) => r.json());
  const data: { task?: { id?: string | number } }[] = res?.data ?? [];

  return { count: data.length, taskId: data[0]?.task?.id?.toString() ?? null };
};

// Returns the latest stage displayName of the GlossaryTermApprovalWorkflow
// instance anchored to the given term FQN, or null if no instance is found.
// Used both to gate the move on workflow readiness (waitForApprovalWorkflowReady)
// and as diagnostics when the term fails to reach its expected status.
const queryApprovalWorkflowStage = async (
  apiContext: APIRequestContext,
  termFqn: string
): Promise<string | null> => {
  const entityLink = encodeURIComponent(`<#E::glossaryTerm::${termFqn}>`);
  const startTs = Date.now() - 24 * 60 * 60 * 1000;
  const endTs = Date.now();

  const instances = await apiContext
    .get(
      `/api/v1/governance/workflowInstances?entityLink=${entityLink}&startTs=${startTs}&endTs=${endTs}&workflowName=GlossaryTermApprovalWorkflow`
    )
    .then((r) => r.json());

  const instanceId = instances?.data?.[0]?.id;
  if (!instanceId) {
    return null;
  }

  const states = await apiContext
    .get(
      `/api/v1/governance/workflowInstanceStates/GlossaryTermApprovalWorkflow/${instanceId}?startTs=${startTs}&endTs=${endTs}`
    )
    .then((r) => r.json());

  return states?.data?.[0]?.stage?.displayName ?? null;
};
const waitForApprovalWorkflowReady = async (
  apiContext: APIRequestContext,
  termFqn: string
) => {
  await expect
    .poll(
      async () => {
        const [stage, { count }] = await Promise.all([
          queryApprovalWorkflowStage(apiContext, termFqn),
          queryOpenApprovalTasks(apiContext, termFqn),
        ]);

        return stage !== null && count === 1;
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
    const [stage, { count }] = await Promise.all([
      queryApprovalWorkflowStage(apiContext, termFqn),
      queryOpenApprovalTasks(apiContext, termFqn),
    ]);

    throw new Error(
      `Term ${termId} never reached "${expectedStatus}". ` +
        `Last GlossaryTermApprovalWorkflow stage: ${stage ?? 'none found'}; ` +
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
      test.slow(true);

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
            glossary.responseData.fullyQualifiedName,
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

          await verifyTaskCreated(
            reviewerPage,
            glossary.responseData.fullyQualifiedName,
            child.data.name
          );

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
      test.slow(true);

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
            glossary.responseData.fullyQualifiedName,
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

          await verifyTaskCreated(
            reviewerPage,
            glossary.responseData.fullyQualifiedName,
            child.data.name
          );

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
          await taskResolve;

          await toastNotification(
            reviewerPage,
            /Task resolved successfully|Vote recorded/
          );
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
