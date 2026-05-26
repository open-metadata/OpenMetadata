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

import { expect, test } from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { waitForPageLoaded } from '../../utils/polling';
import { waitForTaskListResponse } from '../../utils/task';

async function createOpenTask(
  apiContext: Awaited<ReturnType<typeof performAdminLogin>>['apiContext'],
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

async function resolveTask(
  apiContext: Awaited<ReturnType<typeof performAdminLogin>>['apiContext'],
  taskId: string
) {
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
test.describe('ActivityFeedTab — task filter badge and placeholder', () => {
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
    const { page, apiContext, afterAction } = await performAdminLogin(browser);

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
    const { page, apiContext, afterAction } = await performAdminLogin(browser);

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
});
