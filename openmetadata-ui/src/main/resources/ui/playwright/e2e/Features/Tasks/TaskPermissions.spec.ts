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

import { TaskClass } from '../../../support/entity/TaskClass';
import { createActivityTask } from '../../../support/fixtures/taskActivity';
import {
  approveTaskThroughUI,
  expect,
  getTaskUserContext,
  openTaskActions,
  readTaskTable,
  test,
} from '../../../support/fixtures/taskPermissions';
import { okJson } from '../../../utils/apiResponse';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';

for (const field of ['description', 'tags'] as const) {
  test(`assignment does not grant permission to edit ${field}`, async ({
    page,
    activityData: data,
    restrictedUser,
  }) => {
    const targetBefore = await readTaskTable(data.apiContext, data);
    const task = new TaskClass({
      about: `<#E::table::${data.table.entityResponseData.fullyQualifiedName}>`,
      assignees: [restrictedUser.responseData.name],
      type: field === 'description' ? 'DescriptionUpdate' : 'TagUpdate',
      payload: {
        field,
        currentValue:
          field === 'description'
            ? targetBefore.description
            : JSON.stringify(targetBefore.tags),
        suggestedValue:
          field === 'description'
            ? 'Forbidden description'
            : JSON.stringify([
                {
                  tagFQN: 'PII.Sensitive',
                  source: 'Classification',
                  state: 'Confirmed',
                  labelType: 'Manual',
                },
              ]),
      },
    });
    data.tasks.push(task);
    await task.create(data.apiContext);
    const actor = await getTaskUserContext(page, restrictedUser);
    try {
      const response = await actor.apiContext.post(
        `/api/v1/tasks/${task.responseData!.id}/resolve`,
        {
          data: {
            resolutionType: 'Approved',
            newValue: task.data.payload!.suggestedValue,
          },
        }
      );
      expect(response.status()).toBe(403);
      expect((await task.get(data.apiContext)).status).toBe('Open');
      expect((await readTaskTable(data.apiContext, data))[field]).toEqual(
        targetBefore[field]
      );
    } finally {
      await actor.afterAction();
    }
  });
}

for (const actorRole of ['owner', 'admin'] as const) {
  test(`${actorRole} can resolve and persist a task through the API`, async ({
    page,
    activityData: data,
  }) => {
    const user = actorRole === 'admin' ? data.teammate : data.member;
    if (actorRole === 'admin') await user.setAdminRole(data.apiContext);
    else
      await data.table.setOwner(data.apiContext, {
        id: user.responseData.id,
        type: 'user',
      });
    const task = await createActivityTask(data, data.member.responseData.name);
    const actor = await getTaskUserContext(page, user);
    try {
      await okJson(
        await actor.apiContext.post(
          `/api/v1/tasks/${task.responseData!.id}/resolve`,
          {
            data: {
              resolutionType: 'Approved',
              newValue: task.data.payload!.suggestedValue,
            },
          }
        ),
        'Resolve authorized task'
      );
      expect((await task.get(data.apiContext)).status).toBe('Approved');
      expect((await readTaskTable(data.apiContext, data)).description).toBe(
        task.data.payload!.suggestedValue
      );
    } finally {
      await actor.afterAction();
    }
  });

  test(`${actorRole} sees both approve and reject controls for the exact task`, async ({
    page,
    activityData: data,
  }) => {
    const user = actorRole === 'admin' ? data.teammate : data.member;
    if (actorRole === 'admin') await user.setAdminRole(data.apiContext);
    else
      await data.table.setOwner(data.apiContext, {
        id: user.responseData.id,
        type: 'user',
      });
    const task = await createActivityTask(data, data.member.responseData.name);
    const card = await openTaskActions(page, data, task, user);
    await expect(card.getByTestId('approve-button')).toBeVisible();
    await expect(card.getByTestId('reject-button')).toBeVisible();
  });
}

test('an assigned viewer cannot approve a task without edit permission', async ({
  page,
  activityData: data,
  restrictedUser,
}) => {
  const task = await createActivityTask(data, restrictedUser.responseData.name);
  const targetBefore = await readTaskTable(data.apiContext, data);
  const card = await openTaskActions(page, data, task, restrictedUser);
  const response = waitForResponseWithStatus(
    page,
    (result) =>
      result.request().method() === 'POST' &&
      new URL(result.url()).pathname ===
        `/api/v1/tasks/${task.responseData!.id}/resolve`,
    403
  );
  await card.getByTestId('approve-button').click();
  await response;
  expect((await task.get(data.apiContext)).status).toBe('Open');
  expect(await readTaskTable(data.apiContext, data)).toEqual(targetBefore);
  await expect(card.getByTestId('approve-button')).toBeVisible();
});

