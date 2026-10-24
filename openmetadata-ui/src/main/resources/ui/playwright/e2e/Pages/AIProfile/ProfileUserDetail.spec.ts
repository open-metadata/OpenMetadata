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
import { TableClass } from '../../../support/entity/TableClass';
import {
  expect,
  test as isolatedTest,
} from '../../../support/fixtures/isolatedUser';
import { UserClass } from '../../../support/user/UserClass';
import { insertActivityEventForTest } from '../../../utils/activityAPI';
import { openAiProfile, waitForUserPatch } from '../../../utils/aiProfile';
import { okJson } from '../../../utils/apiResponse';
import { getWorkerAdminAPIContext, uuid } from '../../../utils/common';
import { removeCustomPropertyViaApi } from '../../../utils/customProperty';
import {
  composerEditor,
  createInboxTask,
  deleteInboxTasks,
  InboxTask,
  isFollowedAssetsSearch,
  switchActivityFeed,
  visitMyData,
  waitForTaskTransitions,
} from '../../../utils/inbox';
import { waitForSearchIndexed } from '../../../utils/polling';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';
import { enableAiAppMode } from '../../Utils/appMode';

/**
 * Settings › Members › Users › <user>: an admin works on another user's data
 * through the user-detail tabs. Every test seeds its own user (and the tables
 * and tasks it needs) because the flows change them — a rename, a role, a
 * resolved task, a deleted account — so repeated runs never share state.
 * The tabs' rendering rules live in the component unit tests.
 */

type UserDetailTab =
  | 'overview'
  | 'access'
  | 'activity'
  | 'tasks'
  | 'owned-assets'
  | 'following'
  | 'custom-properties';

type Seeded = {
  apiContext: APIRequestContext;
  subject: UserClass;
  tables: TableClass[];
  tasks: InboxTask[];
};

const test = isolatedTest.extend<{ seeded: Seeded }>({
  // eslint-disable-next-line no-empty-pattern -- Seeded through the worker's admin API context, not a browser.
  seeded: async ({}, use) => {
    const apiContext = await getWorkerAdminAPIContext();
    const subject = new UserClass();
    await subject.create(apiContext);
    const seeded: Seeded = { apiContext, subject, tables: [], tasks: [] };

    try {
      await use(seeded);
    } finally {
      await deleteInboxTasks(apiContext, seeded.tasks);
      for (const table of seeded.tables) {
        await table.delete(apiContext);
      }
      await subject.delete(apiContext);
    }
  },
});

test.use({ isolatedUserOptions: { isAdmin: true } });

const tableLink = (table: TableClass) =>
  `<#E::table::${table.entityResponseData.fullyQualifiedName}>`;

// Cards, the summary panel and feed items show an asset's display name.
const shownName = (table: TableClass) =>
  table.entityResponseData.displayName ?? table.entityResponseData.name;

const createTable = async (seeded: Seeded) => {
  const table = new TableClass();
  await table.create(seeded.apiContext);
  seeded.tables.push(table);

  return table;
};

const createOwnedTable = async (
  seeded: Seeded,
  ownerId = seeded.subject.responseData.id
) => {
  const table = await createTable(seeded);
  await table.patch({
    apiContext: seeded.apiContext,
    patchData: [
      {
        op: 'add',
        path: '/owners',
        value: [{ id: ownerId, type: 'user' }],
      },
    ],
  });
  await waitForSearchIndexed(
    seeded.apiContext,
    table.entityResponseData.fullyQualifiedName,
    'table'
  );

  return table;
};

const createDescriptionTask = async (seeded: Seeded, table: TableClass) => {
  const name = `pw-user-detail-${uuid()}`;
  const newDescription = `Description approved from the user page ${name}`;
  const task = await createInboxTask(seeded.apiContext, {
    name,
    category: 'MetadataUpdate',
    type: 'DescriptionUpdate',
    about: tableLink(table),
    assignee: seeded.subject.responseData.name,
    payload: { fieldPath: 'description', newDescription },
  });
  seeded.tasks.push(task);
  await waitForTaskTransitions(seeded.apiContext, task.id);

  return { task, newDescription };
};

