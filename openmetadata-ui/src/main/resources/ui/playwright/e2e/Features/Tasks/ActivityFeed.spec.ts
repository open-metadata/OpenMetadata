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
import { EntityTypeEndpoint } from '../../../support/entity/Entity.interface';
import { TableClass } from '../../../support/entity/TableClass';
import { expect, test as countTest } from '../../../support/fixtures/base';
import {
  createActivityTask,
  openAssignedTasks,
  selectActivityFilter,
  test,
} from '../../../support/fixtures/taskActivity';
import { UserClass } from '../../../support/user/UserClass';
import {
  ACTIVITY_TEST_TIMEOUT,
  createConversationThread,
  getTableFqn,
  insertActivityEventForTest,
  visitTableActivityFeed,
  waitForActivityEvent,
} from '../../../utils/activityAPI';
import { okJson } from '../../../utils/apiResponse';
import {
  getDefaultAdminAPIContext,
  redirectToHomePage,
  uuid,
} from '../../../utils/common';
import { followEntity } from '../../../utils/entity';
import { waitForPageLoaded } from '../../../utils/polling';
import { getTaskCard } from '../../../utils/task';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';

const openEntityTasks = async (
  page: import('@playwright/test').Page,
  table: TableClass
) => {
  await table.visitEntityPage(page);
  await page.getByTestId('activity_feed').click();
  await page.getByRole('menuitem', { name: /^Tasks/ }).click();
};

test.describe('Home activity and task widgets', () => {
  test('activity widget renders an owned entity event', async ({
    page,
    activityData: data,
  }) => {
    await data.member.login(page);
    const widget = await selectActivityFilter(page, 'My Data');
    await expect(
      widget.getByTestId('message-container').filter({ hasText: data.summary })
    ).toBeVisible();
  });

  test('task widget renders the assigned task with its identifier', async ({
    page,
    activityData: data,
  }) => {
    const task = await createActivityTask(data, data.member.responseData.name);
    await data.member.login(page);
    const widget = await openAssignedTasks(page);
    await expect(
      getTaskCard(page, task.responseData!.taskId, widget)
    ).toBeVisible();
    await expect(widget.getByTestId('message-container')).toHaveCount(0);
  });

  test('task widget link opens the correct entity and task', async ({
    page,
    activityData: data,
  }) => {
    const task = await createActivityTask(data, data.member.responseData.name);
    await data.member.login(page);
    const widget = await openAssignedTasks(page);
    await getTaskCard(page, task.responseData!.taskId, widget)
      .getByTestId('redirect-task-button-link')
      .click();
    await expect
      .poll(() => new URL(page.url()).pathname)
      .toBe(
        `/table/${encodeURIComponent(
          getTableFqn(data.table)
        )}/activity_feed/tasks`
      );
    await expect(page.getByTestId('entity-header-name')).toHaveText(
      data.table.entityResponseData.name
    );
    await expect(getTaskCard(page, task.responseData!.taskId)).toBeVisible();
  });
});

