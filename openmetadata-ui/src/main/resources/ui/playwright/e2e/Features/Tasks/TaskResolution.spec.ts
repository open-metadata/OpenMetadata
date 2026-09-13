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

for (const actor of ['member', 'outsider'] as const) {
  test(`${
    actor === 'member' ? 'assignee sees' : 'non-assignee cannot use'
  } approve and reject controls`, async ({ page, activityData: data }) => {
    const task = await createActivityTask(data, data.member.responseData.name);
    const card = await openTaskActions(page, data, task, data[actor]);
    for (const action of ['approve-button', 'reject-button']) {
      if (actor === 'member')
        await expect(card.getByTestId(action)).toBeVisible();
      else await expect(card.getByTestId(action)).toHaveCount(0);
    }
  });
}

test('admin approves another user’s task and saves the description', async ({
  page,
  activityData: data,
}) => {
  await data.teammate.setAdminRole(data.apiContext);
  const task = await createActivityTask(data, data.member.responseData.name);
  await approveTaskThroughUI(page, data, task, data.teammate);
});

test('recognizer data quality feedback is rejected by its assignee', async ({
  page,
  activityData: data,
}) => {
  const [column] = data.table.entityResponseData.columns;
  expect(column.name).toBeTruthy();
  const task = new TaskClass({
    about: `<#E::table::${data.table.entityResponseData.fullyQualifiedName}>`,
    type: 'DataQualityReview',
    category: 'Review',
    assignees: [data.member.responseData.name],
    payload: {
      feedback: {
        entityLink: `<#E::table::${data.table.entityResponseData.fullyQualifiedName}::columns::${column.name}>`,
        tagFQN: 'PII.Sensitive',
        feedbackType: 'FALSE_POSITIVE',
        userReason: 'NOT_SENSITIVE_DATA',
        userComments: 'Recognizer feedback',
        createdBy: {
          id: data.member.responseData.id,
          type: 'user',
          name: data.member.responseData.name,
        },
        createdAt: Date.now(),
      },
      recognizer: {
        recognizerId: '11111111-1111-1111-1111-111111111111',
        recognizerName: 'email_recognizer',
        score: 0.97,
      },
    },
  });
  data.tasks.push(task);
  await task.create(data.apiContext);
  const actor = await getTaskUserContext(page, data.member);
  try {
    expect(
      (await task.resolve(actor.apiContext, 'Rejected', 'False positive'))
        .status
    ).toBe('Rejected');
    expect((await task.get(data.apiContext)).status).toBe('Rejected');
    expect((await readTaskTable(data.apiContext, data)).description).toBe(
      data.table.entityResponseData.description
    );
  } finally {
    await actor.afterAction();
  }
});

test('team member approves a team-assigned task and persists its value', async ({
  page,
  activityData: data,
}) => {
  const task = await createActivityTask(data);
  await approveTaskThroughUI(page, data, task, data.member);
});

test('non-member cannot approve a team-assigned task', async ({
  page,
  activityData: data,
}) => {
  const task = await createActivityTask(data);
  const card = await openTaskActions(page, data, task, data.outsider);
  await expect(card.getByTestId('approve-button')).toHaveCount(0);
  await expect(card.getByTestId('reject-button')).toHaveCount(0);
});

test('assignee without edit permission receives 403 and leaves the task and target unchanged', async ({
  page,
  activityData: data,
  restrictedUser,
}) => {
  const task = await createActivityTask(data, restrictedUser.responseData.name);
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
    expect((await readTaskTable(data.apiContext, data)).description).toBe(
      data.table.entityResponseData.description
    );
  } finally {
    await actor.afterAction();
  }
});

test('owner approves as the real owner and persists the suggested description', async ({
  page,
  activityData: data,
}) => {
  await data.table.setOwner(data.apiContext, {
    id: data.member.responseData.id,
    type: 'user',
  });
  const task = await createActivityTask(data, data.member.responseData.name);
  const actor = await getTaskUserContext(page, data.member);
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
      'Resolve as owner'
    );
    expect((await task.get(data.apiContext)).status).toBe('Approved');
    expect((await readTaskTable(data.apiContext, data)).description).toBe(
      task.data.payload!.suggestedValue
    );
  } finally {
    await actor.afterAction();
  }
});

test('a non-admin creator can cancel their own task without changing the entity', async ({
  page,
  activityData: data,
}) => {
  const actor = await getTaskUserContext(page, data.outsider);
  try {
    const task = new TaskClass({
      about: `<#E::table::${data.table.entityResponseData.fullyQualifiedName}>`,
      assignees: [data.member.responseData.name],
      payload: {
        field: 'description',
        currentValue: data.table.entityResponseData.description,
        suggestedValue: 'Do not apply this',
      },
    });
    data.tasks.push(task);
    await task.create(actor.apiContext);
    expect(task.responseData!.createdBy?.name).toBe(
      data.outsider.responseData.name
    );
    await okJson(
      await actor.apiContext.post(
        `/api/v1/tasks/${task.responseData!.id}/close`,
        { params: { comment: 'Creator cancellation' } }
      ),
      'Cancel own task'
    );
    expect((await task.get(data.apiContext)).status).toBe('Cancelled');
    expect((await readTaskTable(data.apiContext, data)).description).toBe(
      data.table.entityResponseData.description
    );
  } finally {
    await actor.afterAction();
  }
});