// Exact path: the app also asks for `<name>@<domain>`, which a prefix match would catch.
const isUserByName = (userName: string) => (response: Response) =>
  response.request().method() === 'GET' &&
  decodeURIComponent(new URL(response.url()).pathname) ===
    `/api/v1/users/name/${userName}`;

/** Deep-link the Members user detail at a tab, as a shared link opens it. */
const openUserDetail = async (
  page: Page,
  userName: string,
  tab: UserDetailTab = 'overview'
) => {
  await enableAiAppMode(page);
  const userFetch = waitForResponseWithStatus(
    page,
    isUserByName(userName),
    200
  );
  const tabPath = tab === 'overview' ? '' : `/${tab}`;
  await page.goto(`/#members/user/${encodeURIComponent(userName)}${tabPath}`);
  await userFetch;

  await expect(page.getByTestId('members-user-detail')).toBeVisible();
};

const readUser = (apiContext: APIRequestContext, userId: string) =>
  apiContext
    .get(`/api/v1/users/${userId}?fields=roles,extension&include=all`)
    .then((response) =>
      okJson<{
        displayName?: string;
        deleted?: boolean;
        roles?: { name: string }[];
        extension?: Record<string, unknown>;
      }>(response, 'Read the user')
    );

/**
 * Add text custom properties to the user entity. They are global, so each test
 * adds its own uniquely named ones and removes them afterwards.
 */
const addUserTextProperties = async (
  apiContext: APIRequestContext,
  count = 1
) => {
  const [fieldTypes, userType] = await Promise.all([
    apiContext
      .get('/api/v1/metadata/types?category=field&limit=100')
      .then((response) =>
        okJson<{ data: { id: string; name: string }[] }>(
          response,
          'Read the property types'
        )
      ),
    apiContext
      .get('/api/v1/metadata/types/name/user')
      .then((response) =>
        okJson<{ id: string }>(response, 'Read the user type')
      ),
  ]);
  const stringType = fieldTypes.data.find(({ name }) => name === 'string');
  const names: string[] = [];
  const remove = async () => {
    for (const name of names) {
      await removeCustomPropertyViaApi(apiContext, 'user', name);
    }
  };

  try {
    // One at a time: each PUT rewrites the type's property list.
    for (let added = 0; added < count; added++) {
      const name = `pwUserProperty${uuid()}`;
      await okJson(
        await apiContext.put(`/api/v1/metadata/types/${userType.id}`, {
          data: {
            name,
            description: `Playwright user property ${name}`,
            propertyType: { id: stringType?.id, type: 'type' },
          },
        }),
        'Add the user property'
      );
      names.push(name);
    }
  } catch (error) {
    await remove();

    throw error;
  }

  return { names, remove };
};

/** Set a text property's value inline in its row. */
const setTextPropertyValue = async (
  page: Page,
  row: Locator,
  propertyName: string,
  userId: string,
  value: string
) => {
  await row.getByTestId(`edit-${propertyName}`).click();
  await row.getByRole('textbox').fill(value);
  const patch = waitForUserPatch(page, userId);
  await row.getByTestId('inline-save-btn').click();
  expect((await patch).ok()).toBeTruthy();
  await expect(row).toContainText(value);
};

const isUserTaskList = (userName: string) => (response: Response) => {
  const url = new URL(response.url());

  return (
    response.request().method() === 'GET' &&
    url.pathname === '/api/v1/tasks' &&
    url.searchParams.get('assignee')?.split(',').includes(userName) === true &&
    url.searchParams.get('limit') !== '1'
  );
};

