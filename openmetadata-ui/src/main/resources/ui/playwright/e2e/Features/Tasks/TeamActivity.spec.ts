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
import { Page } from '@playwright/test';
import {
  createActivityTask,
  expect,
  openAssignedTasks,
  selectActivityFilter,
  test,
} from '../../../support/fixtures/taskActivity';
import { okJson } from '../../../utils/apiResponse';
import { getTaskCard, getTaskDisplayId } from '../../../utils/task';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';

const openTeam = async (page: Page, name: string, displayName: string) => {
  await page.goto(`/settings/members/teams/${encodeURIComponent(name)}`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.getByTestId('team-heading')).toHaveText(displayName);
};

test.describe('Team membership', () => {
  test('adding a member updates the team member list', async ({
    page,
    activityData: data,
  }) => {
    await data.team.addUser(data.apiContext, data.outsider.responseData.id);
    await data.member.login(page);
    await openTeam(
      page,
      data.team.responseData.name,
      data.team.responseData.displayName
    );
    await expect(
      page.getByRole('row').filter({ hasText: data.outsider.responseData.name })
    ).toBeVisible();
    await expect(
      page.getByRole('row').filter({ hasText: data.member.responseData.name })
    ).toBeVisible();
  });

  test('removing a member updates the list without removing other members', async ({
    page,
    activityData: data,
  }) => {
    const team = await okJson<{ users: { id: string }[] }>(
      await data.apiContext.get(
        `/api/v1/teams/${data.team.responseData.id}?fields=users`
      ),
      'Read team members'
    );
    const index = team.users.findIndex(
      (user) => user.id === data.teammate.responseData.id
    );
    expect(index).toBeGreaterThanOrEqual(0);
    await data.team.patch(data.apiContext, [
      { op: 'remove', path: `/users/${index}` },
    ]);
    await data.member.login(page);
    await openTeam(
      page,
      data.team.responseData.name,
      data.team.responseData.displayName
    );
    await expect(
      page.getByRole('row').filter({ hasText: data.member.responseData.name })
    ).toBeVisible();
    await expect(
      page.getByRole('row').filter({ hasText: data.teammate.responseData.name })
    ).toHaveCount(0);
  });
});

test.describe('Team-owned activity', () => {
  test('My Data includes activity on assets owned by the user’s team', async ({
    page,
    activityData: data,
  }) => {
    await data.member.login(page);
    const widget = await selectActivityFilter(page, 'My Data');
    await expect(
      widget.getByTestId('message-container').filter({ hasText: data.summary })
    ).toBeVisible();
    await expect(
      widget
        .getByTestId('message-container')
        .filter({ hasText: data.otherSummary })
    ).toHaveCount(0);
  });

  test('My Data excludes another team’s activity and retains the user’s own activity', async ({
    page,
    activityData: data,
  }) => {
    await data.outsider.login(page);
    const widget = await selectActivityFilter(page, 'My Data');
    await expect(
      widget
        .getByTestId('message-container')
        .filter({ hasText: data.otherSummary })
    ).toBeVisible();
    await expect(
      widget.getByTestId('message-container').filter({ hasText: data.summary })
    ).toHaveCount(0);
  });
});

test.describe('Tasks assigned to a team', () => {
  for (const member of ['member', 'teammate'] as const) {
    test(`${member} sees the exact task assigned to their team`, async ({
      page,
      activityData: data,
    }) => {
      const task = await createActivityTask(data);
      await data[member].login(page);
      const widget = await openAssignedTasks(page);
      await expect(
        getTaskCard(page, task.responseData!.taskId, widget)
      ).toBeVisible();
    });
  }

  test('non-member sees their own task without seeing a task assigned to another team', async ({
    page,
    activityData: data,
  }) => {
    const teamTask = await createActivityTask(data);
    const ownTask = await createActivityTask(
      data,
      data.outsider.responseData.name,
      data.otherTable
    );
    await data.outsider.login(page);
    const widget = await openAssignedTasks(page);
    await expect(
      getTaskCard(page, ownTask.responseData!.taskId, widget)
    ).toBeVisible();
    await expect(
      getTaskCard(page, teamTask.responseData!.taskId, widget)
    ).toHaveCount(0);
  });

  test('team member approves a team-assigned task and saves the suggested description', async ({
    page,
    activityData: data,
  }) => {
    const task = await createActivityTask(data);
    await data.member.login(page);
    await data.table.visitEntityPage(page);
    await page.getByTestId('activity_feed').click();
    await page.getByRole('menuitem', { name: /^Tasks/ }).click();
    const response = waitForResponseWithStatus(
      page,
      (result) =>
        result.request().method() === 'POST' &&
        new URL(result.url()).pathname ===
          `/api/v1/tasks/${task.responseData!.id}/resolve`,
      200
    );
    await getTaskCard(page, task.responseData!.taskId)
      .getByTestId('approve-button')
      .click();
    expect((await (await response).json()).status).toBe('Approved');
    expect((await task.get(data.apiContext)).status).toBe('Approved');
    const table = await okJson<{ description: string }>(
      await data.apiContext.get(
        `/api/v1/tables/${data.table.entityResponseData.id}`
      ),
      'Read team-approved description'
    );
    expect(table.description).toBe(task.data.payload!.suggestedValue);
    await data.table.visitEntityPage(page);
    await expect(page.getByTestId('asset-description-container')).toContainText(
      table.description
    );
  });
});

test('team page lists the team-owned asset', async ({
  page,
  activityData: data,
}) => {
  await data.member.login(page);
  await openTeam(
    page,
    data.team.responseData.name,
    data.team.responseData.displayName
  );
  await page.getByRole('tab', { name: /^Assets/ }).click();
  await expect(
    page
      .getByTestId(
        `table-data-card_${data.table.entityResponseData.fullyQualifiedName}`
      )
      .getByTestId('entity-link')
  ).toBeVisible();
});

test('team member receives a notification linking to the assigned task', async ({
  page,
  activityData: data,
}) => {
  const task = await createActivityTask(data);
  await data.member.login(page);
  const response = waitForResponseWithStatus(
    page,
    (result) =>
      result.request().method() === 'GET' &&
      new URL(result.url()).pathname === '/api/v1/tasks/assigned',
    200
  );
  await page.getByTestId('task-notifications').click();
  await response;
  const box = page.locator('.notification-box');
  const link = box.getByRole('link', {
    name: new RegExp(`^${getTaskDisplayId(task.responseData!.taskId)} `),
  });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.getByTestId('entity-header-name')).toHaveText(
    data.table.entityResponseData.name
  );
  await expect(getTaskCard(page, task.responseData!.taskId)).toBeVisible();
});
