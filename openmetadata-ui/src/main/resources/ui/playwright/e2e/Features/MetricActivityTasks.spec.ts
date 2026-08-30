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
import { APIRequestContext, expect, test } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { MetricClass } from '../../support/entity/MetricClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { uuid } from '../../utils/common';
import { performUserLogin } from '../../utils/user';

interface AdminUser {
  displayName?: string;
  fullyQualifiedName?: string;
  id: string;
  name: string;
}

interface CreatedThread {
  id: string;
  message: string;
}

interface MetricResponse {
  description?: string;
}

interface TaskComment {
  message: string;
}

interface TaskResponse {
  availableTransitions?: Array<{ id: string }>;
  comments?: TaskComment[];
  id: string;
  status: string;
}

interface TaskCounts {
  approved?: number;
  completed?: number;
  open?: number;
  total?: number;
}

const waitForOpenApprovalTask = async (
  apiContext: APIRequestContext,
  metricFqn: string
) => {
  let taskId = '';

  await expect
    .poll(
      async () => {
        const response = await apiContext.get('/api/v1/tasks', {
          params: {
            aboutEntity: metricFqn,
            fields:
              'assignees,availableTransitions,createdBy,resolution,reviewers',
            limit: 10,
            status: 'Open',
            type: 'RequestApproval',
          },
        });
        if (!response.ok()) {
          return '';
        }
        const taskList = (await response.json()) as {
          data?: Array<{ id?: number | string }>;
        };
        taskId = String(taskList.data?.[0]?.id ?? '');

        return taskId;
      },
      { intervals: [1_000, 2_000, 5_000], timeout: 120_000 }
    )
    .not.toBe('');

  return taskId;
};