const openTaskFullPage = async (page: Page, task: InboxTask) => {
  const row = page.getByTestId(`inbox-task-${task.id}`);
  await expect(row).toBeVisible();
  const taskFetch = waitForResponseWithStatus(
    page,
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname === `/api/v1/tasks/${task.id}`,
    200
  );
  await row.click();
  await taskFetch;

  const taskPage = page.getByTestId('task-detail-page');
  await expect(taskPage).toContainText(task.name);

  return taskPage;
};

const backToUserTasks = async (page: Page, userName: string) => {
  const listFetch = waitForResponseWithStatus(
    page,
    isUserTaskList(userName),
    200
  );
  await page
    .getByTestId('profile-content-header')
    .getByRole('link', { name: 'Tasks' })
    .click();
  await listFetch;
};

/**
 * Seed an activity authored by the user. Real activity is written by the async
 * ActivityFeedAlert consumer, which runs minutes behind on a loaded AUT; its
 * delivery is covered by ActivityResourceIT.
 */
const recordActivityAs = async (
  seeded: Seeded,
  table: TableClass,
  description: string
) => {
  const { subject, apiContext } = seeded;
  await insertActivityEventForTest(
    apiContext,
    table,
    description,
    'DescriptionUpdated',
    subject.responseData
  );
  await expect
    .poll(
      async () =>
        JSON.stringify(
          await okJson(
            await apiContext.get(
              `/api/v1/activity/user/${subject.responseData.id}?days=30`
            ),
            'Read the user activity'
          )
        ),
      { timeout: 30_000, intervals: [1_000, 2_000] }
    )
    .toContain(description);
};

const isOwnedAssetsSearch = (ownerId: string) => (response: Response) => {
  const url = new URL(response.url());

  return (
    response.request().method() === 'GET' &&
    url.pathname === '/api/v1/search/query' &&
    url.searchParams.get('size') !== '0' &&
    url.searchParams.get('query_filter')?.includes(ownerId) === true
  );
};

