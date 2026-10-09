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
import { APIRequestContext, Locator, Page, Response } from '@playwright/test';
import { DOMAIN_TAGS } from '../../../constant/config';
import { TableClass } from '../../../support/entity/TableClass';
import {
  expect,
  test as isolatedTest,
} from '../../../support/fixtures/isolatedUser';
import { insertActivityEventForTest } from '../../../utils/activityAPI';
import { okJson, settleAll } from '../../../utils/apiResponse';
import { getWorkerAdminAPIContext, uuid } from '../../../utils/common';
import {
  getEncodedFqn,
  waitForAllLoadersToDisappear,
} from '../../../utils/entity';
import {
  AI_SHELL_TIMEOUT,
  createInboxTask,
  deleteInboxTasks,
  InboxTask,
  inSequence,
  pickMenuItem,
} from '../../../utils/inbox';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';
import { enableAiAppMode } from '../../Utils/appMode';

/**
 * An entity page's Activity Feeds & Tasks tab in AI mode: the Inbox's Activity
 * and Tasks scoped to one table. A second table carries the same kinds of
 * activity, so every list is checked for what it leaves out as well.
 */

type FeedSeed = {
  table: TableClass;
  tasks: { table: InboxTask; column: InboxTask; other: InboxTask };
  messages: {
    event: string;
    otherEvent: string;
    conversation: string;
    columnConversation: string;
    otherConversation: string;
  };
};

type FeedView = 'all' | 'tasks';

const getTableLink = (table: TableClass) =>
  `<#E::table::${table.entityResponseData.fullyQualifiedName}>`;

const startConversation = async (
  apiContext: APIRequestContext,
  about: string,
  message: string
) =>
  okJson(
    await apiContext.post('/api/v1/conversations', {
      data: { message, about },
    }),
    `Start conversation on ${about}`
  );

// An activity's replies are its conversation; one naming the viewer is what
// puts the activity on the viewer's Mentions.
const mentionViewerOnActivity = async (
  apiContext: APIRequestContext,
  activityId: string,
  viewerName: string
) =>
  okJson(
    await apiContext.post(`/api/v1/activity/${activityId}/replies`, {
      data: { message: `<#E::user::${viewerName}> please take a look` },
    }),
    `Mention the viewer on activity ${activityId}`
  );

const feedRoot = (page: Page) => page.getByTestId('activity-feed');

const feedItem = (page: Page, text: string) =>
  feedRoot(page).getByTestId('activity-feed-item').filter({ hasText: text });

const viewTab = (page: Page, label: 'Activity' | 'Tasks') =>
  feedRoot(page).getByRole('tab', { name: new RegExp(`^${label}`) });

// The page's own "Activity Feeds & Tasks" tab label and its count.
const pageTabCount = (page: Page) =>
  page.getByTestId('activity_feed').getByTestId('filter-count');

// A view tab reads "Activity 3"; with no badge, its count is 0.
const readTabCount = async (tab: Locator) =>
  Number((await tab.textContent())?.match(/\d+/)?.[0] ?? 0);

const isEntityTaskFetch = (
  page: Page,
  predicate: (p: URLSearchParams) => boolean
) =>
  waitForResponseWithStatus(
    page,
    (r: Response) => {
      const url = new URL(r.url());

      return (
        r.request().method() === 'GET' &&
        url.pathname === '/api/v1/tasks' &&
        url.searchParams.get('limit') !== '1' &&
        predicate(url.searchParams)
      );
    },
    200
  );

/**
 * Open an entity's tab in AI mode, straight on a view. The view and the task
 * Status are the URL's, so a deep link lands where it names.
 */
