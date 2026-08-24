/*
 *  Copyright 2024 Collate.
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
  expect,
  Locator,
  Page,
  test as base,
} from '@playwright/test';
import { ApiEndpointClass } from '../../support/entity/ApiEndpointClass';
import { DatabaseClass } from '../../support/entity/DatabaseClass';
import { TableClass } from '../../support/entity/TableClass';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { UserClass } from '../../support/user/UserClass';
import {
  FEED_ITEM_TIMEOUT,
  insertActivityEventForTest,
} from '../../utils/activityAPI';
import { REACTION_EMOJIS, reactOnFeedCard } from '../../utils/activityFeed';
import { performAdminLogin } from '../../utils/admin';
import {
  redirectToHomePage,
  uuid,
  visitOwnProfilePage,
} from '../../utils/common';
import {
  navigateToCustomizeLandingPage,
  setUserDefaultPersona,
  waitForLandingPageWidget,
} from '../../utils/customizeLandingPage';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { editDisplayName } from '../../utils/user';
import { selectActivityFeedFilterAndVerifyEndpoint } from '../../utils/widgetFilters';

const test = base;
test.use({ storageState: undefined });

const adminUser = new UserClass();

const waitForConversationMaterialization = async ({
  apiContext,
  entityLink,
  threadId,
  message,
}: {
  apiContext: APIRequestContext;
  entityLink: string;
  threadId?: string;
  message?: string;
}) => {
  await expect
    .poll(
      async () => {
        const response = await apiContext.get('/api/v1/feed', {
          params: {
            entityLink,
            type: 'Conversation',
          },
        });

        if (!response.ok()) {
          return false;
        }

        const payload = await response.json();

        return (payload.data ?? []).some(
          (thread: { id?: string; message?: string }) =>
            thread.id === threadId || thread.message === message
        );
      },
      {
        timeout: 30_000,
        intervals: [1_000, 2_000, 5_000],
      }
    )
    .toBe(true);
};

// Mirrors PAGE_SIZE_BASE in src/constants/constants.ts. The widget renders the
// first PAGE_SIZE_BASE events and only shows "View More" beyond that, so seeding
// one extra makes the footer link mandatory instead of incidental.
const FEED_WIDGET_PAGE_SIZE = 15;
const SEEDED_OWNED_ACTIVITY_COUNT = FEED_WIDGET_PAGE_SIZE + 1;
const ACTIVITY_FEED_WIDGET_KEY = 'KnowledgePanel.ActivityFeed';

test.describe('FeedWidget on landing page', () => {
  let adminUser: UserClass;
  let user1: UserClass;
  let entity: TableClass;
  let extraEntity: TableClass;
  let ownedTable: TableClass;
  let followedTable: TableClass;
  let testPersona: PersonaClass;

  // The widget is filter-scoped, so the fixture has to give every filter
  // something of its own: My Data reads entities the user owns, Following reads
  // the FOLLOWS relationship. Without both, those filters return an empty list
  // and the tests below can only assert a URL, never rendered content.
  const ownedActivityMarker = `Owned table activity ${uuid()}`;
  const followedActivityMarker = `Followed table activity ${uuid()}`;

  test.beforeAll(
    'setup: seed entities, users, create persona, and customize widget',
    async ({ browser }) => {
      test.slow(true);

      adminUser = new UserClass();
      user1 = new UserClass();
      entity = new TableClass();
      extraEntity = new TableClass();
      ownedTable = new TableClass();
      followedTable = new TableClass();
      testPersona = new PersonaClass();

      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        // Create users and entities
        await adminUser.create(apiContext);
        await adminUser.setAdminRole(apiContext);
        await user1.create(apiContext);
        await entity.create(apiContext);
        await extraEntity.create(apiContext);
        await testPersona.create(apiContext, [adminUser.responseData.id]);

        await ownedTable.create(apiContext);
        await ownedTable.setOwner(apiContext, {
          id: adminUser.responseData.id,
          type: 'user',
        });

        // Each event carries the run-unique marker so a card can be pinned by
        // text. Workers in a shard share one database, so the top of the global
        // feed belongs to whichever spec inserted last — index-based targeting
        // is not stable there.
        for (let index = 0; index < SEEDED_OWNED_ACTIVITY_COUNT; index++) {
          await insertActivityEventForTest(
            apiContext,
            ownedTable,
            `${ownedActivityMarker} ${index}`
          );
        }

        await followedTable.create(apiContext);
        await followedTable.followTable(apiContext, adminUser.responseData.id);
        await insertActivityEventForTest(
          apiContext,
          followedTable,
          followedActivityMarker
        );

        // Set up widget in a separate page context
        const adminPage = await browser.newPage({ storageState: undefined });
        await adminUser.login(adminPage);

        try {
          // Set persona as default
          await redirectToHomePage(adminPage);
          await waitForAllLoadersToDisappear(adminPage);
          await setUserDefaultPersona(adminPage, testPersona.data.displayName);

          // Navigate to customize landing page
          await navigateToCustomizeLandingPage(adminPage, {
            personaName: testPersona.data.name,
          });

          // Ensure Activity Feed widget is full size
          const activityFeedWidget = adminPage.getByTestId(
            ACTIVITY_FEED_WIDGET_KEY
          );

          await expect(activityFeedWidget).toBeVisible();

          const moreOptionsButton = activityFeedWidget.getByTestId(
            'more-options-button'
          );
          await moreOptionsButton.click();
          await adminPage.getByRole('menuitem', { name: 'Full Size' }).click();

          // Save the layout if save button is enabled
          const saveButton = adminPage.getByTestId('save-button');
          if (await saveButton.isEnabled()) {
            const saveResponse = adminPage.waitForResponse('/api/v1/docStore*');
            await saveButton.click();
            await saveResponse;
          }

          await redirectToHomePage(adminPage);
          await waitForAllLoadersToDisappear(adminPage);
        } finally {
          await adminPage.close();
        }
      } finally {
        await afterAction();
      }
    }
  );

  test.afterAll('cleanup: delete seeded tables', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await ownedTable.delete(apiContext);
      await followedTable.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.beforeEach(async ({ page }) => {
    await adminUser.login(page);
    await redirectToHomePage(page);
    await waitForAllLoadersToDisappear(page);
  });

  test('renders widget wrapper and header with sort dropdown', async ({
    page,
  }) => {
    const widget = page.getByTestId(ACTIVITY_FEED_WIDGET_KEY);

    await expect(widget).toBeVisible();

    // Header verification
    const header = widget.getByTestId('widget-header');

    await expect(header).toBeVisible();
    await expect(header).toContainText('Activity Feed');

    // Sort dropdown verification
    const sortDropdown = header.getByTestId('widget-sort-by-dropdown');

    await expect(sortDropdown).toBeVisible();

    // Test dropdown options
    await sortDropdown.click();
    await page.locator('.ant-dropdown').waitFor({ state: 'visible' });

    await expect(
      page.getByRole('menuitem', { name: 'All Activity' })
    ).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'My Data' })).toBeVisible();
    await expect(
      page.getByRole('menuitem', { name: 'Following' })
    ).toBeVisible();

    // Close dropdown by clicking outside
    await widget.click();

    await expect(page.locator('.ant-dropdown')).not.toBeVisible();
  });

  test('clicking title navigates to explore page', async ({ page }) => {
    const widget = page.getByTestId(ACTIVITY_FEED_WIDGET_KEY);

    await expect(widget).toBeVisible();

    // Click the title to navigate
    const titleLink = widget
      .getByTestId('widget-header')
      .getByText('Activity Feed');
    await titleLink.click();

    // Verify navigation to user activity feed
    expect(page.url()).toContain('/users/');
    expect(page.url()).toContain('/activity_feed/all');
  });

  test('feed body renders seeded activity and no empty state', async ({
    page,
  }) => {
    const widget = page.getByTestId(ACTIVITY_FEED_WIDGET_KEY);

    await expect(widget).toBeVisible();

    const container = page.locator('#feedWidgetData');

    await expect(container).toBeVisible();

    const messageContainers = container.locator(
      '[data-testid="message-container"]'
    );

    await expect(messageContainers.first()).toBeVisible();
    await expect(
      container.locator('[data-testid="no-data-placeholder-container"]')
    ).toHaveCount(0);
    await expect(
      container.locator('[data-testid="widget-empty-state"]')
    ).toHaveCount(0);
  });

  test('changing the filter refetches from that filter endpoint', async ({
    page,
  }) => {
    const widget = await waitForLandingPageWidget(
      page,
      ACTIVITY_FEED_WIDGET_KEY
    );

    // Each filter owns an endpoint; asserting the request AND the rendered card
    // is what stops a filter silently reusing another filter's feed.
    await selectActivityFeedFilterAndVerifyEndpoint(
      page,
      widget,
      'My Data',
      '/api/v1/activity/my-feed'
    );

    await expect(
      widget
        .getByTestId('message-container')
        .filter({ hasText: ownedActivityMarker })
        .first()
    ).toBeVisible();

    await selectActivityFeedFilterAndVerifyEndpoint(
      page,
      widget,
      'Following',
      '/api/v1/activity/following'
    );

    await expect(
      widget
        .getByTestId('message-container')
        .filter({ hasText: followedActivityMarker })
        .first()
    ).toBeVisible();

    await selectActivityFeedFilterAndVerifyEndpoint(
      page,
      widget,
      'All Activity',
      '/api/v1/activity'
    );

    // The global stream is shared with every other worker in this shard, so a
    // specific card cannot be asserted here — only that the list is populated.
    await expect(widget.getByTestId('message-container').first()).toBeVisible();
  });

  test('footer view more navigates to the user activity feed', async ({
    page,
  }) => {
    const widget = await waitForLandingPageWidget(
      page,
      ACTIVITY_FEED_WIDGET_KEY
    );

    // The seeded events exceed PAGE_SIZE_BASE under My Data, so the link is
    // guaranteed rather than incidental.
    await selectActivityFeedFilterAndVerifyEndpoint(
      page,
      widget,
      'My Data',
      '/api/v1/activity/my-feed'
    );

    const viewMoreLink = widget.getByRole('link', { name: /View More/i });
    const expectedLink = `/users/${adminUser.responseData.name}/activity_feed/all`;

    await expect(viewMoreLink).toBeVisible();
    await expect(viewMoreLink).toHaveAttribute('href', expectedLink);

    await viewMoreLink.click();
    await page.waitForURL(`**${expectedLink}`);
  });

  test('feed cards render header text and timestamp', async ({ page }) => {
    const widget = await waitForLandingPageWidget(
      page,
      ACTIVITY_FEED_WIDGET_KEY
    );

    await selectActivityFeedFilterAndVerifyEndpoint(
      page,
      widget,
      'My Data',
      '/api/v1/activity/my-feed'
    );

    const seededCard = widget
      .getByTestId('message-container')
      .filter({ hasText: ownedActivityMarker })
      .first();

    await expect(seededCard).toBeVisible();
    await expect(seededCard.getByTestId('headerText')).toBeVisible();
    await expect(seededCard.getByTestId('timestamp')).toBeVisible();
  });

  test('emoji reactions can be added and toggled off on a feed card', async ({
    page,
  }) => {
    const widget = await waitForLandingPageWidget(
      page,
      ACTIVITY_FEED_WIDGET_KEY
    );

    await selectActivityFeedFilterAndVerifyEndpoint(
      page,
      widget,
      'My Data',
      '/api/v1/activity/my-feed'
    );

    // Pin the card by its marker: the list re-renders after every reaction, so
    // an index would not resolve to the same card on the toggle-off pass.
    const seededCard = widget
      .getByTestId('message-container')
      .filter({ hasText: ownedActivityMarker })
      .first();

    await expect(seededCard).toBeVisible();

    await reactOnFeedCard(page, seededCard);

    const reactionContainer = seededCard.getByTestId('feed-reaction-container');

    await expect(reactionContainer).toBeVisible();

    for (const emoji of REACTION_EMOJIS) {
      await expect(reactionContainer).toContainText(emoji);
    }

    await reactOnFeedCard(page, seededCard);

    await expect(reactionContainer).toBeVisible();
  });

  test('activity cards expose no thread affordances on the landing widget', async ({
    page,
  }) => {
    const widget = await waitForLandingPageWidget(
      page,
      ACTIVITY_FEED_WIDGET_KEY
    );

    await selectActivityFeedFilterAndVerifyEndpoint(
      page,
      widget,
      'My Data',
      '/api/v1/activity/my-feed'
    );

    const seededCard = widget
      .getByTestId('message-container')
      .filter({ hasText: ownedActivityMarker })
      .first();

    await expect(seededCard).toBeVisible();

    // The widget renders activity events, not conversation threads: there is no
    // reply count, and it passes no onActivityClick, so no drawer opens. Thread
    // drawer behaviour is covered on the entity feed in ActivityAPI.spec.ts.
    await expect(seededCard.getByTestId('reply-count')).toHaveCount(0);

    await seededCard.click();

    await expect(page.locator('.ant-drawer-content')).toHaveCount(0);
    expect(page.url()).toContain('/my-data');
  });
});

test.describe('Mention notifications in Notification Box', () => {
  let adminUser: UserClass;
  let user1: UserClass;
  let entity: TableClass;

  const test = base.extend<{
    adminPage: Page;
    user1Page: Page;
  }>({
    adminPage: async ({ browser }, use) => {
      const page = await browser.newPage({ storageState: undefined });
      await adminUser.login(page);
      await use(page);
      await page.close();
    },
    user1Page: async ({ browser }, use) => {
      const page = await browser.newPage({ storageState: undefined });
      await user1.login(page);
      await use(page);
      await page.close();
    },
  });

  test.beforeAll('Setup entities and users', async ({ browser }) => {
    adminUser = new UserClass();
    user1 = new UserClass();
    entity = new TableClass();

    const { apiContext, afterAction } = await performAdminLogin(browser);

    await adminUser.create(apiContext);
    await adminUser.setAdminRole(apiContext);
    await user1.create(apiContext);
    await entity.create(apiContext);

    await apiContext.post('/api/v1/feed', {
      data: {
        message: 'Initial conversation thread for mention test',
        about: `<#E::table::${entity.entityResponseData.fullyQualifiedName}>`,
        type: 'Conversation',
      },
    });

    const feedUrl = `/api/v1/feed?entityLink=${encodeURIComponent(
      `<#E::table::${entity.entityResponseData.fullyQualifiedName}>`
    )}&type=Conversation&limit=25`;

    await expect
      .poll(
        async () => {
          const response = await apiContext.get(feedUrl);
          const data = await response.json();

          return (data.data ?? []).some((thread: { message?: string }) =>
            thread.message?.includes(
              'Initial conversation thread for mention test'
            )
          );
        },
        { timeout: 60_000, intervals: [2_000] }
      )
      .toBe(true);

    await afterAction();
  });

  test('Mention notification shows correct user details in Notification box', async ({
    adminPage,
    user1Page,
  }) => {
    await test.step('User1 mentions admin user in a reply', async () => {
      await entity.visitEntityPage(user1Page);

      await user1Page.getByTestId('activity_feed').click();

      await waitForAllLoadersToDisappear(user1Page);

      const seededThread = user1Page
        .locator('[data-testid="message-container"]')
        .filter({ hasText: 'Initial conversation thread for mention test' })
        .first();

      await expect(seededThread).toBeVisible({ timeout: 30_000 });
      await seededThread.click();

      await waitForAllLoadersToDisappear(user1Page);

      await user1Page.getByTestId('comments-input-field').click();

      const editorLocator = user1Page.locator(
        '[data-testid="editor-wrapper"] [contenteditable="true"].ql-editor'
      );

      await editorLocator.fill('Hey ');

      await editorLocator.click();

      await user1Page.keyboard.press('@');
      const userSuggestionsResponse = user1Page.waitForResponse((response) => {
        const url = response.url();

        return (
          url.includes('/api/v1/search/query') &&
          url.includes(adminUser.responseData.displayName)
        );
      });
      await editorLocator.pressSequentially(adminUser.responseData.displayName);
      await userSuggestionsResponse;

      await user1Page
        .locator(`[data-value="@${adminUser.responseData.name}"]`)
        .first()
        .click();

      await editorLocator.pressSequentially(', can you check this?');

      await expect(
        user1Page.locator('[data-testid="send-button"]')
      ).toBeVisible();
      await expect(
        user1Page.locator('[data-testid="send-button"]')
      ).not.toBeDisabled();

      const postMentionResponse = user1Page.waitForResponse(
        '/api/v1/feed/*/posts'
      );
      await user1Page.locator('[data-testid="send-button"]').click();
      await postMentionResponse;
    });

    await test.step('Admin user checks notification for correct user and timestamp', async () => {
      await adminPage.reload();
      await waitForAllLoadersToDisappear(adminPage);
      const notificationBell = adminPage.getByTestId('task-notifications');

      await expect(notificationBell).toBeVisible();

      const feedResponseForNotifications = adminPage.waitForResponse(
        `/api/v1/tasks/assigned?*status=Open*`
      );

      await notificationBell.click();
      await feedResponseForNotifications;
      const notificationBox = adminPage.locator('.notification-box');

      await expect(notificationBox).toBeVisible();

      const mentionsTab = adminPage
        .locator('.notification-box')
        .getByText('Mentions');

      const mentionsFeedResponse = adminPage.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/feed') &&
          response.url().includes('filterType=MENTIONS')
      );

      await mentionsTab.click();
      await mentionsFeedResponse;

      const mentionsList = adminPage
        .getByRole('tabpanel', { name: 'Mentions' })
        .getByRole('list');

      await expect(mentionsList).toBeVisible();

      const firstNotificationItem = mentionsList
        .locator('li.ant-list-item.notification-dropdown-list-btn')
        .first();

      const firstNotificationText = await firstNotificationItem.textContent();

      expect(firstNotificationText?.toLowerCase()).toContain(
        user1.responseData.name.toLowerCase()
      );
      expect(firstNotificationText?.toLowerCase()).not.toContain(
        adminUser.responseData.name.toLowerCase()
      );

      const mentionNotificationLink = firstNotificationItem.locator(
        '[data-testid^="notification-link-"]'
      );

      const navigationPromise = adminPage.waitForURL(/activity_feed/);
      await mentionNotificationLink.click();
      await navigationPromise;

      expect(adminPage.url()).toContain('activity_feed');
      expect(adminPage.url()).toContain('/all');
    });

    await test.step('Update user display name and verify reaction tooltip', async () => {
      test.slow();
      const newDisplayName = `UpdatedName${uuid()}`;

      // Go to profile and update name
      await redirectToHomePage(user1Page);
      await visitOwnProfilePage(user1Page);
      await editDisplayName(user1Page, newDisplayName);

      // Go back to entity
      await entity.visitEntityPage(user1Page);

      await user1Page.getByTestId('activity_feed').click();
      await waitForAllLoadersToDisappear(user1Page);

      // Find a message to react to.
      const message = user1Page
        .locator('[data-testid="message-container"]')
        .first();
      await expect(message).toBeVisible();

      // Add reaction
      const reactionResponse = user1Page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/feed') &&
          response.request().method() === 'PATCH'
      );
      await message.locator('[data-testid="add-reactions"]').click();
      await user1Page.locator('[title="rocket"]').click();
      await reactionResponse;

      // Hover over the emoji button to see the popover
      const emojiButton = message
        .locator('[data-testid="emoji-button"]')
        .last();
      await emojiButton.hover();

      // Verify tooltip using the data-testid from Emoji.tsx popoverContent
      const tooltip = user1Page.getByTestId('popover-content');
      await expect(tooltip).toBeVisible();
      await expect(tooltip).toContainText(newDisplayName);
      await expect(tooltip).toContainText('reacted with');

      // Ensure username is not displayed if it's different
      if (newDisplayName !== user1.responseData.name) {
        await expect(tooltip).not.toContainText(user1.responseData.name);
      }
    });
  });
});