test.describe('AI Profile Members user detail', () => {
  test('grants a role from the Access tab', async ({
    isolatedUserPage: page,
    seeded,
  }) => {
    const { subject } = seeded;
    await openUserDetail(page, subject.responseData.name, 'access');

    await test.step('Pick Data Steward in the roles editor', async () => {
      await page.getByTestId('roles-edit').click();
      const roleSearch = waitForResponseWithStatus(
        page,
        (response) =>
          response.url().includes('/api/v1/roles/search') &&
          new URL(response.url()).searchParams.get('q') === 'DataSteward',
        200
      );
      await page
        .getByTestId('roles-multiselect')
        .getByRole('combobox')
        .fill('DataSteward');
      await roleSearch;
      await page
        .getByRole('option', { name: 'Data Steward', exact: true })
        .click();
    });

    await test.step('Save grants the role', async () => {
      const patch = waitForUserPatch(page, subject.responseData.id);
      await page.getByTestId('roles-save').click();
      await patch;

      await expect(page.getByTestId('roles')).toContainText('Data Steward');
      const user = await readUser(seeded.apiContext, subject.responseData.id);
      expect(user.roles?.map((role) => role.name)).toContain('DataSteward');
    });
  });

  test('shows the activity the user generated', async ({
    isolatedUserPage: page,
    seeded,
  }) => {
    const table = await createTable(seeded);
    const description = `Described by its owner ${uuid()}`;
    await recordActivityAs(seeded, table, description);

    await test.step('The Activity tab lists the user’s event', async () => {
      const activityFetch = waitForResponseWithStatus(
        page,
        (response) =>
          response.request().method() === 'GET' &&
          new URL(response.url()).pathname ===
            `/api/v1/activity/user/${seeded.subject.responseData.id}`,
        200
      );
      await openUserDetail(page, seeded.subject.responseData.name, 'activity');
      await activityFetch;

      const event = page
        .getByTestId('activity-feed-item')
        .filter({ hasText: description });
      await expect(event).toBeVisible();
      await expect(event).toContainText(
        seeded.subject.responseData.displayName ??
          seeded.subject.responseData.name
      );
    });
  });

  test('shows the activity that mentions the user under Mentions', async ({
    isolatedUserPage: page,
    seeded,
  }) => {
    test.slow();
    const subjectId = seeded.subject.responseData.id;
    const table = await createTable(seeded);
    const summary = `Mentioned on the user page ${uuid()}`;

    await test.step('Seed an activity whose reply mentions the user', async () => {
      const activityId = await insertActivityEventForTest(
        seeded.apiContext,
        table,
        summary
      );
      await okJson(
        await seeded.apiContext.post(`/api/v1/activity/${activityId}/replies`, {
          data: {
            message: `<#E::user::${seeded.subject.responseData.name}> please review`,
          },
        }),
        'Reply mentioning the user'
      );
      await expect
        .poll(
          async () =>
            JSON.stringify(
              await okJson(
                await seeded.apiContext.get(
                  `/api/v1/activity/mentions?userId=${subjectId}&days=30`
                ),
                'Read the user’s mentions'
              )
            ),
          { timeout: 60_000, intervals: [1_000, 2_000, 5_000] }
        )
        .toContain(activityId);
    });

    await test.step('Mentions reads the subject’s mentions feed', async () => {
      // The Activity tab prefetches every feed on load, so listen before opening it.
      const mentionsFetch = waitForResponseWithStatus(
        page,
        (response) => {
          const url = new URL(response.url());

          return (
            response.request().method() === 'GET' &&
            url.pathname === '/api/v1/activity/mentions' &&
            url.searchParams.get('userId') === subjectId
          );
        },
        200
      );
      await openUserDetail(page, seeded.subject.responseData.name, 'activity');
      await switchActivityFeed(page, 'Mentions');
      await mentionsFetch;

      await expect(
        page.getByTestId('activity-feed-item').filter({ hasText: summary })
      ).toBeVisible();
    });
  });

  test('comments on the user’s task from its full page', async ({
    isolatedUserPage: page,
    seeded,
  }) => {
    test.slow();
    const userName = seeded.subject.responseData.name;
    const table = await createTable(seeded);
    const { task } = await createDescriptionTask(seeded, table);
    const comment = `Reviewed from the user page ${uuid()}`;

    await openUserDetail(page, userName, 'tasks');
    const taskPage = await openTaskFullPage(page, task);

    await test.step('Post a comment from the composer', async () => {
      const editor = composerEditor(taskPage);
      await editor.click();
      await editor.fill(comment);
      const posted = waitForResponseWithStatus(
        page,
        (response) =>
          response.url().includes(`/api/v1/tasks/${task.id}/comments`) &&
          response.request().method() === 'POST',
        200
      );
      await editor.press('Enter');
      await posted;
      await expect(
        taskPage.getByTestId('task-comment-card').filter({ hasText: comment })
      ).toBeVisible();
    });

    await test.step('The comment is saved on the task', async () => {
      const saved = await okJson<{ comments?: { message: string }[] }>(
        await seeded.apiContext.get(`/api/v1/tasks/${task.id}?fields=comments`),
        'Read the task comments'
      );
      // The editor stores its spaces as &nbsp;, so compare the words.
      const savedText = (saved.comments ?? [])
        .map(({ message }) => message.replace(/\s+/g, ' '))
        .join('\n');
      expect(savedText).toContain(comment);
    });

    await test.step('Back returns to the user’s tasks', async () => {
      await backToUserTasks(page, userName);
      await expect(page.getByTestId(`inbox-task-${task.id}`)).toBeVisible();
    });
  });

  test('approves the user’s task and finds it under Closed', async ({
    isolatedUserPage: page,
    seeded,
  }) => {
    test.slow();
    const userName = seeded.subject.responseData.name;
    const table = await createTable(seeded);
    const { task, newDescription } = await createDescriptionTask(seeded, table);

    await openUserDetail(page, userName, 'tasks');
    const taskPage = await openTaskFullPage(page, task);

    await test.step('Approve the task', async () => {
      const resolved = waitForResponseWithStatus(
        page,
        (response) =>
          response.url().includes(`/api/v1/tasks/${task.id}/resolve`) &&
          response.request().method() === 'POST',
        200
      );
      await taskPage.getByTestId('task-approve').click();
      await resolved;
    });

    await test.step('The task is listed under Closed', async () => {
      await backToUserTasks(page, userName);
      const closedFetch = waitForResponseWithStatus(
        page,
        (response) =>
          isUserTaskList(userName)(response) &&
          new URL(response.url()).searchParams.get('statusGroup') === 'closed',
        200
      );
      await page
        .getByTestId('inbox-tasks-tab')
        .getByRole('tablist')
        .getByRole('tab', { name: /^Closed/ })
        .click();
      await closedFetch;
      await expect(page.getByTestId(`inbox-task-${task.id}`)).toBeVisible();
    });

    await test.step('The approved description is applied', async () => {
      await expect
        .poll(async () => {
          const saved = await okJson<{ description?: string }>(
            await seeded.apiContext.get(
              `/api/v1/tables/${table.entityResponseData.id}`
            ),
            'Read the described table'
          );

          return saved.description;
        })
        .toBe(newDescription);
    });
  });

  test('finds an owned asset by search and previews it', async ({
    isolatedUserPage: page,
    seeded,
  }) => {
    test.slow();
    const [owned, other] = [
      await createOwnedTable(seeded),
      await createOwnedTable(seeded),
    ];
    const ownedName = owned.entityResponseData.name;
    const ownedCard = page.getByTestId(
      `user-asset-card-${owned.entityResponseData.fullyQualifiedName}`
    );
    const otherCard = page.getByTestId(
      `user-asset-card-${other.entityResponseData.fullyQualifiedName}`
    );

    await test.step('Owned assets lists both tables', async () => {
      await openUserDetail(
        page,
        seeded.subject.responseData.name,
        'owned-assets'
      );
      await expect(ownedCard).toBeVisible();
      await expect(otherCard).toBeVisible();
    });

    await test.step('Search narrows the list to one table', async () => {
      const searchFetch = waitForResponseWithStatus(
        page,
        (response) =>
          response.request().method() === 'GET' &&
          new URL(response.url()).pathname === '/api/v1/search/query' &&
          // The query escapes the name's ES reserved characters (`-`).
          new URL(response.url()).searchParams
            .get('q')
            ?.replace(/\\/g, '')
            .includes(ownedName) === true,
        200
      );
      await page.getByTestId('user-assets-search').fill(ownedName);
      await searchFetch;
      await expect(ownedCard).toBeVisible();
      await expect(otherCard).toBeHidden();
    });

    await test.step('Opening the card previews it', async () => {
      await ownedCard.getByTestId('user-asset-card-name').click();
      await expect(page.getByTestId('user-assets-summary')).toContainText(
        shownName(owned)
      );
    });
  });

  test('lists the assets the user follows', async ({
    isolatedUserPage: page,
    seeded,
  }) => {
    const followed = await createTable(seeded);
    await followed.followTable(
      seeded.apiContext,
      seeded.subject.responseData.id
    );
    await waitForSearchIndexed(
      seeded.apiContext,
      followed.entityResponseData.fullyQualifiedName,
      'table',
      {
        queryFilter: JSON.stringify({
          query: {
            term: { followers: seeded.subject.responseData.id },
          },
        }),
      }
    );
    const card = page.getByTestId(
      `user-asset-card-${followed.entityResponseData.fullyQualifiedName}`
    );

    await test.step('Following lists the followed table', async () => {
      await openUserDetail(page, seeded.subject.responseData.name, 'following');
      await expect(card).toBeVisible();
    });

    await test.step('Opening the card previews it', async () => {
      await card.getByTestId('user-asset-card-name').click();
      await expect(page.getByTestId('user-assets-summary')).toContainText(
        shownName(followed)
      );
    });
  });

  test('soft deletes the user and restores them from the banner', async ({
    isolatedUserPage: page,
    seeded,
  }) => {
    const { subject } = seeded;
    await openUserDetail(page, subject.responseData.name);

    await test.step('Delete soft deletes the user', async () => {
      await page.getByTestId('user-detail-delete-button').click();
      await expect(page.getByTestId('delete-modal')).toBeVisible();
      const deleted = waitForResponseWithStatus(
        page,
        (response) =>
          response.url().includes(`/api/v1/users/${subject.responseData.id}`) &&
          response.request().method() === 'DELETE',
        200
      );
      await page.getByTestId('confirm-button').click();
      await deleted;

      await expect(page.getByTestId('user-deleted-banner')).toBeVisible();
      expect(
        (await readUser(seeded.apiContext, subject.responseData.id)).deleted
      ).toBe(true);
    });

    await test.step('The banner restores the user', async () => {
      const restored = waitForResponseWithStatus(
        page,
        (response) =>
          response.url().includes('/api/v1/users/restore') &&
          response.request().method() === 'PUT',
        200
      );
      await page.getByTestId('banner-restore-user').click();
      await restored;

      await expect(page.getByTestId('user-deleted-banner')).toBeHidden();
      expect(
        (await readUser(seeded.apiContext, subject.responseData.id)).deleted
      ).toBe(false);
    });
  });
});

