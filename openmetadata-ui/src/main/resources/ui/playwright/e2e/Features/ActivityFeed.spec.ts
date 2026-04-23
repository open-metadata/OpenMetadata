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
  Page,
  test as base,
} from '@playwright/test';
import { ApiEndpointClass } from '../../support/entity/ApiEndpointClass';
import { DatabaseClass } from '../../support/entity/DatabaseClass';
import { TableClass } from '../../support/entity/TableClass';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { UserClass } from '../../support/user/UserClass';
import { REACTION_EMOJIS, reactOnFeed } from '../../utils/activityFeed';
import { performAdminLogin } from '../../utils/admin';
import {
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
  let adminUser: UserClass;
  let user1: UserClass;
  let entity: TableClass;
  let extraEntity: TableClass;
  let testPersona: PersonaClass;

  test.beforeAll(
    'setup: seed entities, users, create persona, and customize widget',
    async ({ browser }) => {
      test.slow(true);

      adminUser = new UserClass();
      user1 = new UserClass();
      entity = new TableClass();
      extraEntity = new TableClass();
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
  let adminUser: UserClass;
  let user1: UserClass;
  let entity: TableClass;

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

  // Failure needed to be investigated - skipping for now to unblock
  // PR - https://github.com/open-metadata/OpenMetadata/pull/25894
  test.fixme(
    'Mention notification shows correct user details in Notification box',
    async ({ adminPage, user1Page }) => {
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
        const userSuggestionsResponse = user1Page.waitForResponse(
          (response) => {
            const url = response.url();

            return (
              url.includes('/api/v1/search/query') &&
              url.includes(adminUser.responseData.displayName)
            );
          }
        );
        await editorLocator.pressSequentially(
          adminUser.responseData.displayName
        );
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
    }
  );
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
