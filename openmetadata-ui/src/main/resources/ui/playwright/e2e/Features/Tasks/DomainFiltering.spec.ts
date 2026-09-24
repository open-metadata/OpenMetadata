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

import { Page, Response } from '@playwright/test';
import { Domain } from '../../../support/domain/Domain';
import { TaskClass } from '../../../support/entity/TaskClass';
import {
  createActivityTask,
  expect,
  TaskActivityData,
  test as base,
} from '../../../support/fixtures/taskActivity';
import { getTableFqn } from '../../../utils/activityAPI';
import { okJson, settleAll } from '../../../utils/apiResponse';
import {
  assignDomainToEntity,
  selectDomainFromNavbar,
} from '../../../utils/domain';
import { getTaskCard } from '../../../utils/task';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';

type DomainTasks = {
  domainA: Domain;
  domainB: Domain;
  taskA: TaskClass;
  taskB: TaskClass;
};

const domainFqn = (domain: Domain): string => {
  const fqn = domain.responseData.fullyQualifiedName;
  if (!fqn)
    throw new Error(`Domain fixture ${domain.responseData.name} has no FQN`);
  return fqn;
};

const test = base.extend<{ domainTasks: DomainTasks }>({
  domainTasks: async ({ activityData: data }, use) => {
    const domainA = new Domain();
    const domainB = new Domain();
    try {
      await domainA.create(data.apiContext);
      await domainB.create(data.apiContext);
      await assignDomainToEntity(data.apiContext, data.table, domainA);
      await assignDomainToEntity(data.apiContext, data.otherTable, domainB);
      const taskA = await createActivityTask(
        data,
        data.member.responseData.name
      );
      const taskB = await createActivityTask(
        data,
        data.member.responseData.name,
        data.otherTable
      );
      await use({ domainA, domainB, taskA, taskB });
    } finally {
      await settleAll(
        [data.table, data.otherTable].map((table) =>
          table.patch({
            apiContext: data.apiContext,
            patchData: [{ op: 'add', path: '/domains', value: [] }],
          })
        )
      );
      await settleAll(
        [domainA, domainB]
          .filter((domain) => domain.responseData.id)
          .map((domain) => domain.delete(data.apiContext))
      );
    }
  },
});

const openEntityTasks = async (
  page: Page,
  data: TaskActivityData,
  task: TaskClass,
  otherTable = false
) => {
  await data.member.login(page);
  await (otherTable ? data.otherTable : data.table).visitEntityPage(page);
  await page.getByTestId('activity_feed').click();
  await page.getByRole('menuitem', { name: /^Tasks/ }).click();
  await expect(getTaskCard(page, task.responseData!.taskId)).toBeVisible();
};

const changeDomain = async (
  page: Page,
  data: TaskActivityData,
  domain?: Domain
) => {
  const fqn = getTableFqn(data.table);
  const expectedDomain = domain ? domainFqn(domain) : null;
  const matches = (pathname: string) => (response: Response) => {
    const url = new URL(response.url());
    return (
      response.request().method() === 'GET' &&
      url.pathname === pathname &&
      (pathname === '/api/v1/tasks/count' ||
        url.searchParams.get('statusGroup') === 'open') &&
      url.searchParams.get('aboutEntity') === fqn &&
      url.searchParams.get('domain') === expectedDomain
    );
  };
  const listResponse = waitForResponseWithStatus(
    page,
    matches('/api/v1/tasks'),
    200
  );
  const countResponse = waitForResponseWithStatus(
    page,
    matches('/api/v1/tasks/count'),
    200
  );
  if (domain) {
    await selectDomainFromNavbar(page, domain.responseData);
  } else {
    await page.getByTestId('domain-dropdown').click();
    await page.getByTestId('all-domains-selector').click();
  }
  const list = await okJson<{ data: { id: string }[] }>(
    await listResponse,
    'Read domain-filtered entity tasks'
  );
  const counts = await okJson<{ total: number }>(
    await countResponse,
    'Read domain-filtered entity task counts'
  );
  expect(counts.total).toBe(list.data.length);
  return list.data.map((task) => task.id);
};

test('selecting the entity domain refetches its task list and count', async ({
  page,
  activityData: data,
  domainTasks: tasks,
}) => {
  await openEntityTasks(page, data, tasks.taskA);
  expect(await changeDomain(page, data, tasks.domainA)).toEqual([
    tasks.taskA.responseData!.id,
  ]);
  await expect(
    getTaskCard(page, tasks.taskA.responseData!.taskId)
  ).toBeVisible();
});

