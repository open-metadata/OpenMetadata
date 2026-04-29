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
import {
  APIRequestContext,
  expect,
  Page,
  test as base,
} from '@playwright/test';
import { ClassificationClass } from '../../../support/tag/ClassificationClass';
import { TagClass } from '../../../support/tag/TagClass';
import { AdminClass } from '../../../support/user/AdminClass';
import { DOMAIN_TAGS } from '../../../constant/config';
import { performAdminLogin } from '../../../utils/admin';
import { getApiContext, toastNotification, uuid } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { CreatedTask, openTaskDetails } from '../../../utils/taskWorkflow';

type ReviewerReference = {
  id: string;
  type: 'user';
  displayName: string;
  fullyQualifiedName: string;
  name: string;
};

type ApprovalTask = CreatedTask & {
  about?: { type?: string; fullyQualifiedName?: string };
  assignees?: Array<{ name: string }>;
};

const buildWorkflowDefinition = (
  workflowName: string,
  reviewer1: ReviewerReference,
  reviewer2: ReviewerReference
) => ({
  name: workflowName,
  displayName: 'Playwright Multi Reviewer Approval Workflow',
  description: 'Create a threshold-2 approval task for a single test tag.',
  trigger: {
    type: 'eventBasedEntity',
    config: {
      entityTypes: ['tag'],
      events: ['Created'],
      exclude: ['reviewers'],
      filter: {},
    },
    output: ['relatedEntity', 'updatedBy'],
  },
  nodes: [
    {
      type: 'startEvent',
      subType: 'startEvent',
      name: 'StartNode',
      displayName: 'Start',
    },
    {
      type: 'endEvent',
      subType: 'endEvent',
      name: 'ApprovedEnd',
      displayName: 'Approved',
    },
    {
      type: 'endEvent',
      subType: 'endEvent',
      name: 'RejectedEnd',
      displayName: 'Rejected',
    },
    {
      type: 'userTask',
      subType: 'userApprovalTask',
      name: 'ReviewTag',
      displayName: 'Review Tag',
      config: {
        assignees: {
          addReviewers: false,
          addOwners: false,
          candidates: [reviewer1, reviewer2],
        },
        approvalThreshold: 2,
        rejectionThreshold: 1,
      },
      input: ['relatedEntity'],
      inputNamespaceMap: {
        relatedEntity: 'global',
      },
      output: ['result'],
      branches: ['true', 'false'],
    },
  ],
  edges: [
    { from: 'StartNode', to: 'ReviewTag' },
    { from: 'ReviewTag', to: 'ApprovedEnd', condition: 'true' },
    { from: 'ReviewTag', to: 'RejectedEnd', condition: 'false' },
  ],
  config: {
    storeStageStatus: true,
  },
});

const getReviewerRef = (
  reviewer: AdminClass['responseData']
): ReviewerReference => ({
  id: reviewer.id,
  type: 'user',
  displayName: reviewer.displayName ?? reviewer.name,
  fullyQualifiedName: reviewer.fullyQualifiedName ?? reviewer.name,
  name: reviewer.name,
});

const waitForWorkflowDeployment = async (
  apiContext: APIRequestContext,
  workflowName: string
) => {
  await expect
    .poll(
      async () => {
        const response = await apiContext.get(
          `/api/v1/governance/workflowDefinitions/name/${encodeURIComponent(
            workflowName
          )}?fields=deployed`
        );

        if (!response.ok()) {
          return false;
        }

        const workflow = await response.json();

        return workflow.deployed === true;
      },
      {
        timeout: 120_000,
        intervals: [1000, 2000, 5000],
        message: `Timed out waiting for workflow ${workflowName} to be deployed`,
      }
    )
    .toBe(true);
};

const waitForTaskCreated = async (
  apiContext: APIRequestContext,
  entityFqn: string
): Promise<ApprovalTask> => {
  let foundTask: ApprovalTask | null = null;

  await expect
    .poll(
      async () => {
        const response = await apiContext.get(
          '/api/v1/tasks?status=Open&category=Approval&limit=100&fields=about,assignees'
        );
        const payload = await response.json();

        foundTask =
          payload.data?.find(
            (t: ApprovalTask) =>
              t.about?.fullyQualifiedName === entityFqn ||
              t.about?.fullyQualifiedName?.endsWith(`.${entityFqn}`)
          ) ?? null;

        return foundTask?.taskId ?? '';
      },
      {
        timeout: 120_000,
        intervals: [2000, 5000, 10_000],
        message: `Timed out waiting for approval task to be created for ${entityFqn}`,
      }
    )
    .not.toBe('');

  return foundTask!;
};

const fetchTaskStatus = async (
  apiContext: APIRequestContext,
  taskId: string
): Promise<string> => {
  const response = await apiContext.get(`/api/v1/tasks/${taskId}`);

  if (!response.ok()) {
    return '';
  }

  const data = await response.json();

  return data.status ?? '';
};

