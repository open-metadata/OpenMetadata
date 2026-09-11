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
import { Task } from '../../../../src/generated/entity/tasks/task';
import { TaskClass, TaskResponseData } from '../../../support/entity/TaskClass';
import {
  expect,
  TaskActivityData,
  test,
} from '../../../support/fixtures/taskActivity';
import { getTableFqn } from '../../../utils/activityAPI';
import { okJson } from '../../../utils/apiResponse';
import { fillDescriptionBox, uuid } from '../../../utils/common';
import { getTaskCard, waitForTaskCreateResponse } from '../../../utils/task';
import { addTagSuggestion, selectAssignee } from '../../../utils/taskWorkflow';

test.beforeEach(async ({ page, activityData: data }) => {
  await data.teammate.setAdminRole(data.apiContext);
  await data.table.setOwner(data.apiContext, {
    id: data.member.responseData.id,
    type: 'user',
  });
  await data.teammate.login(page);
});

const submitTask = async (
  page: Page,
  data: TaskActivityData,
  button = 'submit-btn'
) => {
  const response = waitForTaskCreateResponse(page);
  await page.getByTestId(button).click();
  const saved = await okJson<TaskResponseData>(
    await response,
    'Create task from form'
  );
  const task = new TaskClass();
  task.set(saved);
  data.tasks.push(task);
  expect(saved.status).toBe('Open');
  expect(saved.assignees).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: data.member.responseData.name }),
    ])
  );
  const stored = await okJson<Task>(
    await data.apiContext.get(`/api/v1/tasks/${saved.id}`, {
      params: { fields: 'payload,assignees,about' },
    }),
    'Read created task'
  );
  expect(stored.payload).toEqual(saved.payload);
  expect(stored.about).toEqual(saved.about);
  await data.table.visitEntityPage(page);
  await page.getByTestId('activity_feed').click();
  await page.getByRole('menuitem', { name: /^Tasks/ }).click();
  await expect(getTaskCard(page, saved.taskId!)).toBeVisible();
  return saved;
};

for (const target of ['table', 'column'] as const) {
  test(`request description for the intended ${target}`, async ({
    page,
    activityData: data,
  }) => {
    await data.table.visitEntityPage(page);
    const [column] = data.table.entityResponseData.columns;
    if (target === 'column') {
      const row = page
        .getByRole('row')
        .filter({ has: page.getByText(column.name, { exact: true }) });
      await row.hover();
      await row.getByTestId('description').getByTestId('task-element').click();
    } else {
      await page.getByTestId('request-description').click();
    }
    await expect(page.getByTestId('form-container')).toBeVisible();
    await expect(page.getByTestId('select-assignee')).toContainText(
      data.member.responseData.displayName
    );
    const saved = await submitTask(page, data);
    expect(saved.about?.fullyQualifiedName).toBe(getTableFqn(data.table));
    expect(saved.payload?.fieldPath).toBe(
      target === 'column'
        ? `columns::${column.name}::description`
        : 'description'
    );
  });
}

test('manually selects an assignee when the entity has no owner', async ({
  page,
  activityData: data,
}) => {
  await data.table.patch({
    apiContext: data.apiContext,
    patchData: [{ op: 'add', path: '/owners', value: [] }],
  });
  await data.table.visitEntityPage(page);
  await page.getByTestId('request-description').click();
  await expect(page.getByTestId('form-container')).toBeVisible();
  await selectAssignee(page, data.member.responseData.name);
  await submitTask(page, data);
});

test('missing assignee prevents submission and leaves no task', async ({
  page,
  activityData: data,
}) => {
  await data.table.patch({
    apiContext: data.apiContext,
    patchData: [{ op: 'add', path: '/owners', value: [] }],
  });
  await data.table.visitEntityPage(page);
  await page.getByTestId('request-description').click();
  await expect(page.getByTestId('form-container')).toBeVisible();
  await page.getByTestId('submit-btn').click();
  await expect(
    page.getByTestId('assignees').locator('.ant-form-item-explain-error')
  ).toHaveText('Assignees: is required.');
  const tasks = await okJson<{ data: unknown[] }>(
    await data.apiContext.get('/api/v1/tasks', {
      params: { aboutEntity: getTableFqn(data.table) },
    }),
    'Read tasks after invalid submission'
  );
  expect(tasks.data).toHaveLength(0);
});

test('requests tags on the intended entity', async ({
  page,
  activityData: data,
}) => {
  await data.table.visitEntityPage(page);
  await page.getByTestId('request-entity-tags').click();
  await expect(page.getByTestId('form-container')).toBeVisible();
  const saved = await submitTask(page, data, 'submit-tag-request');
  expect(saved.type).toBe('TagUpdate');
  expect(saved.about?.fullyQualifiedName).toBe(getTableFqn(data.table));
  expect(saved.payload?.tagsToAdd).toEqual([]);
});

test('suggested description is included in the saved task', async ({
  page,
  activityData: data,
}) => {
  await data.table.visitEntityPage(page);
  await page.getByTestId('request-description').click();
  await expect(page.getByTestId('form-container')).toBeVisible();
  const suggestion = `Suggested description ${uuid()}`;
  await fillDescriptionBox(page, suggestion);
  const saved = await submitTask(page, data);
  expect(saved.payload?.newDescription).toContain(suggestion);
});

test('suggested tags are included in the saved task', async ({
  page,
  activityData: data,
}) => {
  await data.table.visitEntityPage(page);
  await page.getByTestId('request-entity-tags').click();
  await expect(page.getByTestId('form-container')).toBeVisible();
  await addTagSuggestion({
    page,
    searchText: 'PII',
    tagTestId: 'tag-PII.Sensitive',
  });
  const saved = await submitTask(page, data, 'submit-tag-request');
  expect(saved.payload?.tagsToAdd).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ tagFQN: 'PII.Sensitive' }),
    ])
  );
});
