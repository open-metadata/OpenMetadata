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
import { APIRequestContext, expect, Page, test as base } from '@playwright/test';
import { ApiEndpointClass } from '../../support/entity/ApiEndpointClass';
import { DatabaseClass } from '../../support/entity/DatabaseClass';
import { TableClass } from '../../support/entity/TableClass';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { UserClass } from '../../support/user/UserClass';
import { REACTION_EMOJIS, reactOnFeed } from '../../utils/activityFeed';
import { performAdminLogin } from '../../utils/admin';
import {
  getApiContext,
  redirectToHomePage,
  removeLandingBanner,
  uuid,
  visitOwnProfilePage,
} from '../../utils/common';
import {
  navigateToCustomizeLandingPage,
  setUserDefaultPersona,
} from '../../utils/customizeLandingPage';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { editDisplayName } from '../../utils/user';

const test = base;

const adminUser = new UserClass();
const user1 = new UserClass();
const entity = new TableClass();
const extraEntity = new TableClass();
const testPersona = new PersonaClass();

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

test.describe('FeedWidget on landing page', () => {
  test.beforeAll(
    'setup: seed entities, users, create persona, and customize widget',
    async ({ browser }) => {
      test.slow(true);

      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        // Create users and entities
        await adminUser.create(apiContext);
        await adminUser.setAdminRole(apiContext);
        await user1.create(apiContext);
        await entity.create(apiContext);
        await extraEntity.create(apiContext);
        await testPersona.create(apiContext, [adminUser.responseData.id]);

        // Set up widget in a separate page context
        const adminPage = await browser.newPage();
        await adminUser.login(adminPage);

        try {
          // Set persona as default
          await redirectToHomePage(adminPage);
          await removeLandingBanner(adminPage);
          await waitForAllLoadersToDisappear(adminPage);
          await setUserDefaultPersona(adminPage, testPersona.data.displayName);

          // Navigate to customize landing page
          await navigateToCustomizeLandingPage(adminPage, {
            personaName: testPersona.data.name,
          });

          // Ensure Activity Feed widget is full size
          const activityFeedWidget = adminPage.getByTestId(
            'KnowledgePanel.ActivityFeed'
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
          await removeLandingBanner(adminPage);
          await waitForAllLoadersToDisappear(adminPage);
        } finally {
          await adminPage.close();
        }
      } finally {
        await afterAction();
      }
    }
  );

  test.beforeEach(async ({ page }) => {
    await adminUser.login(page);
    await redirectToHomePage(page);
    await removeLandingBanner(page);
    await waitForAllLoadersToDisappear(page);
  });

  test('renders widget wrapper and header with sort dropdown', async ({
    page,
  }) => {
    const widget = page.getByTestId('KnowledgePanel.ActivityFeed');

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
    const widget = page.getByTestId('KnowledgePanel.ActivityFeed');

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

  test('feed body renders content or empty state', async ({ page }) => {
    const widget = page.getByTestId('KnowledgePanel.ActivityFeed');

    await expect(widget).toBeVisible();

    // Wait for feed content to load
    const container = page.locator('#feedWidgetData');

    await expect(container).toBeVisible();

    // Check for either content or any type of empty state
    const messageContainers = container.locator(
      '[data-testid="message-container"]'
    );
    const emptyState = container.locator(
      '[data-testid="no-data-placeholder-container"]'
    );
    const widgetEmptyState = container.locator(
      '[data-testid="widget-empty-state"]'
    );

    const hasMessages = (await messageContainers.count()) > 0;
    const hasEmpty = (await emptyState.count()) > 0;
    const hasWidgetEmpty = (await widgetEmptyState.count()) > 0;

    expect(hasMessages || hasEmpty || hasWidgetEmpty).toBe(true);
  });

  test('changing filter triggers feed reload', async ({ page }) => {
    const widget = page.getByTestId('KnowledgePanel.ActivityFeed');

    await expect(widget).toBeVisible();

    const sortDropdown = widget.getByTestId('widget-sort-by-dropdown');

    await expect(sortDropdown).toBeVisible();

    // Switch to My Data filter
    await sortDropdown.click();
    await page.locator('.ant-dropdown').waitFor({ state: 'visible' });

    const myDataOption = page.getByRole('menuitem', { name: 'My Data' });

    await myDataOption.click();

    // Wait for dropdown to close after selection
    await expect(page.locator('.ant-dropdown')).not.toBeVisible();

    // Switch back to All Activity
    await sortDropdown.click();
    await page.locator('.ant-dropdown').waitFor({ state: 'visible' });

    const allActivityOption = page.getByRole('menuitem', {
      name: 'All Activity',
    });
    if (await allActivityOption.isVisible()) {
      await allActivityOption.click();
      await expect(page.locator('.ant-dropdown')).not.toBeVisible();
    }
  });

  test('footer shows view more link when applicable', async ({ page }) => {
    const widget = page.getByTestId('KnowledgePanel.ActivityFeed');

    await expect(widget).toBeVisible();

    // Check if View More link exists (only visible when there are enough feed items)
    const viewMoreLink = widget.getByRole('link', { name: /View More/i });

    // View More is only shown when activityEvents.length > PAGE_SIZE_BASE
    const isViewMoreVisible = await viewMoreLink
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (isViewMoreVisible) {
      // Click and verify navigation
      await viewMoreLink.click();

      // Should navigate away from home page
      expect(page.url()).not.toMatch(/home|welcome/i);
    } else {
      // When there's no View More, verify the widget title link works instead
      const titleLink = widget.getByText('Activity Feed');
      if (await titleLink.isVisible()) {
        await titleLink.click();
        // Should navigate to user activity feed
        expect(page.url()).toContain('/users/');
      }
    }
  });

  test('feed cards render with proper structure when available', async ({
    page,
  }) => {
    const container = page.locator('#feedWidgetData');

    await expect(container).toBeVisible();

    const messageContainers = container.locator(
      '[data-testid="message-container"]'
    );

    // When there's no feed data, the widget shows empty state instead of cards
    if ((await messageContainers.count()) === 0) {
      // Verify empty state is shown
      const emptyState = container.locator(
        '[data-testid="widget-empty-state"]'
      );
      const placeholderContainer = container.locator(
        '[data-testid="no-data-placeholder-container"]'
      );
      const hasEmpty =
        (await emptyState.count()) > 0 ||
        (await placeholderContainer.count()) > 0;
      expect(hasEmpty).toBe(true);

      return;
    }

    const firstCard = messageContainers.first();

    await expect(firstCard).toBeVisible();

    // Verify typical feed card elements
    const headerText = firstCard.locator('[data-testid="headerText"]');
    const timestamp = firstCard.locator('[data-testid="timestamp"]');

    // Check elements exist if available
    if ((await headerText.count()) > 0) {
      await expect(headerText).toBeVisible();
    }
    if ((await timestamp.count()) > 0) {
      await expect(timestamp).toBeVisible();
    }
  });

  test('emoji reactions can be added when feed messages exist', async ({
    page,
  }) => {
    const messages = page.locator('[data-testid="message-container"]');
    if ((await messages.count()) === 0) {
      // nothing to react to; skip gracefully
      return;
    }

    const firstMessage = messages.first();

    await expect(firstMessage).toBeVisible();

    // Add reactions using helper (acts on the first feed index 1)
    await reactOnFeed(page, 1);

    // Verify reactions are visible
    const reactionContainer = firstMessage.locator(
      '[data-testid="feed-reaction-container"]'
    );

    await expect(reactionContainer).toBeVisible();

    for (const emoji of REACTION_EMOJIS) {
      await expect(reactionContainer).toContainText(emoji);
    }

    // Toggle off the same reactions
    await reactOnFeed(page, 1);

    // Container remains visible even if counts change
    await expect(reactionContainer).toBeVisible();
  });

  test('thread drawer opens from reply count and allows posting a reply', async ({
    page,
  }) => {
    const messages = page.locator('[data-testid="message-container"]');

    // Skip if no messages available
    if ((await messages.count()) === 0) {
      return;
    }

    const firstMessage = messages.first();

    await expect(firstMessage).toBeVisible();

    // Open thread drawer via reply count or clicking the card
    const replyCountBtn = firstMessage.locator('[data-testid="reply-count"]');

    if ((await replyCountBtn.count()) > 0) {
      await replyCountBtn.click();
    } else {
      await firstMessage.click();
    }

    // Wait for drawer to appear
    const drawer = page.locator('.ant-drawer-content');

    await expect(drawer).toBeVisible();

    // Try to post a reply if comment input is available
    const commentInput = drawer.locator('[data-testid="comments-input-field"]');

    if (await commentInput.count()) {
      await commentInput.click();

      // Fill in the editor
      const editorField = page.locator(
        '[data-testid="editor-wrapper"] .ql-editor'
      );
      await editorField.fill('Widget thread automated reply');

      // Wait for send button to be enabled and send reply
      const sendButton = page.getByTestId('send-button');

      await expect(sendButton).toBeEnabled();

      const sendReply = page.waitForResponse('/api/v1/feed/*/posts');
      await sendButton.click();
      await sendReply;

      // Verify reply appears
      await expect(
        drawer.locator('[data-testid="feed-replies"]')
      ).toContainText('Widget thread automated reply');
    }

    // Close drawer
    const closeBtn = drawer.locator('[data-testid="closeDrawer"]');
    if (await closeBtn.count()) {
      await closeBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }

    // Verify drawer is closed
    await expect(drawer).not.toBeVisible();
  });
});

test.describe('Mention notifications in Notification Box', () => {
  const adminUser = new UserClass();
  const user1 = new UserClass();
  const entity = new TableClass();

  const test = base.extend<{
    adminPage: Page;
    user1Page: Page;
  }>({
    adminPage: async ({ browser }, use) => {
      const page = await browser.newPage();
      await adminUser.login(page);
      await use(page);
      await page.close();
    },
    user1Page: async ({ browser }, use) => {
      const page = await browser.newPage();
      await user1.login(page);
      await use(page);
      await page.close();
    },
  });

  let conversationThreadId: string;
  const conversationSeedText = 'Initial conversation thread for mention test';

  const openEntityActivityFeed = async (page: Page) => {
    const entityFqn = entity.entityResponseData.fullyQualifiedName;
    const feedPromise = page.waitForResponse((response) => {
      const url = response.url();

      return (
        url.includes('/api/v1/feed') &&
        url.includes('entityLink=') &&
        url.includes('type=Conversation') &&
        response.request().method() === 'GET'
      );
    });

    await page.goto(
      `/table/${encodeURIComponent(entityFqn)}/activity_feed/all`
    );
    await feedPromise;
    await waitForAllLoadersToDisappear(page);
    await expect(page.getByTestId('entity-header-name')).toBeVisible();
  };

  test.beforeAll('Setup entities and users', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await adminUser.create(apiContext);
    await adminUser.setAdminRole(apiContext);
    await user1.create(apiContext);
    await entity.create(apiContext);

    // Create initial conversation via API since the Activity Feed UI
    // doesn't provide an input field when the feed is empty
    const entityFqn = entity.entityResponseData.fullyQualifiedName;
    const conversationResponse = await apiContext.post('/api/v1/feed', {
      data: {
        about: `<#E::table::${entityFqn}>`,
        from: adminUser.responseData.name,
        message: conversationSeedText,
        type: 'Conversation',
      },
    });
    const conversation = await conversationResponse.json();
    conversationThreadId = conversation.id;
    await waitForConversationMaterialization({
      apiContext,
      entityLink: `<#E::table::${entityFqn}>`,
      threadId: conversationThreadId,
      message: conversationSeedText,
    });
    await afterAction();
  });

  test('Mention notification shows correct user details in Notification box', async ({
    adminPage,
    user1Page,
  }) => {
    test.slow();

    await test.step('Admin user creates a conversation on an entity', async () => {
      await openEntityActivityFeed(adminPage);
      const commentsInput = adminPage.getByTestId('comments-input-field');

      if (!(await commentsInput.isVisible().catch(() => false))) {
        const seededThread = adminPage
          .locator(
            '[data-testid="message-container"], [data-testid="feed-reply-card"]'
          )
          .filter({ hasText: conversationSeedText })
          .first();

        await expect(seededThread).toBeVisible({ timeout: 30_000 });
        await seededThread.click();
        await waitForAllLoadersToDisappear(adminPage);
      }

      await commentsInput.click();

      await adminPage
        .locator(
          '[data-testid="editor-wrapper"] [contenteditable="true"].ql-editor'
        )
        .fill(conversationSeedText);

      await expect(
        adminPage.locator('[data-testid="send-button"]')
      ).toBeVisible();
      await expect(
        adminPage.locator('[data-testid="send-button"]')
      ).not.toBeDisabled();

      const postConversation = adminPage.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/feed') &&
          response.request().method() === 'POST' &&
          response.url().includes('/posts')
      );
      await adminPage.locator('[data-testid="send-button"]').click();
      await postConversation;
    });

    await test.step('User1 mentions admin user in a reply', async () => {
      const { apiContext, afterAction } = await getApiContext(user1Page);

      try {
        const postMentionResponse = await apiContext.post(
          `/api/v1/feed/${conversationThreadId}/posts`,
          {
            data: {
              from: user1.responseData.name,
              message: `Hey <#E::user::${adminUser.responseData.name}>, can you check this?`,
            },
          }
        );

        expect(postMentionResponse.status()).toBe(201);
      } finally {
        await afterAction();
      }
    });

    await test.step('Admin user checks notification for correct user and timestamp', async () => {
      const { apiContext, afterAction } = await getApiContext(adminPage);

      try {
        const loggedInUserResponse = await apiContext.get(
          '/api/v1/users/loggedInUser'
        );
        const loggedInUser = await loggedInUserResponse.json();

        await expect
          .poll(
            async () => {
              const mentionsResponse = await apiContext.get('/api/v1/feed', {
                params: {
                  userId: loggedInUser.id,
                  filterType: 'MENTIONS',
                },
              });
              const mentions = await mentionsResponse.json();

              return JSON.stringify(mentions.data ?? []);
            },
            {
              timeout: 60_000,
              intervals: [5_000],
            }
          )
          .toContain(user1.responseData.name);
      } finally {
        await afterAction();
      }

      await adminPage.reload();
      await waitForAllLoadersToDisappear(adminPage);
      const notificationBell = adminPage.getByTestId('task-notifications');

      await expect(notificationBell).toBeVisible();

      await notificationBell.click();
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

      const firstNotificationItem = notificationBox
        .locator('li.ant-list-item.notification-dropdown-list-btn:visible')
        .first();
      await expect(firstNotificationItem).toBeVisible();

      const firstNotificationText = await firstNotificationItem.textContent();

      expect(
        firstNotificationText
          ?.toLowerCase()
          .includes(user1.responseData.displayName.toLowerCase()) ||
          firstNotificationText
            ?.toLowerCase()
            .includes(user1.responseData.name.toLowerCase())
      ).toBe(true);
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
      const addReactionButton = message
        .locator('[data-testid="feed-reaction-container"]')
        .getByTestId('add-reactions');
      await expect(addReactionButton).toBeVisible();
      await addReactionButton.click();
      await user1Page
        .locator('.ant-popover-feed-reactions .ant-popover-inner-content')
        .waitFor({ state: 'visible' });
      const reactionResponse = user1Page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/feed/') &&
          ['PATCH', 'POST', 'PUT'].includes(response.request().method())
      );
      await user1Page
        .locator('[data-testid="reaction-button"][title="rocket"]')
        .click();
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
          from: adminUser.responseData.name,
          message: 'Initial conversation for Chinese character encoding test',
          about: `<#E::databaseSchema::${schemaFqn}>`,
          type: 'Conversation',
        },
      });
      const conversation = await conversationResponse.json();
      await waitForConversationMaterialization({
        apiContext,
        entityLink: `<#E::databaseSchema::${schemaFqn}>`,
        threadId: conversation.id,
        message: 'Initial conversation for Chinese character encoding test',
      });

      await afterAction();
    }
  );

  test.afterAll('Cleanup chinese mention fixtures', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      if (apiEndpoint.entityResponseData?.id) {
        await apiEndpoint.delete(apiContext);
      }

      if (database.responseData?.id) {
        await database.delete(apiContext);
      }

      if (chineseMentionUser.responseData?.id) {
        await chineseMentionUser.delete(apiContext);
      }

      if (adminUser.responseData?.id) {
        await adminUser.delete(apiContext);
      }
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

    const commentInput = page.getByTestId('comments-input-field');
    if (!(await commentInput.isVisible().catch(() => false))) {
      const seededThread = page
        .locator(
          '[data-testid="message-container"], [data-testid="feed-reply-card"]'
        )
        .filter({
          hasText: 'Initial conversation for Chinese character encoding test',
        })
        .first();

      await expect(seededThread).toBeVisible({ timeout: 30_000 });
      await seededThread.click();
      await waitForAllLoadersToDisappear(page);
    }

    await expect(commentInput).toBeVisible({ timeout: 10000 });
    await commentInput.click();

    const editorLocator = page.locator(
      '[data-testid="editor-wrapper"] .ProseMirror, [data-testid="editor-wrapper"] [contenteditable="true"].ql-editor'
    );
    await expect(editorLocator.first()).toBeVisible({ timeout: 10000 });

    return editorLocator.first();
  };

  const selectMentionSuggestion = async (
    page: Page,
    editorLocator: ReturnType<Page['locator']>,
    label: string
  ) => {
    await page.waitForTimeout(500);

    const editorText = await editorLocator.textContent();
    if (editorText?.includes(`@${label}`)) {
      return;
    }

    const mentionItem = page
      .locator('.mention-item')
      .filter({ hasText: label })
      .first();

    if (await mentionItem.isVisible().catch(() => false)) {
      await mentionItem.click();

      return;
    }

    const dropdown = page.locator('.suggestion-menu-wrapper');
    if (await dropdown.isVisible().catch(() => false)) {
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
    }
  };

  const selectHashSuggestion = async (
    page: Page,
    editorLocator: ReturnType<Page['locator']>,
    label: string
  ) => {
    await page.waitForTimeout(500);

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

  test('Should allow mentioning a user with Chinese characters in the activity feed', async ({
    page,
  }) => {
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
    const feedResponse = await feedPromise;
    expect(feedResponse.status()).toBe(200);
    await waitForAllLoadersToDisappear(page);

    const seededThread = page
      .locator('[data-testid="message-container"]')
      .filter({
        hasText: 'Initial conversation for Chinese character encoding test',
      })
      .first();

    await expect(seededThread).toBeVisible({ timeout: 30_000 });
    await seededThread.click();
    await waitForAllLoadersToDisappear(page);

    const commentsInput = page.getByTestId('comments-input-field');
    await expect(commentsInput).toBeVisible({ timeout: 10_000 });
    await commentsInput.click();

    const editorLocator = page.locator(
      '[data-testid="editor-wrapper"] [contenteditable="true"].ql-editor'
    );

    await editorLocator.fill('Hey ');

    await editorLocator.click();

    await page.keyboard.press('@');
    const userSuggestionsResponse = page.waitForResponse((response) => {
      const url = response.url();

      return (
        url.includes('/api/v1/search/query') &&
        url.includes(encodeURIComponent(userName))
      );
    });
    await editorLocator.pressSequentially(userName);
    await userSuggestionsResponse;

    await selectMentionSuggestion(page, editorLocator, userName);

    await expect(page.locator('[data-testid="send-button"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="send-button"]')
    ).not.toBeDisabled();

    const postMentionResponse = page.waitForResponse('/api/v1/feed/*/posts');
    await page.locator('[data-testid="send-button"]').click();
    await postMentionResponse;
    const replyCard = page
      .getByTestId('feed-reply-card')
      .filter({ hasText: `Hey @${userName}` });
    await expect(replyCard).toBeVisible();
    await expect(replyCard.getByTestId('viewer-container')).toHaveText(
      `Hey @${userName}`
    );
  });

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