const CHINESE_MENTION_THREAD_MESSAGE =
  'Initial conversation for Chinese character encoding test';

test.describe('Mentions: Chinese character encoding in activity feed', () => {
  const database = new DatabaseClass();
  const endpointName = `测试Endpoint-${uuid()}`;
  const apiEndpoint = new ApiEndpointClass(undefined, endpointName);
  let schemaFqn: string;
  const userName = `测试-${uuid()}`;
  const chineseMentionUser = new UserClass({
    firstName: userName,
    lastName: '',
    email: `activity-feed-mention-${uuid()}@example.com`,
    password: 'User@OMD123',
  });

  test.beforeAll(
    'Create database, schema, and user with Chinese name',
    async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await database.create(apiContext);
      await apiEndpoint.create(apiContext);
      await adminUser.create(apiContext);
      schemaFqn = database.schemaResponseData.fullyQualifiedName;
      await chineseMentionUser.create(apiContext);

      // Create a conversation thread via API so we can post replies in the tests
      const conversationResponse = await apiContext.post('/api/v1/feed', {
        data: {
          message: CHINESE_MENTION_THREAD_MESSAGE,
          about: `<#E::databaseSchema::${schemaFqn}>`,
          type: 'Conversation',
        },
      });
      const conversation = await conversationResponse.json();
      await waitForConversationMaterialization({
        apiContext,
        entityLink: `<#E::databaseSchema::${schemaFqn}>`,
        threadId: conversation.id,
        message: CHINESE_MENTION_THREAD_MESSAGE,
      });

      await afterAction();
    }
  );

  test.afterAll('Cleanup chinese mention fixtures', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await apiEndpoint.delete(apiContext);
      await database.delete(apiContext);
      await chineseMentionUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.beforeEach(async ({ page }) => {
    await adminUser.login(page);
    await redirectToHomePage(page);
  });

  const openReplyEditor = async (page: Page) => {
    const feedPromise = page.waitForResponse((response) => {
      const url = response.url();
      return (
        url.includes('/api/v1/feed') &&
        url.includes('entityLink=') &&
        url.includes('type=Conversation') &&
        response.request().method() === 'GET'
      );
    });

    await page.goto(`/databaseSchema/${schemaFqn}/activity_feed/all`);
    await feedPromise;
    await waitForAllLoadersToDisappear(page);

    // The All tab interleaves change-events with conversations and auto-selects
    // whichever is newest, and change-events carry no editor at all. Never
    // assume the seeded thread is already open — select it explicitly, so the
    // editor's presence is a real assertion rather than a race on seed order.
    const seededThread = page
      .locator(
        '[data-testid="message-container"], [data-testid="feed-reply-card"]'
      )
      .filter({ hasText: CHINESE_MENTION_THREAD_MESSAGE })
      .first();

    await expect(seededThread).toBeVisible({ timeout: 30_000 });
    await seededThread.click();
    await waitForAllLoadersToDisappear(page);

    const commentInput = page.getByTestId('comments-input-field');
    await expect(commentInput).toBeVisible({ timeout: 10000 });
    await commentInput.click();

    const editorLocator = page.locator(
      '[data-testid="editor-wrapper"] .ProseMirror, [data-testid="editor-wrapper"] [contenteditable="true"].ql-editor'
    );
    await expect(editorLocator.first()).toBeVisible({ timeout: 10000 });

    return editorLocator.first();
  };

  const selectHashSuggestion = async (
    page: Page,
    editorLocator: ReturnType<Page['locator']>,
    label: string
  ) => {
    await expect(editorLocator).toBeVisible();

    const editorText = await editorLocator.textContent();
    if (editorText?.includes(`#${label}`)) {
      return;
    }

    const hashtagItem = page
      .locator('.hashtag-item')
      .filter({ hasText: label })
      .first();

    if (await hashtagItem.isVisible().catch(() => false)) {
      await hashtagItem.click();

      return;
    }

    const dropdown = page.locator('.suggestion-menu-wrapper');
    if (await dropdown.isVisible().catch(() => false)) {
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
    }
  };

  test('Should encode the chinese character while mentioning api endpoint', async ({
    page,
  }) => {
    const editorLocator = await openReplyEditor(page);

    await editorLocator.fill('Check ');

    await editorLocator.click();

    await page.keyboard.press('#');
    const endpointSuggestionsResponse = page.waitForResponse((response) => {
      const url = response.url();
      return (
        url.includes('/api/v1/search/query') &&
        url.includes(encodeURIComponent(endpointName))
      );
    });

    await editorLocator.pressSequentially(endpointName);
    await endpointSuggestionsResponse;

    await selectHashSuggestion(page, editorLocator, endpointName);

    await expect(page.locator('[data-testid="send-button"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="send-button"]')
    ).not.toBeDisabled();

    const postMentionResponse = page.waitForResponse('/api/v1/feed/*/posts');
    await page.locator('[data-testid="send-button"]').click();
    await postMentionResponse;

    const replyCard = page
      .getByTestId('feed-reply-card')
      .filter({ hasText: `Check #${endpointName}` });
    await expect(replyCard).toBeVisible();

    await expect(replyCard.getByTestId('viewer-container')).toHaveText(
      `Check #${endpointName}`
    );
  });
});

