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
import { APIRequestContext, Page } from '@playwright/test';
import { okJson } from '../../utils/apiResponse';
import { getApiContext } from '../../utils/common';
import { getTaskCard } from '../../utils/task';
import { waitForResponseWithStatus } from '../../utils/waitHelpers';
import { PolicyClass } from '../access-control/PoliciesClass';
import { RolesClass } from '../access-control/RolesClass';
import { TaskClass } from '../entity/TaskClass';
import { UserClass } from '../user/UserClass';
import { expect, TaskActivityData, test as base } from './taskActivity';

export const test = base.extend<{ restrictedUser: UserClass }>({
  restrictedUser: async ({ activityData: data }, use) => {
    const policy = new PolicyClass();
    const role = new RolesClass();
    const user = data.outsider;
    const before = await okJson<{ roles: { id: string; type: string }[] }>(
      await data.apiContext.get(`/api/v1/users/${user.responseData.id}`, {
        params: { fields: 'roles' },
      }),
      'Read isolated user roles'
    );
    try {
      await policy.create(data.apiContext, [
        {
          name: 'deny-task-target-edits',
          resources: ['table'],
          operations: ['EditDescription', 'EditTags', 'EditAll'],
          effect: 'deny',
        },
      ]);
      await role.create(data.apiContext, [policy.responseData.name]);
      await user.patch({
        apiContext: data.apiContext,
        patchData: [
          {
            op: 'add',
            path: '/roles/-',
            value: { id: role.responseData.id, type: 'role' },
          },
        ],
      });
      await use(user);
    } finally {
      await user.patch({
        apiContext: data.apiContext,
        patchData: [{ op: 'add', path: '/roles', value: before.roles }],
      });
      if (role.responseData.id) await role.delete(data.apiContext);
      if (policy.responseData.id) await policy.delete(data.apiContext);
    }
  },
});

export const getTaskUserContext = async (page: Page, user: UserClass) => {
  await user.login(page);
  const context = await getApiContext(page);
  try {
    const current = await okJson<{ id: string }>(
      await context.apiContext.get('/api/v1/users/loggedInUser'),
      'Verify task mutation caller'
    );
    expect(current.id).toBe(user.responseData.id);
    return context;
  } catch (error) {
    await context.afterAction();
    throw error;
  }
};

export const readTaskTable = async (
  apiContext: APIRequestContext,
  data: TaskActivityData
) =>
  okJson<{ description: string; tags: unknown[] }>(
    await apiContext.get(`/api/v1/tables/${data.table.entityResponseData.id}`, {
      params: { fields: 'tags' },
    }),
    'Read task target'
  );

export const openTaskActions = async (
  page: Page,
  data: TaskActivityData,
  task: TaskClass,
  user: UserClass
) => {
  await user.login(page);
  await data.table.visitEntityPage(page);
  await page.getByTestId('activity_feed').click();
  await page.getByRole('menuitem', { name: /^Tasks/ }).click();
  const card = getTaskCard(page, task.responseData!.taskId);
  await expect(card).toBeVisible();
  return card;
};

export const approveTaskThroughUI = async (
  page: Page,
  data: TaskActivityData,
  task: TaskClass,
  user: UserClass
) => {
  const card = await openTaskActions(page, data, task, user);
  const response = waitForResponseWithStatus(
    page,
    (result) =>
      result.request().method() === 'POST' &&
      new URL(result.url()).pathname ===
        `/api/v1/tasks/${task.responseData!.id}/resolve`,
    200
  );
  await card.getByTestId('approve-button').click();
  expect(
    (await okJson<{ status: string }>(await response, 'Approve task')).status
  ).toBe('Approved');
  expect((await task.get(data.apiContext)).status).toBe('Approved');
  expect((await readTaskTable(data.apiContext, data)).description).toBe(
    task.data.payload!.suggestedValue
  );
};

export { expect } from './base';
