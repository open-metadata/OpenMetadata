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

import {
  APIRequestContext,
  Browser,
  Locator,
  Page,
  Response,
} from '@playwright/test';
import { TableClass } from '../../../support/entity/TableClass';
import {
  expect,
  test as isolatedTest,
} from '../../../support/fixtures/isolatedUser';
import { UserClass } from '../../../support/user/UserClass';
import {
  openAiProfile,
  openUsersPanel,
  searchUserRow,
  waitForUserPatch,
} from '../../../utils/aiProfile';
import { okJson } from '../../../utils/apiResponse';
import { getWorkerAdminAPIContext, uuid } from '../../../utils/common';
import {
  createInboxTask,
  deleteInboxTasks,
  InboxTask,
  visitMyData,
  waitForTaskTransitions,
} from '../../../utils/inbox';
import { waitForSearchIndexed } from '../../../utils/polling';
import { performUserLogin } from '../../../utils/user';
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
        await table.delete(apiContext).catch(() => undefined);
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
  await page.goto(`/#members/users/${encodeURIComponent(userName)}${tabPath}`);
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
 * Add a text custom property to the user entity. The property is global, so
 * each test adds its own uniquely named one and removes it afterwards.
 */
const addUserTextProperty = async (apiContext: APIRequestContext) => {
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

  return {
    name,
    remove: () =>
      apiContext.delete(
        `/api/v1/metadata/types/${userType.id}/customProperties/${name}`
      ),
  };
};

/**
 * Set a text property's value from its row: the Custom Properties tab edits in
 * a modal, the own-Profile section edits inline in the row.
 */