const visitEntityFeed = async (
  page: Page,
  path: string,
  view: FeedView = 'all',
  search = ''
) => {
  await enableAiAppMode(page);
  await page.goto(`${path}/activity_feed/${view}${search}`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(feedRoot(page)).toBeVisible({ timeout: AI_SHELL_TIMEOUT });
  await waitForAllLoadersToDisappear(page);
};

const tablePath = (table: TableClass) =>
  `/table/${getEncodedFqn(table.entityResponseData.fullyQualifiedName ?? '')}`;

// The page's count is the feed's: its Activity cards plus the tasks of the
// chosen Status, read from the same queries as the view tabs.
const expectPageCountToMatchFeed = async (page: Page) => {
  await expect
    .poll(async () => {
      const [activity, tasks, total] = await Promise.all([
        readTabCount(viewTab(page, 'Activity')),
        readTabCount(viewTab(page, 'Tasks')),
        readTabCount(pageTabCount(page)),
      ]);

      return total === activity + tasks;
    })
    .toBe(true);
};

const test = isolatedTest.extend<object, { feed: FeedSeed }>({
  feed: [
    async ({ isolatedUserSession }, use) => {
      const apiContext = await getWorkerAdminAPIContext();
      const viewer = isolatedUserSession.user.responseData;
      const id = uuid();
      const messages = {
        event: `Entity feed event ${id}`,
        otherEvent: `Other entity feed event ${id}`,
        conversation: `Entity feed conversation ${id}`,
        columnConversation: `Entity feed column conversation ${id}`,
        otherConversation: `Other entity feed conversation ${id}`,
      };
      const table = new TableClass();
      const otherTable = new TableClass();
      const created: InboxTask[] = [];

      try {
        await settleAll([
          table.create(apiContext),
          otherTable.create(apiContext),
        ]);
        const column = table.entityResponseData.columns?.[0]?.name;
        expect(column, 'The seeded table has a column').toBeTruthy();
        const columnLink = `<#E::table::${table.entityResponseData.fullyQualifiedName}::columns::${column}>`;

        await settleAll([
          startConversation(
            apiContext,
            getTableLink(table),
            messages.conversation
          ),
          startConversation(
            apiContext,
            columnLink,
            messages.columnConversation
          ),
          startConversation(
            apiContext,
            getTableLink(otherTable),
            messages.otherConversation
          ),
        ]);

        const [eventId, otherEventId] = await Promise.all([
          insertActivityEventForTest(apiContext, table, messages.event),
          insertActivityEventForTest(
            apiContext,
            otherTable,
            messages.otherEvent
          ),
        ]);
        await settleAll([
          mentionViewerOnActivity(apiContext, eventId, viewer.name),
          mentionViewerOnActivity(apiContext, otherEventId, viewer.name),
        ]);

        const fileTask = (name: string, about: string) => () =>
          createInboxTask(apiContext, {
            name: `pw-entity-feed-${name}-${id}`,
            category: 'MetadataUpdate',
            type: 'DescriptionUpdate',
            about,
            assignee: viewer.name,
            payload: {
              fieldPath: 'description',
              newDescription: `Described ${id}`,
            },
          });
        const [tableTask, columnTask, otherTask] = await inSequence([
          fileTask('table', getTableLink(table)),
          fileTask('column', columnLink),
          fileTask('other', getTableLink(otherTable)),
        ]);
        created.push(tableTask, columnTask, otherTask);

        await use({
          table,
          tasks: { table: tableTask, column: columnTask, other: otherTask },
          messages,
        });
      } finally {
        // The tables go even if a task delete fails.
        try {
          await deleteInboxTasks(apiContext, created);
        } finally {
          await settleAll(
            [table, otherTable]
              .filter((entity) => entity.entityResponseData?.id)
              .map((entity) => entity.delete(apiContext))
          );
        }
      }
    },
    { scope: 'worker', timeout: 300_000 },
  ],
});

test.use({ isolatedUserOptions: { isAdmin: true } });

test.describe(
  'Entity page — Activity Feeds & Tasks in AI mode',
  { tag: ['@Features', DOMAIN_TAGS.DISCOVERY] },
  () => {
    // The seed files tasks; one worker keeps the workflow engine's load low.
    test.describe.configure({ mode: 'default' });

    test("lists the table's activity and its columns' conversations, and no other table's", async ({
      isolatedUserPage: page,
      feed,
    }) => {
      await visitEntityFeed(page, tablePath(feed.table));

      await expect(viewTab(page, 'Activity')).toHaveAttribute(
        'aria-selected',
        'true'
      );
      await expect(feedItem(page, feed.messages.event)).toBeVisible();
      await expect(feedItem(page, feed.messages.conversation)).toBeVisible();
      await expect(
        feedItem(page, feed.messages.columnConversation)
      ).toBeVisible();
      await expect(feedItem(page, feed.messages.otherEvent)).toHaveCount(0);
      await expect(feedItem(page, feed.messages.otherConversation)).toHaveCount(
        0
      );
    });

    test('Mentions lists only the mentions about the table', async ({
      isolatedUserPage: page,
      feed,
    }) => {
      // The Show menu counts Mentions on load, so the scoped fetch is made
      // before the menu is opened.
      const mentions = waitForResponseWithStatus(
        page,
        (r) => {
          const url = new URL(r.url());

          return (
            url.pathname === '/api/v1/activity/mentions' &&
            url.searchParams.get('entityLink') === getTableLink(feed.table)
          );
        },
        200
      );
      await visitEntityFeed(page, tablePath(feed.table));
      await mentions;

      await pickMenuItem(
        page,
        page.getByTestId('activity-show-filter'),
        /^Mentions/
      );

      await expect(feedItem(page, feed.messages.event)).toBeVisible();
      await expect(feedItem(page, feed.messages.conversation)).toHaveCount(0);
      await expect(feedItem(page, feed.messages.otherEvent)).toHaveCount(0);
    });

    test("a Tasks link opens the table's tasks, its columns' included", async ({
      isolatedUserPage: page,
      feed,
    }) => {
      await visitEntityFeed(page, tablePath(feed.table), 'tasks');

      await expect(viewTab(page, 'Tasks')).toHaveAttribute(
        'aria-selected',
        'true'
      );
      await expect(
        page.getByTestId(`inbox-task-${feed.tasks.table.id}`)
      ).toBeVisible();
      await expect(
        page.getByTestId(`inbox-task-${feed.tasks.column.id}`)
      ).toBeVisible();
      await expect(
        page.getByTestId(`inbox-task-${feed.tasks.other.id}`)
      ).toHaveCount(0);

      await test.step('Switching to Activity updates the URL', async () => {
        await viewTab(page, 'Activity').click();
        await expect(page).toHaveURL(/\/activity_feed\/all$/);
        await expect(feedItem(page, feed.messages.event)).toBeVisible();
      });
    });

    test("searches within the table's tasks", async ({
      isolatedUserPage: page,
      feed,
    }) => {
      await visitEntityFeed(page, tablePath(feed.table), 'tasks');
      await expect(
        page.getByTestId(`inbox-task-${feed.tasks.column.id}`)
      ).toBeVisible();

      const searched = isEntityTaskFetch(
        page,
        (params) =>
          params.get('q') === feed.tasks.table.name &&
          params.get('aboutEntity') !== null
      );
      await page
        .getByTestId('activity-feed-task-search')
        .fill(feed.tasks.table.name);
      await searched;

      await expect(
        page.getByTestId(`inbox-task-${feed.tasks.table.id}`)
      ).toBeVisible();
      await expect(
        page.getByTestId(`inbox-task-${feed.tasks.column.id}`)
      ).toHaveCount(0);
    });

    test("keeps the task Status in the URL, and the page's count follows it", async ({
      isolatedUserPage: page,
      feed,
    }) => {
      await visitEntityFeed(page, tablePath(feed.table), 'tasks');
      const status = page.getByTestId('activity-feed-task-status');

      await test.step('Open, the default, counts both open tasks', async () => {
        await expect(viewTab(page, 'Tasks')).toHaveText(/2$/);
        await expectPageCountToMatchFeed(page);
      });

      await test.step('Closed is written to the URL and drops the tasks from the count', async () => {
        const closedFetch = isEntityTaskFetch(
          page,
          (params) => params.get('statusGroup') === 'closed'
        );
        await pickMenuItem(page, status, /^Closed/);
        await closedFetch;

        await expect(page).toHaveURL(/[?&]taskStatus=closed/);
        await expect(viewTab(page, 'Tasks')).toHaveText(/^Tasks$/);
        await expectPageCountToMatchFeed(page);
      });

      await test.step('The Status survives a reload and a switch to Activity', async () => {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(status).toContainText('Closed', {
          timeout: AI_SHELL_TIMEOUT,
        });

        await viewTab(page, 'Activity').click();
        await expect(page).toHaveURL(/\/activity_feed\/all\?taskStatus=closed/);
        await expectPageCountToMatchFeed(page);
      });
    });

    test('another entity page shows the same tab', async ({
      isolatedUserPage: page,
      feed,
    }) => {
      const schemaFqn = feed.table.schemaResponseData.fullyQualifiedName ?? '';
      await visitEntityFeed(
        page,
        `/databaseSchema/${getEncodedFqn(schemaFqn)}`
      );

      await expect(viewTab(page, 'Activity')).toBeVisible();
      await expect(viewTab(page, 'Tasks')).toBeVisible();
    });

    test('outside AI mode the table keeps the classic tab', async ({
      isolatedUserPage: page,
      feed,
    }) => {
      await page.goto(`${tablePath(feed.table)}/activity_feed/all`, {
        waitUntil: 'domcontentloaded',
      });

      await expect(page.getByTestId('global-setting-left-panel')).toBeVisible({
        timeout: AI_SHELL_TIMEOUT,
      });
      await expect(feedRoot(page)).toHaveCount(0);
    });
  }
);