const approveTaskFromEntityPage = async (
  page: Page,
  task: ApprovalTask
): Promise<void> => {
  await page.goto(
    `/tag/${encodeURIComponent(
      task.about?.fullyQualifiedName ?? ''
    )}/activity_feed/tasks`
  );
  await waitForAllLoadersToDisappear(page);
  await openTaskDetails(page, task);

  const resolveResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().includes(`/api/v1/tasks/${task.id}/resolve`)
  );
  const ctaButton = page.getByTestId('task-cta-buttons');
  await expect(ctaButton).toBeVisible();
  await expect(ctaButton).toBeEnabled();
  await ctaButton.click();
  const response = await resolveResponse;
  expect(response.status()).toBe(200);
};

let adminUser: AdminClass;
let classification: ClassificationClass;
let reviewer1User: AdminClass;
let reviewer2User: AdminClass;

const test = base.extend<{
  page: Page;
  reviewer1Page: Page;
  reviewer2Page: Page;
}>({
  page: async ({ browser }, use) => {
    const page = await browser.newPage();
    await adminUser.login(page);
    await use(page);
    await page.close();
  },
  reviewer1Page: async ({ browser }, use) => {
    const page = await browser.newPage();
    await reviewer1User.login(
      page,
      reviewer1User.data.email,
      reviewer1User.data.password
    );
    await use(page);
    await page.close();
  },
  reviewer2Page: async ({ browser }, use) => {
    const page = await browser.newPage();
    await reviewer2User.login(
      page,
      reviewer2User.data.email,
      reviewer2User.data.password
    );
    await use(page);
    await page.close();
  },
});

test.describe(
  'Task Workflow Approval',
  { tag: [DOMAIN_TAGS.GOVERNANCE] },
  () => {
    const workflowName = `pw_task_approval_workflow_${uuid()}`;

    test.beforeAll(async ({ browser }) => {
      const { afterAction, apiContext } = await performAdminLogin(browser);

      classification = new ClassificationClass({
        name: `pw_task_approval_classification-${uuid()}`,
        displayName: `PW Task Approval Classification ${uuid()}`,
      });
      reviewer1User = new AdminClass();
      reviewer2User = new AdminClass();
      adminUser = new AdminClass();

      await adminUser.create(apiContext, false);
      await reviewer1User.create(apiContext);
      await reviewer2User.create(apiContext);
      await classification.create(apiContext);

      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { afterAction, apiContext } = await performAdminLogin(browser);

      await adminUser.delete(apiContext);
      await reviewer1User.delete(apiContext);
      await reviewer2User.delete(apiContext);
      await classification.delete(apiContext);
      await apiContext
        .delete(
          `/api/v1/governance/workflowDefinitions/name/${encodeURIComponent(
            workflowName
          )}?hardDelete=true`
        )
        .catch(() => {});

      await afterAction();
    });

    test('keeps task open until both reviewers have approved', async ({
      page,
      reviewer1Page,
      reviewer2Page,
    }) => {
      // 6 minutes: workflow deployment poll (up to 2 min) + task creation poll
      // (up to 2 min) + two reviewer approval flows with page loads = ~5 min total.
      test.setTimeout(360_000);

      const { apiContext, afterAction } = await getApiContext(page);
      const tag = new TagClass({
        name: `pw_task_approval_tag_${uuid()}`,
        classification: classification.data.name,
      });

      try {
        await test.step('Create workflow and wait for deployment', async () => {
          await apiContext.post('/api/v1/governance/workflowDefinitions', {
            data: buildWorkflowDefinition(
              workflowName,
              getReviewerRef(reviewer1User.responseData),
              getReviewerRef(reviewer2User.responseData)
            ),
          });
          await waitForWorkflowDeployment(apiContext, workflowName);
        });

        await test.step('Create tag to trigger workflow', async () => {
          await tag.create(apiContext);
        });

        const task =
          await test.step('Wait for approval task to be created', async () =>
            waitForTaskCreated(
              apiContext,
              tag.responseData.fullyQualifiedName
            ));

        await test.step('Reviewer 1 casts first approval vote', async () => {
          await approveTaskFromEntityPage(reviewer1Page, task);
          await toastNotification(reviewer1Page, /Vote recorded/i, 10_000);
        });

        await test.step('Task stays open after first vote (threshold not met)', async () => {
          await expect
            .poll(() => fetchTaskStatus(apiContext, task.id), {
              timeout: 60_000,
              intervals: [2000, 5000],
              message: 'Task should remain Open after first vote',
            })
            .toBe('Open');
        });

        await test.step('Reviewer 2 casts second approval vote', async () => {
          await approveTaskFromEntityPage(reviewer2Page, task);
          await toastNotification(
            reviewer2Page,
            /Task resolved successfully/i,
            10_000
          );
        });

        await test.step('Task is resolved after both votes (threshold met)', async () => {
          await expect
            .poll(() => fetchTaskStatus(apiContext, task.id), {
              timeout: 60_000,
              intervals: [2000, 5000],
              message: 'Task should be Approved after second vote',
            })
            .toBe('Approved');
        });
      } finally {
        await tag.delete(apiContext).catch(() => {});
        await apiContext
          .delete(
            `/api/v1/governance/workflowDefinitions/name/${encodeURIComponent(
              workflowName
            )}?hardDelete=true`
          )
          .catch(() => {});
        await afterAction();
      }
    });
  }
);