test.describe('My Data & Following', () => {
  test('shows the signed-in user’s owned and followed assets', async ({
    freshUserPage: { page, user },
    seeded,
  }) => {
    test.slow();
    const userId = user.responseData.id;
    const owned = await createOwnedTable(seeded, userId);
    const followed = await createTable(seeded);
    await followed.followTable(seeded.apiContext, userId);
    await waitForSearchIndexed(
      seeded.apiContext,
      followed.entityResponseData.fullyQualifiedName,
      'table',
      {
        queryFilter: JSON.stringify({
          query: { term: { followers: userId } },
        }),
      }
    );
    const myData = page.getByTestId('my-data-page');
    const ownedCard = myData.getByTestId(
      `user-asset-card-${owned.entityResponseData.fullyQualifiedName}`
    );

    await test.step('My Data lists the owned table', async () => {
      await enableAiAppMode(page);
      await visitMyData(page);
      await expect(ownedCard).toBeVisible();
    });

    await test.step('Following lists only the followed table', async () => {
      const followingFetch = waitForResponseWithStatus(
        page,
        isFollowedAssetsSearch(userId),
        200
      );
      await myData.getByRole('tab', { name: 'Following' }).click();
      await followingFetch;
      await expect(
        myData.getByTestId(
          `user-asset-card-${followed.entityResponseData.fullyQualifiedName}`
        )
      ).toBeVisible();
      await expect(ownedCard).toBeHidden();
    });
  });
});