test('team membership and entity ownership authorize the actual approval', async ({
  page,
  activityData: data,
}) => {
  const task = await createActivityTask(data);
  await approveTaskThroughUI(page, data, task, data.member);
});

test('non-team member has no controls on a team-assigned task', async ({
  page,
  activityData: data,
}) => {
  const task = await createActivityTask(data);
  const card = await openTaskActions(page, data, task, data.outsider);
  await expect(card.getByTestId('approve-button')).toHaveCount(0);
  await expect(card.getByTestId('reject-button')).toHaveCount(0);
});

test('a non-admin task creator can close their own task', async ({
  page,
  activityData: data,
}) => {
  const actor = await getTaskUserContext(page, data.outsider);
  try {
    const task = new TaskClass({
      about: `<#E::table::${data.table.entityResponseData.fullyQualifiedName}>`,
      assignees: [data.member.responseData.name],
    });
    data.tasks.push(task);
    await task.create(actor.apiContext);
    expect(task.responseData!.createdBy?.name).toBe(
      data.outsider.responseData.name
    );
    await okJson(
      await actor.apiContext.post(
        `/api/v1/tasks/${task.responseData!.id}/close`,
        { params: { comment: 'Creator closing task' } }
      ),
      'Close as creator'
    );
    expect((await task.get(data.apiContext)).status).toBe('Cancelled');
  } finally {
    await actor.afterAction();
  }
});

test('a non-creator and non-assignee cannot close another user’s task', async ({
  page,
  activityData: data,
}) => {
  const task = await createActivityTask(data, data.member.responseData.name);
  const actor = await getTaskUserContext(page, data.outsider);
  try {
    const response = await actor.apiContext.post(
      `/api/v1/tasks/${task.responseData!.id}/close`,
      { params: { comment: 'Forbidden cancellation' } }
    );
    expect(response.status()).toBe(403);
    expect((await task.get(data.apiContext)).status).toBe('Open');
  } finally {
    await actor.afterAction();
  }
});

test('a cancelled task cannot later apply its suggested value', async ({
  activityData: data,
}) => {
  const task = await createActivityTask(data);
  await okJson(
    await data.apiContext.post(`/api/v1/tasks/${task.responseData!.id}/close`),
    'Cancel task'
  );
  expect((await task.get(data.apiContext)).status).toBe('Cancelled');
  const response = await data.apiContext.post(
    `/api/v1/tasks/${task.responseData!.id}/resolve`,
    {
      data: {
        resolutionType: 'Approved',
        newValue: task.data.payload!.suggestedValue,
      },
    }
  );
  expect(response.status()).toBe(400);
  expect((await task.get(data.apiContext)).status).toBe('Cancelled');
  expect((await readTaskTable(data.apiContext, data)).description).toBe(
    data.table.entityResponseData.description
  );
});

test('admin can resolve an unassigned task and persist its value', async ({
  page,
  activityData: data,
}) => {
  await data.teammate.setAdminRole(data.apiContext);
  const task = new TaskClass({
    about: `<#E::table::${data.table.entityResponseData.fullyQualifiedName}>`,
    payload: {
      field: 'description',
      currentValue: data.table.entityResponseData.description,
      suggestedValue: 'Unassigned task approved',
    },
  });
  data.tasks.push(task);
  await task.create(data.apiContext);
  const actor = await getTaskUserContext(page, data.teammate);
  try {
    await okJson(
      await actor.apiContext.post(
        `/api/v1/tasks/${task.responseData!.id}/resolve`,
        {
          data: {
            resolutionType: 'Approved',
            newValue: task.data.payload!.suggestedValue,
          },
        }
      ),
      'Resolve as admin'
    );
    expect((await task.get(data.apiContext)).status).toBe('Approved');
    expect((await readTaskTable(data.apiContext, data)).description).toBe(
      task.data.payload!.suggestedValue
    );
  } finally {
    await actor.afterAction();
  }
});
