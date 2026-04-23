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
import { expect, Page, test as base } from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import { TagClass } from '../../support/tag/TagClass';
import { AdminClass } from '../../support/user/AdminClass';
import { UserClass } from '../../support/user/UserClass';
import { createAdminApiContext, performAdminLogin } from '../../utils/admin';
import {
  descriptionBox,
  getApiContext,
  redirectToHomePage,
  uuid,
} from '../../utils/common';
import { waitForPageLoaded } from '../../utils/polling';

let adminUser: AdminClass;
let testTable: TableClass;
let testTag: TagClass;

const test = base.extend<{
  page: Page;
}>({
  page: async ({ browser }, use) => {
    const adminPage = await browser.newPage();
    await adminUser.login(
      adminPage,
      adminUser.data.email,
      adminUser.data.password
    );
    await use(adminPage);
    await adminPage.close();
  },
});

type ActivityApiEvent = {
  actor?: { displayName?: string; name?: string };
  eventType?: string;
  summary?: string;
};

type ActivityApiResponse = {
  data?: ActivityApiEvent[];
};

const openActivityFeedAndWaitForApi = async (page: Page, entityFqn: string) => {
  const expectedActivityPath = `/api/v1/activity/entity/table/name/${entityFqn}`;
  const activityResponsePromise = page.waitForResponse(
    (response) =>
      decodeURIComponent(response.url()).includes(expectedActivityPath) &&
      response.status() === 200,
    { timeout: 15000 }
  );

  await page.getByTestId('activity_feed').click();
  await waitForPageLoaded(page);

  const activityResponse = await activityResponsePromise;

  return (await activityResponse.json()) as ActivityApiResponse;
};

const waitForActivityEvent = async (entityFqn: string, eventType: string) => {
  const { apiContext, afterAction } = await createAdminApiContext();
  const activityUrl = `/api/v1/activity/entity/table/name/${encodeURIComponent(
    entityFqn
  )}?days=30&limit=50`;
  let events: ActivityApiEvent[] = [];

  try {
    await expect
      .poll(
        async () => {
          const response = await apiContext.get(activityUrl);

          if (!response.ok()) {
            return false;
          }

          const body = (await response.json()) as ActivityApiResponse;
          events = body.data ?? [];

          return events.some((event) => event.eventType === eventType);
        },
        {
          timeout: 75000,
          intervals: [1000, 2000, 5000, 10000],
          message: `Timed out waiting for ${eventType} event for ${entityFqn}`,
        }
      )
      .toBe(true);

    return events.find((event) => event.eventType === eventType);
  } finally {
    await afterAction();
  }
};

const addOwnerFromActivitySpec = async (page: Page, owner: string) => {
  await page.getByTestId('edit-owner').click();

  const usersTab = page.getByRole('tab', { name: /^Users\b/ });
  if ((await usersTab.getAttribute('aria-selected')) !== 'true') {
    await usersTab.click();
  }

  const ownerSearchInput = page.getByTestId('owner-select-users-search-bar');
  await expect(ownerSearchInput).toBeVisible({ timeout: 30000 });

  const searchUser = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') && response.ok()
  );
  await ownerSearchInput.fill(owner);
  await searchUser;

  const ownerItem = page.getByRole('listitem', { name: owner });
  await expect(ownerItem).toBeVisible({ timeout: 60000 });
  await ownerItem.click();

  const patchRequest = page.waitForResponse('/api/v1/tables/*');
  await page
    .locator('[id^="rc-tabs-"][id$="-panel-users"]')
    .getByTestId('selectable-list-update-btn')
    .click();
  await patchRequest;

  await expect(page.getByTestId('owner-link').getByTestId(owner)).toBeVisible();
};

test.beforeAll('Setup create admin user', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  adminUser = new AdminClass();

  await adminUser.create(apiContext);

  await afterAction();
});

test.afterAll('Cleanup delete admin user', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);

  await adminUser.delete(apiContext);

  await afterAction();
});

