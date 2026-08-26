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
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { waitForPageLoaded } from '../../utils/polling';
import { waitForTaskListResponse } from '../../utils/task';

async function createOpenTask(
  apiContext: APIRequestContext,
  tableFqn: string,
  assigneeName: string
): Promise<{ id: string }> {
  const res = await apiContext.post('/api/v1/tasks', {
    data: {
      name: `badge-test-${Date.now()}`,
      about: `<#E::table::${tableFqn}>`,
      type: 'DescriptionUpdate',
      category: 'MetadataUpdate',
      assignees: [assigneeName],
    },
  });
  expect(res.ok()).toBe(true);

  return res.json();
}

async function resolveTask(apiContext: APIRequestContext, taskId: string) {
  const res = await apiContext.post(`/api/v1/tasks/${taskId}/resolve`, {
    data: { resolutionType: 'Approved' },
  });
  expect([200, 201]).toContain(res.status());
}

async function navigateToTasksPanel(page: import('@playwright/test').Page) {
  await page.getByTestId('activity_feed').click();
  await waitForPageLoaded(page);

  const tasksMenuItem = page
    .getByTestId('global-setting-left-panel')
    .getByText('Tasks');

  await expect(tasksMenuItem).toBeVisible();

  await tasksMenuItem.click();
  await waitForPageLoaded(page);
}

function badge(page: import('@playwright/test').Page) {
  return page.getByTestId('left-panel-task-count').getByTestId('filter-count');
}

async function switchToClosedFilter(page: import('@playwright/test').Page) {
  await page.getByTestId('user-profile-page-task-filter-icon').click();
  const tasksListResponse = waitForTaskListResponse(page);
  await page.getByTestId('closed-tasks').click();
  await tasksListResponse;
}

async function switchToOpenFilter(page: import('@playwright/test').Page) {
  await page.getByTestId('user-profile-page-task-filter-icon').click();
  const tasksListResponse = waitForTaskListResponse(page);
  await page.getByTestId('open-tasks').click();
  await tasksListResponse;
}
const waitForMentionedTaskResponse = (page: import('@playwright/test').Page) =>
  page.waitForResponse((response) => {
    if (
      response.request().method() !== 'GET' ||
      !response.url().includes('/api/v1/tasks')
    ) {
      return false;
    }

    return Boolean(new URL(response.url()).searchParams.get('mentionedUser'));
  });