test.describe('Activity filters', () => {
  test('All Activity displays the first page of global activity', async ({
    page,
    activityData: data,
  }) => {
    await data.member.login(page);
    await selectActivityFilter(page, 'My Data');
    const response = waitForResponseWithStatus(
      page,
      (result) =>
        result.request().method() === 'GET' &&
        new URL(result.url()).pathname === '/api/v1/activity',
      200
    );
    const widget = await selectActivityFilter(page, 'All Activity');
    const body = await okJson<{ data: unknown[] }>(
      await response,
      'Read global activity'
    );
    expect(body.data.length).toBeGreaterThan(0);
    await expect(widget.getByTestId('message-container')).toHaveCount(
      Math.min(15, body.data.length)
    );
  });

  test('My Data shows owned activity and excludes unowned activity', async ({
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

  test('the task widget keeps task cards separate from activity events', async ({
    page,
    activityData: data,
  }) => {
    const task = await createActivityTask(data, data.member.responseData.name);
    await data.member.login(page);
    const activity = await selectActivityFilter(page, 'My Data');
    await expect(
      activity
        .getByTestId('message-container')
        .filter({ hasText: data.summary })
    ).toBeVisible();
    await expect(activity.getByTestId('task-feed-card')).toHaveCount(0);
    const tasks = await openAssignedTasks(page);
    await expect(
      getTaskCard(page, task.responseData!.taskId, tasks)
    ).toBeVisible();
    await expect(tasks.getByTestId('message-container')).toHaveCount(0);
  });

  test('switching Following and My Data replaces the displayed events', async ({
    page,
    activityData: data,
  }) => {
    await data.member.login(page);
    await data.otherTable.visitEntityPage(page);
    await followEntity(page, EntityTypeEndpoint.Table);
    await redirectToHomePage(page, false);
    const widget = await selectActivityFilter(page, 'Following');
    await expect(
      widget
        .getByTestId('message-container')
        .filter({ hasText: data.otherSummary })
    ).toBeVisible();
    await expect(
      widget.getByTestId('message-container').filter({ hasText: data.summary })
    ).toHaveCount(0);
    await selectActivityFilter(page, 'My Data');
    await expect(
      widget.getByTestId('message-container').filter({ hasText: data.summary })
    ).toBeVisible();
    await expect(
      widget
        .getByTestId('message-container')
        .filter({ hasText: data.otherSummary })
    ).toHaveCount(0);
  });

  test('assignee sees their task while a non-assignee does not', async ({
    browser,
    page,
    activityData: data,
  }) => {
    const task = await createActivityTask(data, data.member.responseData.name);
    await data.member.login(page);
    const widget = await openAssignedTasks(page);
    await expect(
      getTaskCard(page, task.responseData!.taskId, widget)
    ).toBeVisible();
    const outsiderPage = await browser.newPage();
    try {
      await data.outsider.login(outsiderPage);
      const other = await openAssignedTasks(outsiderPage);
      await expect(other.getByTestId('my-task-empty-state')).toBeVisible();
      await expect(
        getTaskCard(outsiderPage, task.responseData!.taskId, other)
      ).toHaveCount(0);
    } finally {
      await outsiderPage.close();
    }
  });
});

test.describe('Entity activity and tasks', () => {
  test('entity page exposes its activity tab', async ({
    page,
    activityData: data,
  }) => {
    await data.member.login(page);
    await data.table.visitEntityPage(page);
    await expect(
      page.getByRole('tab', { name: /Activity Feeds & Tasks/ })
    ).toBeVisible();
  });

  test('activity and task panels display their own known items', async ({
    page,
    activityData: data,
  }) => {
    const task = await createActivityTask(data);
    await data.member.login(page);
    await visitTableActivityFeed(page, data.table);
    await expect(
      page
        .locator('#feedData')
        .getByTestId('message-container')
        .filter({ hasText: data.summary })
    ).toBeVisible();
    await page.getByRole('menuitem', { name: /^Tasks/ }).click();
    await expect(getTaskCard(page, task.responseData!.taskId)).toBeVisible();
  });

  test('open and closed filters show tasks with the corresponding status', async ({
    page,
    activityData: data,
  }) => {
    const open = await createActivityTask(data);
    const closed = await createActivityTask(data);
    expect((await closed.resolve(data.apiContext, 'Rejected')).status).toBe(
      'Rejected'
    );
    await data.member.login(page);
    await openEntityTasks(page, data.table);
    const filter = page.getByTestId('user-profile-page-task-filter-icon');
    await filter.click();
    await page.getByTestId('closed-tasks').click();
    await expect(getTaskCard(page, closed.responseData!.taskId)).toBeVisible();
    await expect(getTaskCard(page, open.responseData!.taskId)).toHaveCount(0);
    await filter.click();
    await page.getByTestId('open-tasks').click();
    await expect(getTaskCard(page, open.responseData!.taskId)).toBeVisible();
    await expect(getTaskCard(page, closed.responseData!.taskId)).toHaveCount(0);
  });

  test('mentions filters conversations containing the signed-in user', async ({
    page,
    activityData: data,
  }) => {
    const mention = `Mention ${uuid()} <#E::user::${
      data.member.responseData.fullyQualifiedName
    }>`;
    await createConversationThread(data.apiContext, data.table, mention);
    await data.member.login(page);
    await openEntityTasks(page, data.table);
    const response = waitForResponseWithStatus(
      page,
      (result) => {
        const url = new URL(result.url());
        return (
          result.request().method() === 'GET' &&
          url.pathname === '/api/v1/conversations' &&
          url.searchParams.get('filterType') === 'MENTIONS'
        );
      },
      200
    );
    await page.getByTestId('mentions-toggle').click();
    const body = await okJson<{ data: { message: string }[] }>(
      await response,
      'Read mentions'
    );
    expect(body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ message: mention })])
    );
    await expect(
      page
        .locator('#feedData')
        .getByTestId('message-container')
        .filter({ hasText: mention.split(' <')[0] })
    ).toBeVisible();
  });

  test('entity feed renders the description in a stored activity event', async ({
    page,
    activityData: data,
  }) => {
    await data.member.login(page);
    await visitTableActivityFeed(page, data.table);
    await expect(
      page
        .locator('#feedData')
        .getByTestId('message-container')
        .filter({ hasText: data.summary })
    ).toBeVisible();
  });
});