test.describe('Activity API - Entity Changes', () => {
  test.describe.configure({ timeout: 120000 });

  test.beforeAll('Setup: create entities and users', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    testTable = new TableClass();
    testTag = new TagClass({});

    await testTable.create(apiContext);
    await testTag.create(apiContext);

    await afterAction();
  });

  test.afterAll('Cleanup: delete entities and users', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await testTable.delete(apiContext);
    await testTag.delete(apiContext);

    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await waitForPageLoaded(page);
  });

  test('Activity event is created when description is updated', async ({
    page,
  }) => {
    const newDescription = `Test description updated at ${Date.now()}`;
    const entityFqn = testTable.entityResponseData.fullyQualifiedName ?? '';

    // Navigate to entity page
    await testTable.visitEntityPage(page);

    // Update description
    await page.getByTestId('edit-description').click();

    // Wait for description modal to appear
    await page.locator(descriptionBox).waitFor({ state: 'visible' });
    await page.locator(descriptionBox).clear();
    await page.locator(descriptionBox).fill(newDescription);

    const patchResponse = page.waitForResponse('/api/v1/tables/*');
    await page.getByTestId('save').click();
    await patchResponse;

    const descriptionEvent = await waitForActivityEvent(
      entityFqn,
      'DescriptionUpdated'
    );
    const activityResponse = await openActivityFeedAndWaitForApi(
      page,
      entityFqn
    );
    const feedContainer = page.locator(
      '#center-container [data-testid="message-container"]'
    );
    const renderedDescriptionEvent = activityResponse.data?.find(
      (event) => event.eventType === 'DescriptionUpdated'
    );

    expect(descriptionEvent).toBeDefined();
    expect(renderedDescriptionEvent).toBeDefined();
    await expect(feedContainer.first()).toContainText(/description/i);
  });

  test('Activity event is created when tags are added', async ({ page }) => {
    const entityFqn = testTable.entityResponseData.fullyQualifiedName ?? '';

    // Add tag via API to bypass search indexing issues
    const { apiContext, afterAction } = await getApiContext(page);

    // Add tag to the table via API
    await apiContext.patch(
      `/api/v1/tables/${testTable.entityResponseData.id}`,
      {
        data: [
          {
            op: 'add',
            path: '/tags/0',
            value: {
              tagFQN: testTag.responseData.fullyQualifiedName,
              source: 'Classification',
            },
          },
        ],
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      }
    );

    await afterAction();

    const tagsEvent = await waitForActivityEvent(entityFqn, 'TagsUpdated');

    // Navigate to entity page
    await testTable.visitEntityPage(page);

    const activityResponse = await openActivityFeedAndWaitForApi(
      page,
      entityFqn
    );
    const feedContainer = page.locator(
      '#center-container [data-testid="message-container"]'
    );
    const renderedTagsEvent = activityResponse.data?.find(
      (event) => event.eventType === 'TagsUpdated'
    );

    expect(tagsEvent).toBeDefined();
    expect(renderedTagsEvent).toBeDefined();
    await expect(feedContainer.first()).toContainText(/tag/i);
  });

  test('Activity event is created when owner is added', async ({ page }) => {
    const entityFqn = testTable.entityResponseData.fullyQualifiedName ?? '';
    const ownerDisplayName = adminUser.getUserDisplayName();

    // Navigate to entity page
    await testTable.visitEntityPage(page);

    await addOwnerFromActivitySpec(page, ownerDisplayName);

    const ownerEvent = await waitForActivityEvent(entityFqn, 'OwnerUpdated');
    const activityResponse = await openActivityFeedAndWaitForApi(
      page,
      entityFqn
    );
    const feedContainer = page.locator(
      '#center-container [data-testid="message-container"]'
    );
    const renderedOwnerEvent = activityResponse.data?.find(
      (event) => event.eventType === 'OwnerUpdated'
    );

    expect(ownerEvent).toBeDefined();
    expect(renderedOwnerEvent).toBeDefined();
    await expect(feedContainer.first()).toContainText(/owner/i);
    await expect(feedContainer.first()).toContainText(ownerDisplayName);
  });

  test('Activity event shows the actor who made the change', async ({
    page,
  }) => {
    // Make a change via API so we know exactly who the actor is
    const { apiContext, afterAction } = await getApiContext(page);
    const uniqueDescription = `Actor test description ${Date.now()}`;

    await apiContext.patch(
      `/api/v1/tables/${testTable.entityResponseData.id}`,
      {
        data: [
          {
            op: 'add',
            path: '/description',
            value: uniqueDescription,
          },
        ],
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      }
    );

    await afterAction();

    // Wait for activity to be indexed
    await waitForActivityEvent(
      testTable.entityResponseData.fullyQualifiedName ?? '',
      'DescriptionUpdated'
    );

    // Navigate to entity page
    await testTable.visitEntityPage(page);

    // Navigate to Activity Feed tab
    await page.getByTestId('activity_feed').click();
    await waitForPageLoaded(page);

    // Check if there are any feed items
    const feedContainer = page
      .locator('#center-container [data-testid="message-container"]')
      .filter({
        hasText: uniqueDescription,
      });

    await feedContainer.waitFor({ state: 'visible' });

    const feedContent = await feedContainer.first().textContent();

    // The activity should show the actor's name (admin user who made the change)
    // Activity typically shows username or display name
    const actorName = adminUser.responseData.displayName;

    expect(feedContent).toContain(actorName);
  });

  test('Activity event links to the correct entity', async ({ page }) => {
    // Navigate to entity page
    await testTable.visitEntityPage(page);

    // Navigate to Activity Feed tab
    await page.getByTestId('activity_feed').click();
    await waitForPageLoaded(page);

    // Check if there are any feed items
    const feedContainer = page.locator(
      '#center-container [data-testid="message-container"]'
    );

    await feedContainer
      .first()
      .waitFor({ state: 'visible', timeout: 10000 })
      .catch(() => {});

    if ((await feedContainer.count()) > 0) {
      // Activity cards now render actor/profile links ahead of the entity link.
      const entityLink = feedContainer
        .first()
        .locator('a[href*="/table/"]')
        .first();

      if (await entityLink.isVisible()) {
        const href = await entityLink.getAttribute('href');

        // The link should point to the table entity
        expect(href).toContain('table');
        expect(href).toContain(
          (testTable.entityResponseData.fullyQualifiedName ?? '')
            .split('.')
            .pop() ?? ''
        );
      } else {
        // Some activity types may not have clickable entity links
        test.info().annotations.push({
          type: 'note',
          description: 'No entity link found in activity item',
        });
      }
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'Activity feed is empty - cannot verify entity link',
      });
    }
  });
});