test('switching to another domain removes tasks from the previous domain', async ({
  page,
  activityData: data,
  domainTasks: tasks,
}) => {
  await openEntityTasks(page, data, tasks.taskA);
  await changeDomain(page, data, tasks.domainA);
  expect(await changeDomain(page, data, tasks.domainB)).toEqual([]);
  await expect(getTaskCard(page, tasks.taskA.responseData!.taskId)).toHaveCount(
    0
  );
});

test('All Domains removes the request filter and restores the entity task', async ({
  page,
  activityData: data,
  domainTasks: tasks,
}) => {
  await openEntityTasks(page, data, tasks.taskA);
  await changeDomain(page, data, tasks.domainB);
  expect(await changeDomain(page, data)).toEqual([
    tasks.taskA.responseData!.id,
  ]);
  await expect(
    getTaskCard(page, tasks.taskA.responseData!.taskId)
  ).toBeVisible();
});

test('domain task counts change when its task is approved', async ({
  activityData: data,
  domainTasks: tasks,
}) => {
  const readCounts = async () =>
    okJson<{ open: number; completed: number; total: number }>(
      await data.apiContext.get('/api/v1/tasks/count', {
        params: { domain: domainFqn(tasks.domainA) },
      }),
      'Read isolated domain task counts'
    );
  expect(await readCounts()).toMatchObject({ open: 1, completed: 0, total: 1 });
  const suggested = tasks.taskA.data.payload!.suggestedValue;
  await okJson(
    await data.apiContext.post(
      `/api/v1/tasks/${tasks.taskA.responseData!.id}/resolve`,
      {
        data: { resolutionType: 'Approved', newValue: suggested },
      }
    ),
    'Approve task in the selected domain'
  );
  expect((await tasks.taskA.get(data.apiContext)).status).toBe('Approved');
  const table = await okJson<{ description: string }>(
    await data.apiContext.get(
      `/api/v1/tables/${data.table.entityResponseData.id}`
    ),
    'Read approved task target'
  );
  expect(table.description).toBe(suggested);
  expect(await readCounts()).toMatchObject({ open: 0, completed: 1, total: 1 });
});

test('task API domain filter returns the matching task and excludes the other domain', async ({
  activityData: data,
  domainTasks: tasks,
}) => {
  for (const [domain, task] of [
    [tasks.domainA, tasks.taskA],
    [tasks.domainB, tasks.taskB],
  ] as const) {
    const response = await okJson<{ data: { id: string }[] }>(
      await data.apiContext.get('/api/v1/tasks', {
        params: { domain: domainFqn(domain) },
      }),
      'Read tasks for the requested domain'
    );
    expect(response.data.map((item) => item.id)).toEqual([
      task.responseData!.id,
    ]);
  }
});

test('unfiltered assigned-task API includes both owned domain fixtures', async ({
  activityData: data,
  domainTasks: tasks,
}) => {
  const response = await okJson<{ data: { id: string }[] }>(
    await data.apiContext.get('/api/v1/tasks', {
      params: { assignee: data.member.responseData.fullyQualifiedName },
    }),
    'Read tasks assigned across domains'
  );
  expect(response.data.map((task) => task.id).sort()).toEqual(
    [tasks.taskA.responseData!.id, tasks.taskB.responseData!.id].sort()
  );
});

test('reloading preserves the selected domain and matching task card', async ({
  page,
  activityData: data,
  domainTasks: tasks,
}) => {
  await openEntityTasks(page, data, tasks.taskA);
  await changeDomain(page, data, tasks.domainA);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('domain-dropdown')).toContainText(
    tasks.domainA.responseData.displayName
  );
  await expect(
    getTaskCard(page, tasks.taskA.responseData!.taskId)
  ).toBeVisible();
  await expect(getTaskCard(page, tasks.taskB.responseData!.taskId)).toHaveCount(
    0
  );
});

test('the other entity shows its own task without inheriting another entity task', async ({
  page,
  activityData: data,
  domainTasks: tasks,
}) => {
  await openEntityTasks(page, data, tasks.taskB, true);
  await expect(
    getTaskCard(page, tasks.taskB.responseData!.taskId)
  ).toBeVisible();
  await expect(getTaskCard(page, tasks.taskA.responseData!.taskId)).toHaveCount(
    0
  );
});