const setTextPropertyValue = async (
  page: Page,
  row: Locator,
  propertyName: string,
  userId: string,
  value: string,
  editor: 'modal' | 'inline'
) => {
  await row.getByTestId(`edit-${propertyName}`).click();
  const form =
    editor === 'modal' ? page.getByTestId('custom-property-edit-modal') : row;
  await form.getByRole('textbox').fill(value);
  const patch = waitForUserPatch(page, userId);
  await form.getByTestId('inline-save-btn').click();
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
    (response) => response.url().includes(`/api/v1/tasks/${task.id}`),
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

/** The user acts on their own table, so the event is theirs. */
const recordActivityAs = async (
  browser: Browser,
  seeded: Seeded,
  table: TableClass,
  description: string
) => {
  const { apiContext, afterAction } = await performUserLogin(
    browser,
    seeded.subject
  );
  try {
    await okJson(
      await apiContext.patch(`/api/v1/tables/${table.entityResponseData.id}`, {
        data: [{ op: 'add', path: '/description', value: description }],
        headers: { 'Content-Type': 'application/json-patch+json' },
      }),
      'The user describes their table'
    );
  } finally {
    await afterAction();
  }

  // Activity is written after the change event, not with the PATCH, and lags
  // further while other runs load the server.
  await expect
    .poll(
      async () => {
        const response = await seeded.apiContext.get(
          `/api/v1/activity/user/${seeded.subject.responseData.id}?days=30`
        );

        return response.ok() ? response.text() : '';
      },
      { timeout: 120_000, intervals: [1_000, 2_000, 5_000] }
    )
    .toContain(table.entityResponseData.name);
};

test.describe('AI Profile Members user detail', () => {
  // Only you rename yourself (legacy parity), so the isolated admin renames
  // its own account from the own Profile tab.
  test('renames yourself from your own Profile', async ({
    isolatedUserPage: page,
    isolatedUser,
    seeded,
  }) => {
    const userName = isolatedUser.responseData.name;
    const newName = `PW Renamed ${uuid()}`;

    const userFetch = waitForResponseWithStatus(
      page,
      (response) =>
        isUserByName(userName)(response) &&
        response.url().includes('extension'),
      200
    );
    await openAiProfile(page);
    await userFetch;

    await page.getByTestId('preferred-name-edit').click();
    await page
      .getByTestId('preferred-name-input')
      .getByRole('textbox')
      .fill(newName);
    const patch = waitForUserPatch(page, isolatedUser.responseData.id);
    await page.getByTestId('preferred-name-save').click();
    expect((await patch).ok()).toBeTruthy();

    await expect(page.getByTestId('profile-content-header')).toContainText(
      newName
    );
    expect(
      (await readUser(seeded.apiContext, isolatedUser.responseData.id))
        .displayName
    ).toBe(newName);
  });

  test('grants a role from the Access tab', async ({
    isolatedUserPage: page,
    seeded,
  }) => {
    const { subject } = seeded;
    await openUserDetail(page, subject.responseData.name, 'access');

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

    const patch = waitForUserPatch(page, subject.responseData.id);
    await page.getByTestId('roles-save').click();
    expect((await patch).ok()).toBeTruthy();

    await expect(page.getByTestId('roles')).toContainText('Data Steward');
    const user = await readUser(seeded.apiContext, subject.responseData.id);
    expect(user.roles?.map((role) => role.name)).toContain('DataSteward');
  });

  test('shows the activity the user generated', async ({
    browser,
    isolatedUserPage: page,
    seeded,
  }) => {
    test.slow();
    const table = await createOwnedTable(seeded);
    const description = `Described by its owner ${uuid()}`;
    await recordActivityAs(browser, seeded, table, description);

    const activityFetch = waitForResponseWithStatus(
      page,
      (response) =>
        response
          .url()
          .includes(`/api/v1/activity/user/${seeded.subject.responseData.id}`),
      200
    );
    await openUserDetail(page, seeded.subject.responseData.name, 'activity');
    await activityFetch;

    const event = page
      .getByTestId('activity-feed-item')
      .filter({ hasText: shownName(table) });
    await expect(event).toBeVisible();
    await expect(event).toContainText(description);
    await expect(event).toContainText(
      seeded.subject.responseData.displayName ??
        seeded.subject.responseData.name
    );
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

    const editor = taskPage
      .getByTestId('inbox-comment-composer')
      .locator('.ql-editor');
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

    const saved = await okJson<{ comments?: { message: string }[] }>(
      await seeded.apiContext.get(`/api/v1/tasks/${task.id}?fields=comments`),
      'Read the task comments'
    );
    // The editor stores its spaces as &nbsp;, so compare the words.
    const savedText = (saved.comments ?? [])
      .map(({ message }) => message.replace(/\s+/g, ' '))
      .join('\n');
    expect(savedText).toContain(comment);

    await backToUserTasks(page, userName);
    await expect(page.getByTestId(`inbox-task-${task.id}`)).toBeVisible();
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

    const resolved = waitForResponseWithStatus(
      page,
      (response) =>
        response.url().includes(`/api/v1/tasks/${task.id}/resolve`) &&
        response.request().method() === 'POST',
      200
    );
    await taskPage.getByTestId('task-approve').click();
    await resolved;

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

    await openUserDetail(
      page,
      seeded.subject.responseData.name,
      'owned-assets'
    );
    const ownedCard = page.getByTestId(
      `user-asset-card-${owned.entityResponseData.fullyQualifiedName}`
    );
    const otherCard = page.getByTestId(
      `user-asset-card-${other.entityResponseData.fullyQualifiedName}`
    );
    await expect(ownedCard).toBeVisible();
    await expect(otherCard).toBeVisible();

    const searchFetch = waitForResponseWithStatus(
      page,
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        new URL(response.url()).searchParams.get('q')?.includes(ownedName) ===
          true,
      200
    );
    await page.getByTestId('user-assets-search').fill(ownedName);
    await searchFetch;
    await expect(ownedCard).toBeVisible();
    await expect(otherCard).toBeHidden();

    await ownedCard.getByTestId('user-asset-card-name').click();
    await expect(page.getByTestId('user-assets-summary')).toContainText(
      shownName(owned)
    );
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

    await openUserDetail(page, seeded.subject.responseData.name, 'following');
    const card = page.getByTestId(
      `user-asset-card-${followed.entityResponseData.fullyQualifiedName}`
    );
    await expect(card).toBeVisible();

    await card.getByTestId('user-asset-card-name').click();
    await expect(page.getByTestId('user-assets-summary')).toContainText(
      shownName(followed)
    );
  });

  test('soft deletes the user and restores them from the banner', async ({
    isolatedUserPage: page,
    seeded,
  }) => {
    const { subject } = seeded;
    await openUserDetail(page, subject.responseData.name);

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

test.describe('My Data & Following', () => {
  test('shows the signed-in user’s owned and followed assets', async ({
    browser,
    seeded,
  }) => {
    test.slow();
    const owned = await createOwnedTable(seeded);
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

    const { page, afterAction } = await performUserLogin(
      browser,
      seeded.subject
    );
    try {
      await enableAiAppMode(page);
      await visitMyData(page);

      const myData = page.getByTestId('my-data-page');
      await expect(
        myData.getByTestId(
          `user-asset-card-${owned.entityResponseData.fullyQualifiedName}`
        )
      ).toBeVisible();

      const followingFetch = waitForResponseWithStatus(
        page,
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          decodeURIComponent(response.url()).includes(
            seeded.subject.responseData.id
          ),
        200
      );
      await myData.getByRole('tab', { name: 'Following' }).click();
      await followingFetch;
      await expect(
        myData.getByTestId(
          `user-asset-card-${followed.entityResponseData.fullyQualifiedName}`
        )
      ).toBeVisible();
      await expect(
        myData.getByTestId(
          `user-asset-card-${owned.entityResponseData.fullyQualifiedName}`
        )
      ).toBeHidden();
    } finally {
      await afterAction();
    }
  });
});

test.describe('User custom properties, password reset and read-only access', () => {
  test('sets a value on the user’s Custom Properties tab', async ({
    isolatedUserPage: page,
    seeded,
  }) => {
    const { subject } = seeded;
    const property = await addUserTextProperty(seeded.apiContext);
    const value = `Senior Data Engineer ${uuid()}`;
    try {
      await openUserDetail(
        page,
        subject.responseData.name,
        'custom-properties'
      );
      const row = page.getByTestId(`custom-property-row-${property.name}`);
      await setTextPropertyValue(
        page,
        row,
        property.name,
        subject.responseData.id,
        value,
        'modal'
      );

      const saved = await readUser(seeded.apiContext, subject.responseData.id);
      expect(saved.extension?.[property.name]).toBe(value);
    } finally {
      await property.remove();
    }
  });

  test('sets your own custom property from your Profile', async ({
    isolatedUserPage: page,
    isolatedUser,
    seeded,
  }) => {
    const property = await addUserTextProperty(seeded.apiContext);
    const value = `Bengaluru ${uuid()}`;
    try {
      const selfFetch = waitForResponseWithStatus(
        page,
        isUserByName(isolatedUser.responseData.name),
        200
      );
      await openAiProfile(page);
      await selfFetch;

      const section = page.getByTestId('profile-section-custom-properties');
      await expect(section).toBeVisible();
      // Past five properties the rest sit behind "Show all".
      const showAll = section.getByTestId('toggle-all-custom-properties');
      if (await showAll.isVisible()) {
        await showAll.click();
      }
      const row = section.getByTestId(`custom-property-row-${property.name}`);
      await setTextPropertyValue(
        page,
        row,
        property.name,
        isolatedUser.responseData.id,
        value,
        'inline'
      );

      const saved = await readUser(
        seeded.apiContext,
        isolatedUser.responseData.id
      );
      expect(saved.extension?.[property.name]).toBe(value);
    } finally {
      await property.remove();
    }
  });

  test('an admin resets another user’s password', async ({
    isolatedUserPage: page,
    seeded,
  }) => {
    const { subject } = seeded;
    const newPassword = `Pw!${uuid()}Reset1`;
    await openUserDetail(page, subject.responseData.name);

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

    const login = await seeded.apiContext.post('/api/v1/users/login', {
      data: {
        email: subject.data.email,
        password: Buffer.from(newPassword).toString('base64'),
      },
    });
    expect(login.ok()).toBeTruthy();
  });

  test('a non-admin opens another user read-only and sees their assets', async ({
    browser,
    seeded,
  }) => {
    test.slow();
    const owner = new UserClass();
    await owner.create(seeded.apiContext);
    try {
      const table = await createOwnedTable(seeded, owner.responseData.id);
      const { page, afterAction } = await performUserLogin(
        browser,
        seeded.subject
      );
      try {
        // Sign-in already landed on `/`, so a hash-only goto would not reload
        // into the AI shell; load it first, then follow the profile link.
        await enableAiAppMode(page);
        await page.goto('/');
        await expect(page.getByTestId('ask-sidebar')).toBeVisible();
        const ownerFetch = waitForResponseWithStatus(
          page,
          isUserByName(owner.responseData.name),
          200
        );
        await page.goto(
          `/#profile/${encodeURIComponent(
            owner.responseData.name
          )}/owned-assets`
        );
        await ownerFetch;

        await expect(
          page.getByTestId(
            `user-asset-card-${table.entityResponseData.fullyQualifiedName}`
          )
        ).toBeVisible();
        await expect(page.getByTestId('profile-content-header')).toContainText(
          `@${owner.responseData.name}`
        );
      } finally {
        await afterAction();
      }
    } finally {
      await owner.delete(seeded.apiContext);
    }
  });

  test('a data consumer reaches another user through Settings › Members', async ({
    browser,
    seeded,
  }) => {
    test.slow();
    const owner = new UserClass();
    await owner.create(seeded.apiContext);
    try {
      const table = await createOwnedTable(seeded, owner.responseData.id);
      const { page, afterAction } = await performUserLogin(
        browser,
        seeded.subject
      );
      try {
        await enableAiAppMode(page);
        await page.goto('/');
        await expect(page.getByTestId('ask-sidebar')).toBeVisible();
        await page.goto('/#members');
        await expect(page.getByTestId('members-landing')).toBeVisible();

        await openUsersPanel(page);
        const ownerCell = await searchUserRow(page, owner.responseData.name);
        const ownerFetch = waitForResponseWithStatus(
          page,
          isUserByName(owner.responseData.name),
          200
        );
        await ownerCell.click();
        await ownerFetch;

        const assetsFetch = waitForResponseWithStatus(
          page,
          (response) => response.url().includes('/api/v1/search/query'),
          200
        );
        await page.getByTestId('user-detail-tab-owned-assets').click();
        await assetsFetch;
        await expect(
          page.getByTestId(
            `user-asset-card-${table.entityResponseData.fullyQualifiedName}`
          )
        ).toBeVisible();
      } finally {
        await afterAction();
      }
    } finally {
      await owner.delete(seeded.apiContext);
    }
  });
});