test.describe('Feed refresh', () => {
  test('a newly created task appears after refreshing the task list', async ({
    page,
    activityData: data,
  }) => {
    await data.member.login(page);
    await openEntityTasks(page, data.table);
    await expect(page.getByTestId('task-feed-card')).toHaveCount(0);
    const task = await createActivityTask(data);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(getTaskCard(page, task.responseData!.taskId)).toBeVisible();
  });

  test('updating an entity produces the matching description activity', async ({
    page,
    activityData: data,
  }) => {
    test.setTimeout(ACTIVITY_TEST_TIMEOUT);
    const description = `Updated description ${uuid()}`;
    await okJson(
      await data.apiContext.patch(
        `/api/v1/tables/${data.table.entityResponseData.id}`,
        {
          data: [{ op: 'add', path: '/description', value: description }],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }
      ),
      'Update description'
    );
    await waitForActivityEvent({
      entityFqn: getTableFqn(data.table),
      eventType: 'DescriptionUpdated',
      text: description,
    });
    await data.member.login(page);
    await visitTableActivityFeed(page, data.table);
    await expect(
      page
        .locator('#feedData')
        .getByTestId('message-container')
        .filter({ hasText: description })
    ).toBeVisible();
  });
});

test('following an entity makes its activity available in Following', async ({
  page,
  activityData: data,
}) => {
  await data.member.login(page);
  await data.otherTable.visitEntityPage(page);
  await followEntity(page, EntityTypeEndpoint.Table);
  await redirectToHomePage(page, false);
  const widget = await selectActivityFilter(page, 'Following');
  await expect(
    widget
      .getByTestId('message-container')
      .filter({ hasText: data.otherSummary })
  ).toBeVisible();
});

// Counts are asserted exactly, so this describe owns its entity and never
// mutates it. The sibling 'Activity Feed - Entity Page' describe adds a third
// task in one of its tests, and chromium runs fullyParallel, so sharing that
// fixture would make an exact count order-dependent.
countTest.describe('Activity Feed - Entity Page counts', () => {
  const adminUser = new UserClass();
  const table = new TableClass();
  const seededActivitySummary = `Entity count seeded event ${uuid()}`;
  const SEEDED_TASK_COUNT = 2;

  countTest.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await table.create(apiContext);

      await insertActivityEventForTest(
        apiContext,
        table,
        seededActivitySummary
      );

      for (const type of ['DescriptionUpdate', 'TagUpdate']) {
        const taskResponse = await apiContext.post('/api/v1/tasks', {
          data: {
            name: `Count Task - ${type}-${uuid()}`,
            about: `<#E::table::${table.entityResponseData?.fullyQualifiedName}>`,
            type,
            category: 'MetadataUpdate',
            assignees: [adminUser.responseData.name],
          },
        });

        expect(taskResponse.ok()).toBe(true);
      }
    } finally {
      await afterAction();
    }
  });

  countTest.afterAll('Cleanup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );

    try {
      await table.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  countTest.beforeEach(async ({ page }) => {
    await adminUser.login(page);
  });

  countTest(
    'entity tab badge totals conversations, activity and tasks',
    async ({ page }) => {
      await table.visitEntityPage(page);

      const countBadge = page
        .getByRole('tab', { name: /activity feeds & tasks/i })
        .getByTestId('count');

      await expect(countBadge).toBeVisible();

      // feedCount.totalCount = conversations (0) + activity (>= 1 seeded) +
      // tasks (2). Anything below 3 means a category was dropped from the sum;
      // the previous `>= 0` assertion held even with activity left out entirely.
      // Poll instead of reading once — the counts are fetched after first paint,
      // so a single read races the request and sees the initial 0.
      await expect
        .poll(async () => Number((await countBadge.innerText()).trim()), {
          timeout: 30_000,
        })
        .toBeGreaterThanOrEqual(SEEDED_TASK_COUNT + 1);
    }
  );

  countTest(
    'All and Tasks panels each show their own seeded items',
    async ({ page }) => {
      await table.visitEntityPage(page);
      await page.getByTestId('activity_feed').click();
      await waitForPageLoaded(page);

      const leftPanel = page.getByTestId('global-setting-left-panel');

      await leftPanel.getByText('Tasks').click();
      await waitForPageLoaded(page);

      await expect(
        page.getByTestId('left-panel-task-count').getByTestId('filter-count')
      ).toHaveText(String(SEEDED_TASK_COUNT), { timeout: 30_000 });
      await expect(page.locator('[data-testid="task-feed-card"]')).toHaveCount(
        SEEDED_TASK_COUNT
      );

      // All lists the change-events, including the one seeded for this entity.
      await leftPanel.getByText('All', { exact: true }).click();
      await waitForPageLoaded(page);

      const feedItems = page.locator(
        '#feedData [data-testid="message-container"]'
      );

      await expect(
        feedItems.filter({ hasText: seededActivitySummary })
      ).toBeVisible({ timeout: 30_000 });

      // Deliberately not asserting badge === rendered here. The badge is a
      // server count and the list a separate query, and this fixture also
      // creates tasks, whose own change-events are indexed a moment later — the
      // two reads legitimately disagree by one while that settles. That
      // invariant has its own test in ActivityFeed.spec.ts ('All badge, header
      // and rendered list agree on the count') on a fixture with no tasks.
      await expect(
        page.getByTestId('left-panel-all-count').getByTestId('filter-count')
      ).toHaveText(/^[1-9]\d*$/, { timeout: 30_000 });
    }
  );
});