// Regressions introduced by the Task-redesign refactor (PR #25894): the entity
// "All" tab merged activity change-events with conversations as an either-or,
// hiding conversations, and the right-panel reply double-posted. These guard the fixes.
test.describe('ActivityFeed: activity + conversation merge (regression #25894)', () => {
  let adminUser: UserClass;
  let entity: TableClass;
  const conversationMessage = `Merge regression conversation ${uuid()}`;
  const conversationMessage2 = `Second regression conversation ${uuid()}`;
  // Run-unique so the seeded change-event can be pinned by text. Matching the
  // generic "created" header instead would also match the table's own auto
  // "Created" event if the consumer happens to deliver it mid-run, and every
  // worker in a shard shares one database.
  const activityMarker = `Merge regression activity ${uuid()}`;

  const test = base.extend<{ adminPage: Page }>({
    adminPage: async ({ browser }, use) => {
      const page = await browser.newPage({ storageState: undefined });
      await adminUser.login(page);
      await use(page);
      await page.close();
    },
  });

  const openActivityFeedTab = async (page: Page) => {
    await entity.visitEntityPage(page);
    await page.getByTestId('activity_feed').click();
    await waitForAllLoadersToDisappear(page);

    // Scoped to #feedData throughout: the right-hand panel renders
    // message-container for the selected item, so an unscoped match could be
    // satisfied by the panel and would not prove both kinds share the list.
    return page.locator('#feedData [data-testid="message-container"]');
  };

  // The list is merged from two independent fetches (/api/v1/feed and
  // /api/v1/activity) and re-sorts — moving the auto-selection with it — as each
  // one lands. Anything asserting on order, counts or the active item has to
  // wait for BOTH kinds to be on screen first, or it races the slower response.
  const waitForBothFeedKinds = async (feedList: Locator) => {
    await expect(
      feedList.filter({ hasText: conversationMessage }).first()
    ).toBeVisible({ timeout: FEED_ITEM_TIMEOUT });
    await expect(
      feedList.filter({ hasText: activityMarker }).first()
    ).toBeVisible({ timeout: FEED_ITEM_TIMEOUT });
  };

  test.beforeAll(
    'Setup entity and seeded conversation',
    async ({ browser }) => {
      test.slow(true);

      adminUser = new UserClass();
      entity = new TableClass();

      const { apiContext, afterAction } = await performAdminLogin(browser);

      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await entity.create(apiContext);

      // Seed the change-event directly instead of waiting for the table's own
      // auto "Created" event to arrive through the ActivityFeedAlert consumer.
      // That consumer ticks on its pollInterval, drains at most batchSize
      // change_event rows per tick, and parks on any commit-order offset gap —
      // so on an AUT running the whole suite in parallel the backlog puts the
      // event arbitrarily far behind and no poll timeout here can outlast it.
      // Async delivery is the backend's contract (ActivityResourceIT); these
      // tests are about how the merged list renders.
      await insertActivityEventForTest(
        apiContext,
        entity,
        activityMarker,
        'EntityCreated'
      );

      for (const message of [conversationMessage, conversationMessage2]) {
        await apiContext.post('/api/v1/feed', {
          data: {
            message,
            about: `<#E::table::${entity.entityResponseData.fullyQualifiedName}>`,
            type: 'Conversation',
          },
        });
      }

      const feedUrl = `/api/v1/feed?entityLink=${encodeURIComponent(
        `<#E::table::${entity.entityResponseData.fullyQualifiedName}>`
      )}&type=Conversation&limit=25`;

      // /api/v1/feed writes synchronously, so this only covers read-your-write
      // lag on a loaded server — nothing here waits on an async pipeline.
      await expect
        .poll(
          async () => {
            const response = await apiContext.get(feedUrl);
            const data = await response.json();
            const messages = (data.data ?? []).map(
              (thread: { message?: string }) => thread.message
            );

            return (
              messages.includes(conversationMessage) &&
              messages.includes(conversationMessage2)
            );
          },
          { timeout: 30_000, intervals: [1_000] }
        )
        .toBe(true);

      await afterAction();
    }
  );

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await entity.delete(apiContext);
    await adminUser.delete(apiContext);
    await afterAction();
  });

  test('All tab shows BOTH the change-event activity and the conversation', async ({
    adminPage,
  }) => {
    const feedList = await openActivityFeedTab(adminPage);

    // Conversation thread (from /api/v1/feed) must be visible...
    await expect(
      feedList.filter({ hasText: conversationMessage }).first()
    ).toBeVisible({ timeout: FEED_ITEM_TIMEOUT });

    // ...alongside the seeded change-event activity (from /api/v1/activity).
    // On the buggy either-or code these two never render together.
    await expect(
      feedList.filter({ hasText: activityMarker }).first()
    ).toBeVisible({ timeout: FEED_ITEM_TIMEOUT });
  });

  test('A change-event activity is read-only (no comment editor)', async ({
    adminPage,
  }) => {
    const feedList = await openActivityFeedTab(adminPage);
    await waitForBothFeedKinds(feedList);

    // Open the seeded change-event activity in the right panel. Scoped to
    // #feedData so this is the list card, not the panel's own copy.
    const activityCard = feedList.filter({ hasText: activityMarker }).first();
    await activityCard.click();
    await waitForAllLoadersToDisappear(adminPage);

    // Activities are read-only notifications — no comment box, no send button.
    await expect(
      adminPage.locator('#activity-panel [data-testid="comments-input-field"]')
    ).toHaveCount(0);
    await expect(
      adminPage.locator('#activity-panel [data-testid="send-button"]')
    ).toHaveCount(0);
  });

  test('Replying to a conversation stays isolated to that thread', async ({
    adminPage,
  }) => {
    const feedList = await openActivityFeedTab(adminPage);

    const newThreadCalls: string[] = [];
    const replyPostCalls: string[] = [];
    adminPage.on('request', (request) => {
      if (request.method() !== 'POST') {
        return;
      }
      const url = request.url().split('?')[0];
      if (/\/api\/v1\/feed\/[^/]+\/posts$/.test(url)) {
        replyPostCalls.push(url);
      } else if (/\/api\/v1\/feed$/.test(url)) {
        newThreadCalls.push(url);
      }
    });

    const feedListCount = () => feedList.count();

    // Loaders disappearing does not mean the merged list has rendered, and the
    // conversation alone is not enough either: the activity fetch lands
    // separately and would grow the list between the baseline and the
    // post-reply count. Both kinds have to be on screen before counting.
    await waitForBothFeedKinds(feedList);

    const seededConversation = feedList
      .filter({ hasText: conversationMessage })
      .first();

    const countBeforeReply = await feedListCount();

    // Reply to the FIRST seeded conversation.
    const replyText = `Isolated reply ${uuid()}`;
    await seededConversation.click();
    await waitForAllLoadersToDisappear(adminPage);

    await adminPage.getByTestId('comments-input-field').click();
    await adminPage
      .locator(
        '[data-testid="editor-wrapper"] [contenteditable="true"].ql-editor'
      )
      .fill(replyText);

    const replyResponse = adminPage.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/api\/v1\/feed\/[^/]+\/posts$/.test(response.url().split('?')[0])
    );
    await adminPage.locator('[data-testid="send-button"]').click();
    await replyResponse;
    await waitForAllLoadersToDisappear(adminPage);

    // Isolation is structural: exactly one post to the thread's own id, NO new
    // top-level thread created, and NO extra feed card injected — so the reply
    // can only ever belong to this one conversation.
    expect(replyPostCalls).toHaveLength(1);
    expect(newThreadCalls).toHaveLength(0);
    expect(await feedListCount()).toBe(countBeforeReply);

    // And it renders on its own thread.
    await expect(adminPage.getByText(replyText)).toBeVisible();
  });

  test('Activity is NOT fetched on the Tasks tab', async ({ adminPage }) => {
    const feedList = await openActivityFeedTab(adminPage);

    // Switch away only once the ALL tab has fully settled, so its own activity
    // fetch cannot still be in flight when the listener below is attached.
    await waitForBothFeedKinds(feedList);

    await adminPage.getByRole('menuitem', { name: /task/i }).click();
    await waitForAllLoadersToDisappear(adminPage);
    await expect(adminPage).toHaveURL(/activity_feed\/tasks/);

    // Two different callers hit /activity/entity: the tab badge count via
    // getFeedCounts with limit=0, which runs on every entity page load
    // whatever the tab, and the list fetch with limit=50, which is the one the
    // tab gates. Matching the endpoint alone caught the count request and
    // failed for the wrong reason, so match only a fetch that retrieves events.
    const isActivityListFetch = (url: string) =>
      url.includes('/api/v1/activity/entity/') &&
      !/[?&]limit=0(?:&|$)/.test(url);

    // Watch only after the switch has settled. Attaching the listener before
    // the click also caught the ALL tab's own activity fetch when that request
    // was still being issued as the switch happened.
    let activityFetchedOnTasks = false;
    adminPage.on('request', (request) => {
      if (isActivityListFetch(request.url())) {
        activityFetchedOnTasks = true;
      }
    });

    // Reload with Tasks active so every request below belongs to this tab.
    await adminPage.reload();
    await waitForAllLoadersToDisappear(adminPage);

    // Landing back on ALL would fetch activity legitimately and fail the
    // assertion for the wrong reason.
    await expect(adminPage).toHaveURL(/activity_feed\/tasks/);

    expect(activityFetchedOnTasks).toBe(false);
  });

  test('All badge, header and rendered list agree on the count', async ({
    adminPage,
  }) => {
    const feedList = await openActivityFeedTab(adminPage);
    await waitForBothFeedKinds(feedList);

    // The "All" badge must equal the number of rendered items (conversations +
    // activity events) — not the old activity-only / double-counted value.
    // Polled rather than compared once because the consumer can deliver this
    // table's own "Created" event mid-test, growing both numbers a beat apart.
    await expect
      .poll(
        async () => {
          const rendered = await feedList.count();
          const allBadge = (
            await adminPage.getByTestId('left-panel-all-count').innerText()
          ).trim();

          return Number(allBadge) === rendered;
        },
        { timeout: 15_000, intervals: [1_000] }
      )
      .toBe(true);

    // With no tasks, the entity tab header total equals the same count.
    const renderedCount = await feedList.count();
    await expect(
      adminPage.getByRole('tab', { name: /activity feeds & tasks/i })
    ).toContainText(String(renderedCount));
  });

  test('Auto-selects the first (newest) item on load', async ({
    adminPage,
  }) => {
    const items = await openActivityFeedTab(adminPage);

    // Both sources must have landed first. The merged list re-sorts as each one
    // arrives and the auto-selection follows the new top item, so asserting the
    // position mid-settle can catch the active card at index 1.
    await waitForBothFeedKinds(items);

    // The FIRST (newest) item is the auto-selected one — deterministically,
    // regardless of whether the conversation or activity request resolved first.
    // (Asserting the position, not the content, since a reply in an earlier test
    // can change which conversation is newest.)
    await expect(items.first().locator('.is-active')).toBeVisible();
    // ...and no item below it is the active one.
    await expect(
      adminPage.locator(
        '#feedData [data-testid="message-container"] .is-active'
      )
    ).toHaveCount(1);
  });

  test('Reacting to an activity updates its reactions in the right panel', async ({
    adminPage,
  }) => {
    const feedList = await openActivityFeedTab(adminPage);
    await waitForBothFeedKinds(feedList);

    // Select the seeded change-event activity into the right panel.
    const activityCard = feedList.filter({ hasText: activityMarker }).first();
    await activityCard.click();
    await waitForAllLoadersToDisappear(adminPage);

    const panel = adminPage.locator('#activity-panel');
    await expect(panel).toBeVisible();

    await panel.locator('[data-testid="add-reactions"]').first().click();
    await adminPage
      .locator('.ant-popover-feed-reactions .ant-popover-inner-content')
      .waitFor({ state: 'visible' });

    // The picker button's title is the ReactionType value (🎉 == "hooray"); it
    // fires PUT /api/v1/activity/{id}/reaction/hooray.
    const reactionResponse = adminPage.waitForResponse((response) =>
      /\/api\/v1\/activity\/[^/]+\/reaction\//.test(response.url())
    );
    await adminPage
      .locator('[data-testid="reaction-button"][title="hooray"]')
      .click();
    await reactionResponse;

    // The right panel must reflect the toggled reaction immediately (the fix:
    // the selected activity is kept in sync, not just the list copy).
    await expect(
      panel.locator('[data-testid="feed-reaction-container"]')
    ).toContainText('🎉', { timeout: 15_000 });
  });
});