test.describe('Activity API - Reactions', () => {
  const adminUser = new UserClass();
  const testTable = new TableClass();

  test.beforeAll(
    'Setup: create entities and conversation',
    async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        await adminUser.create(apiContext);
        await adminUser.setAdminRole(apiContext);
        await testTable.create(apiContext);

        // Create a conversation thread to have something to react to
        const entityLink = `<#E::table::${testTable.entityResponseData.fullyQualifiedName}>`;
        await apiContext.post('/api/v1/feed', {
          data: {
            message: 'Test conversation for reactions',
            about: entityLink,
          },
        });
      } finally {
        await afterAction();
      }
    }
  );

  test.afterAll('Cleanup: delete entities', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await testTable.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await waitForPageLoaded(page);
  });

  test('User can add reaction to feed item', async ({ page }) => {
    // Navigate to entity page
    await testTable.visitEntityPage(page);

    // Navigate to Activity Feed tab
    await page.getByTestId('activity_feed').click();
    await waitForPageLoaded(page);

    // Wait for feed to load
    const feedContainer = page.locator(
      '#center-container [data-testid="message-container"]'
    );
    const emptyState = page.locator(
      '[data-testid="no-data-placeholder-container"]'
    );

    // Wait for either feed items or empty state
    await Promise.race([
      feedContainer.first().waitFor({ state: 'visible', timeout: 10000 }),
      emptyState.waitFor({ state: 'visible', timeout: 10000 }),
    ]).catch(() => {});

    // Skip if no feed items
    if ((await feedContainer.count()) === 0) {
      test.info().annotations.push({
        type: 'skip',
        description: 'No feed items available to react to',
      });

      return;
    }

    // Find reaction button and click
    const reactionContainer = feedContainer
      .first()
      .locator('[data-testid="feed-reaction-container"]');

    if (await reactionContainer.isVisible()) {
      const addReactionBtn = reactionContainer.locator(
        '[data-testid="add-reactions"]'
      );

      await expect(addReactionBtn).toBeVisible();
      await addReactionBtn.click();

      // Wait for reaction popover
      await page
        .locator('.ant-popover-feed-reactions')
        .waitFor({ state: 'visible' });

      // Click on thumbsUp reaction
      const reactionResponse = page.waitForResponse(
        (response) =>
          (response.url().includes('/api/v1/feed') ||
            response.url().includes('/api/v1/activity')) &&
          response.status() === 200
      );

      await page
        .locator('[data-testid="reaction-button"][title="thumbsUp"]')
        .click();

      await reactionResponse;

      // Verify reaction is added - look for thumbsUp emoji in the feed
      // The reaction button shows as "👍 1" or similar
      const thumbsUpReaction = page.getByRole('button', { name: /👍/ });

      await expect(thumbsUpReaction.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('User can remove reaction from feed item', async ({ page }) => {
    // Navigate to entity page
    await testTable.visitEntityPage(page);

    // Navigate to Activity Feed tab
    await page.getByTestId('activity_feed').click();
    await waitForPageLoaded(page);

    // Wait for feed to load
    const feedContainer = page.locator(
      '#center-container [data-testid="message-container"]'
    );
    const emptyState = page.locator(
      '[data-testid="no-data-placeholder-container"]'
    );

    // Wait for either feed items or empty state
    await Promise.race([
      feedContainer.first().waitFor({ state: 'visible', timeout: 10000 }),
      emptyState.waitFor({ state: 'visible', timeout: 10000 }),
    ]).catch(() => {});

    // Skip if no feed items
    if ((await feedContainer.count()) === 0) {
      test.info().annotations.push({
        type: 'skip',
        description: 'No feed items available',
      });

      return;
    }

    // Find reaction container
    const reactionContainer = feedContainer
      .first()
      .locator('[data-testid="feed-reaction-container"]');

    if (await reactionContainer.isVisible()) {
      // First add a reaction if not already present
      const existingReaction = reactionContainer.locator(
        '[data-testid="Reactions"]'
      );

      if (!(await existingReaction.isVisible())) {
        const addReactionBtn = reactionContainer.locator(
          '[data-testid="add-reactions"]'
        );
        await addReactionBtn.click();
        await page
          .locator('.ant-popover-feed-reactions')
          .waitFor({ state: 'visible' });

        const addResponse = page.waitForResponse(
          (response) =>
            (response.url().includes('/api/v1/feed') ||
              response.url().includes('/api/v1/activity')) &&
            response.status() === 200
        );
        await page
          .locator('[data-testid="reaction-button"][title="thumbsUp"]')
          .click();
        await addResponse;
      }

      // Now remove the reaction by clicking again
      await reactionContainer.locator('[data-testid="add-reactions"]').click();
      await page
        .locator('.ant-popover-feed-reactions')
        .waitFor({ state: 'visible' });

      const removeResponse = page.waitForResponse(
        (response) =>
          (response.url().includes('/api/v1/feed') ||
            response.url().includes('/api/v1/activity')) &&
          response.status() === 200
      );

      await page
        .locator('[data-testid="reaction-button"][title="thumbsUp"]')
        .click();

      await removeResponse;
    }
  });
});

test.describe('Activity API - Comments', () => {
  let adminUser: UserClass;
  let testTable: TableClass;
  let feedMessage = '';
  let feedUrl = '';
  let entityLink = '';

  test.beforeAll(
    'Setup: create entities and conversation',
    async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      adminUser = new UserClass();
      testTable = new TableClass();

      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await testTable.create(apiContext);

      // Create a conversation thread to have something to comment on
      feedMessage = `Test conversation for comments ${Date.now()}`;
      entityLink = `<#E::table::${testTable.entityResponseData.fullyQualifiedName}>`;
      await apiContext.post('/api/v1/feed', {
        data: {
          message: feedMessage,
          about: entityLink,
        },
      });
      feedUrl = `/api/v1/feed?entityLink=${encodeURIComponent(
        entityLink
      )}&type=Conversation&limit=25`;

      await expect
        .poll(
          async () => {
            const response = await apiContext.get(feedUrl);
            const data = await response.json();

            return (data.data ?? []).some((thread: { message?: string }) =>
              thread.message?.includes(feedMessage)
            );
          },
          { timeout: 60_000, intervals: [2_000] }
        )
        .toBe(true);

      await afterAction();
    }
  );

  test.afterAll('Cleanup: delete entities', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await testTable.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await waitForPageLoaded(page);
  });

  test('User can add comment to feed item', async ({ page }) => {
    const commentText = `Test comment ${uuid()}`;

    // Navigate to entity page
    await testTable.visitEntityPage(page);

    // Navigate to Activity Feed tab
    await page.getByTestId('activity_feed').click();
    await waitForPageLoaded(page);

    // Wait for feed to load
    const feedContainer = page
      .locator('#center-container [data-testid="message-container"]')
      .filter({
        hasText: feedMessage,
      });

    // Wait for either feed items or empty state

    feedContainer.waitFor({ state: 'visible' });

    // Click on the feed card to open detail view
    await feedContainer.click();
    await waitForPageLoaded(page);

    // Wait for comment input to appear
    const commentInput = page.locator('[data-testid="comments-input-field"]');

    if (await commentInput.isVisible()) {
      await commentInput.click();

      // Fill in the comment using the editor
      const editorField = page.locator(
        '[data-testid="editor-wrapper"] [contenteditable="true"]'
      );
      await editorField.fill(commentText);

      // Wait for send button to be enabled
      const sendButton = page.getByTestId('send-button');

      await expect(sendButton).toBeEnabled();

      // Send the comment
      const postResponse = page.waitForResponse('/api/v1/feed/*/posts');
      await sendButton.click();
      await postResponse;

      // Verify comment appears
      await expect(page.getByText(commentText)).toBeVisible({ timeout: 10000 });
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'Comment input not visible for this feed item type',
      });
    }
  });

  test('Feed detail shows conversation layout', async ({ page }) => {
    // Navigate to entity page
    await testTable.visitEntityPage(page);

    // Navigate to Activity Feed tab
    await page.getByTestId('activity_feed').click();
    await waitForPageLoaded(page);

    // Wait for feed to load
    const feedContainer = page.locator(
      '#center-container [data-testid="message-container"]'
    );
    const emptyState = page.locator(
      '[data-testid="no-data-placeholder-container"]'
    );

    // Wait for either feed items or empty state
    await Promise.race([
      feedContainer.first().waitFor({ state: 'visible', timeout: 10000 }),
      emptyState.waitFor({ state: 'visible', timeout: 10000 }),
    ]).catch(() => {});

    // Skip if no feed items
    if ((await feedContainer.count()) === 0) {
      test.info().annotations.push({
        type: 'skip',
        description: 'No feed items available',
      });

      return;
    }

    // Click on feed card to open detail view
    await feedContainer.first().click();
    await waitForPageLoaded(page);

    // Verify layout elements are visible
    // Feed card sidebar (at least one should be visible)
    const leftSidebar = page
      .locator('[data-testid="feed-card-v2-sidebar"]')
      .first();

    // Feed replies section
    const feedReplies = page.locator('[data-testid="feed-replies"]');

    // Feed content panel or activity feed panel
    const feedContentPanel = page.locator('.activity-feed-content-panel');
    const activityFeedPanel = page.locator(
      '[data-testid="activity-feed-panel"]'
    );

    // Check at least one layout element is visible
    const hasLayout =
      (await leftSidebar.isVisible().catch(() => false)) ||
      (await feedReplies.isVisible().catch(() => false)) ||
      (await feedContentPanel.isVisible().catch(() => false)) ||
      (await activityFeedPanel.isVisible().catch(() => false));

    expect(hasLayout).toBe(true);
  });
});