test.describe(
  'Metric Activity and Tasks',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    test('creates a mentioned conversation and completes a description task', async ({
      browser,
    }) => {
      const { page, apiContext, afterAction } = await performAdminLogin(
        browser,
        { navigate: true }
      );
      const metric = new MetricClass();
      const commentText = `Please validate this metric definition ${uuid()}`;
      const taskTitle = `Clarify metric definition ${uuid()}`;
      const proposedDescription = `Governed metric definition ${uuid()}`;
      const taskComment = `Definition reviewed ${uuid()}`;
      const resolutionNote = `Approved through the metric activity workflow ${uuid()}`;
      let threadId: string | undefined;
      let taskId: string | undefined;

      try {
        const adminResponse = await apiContext.get('/api/v1/users/name/admin');
        expect(adminResponse.ok()).toBeTruthy();
        const admin = (await adminResponse.json()) as AdminUser;
        const adminFqn = admin.fullyQualifiedName ?? admin.name;
        const adminLabel = admin.displayName ?? admin.name;

        await metric.create(apiContext);
        expect(metric.entityResponseData.id).toBeTruthy();
        const metricFqn = metric.entityResponseData.fullyQualifiedName;

        await metric.visitEntityPage(page);
        await page.getByTestId('activity_feed').click();

        const activityTab = page.getByTestId('metric-activity-tab');
        await expect(activityTab).toBeVisible();

        const composer = activityTab
          .getByTestId('metric-activity-composer')
          .getByRole('textbox');
        await composer.fill(`Review with @${admin.name}`);

        const mentionSuggestion = page.getByTestId(
          `metric-mention-suggestion-${admin.id}`
        );
        await expect(mentionSuggestion).toBeVisible();
        await mentionSuggestion.click();

        const selectedMention = await composer.inputValue();
        expect(selectedMention).toContain(
          `<#E::user::${adminFqn}|@${adminLabel}>`
        );
        await composer.fill(`${selectedMention}${commentText}`);

        const createThreadResponsePromise = page.waitForResponse((response) => {
          const url = new URL(response.url());

          return (
            response.request().method() === 'POST' &&
            url.pathname === '/api/v1/feed'
          );
        });
        await activityTab
          .getByTestId('metric-activity-composer-submit')
          .click();
        const createThreadResponse = await createThreadResponsePromise;
        expect(createThreadResponse.ok()).toBeTruthy();
        const thread = (await createThreadResponse.json()) as CreatedThread;
        threadId = thread.id;
        expect(thread.message).toContain(
          `<#E::user::${adminFqn}|@${adminLabel}>`
        );
        expect(thread.message).toContain(commentText);

        const threadCard = page.getByTestId(
          `metric-activity-item-${thread.id}`
        );
        await expect(threadCard).toBeVisible();
        await expect(threadCard).toContainText(commentText);

        const tasksTab = activityTab.getByRole('tab', { name: /Tasks/ });
        await tasksTab.click();
        await page.getByTestId('metric-task-create').click();

        const taskDialog = page.getByTestId('metric-task-create-dialog');
        await expect(taskDialog).toBeVisible();
        await taskDialog
          .getByTestId('metric-task-create-title')
          .fill(taskTitle);
        await taskDialog
          .getByTestId('metric-task-create-assignees-search')
          .fill(admin.name);
        const assigneeCheckbox = taskDialog.getByRole('checkbox', {
          exact: true,
          name: adminLabel,
        });
        await assigneeCheckbox.focus();
        await assigneeCheckbox.press('Space');
        await expect(assigneeCheckbox).toBeChecked();
        await taskDialog
          .getByTestId('metric-task-create-value')
          .getByRole('textbox')
          .fill(proposedDescription);

        const createTaskResponsePromise = page.waitForResponse((response) => {
          const url = new URL(response.url());

          return (
            response.request().method() === 'POST' &&
            url.pathname === '/api/v1/tasks'
          );
        });
        await taskDialog.getByTestId('metric-task-create-submit').click();
        const createTaskResponse = await createTaskResponsePromise;
        expect(createTaskResponse.ok()).toBeTruthy();
        const createdTask = (await createTaskResponse.json()) as TaskResponse;
        taskId = createdTask.id;
        expect(createdTask.status).toBe('Open');

        const taskCard = page.getByTestId(`metric-task-item-${createdTask.id}`);
        const taskListItem = taskCard.locator('xpath=ancestor::li[1]');
        await expect(taskListItem).toBeVisible();
        await expect(taskListItem).toContainText(taskTitle);
        await expect(taskListItem).toContainText(adminLabel);
        await expect(tasksTab).toContainText('1');
        await taskCard.click();

        const taskDetail = page.getByTestId('metric-task-detail');
        await expect(taskDetail).toContainText(taskTitle);

        const taskCommentResponsePromise = page.waitForResponse((response) => {
          const url = new URL(response.url());

          return (
            response.request().method() === 'POST' &&
            url.pathname === `/api/v1/tasks/${createdTask.id}/comments`
          );
        });
        await taskDetail
          .getByTestId('metric-activity-composer')
          .getByRole('textbox')
          .fill(taskComment);
        await taskDetail.getByTestId('metric-activity-composer-submit').click();
        const taskCommentResponse = await taskCommentResponsePromise;
        expect(taskCommentResponse.ok()).toBeTruthy();
        const taskWithComment =
          (await taskCommentResponse.json()) as TaskResponse;
        expect(taskWithComment.comments).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ message: taskComment }),
          ])
        );

        await expect
          .poll(
            async () => {
              const response = await apiContext.get(
                `/api/v1/tasks/${createdTask.id}`,
                {
                  params: {
                    fields: 'availableTransitions,comments,payload,resolution',
                  },
                }
              );
              expect(response.ok()).toBeTruthy();
              const task = (await response.json()) as TaskResponse;

              return task.availableTransitions?.some(
                (transition) => transition.id === 'approve'
              );
            },
            { timeout: 60_000 }
          )
          .toBe(true);

        await taskDetail.getByRole('button', { name: 'Close' }).click();
        await activityTab.getByRole('tab', { name: /All Activity/ }).click();
        await tasksTab.click();
        await expect(taskListItem).toBeVisible();
        await taskCard.click();
        await expect(taskDetail).toContainText(taskComment);

        await taskDetail
          .getByRole('textbox', { name: 'Note' })
          .fill(resolutionNote);
        const resolveTaskResponsePromise = page.waitForResponse((response) => {
          const url = new URL(response.url());

          return (
            response.request().method() === 'POST' &&
            url.pathname === `/api/v1/tasks/${createdTask.id}/resolve`
          );
        });
        await taskDetail.getByRole('button', { name: 'Approve' }).click();
        const resolveTaskResponse = await resolveTaskResponsePromise;
        expect(resolveTaskResponse.ok()).toBeTruthy();
        const resolvedTask = (await resolveTaskResponse.json()) as TaskResponse;
        expect(resolvedTask.status).toBe('Approved');

        await expect
          .poll(async () => {
            const response = await apiContext.get(
              `/api/v1/metrics/name/${encodeURIComponent(metricFqn)}`
            );
            expect(response.ok()).toBeTruthy();

            return ((await response.json()) as MetricResponse).description;
          })
          .toBe(proposedDescription);

        await expect(taskCard).toBeHidden();
        await expect(tasksTab).toContainText('0');
        await expect
          .poll(async () => {
            const response = await apiContext.get('/api/v1/tasks/count', {
              params: { aboutEntity: metricFqn },
            });
            expect(response.ok()).toBeTruthy();

            return (await response.json()) as TaskCounts;
          })
          .toEqual(
            expect.objectContaining({
              approved: 1,
              completed: 1,
              open: 0,
              total: 1,
            })
          );

        await taskDetail.getByRole('button', { name: 'Close' }).click();
        await activityTab.getByRole('button', { name: /Status/ }).click();
        await page.getByRole('option', { exact: true, name: 'Closed' }).click();

        await expect(taskListItem).toBeVisible();
        await expect(taskListItem).toContainText('Approved');
        await taskCard.click();
        await expect(taskDetail).toContainText(taskComment);
        await expect(taskDetail).toContainText(resolutionNote);
      } finally {
        if (taskId) {
          await apiContext.delete(`/api/v1/tasks/${taskId}`, {
            params: { hardDelete: 'true' },
          });
        }
        if (threadId) {
          await apiContext.delete(`/api/v1/feed/${threadId}`);
        }
        if (metric.entityResponseData.id) {
          await metric.delete(apiContext);
        }
        await afterAction();
      }
    });

    test('opens an approval request from Tasks in the Approval Workflow tab', async ({
      browser,
    }) => {
      test.setTimeout(5 * 60 * 1_000);

      const { apiContext, afterAction } = await performAdminLogin(browser);
      const metric = new MetricClass();
      const reviewer = new UserClass(undefined, true);
      let reviewerAfterAction: (() => Promise<void>) | undefined;
      let reviewerCreated = false;

      try {
        await reviewer.create(apiContext);
        reviewerCreated = true;

        const createResponse = await apiContext.post('/api/v1/metrics', {
          data: {
            ...metric.entity,
            reviewers: [{ id: reviewer.responseData.id, type: 'user' }],
          },
        });
        expect(createResponse.status()).toBe(201);
        metric.entityResponseData = await createResponse.json();

        const metricFqn = metric.entityResponseData.fullyQualifiedName;
        const approvalTaskId = await waitForOpenApprovalTask(
          apiContext,
          metricFqn
        );
        const reviewerSession = await performUserLogin(browser, reviewer);
        reviewerAfterAction = reviewerSession.afterAction;
        const reviewerPage = reviewerSession.page;

        await metric.visitEntityPage(reviewerPage);
        await reviewerPage.getByTestId('activity_feed').click();
        const activityTab = reviewerPage.getByTestId('metric-activity-tab');
        await expect(activityTab).toBeVisible();
        await activityTab.getByRole('tab', { name: /Tasks/ }).click();

        const reviewButton = reviewerPage.getByTestId(
          `metric-task-review-${approvalTaskId}`
        );
        await expect(reviewButton).toBeVisible({ timeout: 60_000 });
        await expect(reviewButton).toHaveText('View Approval Workflow');
        await reviewButton.click();

        await expect(reviewerPage).toHaveURL(
          new RegExp(
            `/metric/${encodeURIComponent(metricFqn)}/approval(?:\\?.*)?$`
          )
        );
        await expect(
          reviewerPage.getByTestId('metric-approval-tab')
        ).toBeVisible({ timeout: 60_000 });
        await expect(
          reviewerPage.getByTestId('metric-approval-approve-btn')
        ).toBeVisible();
      } finally {
        try {
          await reviewerAfterAction?.();
        } finally {
          try {
            if (metric.entityResponseData.id) {
              await metric.delete(apiContext);
            }
          } finally {
            try {
              if (reviewerCreated) {
                await reviewer.delete(apiContext);
              }
            } finally {
              await afterAction();
            }
          }
        }
      }
    });
  }
);
