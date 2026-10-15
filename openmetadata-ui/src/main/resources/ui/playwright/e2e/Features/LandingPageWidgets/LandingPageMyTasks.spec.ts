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
import { Page } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../../constant/config';
import { TaskClass } from '../../../support/entity/TaskClass';
import {
  expect,
  test as landingPageTest,
} from '../../../support/fixtures/landingPageUser';
import { okJson } from '../../../utils/apiResponse';
import {
  getWorkerAdminAPIContext,
  redirectToHomePage,
} from '../../../utils/common';
import { waitForLandingPageWidget } from '../../../utils/customizeLandingPage';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';

const MY_TASKS_KEY = 'KnowledgePanel.MyTask';
const ASSIGNED_TASKS_PATH = '/api/v1/tasks/assigned';

type AssignedTasksBody = {
  data: { id: string; category: string }[];
  paging?: { total?: number };
};

const waitForAssignedTasks = (page: Page) =>
  waitForResponseWithStatus(
    page,
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname === ASSIGNED_TASKS_PATH,
    200
  );

/**
 * One approval per test, assigned to the worker's landing-page account and
 * removed afterwards, so the card always holds something of the test's own.
 */
const test = landingPageTest.extend<{ approvalTask: TaskClass }>({
  approvalTask: async ({ landingPageUser }, use) => {
    const apiContext = await getWorkerAdminAPIContext();
    const task = new TaskClass({
      assignees: [landingPageUser.responseData.name],
      category: 'Approval',
      description: 'Approve this request from the landing page',
      // A generic approval: it carries no asset whose state a rejection would
      // have to change, so the reject below exercises the card, not a handler.
      type: 'RequestApproval',
    });

    await task.create(apiContext);
    await use(task);
    await task.delete(apiContext);
  },
});

const openMyTasks = async (page: Page) => {
  const assignedResponse = waitForAssignedTasks(page);

  await redirectToHomePage(page);
  const widget = await waitForLandingPageWidget(page, MY_TASKS_KEY);
  const assigned = await okJson<AssignedTasksBody>(
    await assignedResponse,
    'Assigned tasks'
  );

  return { assigned, widget };
};

test.describe('Landing page my tasks', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
  test('lists the viewer’s task and counts the open total from the server', async ({
    page,
    approvalTask,
  }) => {
    const { assigned, widget } = await openMyTasks(page);

    await expect(
      widget.getByTestId(`my-task-row-${approvalTask.responseData?.id}`)
    ).toBeVisible();
    await expect(widget.getByTestId('my-tasks-filter-all-count')).toHaveText(
      String(assigned.paging?.total ?? assigned.data.length)
    );

    // Approvals are counted over the loaded page, which holds this task.
    const approvals = assigned.data.filter((item) =>
      ['Approval', 'Review', 'MetadataUpdate'].includes(item.category)
    ).length;

    await expect(
      widget.getByTestId('my-tasks-filter-approvals-count')
    ).toHaveText(String(approvals));
  });

  test('rejects a selected approval from the selection bar', async ({
    page,
    approvalTask,
  }) => {
    const taskId = approvalTask.responseData?.id ?? '';
    const { widget } = await openMyTasks(page);
    const row = widget.getByTestId(`my-task-row-${taskId}`);

    await row.getByTestId(`my-task-select-${taskId}`).click();

    const bar = widget.getByTestId('my-tasks-selection-bar');

    await expect(bar).toBeVisible();
    await expect(bar.getByTestId('my-tasks-bulk-reject')).toHaveText('Reject');

    const resolveResponse = waitForResponseWithStatus(
      page,
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === `/api/v1/tasks/${taskId}/resolve`,
      200
    );
    const refreshed = waitForAssignedTasks(page);

    await bar.getByTestId('my-tasks-bulk-reject').click();
    await resolveResponse;
    await refreshed;

    await expect(row).toHaveCount(0);
    await expect(bar).toHaveCount(0);
  });

  test('sends the viewer to their tasks from the footer', async ({
    page,
    approvalTask,
  }) => {
    // Depended on so the card is not empty: an empty card shows no footer.
    void approvalTask;
    const { widget } = await openMyTasks(page);

    await widget.getByTestId('topic-action-myTasks').click();

    await expect
      .poll(() => new URL(page.url()).pathname)
      .toMatch(/\/(inbox\/tasks|users\/.+\/task)$/);
  });
});