test.describe('ActivityFeedTab — task filter badge, placeholder and mentions', () => {
  const table = new TableClass();
  const assigneeUser = new UserClass();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await table.create(apiContext);
    await assigneeUser.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await table.delete(apiContext);
    await assigneeUser.delete(apiContext);
    await afterAction();
  });

  test('badge reflects openTaskCount in Open filter and closedTaskCount in Closed filter', async ({
    browser,
  }) => {
    const { page, apiContext, afterAction } = await performAdminLogin(browser, {
      navigate: true,
    });

    try {
      const fqn = table.entityResponseData?.fullyQualifiedName as string;
      const task = await createOpenTask(
        apiContext,
        fqn,
        assigneeUser.responseData.name
      );

      await table.visitEntityPage(page);
      await navigateToTasksPanel(page);

      await expect(badge(page)).toHaveText('1');

      await switchToClosedFilter(page);
      await expect(badge(page)).toHaveText('0');

      await resolveTask(apiContext, task.id);

      await page.reload();
      await waitForPageLoaded(page);
      await navigateToTasksPanel(page);

      await expect(badge(page)).toHaveText('0');

      await switchToClosedFilter(page);
      await expect(badge(page)).toHaveText('1');
    } finally {
      await afterAction();
    }
  });

  test('placeholder shows the correct message per filter state', async ({
    browser,
  }) => {
    const { page, apiContext, afterAction } = await performAdminLogin(browser, {
      navigate: true,
    });

    const emptyTable = new TableClass();

    try {
      await emptyTable.create(apiContext);
      await emptyTable.visitEntityPage(page);
      await navigateToTasksPanel(page);

      await expect(page.getByText(/Great News/i)).toBeVisible();
      await switchToClosedFilter(page);

      await expect(page.getByText(/Nothing Closed Yet/i)).toBeVisible();
      await expect(page.getByText(/Great News/i)).not.toBeVisible();

      await switchToOpenFilter(page);
      await expect(page.getByText(/Great News/i)).toBeVisible();
      await expect(page.getByText(/Nothing Closed Yet/i)).not.toBeVisible();
    } finally {
      await emptyTable.delete(apiContext);
      await afterAction();
    }
  });

  test('entity tab count equals the sum of the All and Tasks badges', async ({
    browser,
  }) => {
    const { page, apiContext, afterAction } = await performAdminLogin(browser, {
      navigate: true,
    });

    // Own table: the sibling tests resolve tasks on the shared one and chromium
    // runs fullyParallel, so sharing it would make these exact counts depend on
    // test order.
    const countedTable = new TableClass();

    try {
      await countedTable.create(apiContext);

      const fqn = countedTable.entityResponseData?.fullyQualifiedName as string;
      const assignee = assigneeUser.responseData.name;

      // One open task and one resolved task. The resolved one is the whole
      // point: the header counted every task while the Tasks badge counts only
      // the open ones, so with no closed task the two agree by accident.
      await createOpenTask(apiContext, fqn, assignee);
      const resolvedTask = await createOpenTask(apiContext, fqn, assignee);
      await resolveTask(apiContext, resolvedTask.id);

      await countedTable.visitEntityPage(page);

      const headerCount = page
        .getByRole('tab', { name: /activity feeds & tasks/i })
        .getByTestId('count');

      await expect(headerCount).toBeVisible();

      await navigateToTasksPanel(page);

      const allBadge = page
        .getByTestId('left-panel-all-count')
        .getByTestId('filter-count');

      await expect(allBadge).toBeVisible();
      // Open filter is the default, and exactly one task is still open.
      await expect(badge(page)).toHaveText('1', { timeout: 30_000 });

      // Poll the difference: all three numbers land after first paint, so a
      // single read races the count request and compares stale values. A
      // non-zero delta is the defect — the header counting the resolved task
      // that neither sub-tab badge includes.
      await expect
        .poll(
          async () => {
            const [header, all, tasks] = await Promise.all([
              headerCount.innerText(),
              allBadge.innerText(),
              badge(page).innerText(),
            ]);

            return (
              Number(header.trim()) -
              (Number(all.trim()) + Number(tasks.trim()))
            );
          },
          { timeout: 30_000 }
        )
        .toBe(0);
    } finally {
      await countedTable.delete(apiContext);
      await afterAction();
    }
  });

  test('Mentions sub-tab lists only the tasks the user is mentioned in', async ({
    browser,
  }) => {
    const { page, apiContext, afterAction } = await performAdminLogin(browser, {
      navigate: true,
    });

    // Own table: the assertions below are exact card counts and chromium runs
    // fullyParallel, so sharing the describe-level table would make them depend
    // on test order.
    const mentionTable = new TableClass();

    try {
      await mentionTable.create(apiContext);

      const fqn = mentionTable.entityResponseData?.fullyQualifiedName as string;
      const assignee = assigneeUser.responseData.name;

      await createOpenTask(apiContext, fqn, assignee);
      const mentionedTask = await createOpenTask(apiContext, fqn, assignee);

      // A mention relationship is only written from the comment path, so the
      // comment is what makes this task match ?mentionedUser=admin.
      const commentResponse = await apiContext.post(
        `/api/v1/tasks/${mentionedTask.id}/comments`,
        { data: { message: 'Please take a look <#E::user::admin>' } }
      );
      expect(commentResponse.ok()).toBe(true);

      await mentionTable.visitEntityPage(page);
      await navigateToTasksPanel(page);

      // My Tasks lists every task about the entity.
      await expect(page.getByTestId('task-feed-card')).toHaveCount(2);

      const mentionsResponse = waitForMentionedTaskResponse(page);
      await page.getByTestId('mentions-toggle').click();
      await mentionsResponse;

      // The list has to actually switch — it used to keep rendering My Tasks
      // because the mentions fetch wrote to the conversation feed state instead.
      await expect(page.getByTestId('task-feed-card')).toHaveCount(1);
      await expect(
        page.getByTestId('task-feed-card').getByTestId('entity-link')
      ).toBeVisible();
      await expect(
        page.getByTestId('no-data-placeholder-container')
      ).toHaveCount(0);

      // Switching back restores the full list — guards the paging-cursor reset.
      const myTasksResponse = waitForTaskListResponse(page);
      await page.getByTestId('my-tasks-toggle').click();
      await myTasksResponse;

      await expect(page.getByTestId('task-feed-card')).toHaveCount(2);

      // Landing on the mentions URL directly used to show the empty placeholder.
      const mentionsAgain = waitForMentionedTaskResponse(page);
      await page.getByTestId('mentions-toggle').click();
      await mentionsAgain;

      await page.reload();
      await waitForPageLoaded(page);

      await expect(page.getByTestId('task-feed-card')).toHaveCount(1);
    } finally {
      await mentionTable.delete(apiContext);
      await afterAction();
    }
  });
});
