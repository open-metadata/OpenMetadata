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
import { insertActivityEventForTest } from '../../utils/activityAPI';
import { performAdminLogin } from '../../utils/admin';
import {
  assertFulfilled,
  deleteFixtureEntity,
  okJson,
} from '../../utils/apiResponse';
import { uuid } from '../../utils/common';
import { waitForLandingPageWidget } from '../../utils/customizeLandingPage';
import {
  selectActivityFeedFilterAndVerifyEndpoint,
  selectWidgetSortOption,
} from '../../utils/widgetFilters';
import { TableClass } from '../entity/TableClass';
import { TaskClass } from '../entity/TaskClass';
import { PersonaClass } from '../persona/PersonaClass';
import { TeamClass } from '../team/TeamClass';
import { UserClass } from '../user/UserClass';
import { expect, test as base } from './base';

export type TaskActivityData = {
  apiContext: APIRequestContext;
  member: UserClass;
  teammate: UserClass;
  outsider: UserClass;
  team: TeamClass;
  table: TableClass;
  otherTable: TableClass;
  summary: string;
  otherSummary: string;
  tasks: TaskClass[];
};

export const test = base.extend<{ activityData: TaskActivityData }>({
  activityData: async ({ browser }, use) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const member = new UserClass();
    const teammate = new UserClass();
    const outsider = new UserClass();
    const users = [member, teammate, outsider];
    const team = new TeamClass();
    const table = new TableClass();
    const otherTable = new TableClass();
    const persona = new PersonaClass();
    const tasks: TaskClass[] = [];
    const summary = `Team activity ${uuid()}`;
    const otherSummary = `Personal activity ${uuid()}`;
    let layoutId: string | undefined;
    try {
      for (const user of users) await user.create(apiContext);
      await team.create(apiContext);
      await team.addUser(apiContext, member.responseData.id);
      await team.addUser(apiContext, teammate.responseData.id);
      await persona.create(
        apiContext,
        users.map((user) => user.responseData.id)
      );
      const document = await okJson<{ id: string }>(
        await apiContext.post('/api/v1/docStore', {
          data: {
            name: persona.responseData.name,
            fullyQualifiedName: `persona.${
              persona.responseData.fullyQualifiedName ??
              persona.responseData.name
            }`,
            entityType: 'Page',
            data: {
              pages: [
                {
                  pageType: 'LandingPage',
                  layout: [
                    {
                      i: 'KnowledgePanel.ActivityFeed',
                      x: 0,
                      y: 0,
                      w: 1,
                      h: 3,
                    },
                    { i: 'KnowledgePanel.MyTask', x: 1, y: 0, w: 1, h: 3 },
                  ],
                },
              ],
            },
          },
        }),
        'Create isolated activity layout'
      );
      layoutId = document.id;
      for (const user of users) {
        await user.patch({
          apiContext,
          patchData: [
            {
              op: 'add',
              path: '/defaultPersona',
              value: {
                id: persona.responseData.id,
                type: 'persona',
                name: persona.responseData.name,
              },
            },
          ],
        });
      }
      await table.create(apiContext);
      await table.setOwner(apiContext, {
        id: team.responseData.id!,
        type: 'team',
      });
      await otherTable.create(apiContext);
      await otherTable.setOwner(apiContext, {
        id: outsider.responseData.id,
        type: 'user',
      });
      // Delivery from actual UI mutations is covered by ActivityStream.spec.ts.
      // These known events isolate feed filtering/rendering from asynchronous ingestion.
      await insertActivityEventForTest(apiContext, table, summary);
      await insertActivityEventForTest(apiContext, otherTable, otherSummary);
      await use({
        apiContext,
        member,
        teammate,
        outsider,
        team,
        table,
        otherTable,
        summary,
        otherSummary,
        tasks,
      });
    } finally {
      try {
        const cleanup: PromiseSettledResult<unknown>[] =
          await Promise.allSettled(
            tasks.map((task) => task.delete(apiContext))
          );
        cleanup.push(
          ...(await Promise.allSettled(
            [table, otherTable]
              .filter((entity) => entity.entityResponseData.id)
              .map((entity) => entity.delete(apiContext))
          ))
        );
        cleanup.push(
          ...(await Promise.allSettled(
            users
              .filter((user) => user.responseData.id)
              .map((user) => user.delete(apiContext))
          ))
        );
        cleanup.push(
          ...(await Promise.allSettled([
            ...(team.responseData.id ? [team.delete(apiContext)] : []),
            ...(layoutId
              ? [
                  deleteFixtureEntity(
                    apiContext,
                    `/api/v1/docStore/${layoutId}`
                  ),
                ]
              : []),
          ]))
        );
        if (persona.responseData.id)
          cleanup.push(
            ...(await Promise.allSettled([persona.delete(apiContext)]))
          );
        assertFulfilled(cleanup);
      } finally {
        await afterAction();
      }
    }
  },
});

export const createActivityTask = async (
  data: TaskActivityData,
  assignee = data.team.responseData.name,
  table = data.table
) => {
  const task = new TaskClass({
    about: `<#E::table::${table.entityResponseData.fullyQualifiedName}>`,
    assignees: [assignee],
    payload: {
      field: 'description',
      currentValue: table.entityResponseData.description ?? '',
      suggestedValue: `Team-approved description ${uuid()}`,
    },
  });
  data.tasks.push(task);
  await task.create(data.apiContext);
  expect(task.responseData?.status).toBe('Open');
  return task;
};

export const selectActivityFilter = async (
  page: Page,
  label: 'My Data' | 'Following' | 'All Activity'
) => {
  const widget = await waitForLandingPageWidget(
    page,
    'KnowledgePanel.ActivityFeed'
  );
  const endpoint = {
    'My Data': '/my-feed',
    Following: '/following',
    'All Activity': '',
  }[label];
  await selectActivityFeedFilterAndVerifyEndpoint(
    page,
    widget,
    label,
    `/api/v1/activity${endpoint}`
  );
  return widget;
};

export const openAssignedTasks = async (page: Page) => {
  const widget = await waitForLandingPageWidget(page, 'KnowledgePanel.MyTask');
  const response = await selectWidgetSortOption(
    page,
    widget,
    'Assigned',
    (result) =>
      result.request().method() === 'GET' &&
      new URL(result.url()).pathname === '/api/v1/tasks/assigned'
  );
  expect(response.status()).toBe(200);
  return widget;
};

export { expect } from './base';