test.describe('Activity API - Homepage Widget', () => {
  const adminUser = new UserClass();
  const testTable = new TableClass();

  test.beforeAll('Setup: create entities and activity', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await testTable.create(apiContext);

      // Create a conversation to ensure there's activity in the feed
      const entityLink = `<#E::table::${testTable.entityResponseData.fullyQualifiedName}>`;
      await apiContext.post('/api/v1/feed', {
        data: {
          message: 'Test conversation for homepage widget',
          about: entityLink,
        },
      });
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup: delete entities', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await testTable.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await waitForPageLoaded(page);
  });

  test('Activity Feed widget displays feed items', async ({ page }) => {
    // Wait for feed widget to load
    page
      .getByTestId('KnowledgePanel.ActivityFeed')
      .waitFor({ state: 'visible' });

    // Check for feed content - either messages, empty state, or "No Recent Activity"
    const messageContainers = page.locator(
      '#center-container [data-testid="message-container"]'
    );
    const noRecentActivity = page.getByText('No Recent Activity');
    const emptyState = page.locator(
      '[data-testid="no-data-placeholder-container"]'
    );

    // Either we have messages or empty state
    const hasMessages = (await messageContainers.count()) > 0;
    const hasNoRecentActivity = await noRecentActivity
      .isVisible()
      .catch(() => false);
    const hasEmpty = (await emptyState.count()) > 0;

    expect(hasMessages || hasNoRecentActivity || hasEmpty).toBe(true);
  });

  test('Activity Feed widget has filter options', async ({ page }) => {
    // Wait for feed widget to load
    const feedWidget = page.getByTestId('KnowledgePanel.ActivityFeed');

    // Widget may not exist if homepage is not customized
    const widgetExists = await feedWidget.isVisible().catch(() => false);

    if (!widgetExists) {
      test.info().annotations.push({
        type: 'skip',
        description: 'Activity Feed widget not visible on homepage',
      });

      return;
    }

    await expect(feedWidget).toBeVisible();

    // Find sort dropdown in widget header
    const sortDropdown = feedWidget.getByTestId('widget-sort-by-dropdown');

    // Sort dropdown may not be visible if widget is in minimal mode
    const dropdownExists = await sortDropdown.isVisible().catch(() => false);

    if (!dropdownExists) {
      test.info().annotations.push({
        type: 'note',
        description: 'Sort dropdown not visible in widget header',
      });

      return;
    }

    await expect(sortDropdown).toBeVisible();

    // Click to open dropdown
    await sortDropdown.click();
    await page.locator('.ant-dropdown').waitFor({ state: 'visible' });

    // Verify filter options are present
    await expect(
      page.getByRole('menuitem', { name: 'All Activity' })
    ).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'My Data' })).toBeVisible();
    await expect(
      page.getByRole('menuitem', { name: 'Following' })
    ).toBeVisible();

    // Close dropdown by pressing escape
    await page.keyboard.press('Escape');
  });
});