test.describe('User custom properties, password reset and read-only access', () => {
  test('sets a value on the user’s Custom Properties tab', async ({
    isolatedUserPage: page,
    seeded,
  }) => {
    const { subject } = seeded;
    const {
      names: [propertyName],
      remove,
    } = await addUserTextProperties(seeded.apiContext);
    const value = `Senior Data Engineer ${uuid()}`;
    try {
      await openUserDetail(
        page,
        subject.responseData.name,
        'custom-properties'
      );
      const row = page.getByTestId(`custom-property-row-${propertyName}`);

      await test.step('Search finds the property among all of them', async () => {
        await page.getByTestId('custom-property-search').fill(propertyName);
        await expect(row).toBeVisible();
      });

      await test.step('The inline value is saved', async () => {
        await setTextPropertyValue(
          page,
          row,
          propertyName,
          subject.responseData.id,
          value
        );

        const saved = await readUser(
          seeded.apiContext,
          subject.responseData.id
        );
        expect(saved.extension?.[propertyName]).toBe(value);
      });
    } finally {
      await remove();
    }
  });

  test('sets your own custom property from your Profile', async ({
    freshUserPage: { page, user },
    seeded,
  }) => {
    // Six of our own guarantee the section collapses past its five rows, so
    // "Show all" is always there, however many other properties come and go.
    const { names, remove } = await addUserTextProperties(seeded.apiContext, 6);
    const propertyName = names[names.length - 1];
    const value = `Bengaluru ${uuid()}`;
    try {
      const section = page.getByTestId('profile-section-custom-properties');
      const row = section.getByTestId(`custom-property-row-${propertyName}`);

      await test.step('Show all reveals every property', async () => {
        const selfFetch = waitForResponseWithStatus(
          page,
          isUserByName(user.responseData.name),
          200
        );
        await openAiProfile(page);
        await selfFetch;

        const showAll = section.getByTestId('toggle-all-custom-properties');
        await expect(showAll).toBeVisible();
        await showAll.click();
        await expect(row).toBeVisible();
      });

      await test.step('The inline value is saved on your account', async () => {
        await setTextPropertyValue(
          page,
          row,
          propertyName,
          user.responseData.id,
          value
        );

        const saved = await readUser(seeded.apiContext, user.responseData.id);
        expect(saved.extension?.[propertyName]).toBe(value);
      });
    } finally {
      await remove();
    }
  });

  test('an admin resets another user’s password', async ({
    isolatedUserPage: page,
    seeded,
  }) => {
    const { subject } = seeded;
    const newPassword = `Pw!${uuid()}Reset1`;
    await openUserDetail(page, subject.responseData.name);

    await test.step('Set a new password', async () => {
      await page.getByTestId('change-password-button').click();
      await page
        .getByTestId('new-password-input')
        .locator('input')
        .fill(newPassword);
      await page
        .getByTestId('confirm-password-input')
        .locator('input')
        .fill(newPassword);
      const changed = waitForResponseWithStatus(
        page,
        (response) =>
          response.url().includes('/api/v1/users/changePassword') &&
          response.request().method() === 'PUT',
        200
      );
      await page.getByTestId('update-password-button').click();
      await changed;
    });

    await test.step('The user signs in with it', async () => {
      const login = await seeded.apiContext.post('/api/v1/users/login', {
        data: {
          email: subject.data.email,
          password: Buffer.from(newPassword).toString('base64'),
        },
      });
      expect(login.ok()).toBeTruthy();
    });
  });

  test('a non-admin opens another user read-only and sees their assets', async ({
    freshUserPage: { page },
    seeded,
  }) => {
    test.slow();
    const { subject } = seeded;
    const table = await createOwnedTable(seeded);

    await test.step('The profile link shows the user’s assets', async () => {
      // Sign-in already landed on `/`, so a hash-only goto would not reload
      // into the AI shell; load it first, then follow the profile link.
      await enableAiAppMode(page);
      await page.goto('/');
      await expect(page.getByTestId('ask-sidebar')).toBeVisible();
      const subjectFetch = waitForResponseWithStatus(
        page,
        isUserByName(subject.responseData.name),
        200
      );
      await page.goto(
        `/#profile/${encodeURIComponent(
          subject.responseData.name
        )}/owned-assets`
      );
      await subjectFetch;

      await expect(
        page.getByTestId(
          `user-asset-card-${table.entityResponseData.fullyQualifiedName}`
        )
      ).toBeVisible();
      await expect(page.getByTestId('profile-content-header')).toContainText(
        `@${subject.responseData.name}`
      );
    });

    await test.step('Nothing on the user can be changed', async () => {
      await page.getByTestId('user-detail-tab-overview').click();
      await expect(page.getByTestId('profile-details-panel')).toBeVisible();

      await expect(page.getByTestId('user-detail-delete-button')).toBeHidden();
      await expect(page.getByTestId('preferred-name-edit')).toBeHidden();
      await expect(page.getByTestId('change-password-button')).toBeHidden();
    });
  });
});
