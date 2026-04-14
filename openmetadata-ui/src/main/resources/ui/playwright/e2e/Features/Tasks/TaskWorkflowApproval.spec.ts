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
/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { APIRequestContext, expect, Page, request } from '@playwright/test';
import { DEFAULT_ADMIN_USER } from '../../../constant/user';
import { ClassificationClass } from '../../../support/tag/ClassificationClass';
import { TagClass } from '../../../support/tag/TagClass';
import { UserClass } from '../../../support/user/UserClass';
import { getAuthContext, toastNotification } from '../../../utils/common';
import { CreatedTask, openTaskDetails } from '../../../utils/taskWorkflow';
import { test } from '../../fixtures/pages';

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

type LoginResponse = {
  accessToken: string;
};

const REVIEWER_PASSWORD = 'User@OMD123';

const logWorkflowDebug = (...messages: Array<string | number | boolean>) => {
  if (process.env.PW_TASK_DEBUG) {
    console.log('[PW_TASK_WORKFLOW]', ...messages);
  }
};

const buildWorkflowDefinition = (
  workflowName: string,
  tagFullyQualifiedName: string,
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
      filter: {
        // Trigger filters are exclusion rules. Keep only the generated tag by
        // excluding every tag whose FQN does not match the target tag.
        tag: JSON.stringify({
          '!=': [{ var: 'fullyQualifiedName' }, tagFullyQualifiedName],
        }),
        default: JSON.stringify({
          '!=': [{ var: 'fullyQualifiedName' }, tagFullyQualifiedName],
        }),
      },
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

const fetchReviewerReference = async (
  apiContext: APIRequestContext,
  userName: string
): Promise<ReviewerReference> => {
  const response = await apiContext.get(
    `/api/v1/users/name/${encodeURIComponent(userName)}`
  );

  expect(response.ok()).toBeTruthy();

  const reviewer = await response.json();

  return {
    id: reviewer.id,
    type: 'user',
    displayName: reviewer.displayName ?? reviewer.name,
    fullyQualifiedName: reviewer.fullyQualifiedName ?? reviewer.name,
    name: reviewer.name,
  };
};

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
      (task: CreatedTask & {
        about?: { fullyQualifiedName?: string; name?: string };
      }) =>
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

const getStoredAdminAccessToken = (): string | undefined => {
  try {
    const authStatePath = path.join(process.cwd(), 'playwright/.auth/admin.json');
    const authState = JSON.parse(readFileSync(authStatePath, 'utf-8')) as {
      origins?: Array<{
        indexedDB?: Array<{
          name?: string;
          stores?: Array<{
            name?: string;
            records?: Array<{ key?: string; value?: string }>;
          }>;
        }>;
      }>;
    };

    for (const origin of authState.origins ?? []) {
      for (const database of origin.indexedDB ?? []) {
        if (database.name !== 'AppDataStore') {
          continue;
        }

        for (const store of database.stores ?? []) {
          if (store.name !== 'keyValueStore') {
            continue;
          }

          const appStateRecord = store.records?.find(
            (record) => record.key === 'app_state'
          );

          if (!appStateRecord?.value) {
            continue;
          }

          return JSON.parse(appStateRecord.value).primary as string;
        }
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
};

const createAdminApiContext = async () => {
  const storedAccessToken = getStoredAdminAccessToken();

  if (storedAccessToken) {
    const apiContext = await getAuthContext(storedAccessToken);
    const afterAction = async () => {
      await apiContext.dispose();
    };

    return { apiContext, afterAction };
  }

  const loginContext = await request.newContext({
    baseURL: 'http://localhost:8585',
    timeout: 90000,
  });

  try {
    const loginResponse = await loginContext.post('/api/v1/auth/login', {
      data: {
        email: DEFAULT_ADMIN_USER.userName,
        password: Buffer.from(DEFAULT_ADMIN_USER.password).toString('base64'),
      },
    });

    expect(loginResponse.ok()).toBeTruthy();

    const loginPayload = (await loginResponse.json()) as LoginResponse;
    const apiContext = await getAuthContext(loginPayload.accessToken);
    const afterAction = async () => {
      await apiContext.dispose();
      await loginContext.dispose();
    };

    return { apiContext, afterAction };
  } catch (error) {
    await loginContext.dispose();

    throw error;
  }
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
  const approvalDropdown = page.getByTestId(
    'glossary-accept-reject-task-dropdown'
  );
  const primaryActionButton = approvalDropdown.locator('button').first();

  await expect(primaryActionButton).toBeVisible();
  await primaryActionButton.click();
  await resolveResponse;
};

test.describe.serial('Task Workflow Approval', () => {
  test('keeps a workflow-opened approval task open until the approval threshold is reached', async ({
    browser,
  }) => {
    test.setTimeout(240000);

    logWorkflowDebug('admin-login:start');
    const { apiContext, afterAction } = await createAdminApiContext();
    logWorkflowDebug('admin-login:done');
    const uniqueSuffix = Date.now();
    const workflowName = `pw_tag_request_approval_${uniqueSuffix}`;
    const classification = new ClassificationClass({
      name: `pw-classification-${uniqueSuffix}`,
      displayName: `PW Classification ${uniqueSuffix}`,
    });
    const tag = new TagClass({
      name: `pw_tag_threshold_${uniqueSuffix}`,
      classification: classification.data.name,
    });
    const reviewer1User = new UserClass({
      firstName: 'PW',
      lastName: `WorkflowReviewer1 ${uniqueSuffix}`,
      email: `pw-task-reviewer1-${uniqueSuffix}@gmail.com`,
      password: REVIEWER_PASSWORD,
    });
    const reviewer2User = new UserClass({
      firstName: 'PW',
      lastName: `WorkflowReviewer2 ${uniqueSuffix}`,
      email: `pw-task-reviewer2-${uniqueSuffix}@gmail.com`,
      password: REVIEWER_PASSWORD,
    });
    const reviewer1Page = await browser.newPage();
    const reviewer2Page = await browser.newPage();
    await reviewer1User.create(apiContext, false);
    await reviewer2User.create(apiContext, false);
    await reviewer1User.setAdminRole(apiContext);
    await reviewer2User.setAdminRole(apiContext);
    const reviewer1 = await fetchReviewerReference(
      apiContext,
      reviewer1User.getUserName()
    );
    const reviewer2 = await fetchReviewerReference(
      apiContext,
      reviewer2User.getUserName()
    );
    logWorkflowDebug('reviewers:resolved', reviewer1.name, reviewer2.name);
    logWorkflowDebug('reviewer-pages:ready');

    try {
      logWorkflowDebug('classification:create:start', classification.data.name);
      await classification.create(apiContext);
      logWorkflowDebug(
        'classification:create:done',
        classification.responseData.id
      );

      logWorkflowDebug('workflow:create:start', workflowName);
      const workflowResponse = await apiContext.post(
        '/api/v1/governance/workflowDefinitions',
        {
          data: buildWorkflowDefinition(
            workflowName,
            `${classification.data.name}.${tag.data.name}`,
            reviewer1,
            reviewer2
          ),
        }
      );

      expect(workflowResponse.ok()).toBeTruthy();
      logWorkflowDebug('workflow:create:done', workflowName);
      logWorkflowDebug('workflow:deploy:wait:start', workflowName);
      await waitForWorkflowDeployment(apiContext, workflowName);
      logWorkflowDebug('workflow:deploy:wait:done', workflowName);

      logWorkflowDebug('tag:create:start', tag.data.name);
      const tagResponse = await apiContext.post('/api/v1/tags', {
        data: {
          ...tag.data,
        },
      });

      expect(tagResponse.ok()).toBeTruthy();
      tag.responseData = await tagResponse.json();
      logWorkflowDebug('tag:create:done', tag.responseData.fullyQualifiedName);

      logWorkflowDebug(
        'task:create:wait:start',
        tag.responseData.fullyQualifiedName
      );
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
            message:
              'Timed out waiting for the tag approval task to be created',
          }
        )
        .not.toBe('');
      logWorkflowDebug('task:create:wait:done');

      const createdTask = (await fetchOpenApprovalTask(
        apiContext,
        tag.responseData.fullyQualifiedName
      )) as CreatedTask & {
        about?: { type?: string; fullyQualifiedName?: string };
        assignees?: Array<{ name: string }>;
      };
      logWorkflowDebug('task:fetched', createdTask.taskId, createdTask.id);

      await reviewer1User.login(reviewer1Page);
      await reviewer2User.login(reviewer2Page);
      logWorkflowDebug('assignee-reviewers:ready', reviewer1.name, reviewer2.name);

      logWorkflowDebug('reviewer1:approve:start', createdTask.taskId);
      await approveTaskFromEntityPage(reviewer1Page, createdTask);
      await toastNotification(reviewer1Page, /Vote recorded/i, 10000);
      logWorkflowDebug('reviewer1:approve:done', createdTask.taskId);

      logWorkflowDebug('reviewer1:state:wait:start');
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
      logWorkflowDebug('reviewer1:state:wait:done');

      logWorkflowDebug('reviewer2:approve:start', createdTask.taskId);
      await approveTaskFromEntityPage(reviewer2Page, createdTask);
      await toastNotification(
        reviewer2Page,
        /Task resolved successfully/i,
        10000
      );
      logWorkflowDebug('reviewer2:approve:done', createdTask.taskId);

      logWorkflowDebug('reviewer2:state:wait:start');
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
      logWorkflowDebug('reviewer2:state:wait:done');
    } finally {
      logWorkflowDebug('cleanup:start', workflowName);
      await reviewer1Page.close().catch(() => undefined);
      await reviewer2Page.close().catch(() => undefined);
      await tag.delete(apiContext).catch(() => undefined);
      await reviewer1User.delete(apiContext).catch(() => undefined);
      await reviewer2User.delete(apiContext).catch(() => undefined);
      await classification.delete(apiContext).catch(() => undefined);
      await apiContext
        .delete(
          `/api/v1/governance/workflowDefinitions/name/${encodeURIComponent(
            workflowName
          )}?hardDelete=true`
        )
        .catch(() => undefined);
      await afterAction();
      logWorkflowDebug('cleanup:done', workflowName);
    }
  });
});
