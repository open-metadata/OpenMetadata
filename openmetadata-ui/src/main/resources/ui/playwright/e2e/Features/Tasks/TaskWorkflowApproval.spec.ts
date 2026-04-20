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
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { getApiContext, toastNotification, uuid } from '../../../utils/common';
import { CreatedTask, openTaskDetails } from '../../../utils/taskWorkflow';

type ReviewerReference = {
  id: string;
  type: 'user';
  displayName: string;
  fullyQualifiedName: string;
  name: string;
};

type TaskState = {
  id: string;
  status: string;
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
  reviewer: UserClass['responseData']
): ReviewerReference => ({
  id: reviewer.id,
  type: 'user',
  displayName: reviewer.displayName ?? reviewer.name,
  fullyQualifiedName: reviewer.fullyQualifiedName ?? reviewer.name,
  name: reviewer.name,
});

const fetchOpenApprovalTask = async (
  apiContext: APIRequestContext,
  aboutEntity: string
): Promise<
  | (CreatedTask & {
      about?: { type?: string; fullyQualifiedName?: string };
      assignees?: Array<{ name: string }>;
    })
  | null
> => {
  const response = await apiContext.get(
    '/api/v1/tasks?status=Open&category=Approval&limit=100&fields=about,assignees'
  );
  const payload = await response.json();

  return (
    payload.data?.find(
      (
        task: CreatedTask & {
          about?: { fullyQualifiedName?: string; name?: string };
        }
      ) =>
        task.about?.fullyQualifiedName === aboutEntity ||
        task.about?.name === aboutEntity
    ) ?? null
  );
};

const fetchTaskById = async (
  apiContext: APIRequestContext,
  taskId: string
): Promise<TaskState | null> => {
  const response = await apiContext.get(
    `/api/v1/tasks/${taskId}?fields=assignees`
  );

  if (!response.ok()) {
    return null;
  }

  return response.json();
};

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
        timeout: 120000,
        intervals: [1000, 2000, 5000],
        message: `Timed out waiting for workflow ${workflowName} to be deployed`,
      }
    )
    .toBe(true);
};

const approveTaskFromEntityPage = async (
  page: Page,
  task: CreatedTask & {
    about?: { type?: string; fullyQualifiedName?: string };
  }
) => {
  expect(task.about?.fullyQualifiedName).toBeTruthy();

  await page.goto(
    `/tag/${encodeURIComponent(
      task.about?.fullyQualifiedName ?? ''
    )}/activity_feed/tasks`
  );
  await openTaskDetails(page, task);

  const resolveResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().includes(`/api/v1/tasks/${task.id}/resolve`)
  );
  const primaryActionButton = page.getByTestId('task-cta-buttons');

  await expect(primaryActionButton).toBeVisible();
  await primaryActionButton.click();
  await resolveResponse;
};

let adminUser: AdminClass;
let classification: ClassificationClass;
let tag: TagClass;
let reviewer1User: UserClass;
let reviewer2User: UserClass;

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
      reviewer1User.data.password
    );
    await use(page);
    await page.close();
  },
});

test.describe('Task Workflow Approval', () => {
  const workflowName = `pw_task_approval_workflow_${uuid()}`;

  test.beforeAll(async ({ browser }) => {
    const { afterAction, apiContext } = await performAdminLogin(browser);

    classification = new ClassificationClass({
      name: `pw_task_approval_classification-${uuid()}`,
      displayName: `PW Task Approval Classification ${uuid()}`,
    });
    tag = new TagClass({
      name: `pw_task_approval_tag_${uuid()}`,
      classification: classification.data.name,
    });
    reviewer1User = new AdminClass();
    reviewer2User = new AdminClass();
    adminUser = new AdminClass();

    await adminUser.create(apiContext, false);
    await reviewer1User.create(apiContext);
    await reviewer2User.create(apiContext);
    await classification.create(apiContext);

    await apiContext.post('/api/v1/governance/workflowDefinitions', {
      data: buildWorkflowDefinition(
        workflowName,
        getReviewerRef(reviewer1User.responseData),
        getReviewerRef(reviewer2User.responseData)
      ),
    });
    await waitForWorkflowDeployment(apiContext, workflowName);
    await tag.create(apiContext);

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { afterAction, apiContext } = await performAdminLogin(browser);

    await adminUser.delete(apiContext);
    await reviewer1User.delete(apiContext);
    await reviewer2User.delete(apiContext);
    await classification.delete(apiContext);
    await apiContext.delete(
      `/api/v1/governance/workflowDefinitions/name/${encodeURIComponent(
        workflowName
      )}?hardDelete=true`
    );

    await afterAction();
  });

  test('keep task open until all reviewers have approved', async ({
    page,
    reviewer1Page,
    reviewer2Page,
  }) => {
    test.setTimeout(360000);
    const { apiContext, afterAction } = await getApiContext(page);

    await expect
      .poll(
        async () => {
          const task = await fetchOpenApprovalTask(
            apiContext,
            tag.responseData.fullyQualifiedName
          );

          return task?.taskId ?? '';
        },
        {
          timeout: 120000,
          intervals: [1000, 2000, 5000],
          message: 'Timed out waiting for the tag approval task to be created',
        }
      )
      .not.toBe('');

    const createdTask = (await fetchOpenApprovalTask(
      apiContext,
      tag.responseData.fullyQualifiedName
    )) as CreatedTask & {
      about?: { type?: string; fullyQualifiedName?: string };
      assignees?: Array<{ name: string }>;
    };

    await approveTaskFromEntityPage(reviewer1Page, createdTask);
    await toastNotification(reviewer1Page, /Vote recorded/i, 10000);

    await expect
      .poll(
        async () => {
          const task = await fetchTaskById(apiContext, createdTask.id);

          return task?.status ?? '';
        },
        {
          timeout: 120000,
          intervals: [1000, 2000, 5000],
          message:
            'Timed out waiting for the first approval vote to leave the task open',
        }
      )
      .toBe('Open');
    await approveTaskFromEntityPage(reviewer2Page, createdTask);
    await toastNotification(
      reviewer2Page,
      /Task resolved successfully/i,
      10000
    );

    await expect
      .poll(
        async () => {
          const task = await fetchTaskById(apiContext, createdTask.id);

          return task?.status ?? '';
        },
        {
          timeout: 120000,
          intervals: [1000, 2000, 5000],
          message:
            'Timed out waiting for the second approval to resolve the task',
        }
      )
      .toBe('Approved');

    await afterAction();
  });
});
