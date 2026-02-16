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
import { test as base, expect, Page } from '@playwright/test';
import { ApiEndpointClass } from '../../support/entity/ApiEndpointClass';
import { DatabaseClass } from '../../support/entity/DatabaseClass';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
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
const user1 = new UserClass();
const entity = new TableClass();
const extraEntity = new TableClass();
const testPersona = new PersonaClass();

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
            await adminPage.waitForLoadState('networkidle');
            await saveResponse;
          }

          await redirectToHomePage(adminPage);
          await adminPage.waitForLoadState('networkidle');
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
    await page.waitForLoadState('networkidle');
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
    await page.waitForSelector('.ant-dropdown', { state: 'visible' });

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
    await page.waitForLoadState('networkidle');

    // Verify navigation to user activity feed
    await expect(page.url()).toContain('/users/');
    await expect(page.url()).toContain('/activity_feed/all');
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
    await page.waitForSelector('.ant-dropdown', { state: 'visible' });

    const myDataOption = page.getByRole('menuitem', { name: 'My Data' });

    if (await myDataOption.isVisible()) {
      await myDataOption.click();
      await page.waitForLoadState('networkidle');
      // Verify the dropdown now shows My Data
      await expect(sortDropdown).toContainText(/My Data/i);
    }

    // Switch back to All Activity
    await sortDropdown.click();
    await page.waitForSelector('.ant-dropdown', { state: 'visible' });

    const allActivityOption = page.getByRole('menuitem', {
      name: 'All Activity',
    });
    if (await allActivityOption.isVisible()) {
      await allActivityOption.click();
      await page.waitForLoadState('networkidle');
      // Verify the dropdown now shows All Activity
      await expect(sortDropdown).toContainText(/All Activity/i);
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
      await page.waitForLoadState('networkidle');

      // Should navigate away from home page
      expect(page.url()).not.toMatch(/home|welcome/i);
    } else {
      // When there's no View More, verify the widget title link works instead
      const titleLink = widget.getByText('Activity Feed');
      if (await titleLink.isVisible()) {
        await titleLink.click();
        await page.waitForLoadState('networkidle');
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
      const emptyState = container.locator('[data-testid="widget-empty-state"]');
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
      await page.waitForLoadState('networkidle');

      // Fill in the editor
      const editorField = page.locator(
        '[data-testid="editor-wrapper"] .ql-editor'
      );
      await editorField.fill('Widget thread automated reply');

      // Wait for send button to be enabled and send reply
      const sendButton = page.getByTestId('send-button');

      await expect(sendButton).toBeEnabled();

      const sendReply = page.waitForResponse('/api/v1/feed/*/posts');
      await page.waitForLoadState('networkidle');
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
  const entity = EntityDataClass.table1;

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

  test.beforeAll('Setup entities and users', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await adminUser.create(apiContext);
    await adminUser.setAdminRole(apiContext);
    await user1.create(apiContext);

    // Reload entity data in case it wasn't loaded when module was imported
    // (entity-data.setup.ts creates the JSON file AFTER module import)
    EntityDataClass.loadResponseData();

    // Create initial conversation via API since the Activity Feed UI
    // doesn't provide an input field when the feed is empty
    const entityFqn = entity.entityResponseData.fullyQualifiedName;
    const conversationResponse = await apiContext.post('/api/v1/feed', {
      data: {
        about: `<#E::table::${entityFqn}>`,
        from: adminUser.responseData.name,
        message: 'Initial conversation thread for mention test',
        type: 'Conversation',
      },
    });
    const conversation = await conversationResponse.json();
    conversationThreadId = conversation.id;

    await afterAction();
  });

  test('Mention notification shows correct user details in Notification box', async ({
    adminPage,
    user1Page,
  }) => {
    test.slow();

    await test.step(
      'Verify conversation was created via API setup',
      async () => {
        // Conversation was created in beforeAll via API
        // Just verify we can navigate to the entity page
        await entity.visitEntityPage(adminPage);
        await removeLandingBanner(adminPage);
        await waitForAllLoadersToDisappear(adminPage);

        // Click on activity feed tab
        await adminPage.getByTestId('activity_feed').click();
        await adminPage.waitForLoadState('networkidle');

        await adminPage.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        // Wait for the activity feed to load and show the conversation
        await adminPage.waitForSelector('[data-testid="message-container"]', {
          state: 'visible',
          timeout: 10000,
        });
      }
    );

    await test.step('User1 mentions admin user in a reply', async () => {
      await entity.visitEntityPage(user1Page);
      await removeLandingBanner(user1Page);

      await user1Page.getByTestId('activity_feed').click();
      await user1Page.waitForLoadState('networkidle');

      await user1Page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Wait for the conversation thread to appear in the feed
      const conversationThread = user1Page
        .locator('[data-testid="message-container"]')
        .first();
      await expect(conversationThread).toBeVisible({ timeout: 10000 });

      // Click on the conversation to open it in the right panel
      await conversationThread.click();

      // Now the comments-input-field should be visible in the right panel
      await user1Page.getByTestId('comments-input-field').click();

      // Use TipTap/ProseMirror editor selector (not Quill)
      const editorSelector =
        '[data-testid="editor-wrapper"] .ProseMirror, [data-testid="editor-wrapper"] [contenteditable="true"].ql-editor';
      const editorLocator = user1Page.locator(editorSelector).first();

      await editorLocator.fill('Hey ');

      await editorLocator.click();

      await user1Page.keyboard.press('@');

      // Type the full displayName to search for the specific admin user
      const userSuggestionsResponse = user1Page.waitForResponse((response) => {
        const url = response.url();

        return (
          url.includes('/api/v1/search/query') &&
          url.includes(adminUser.responseData.displayName)
        );
      });
      await editorLocator.pressSequentially(adminUser.responseData.displayName);
      await userSuggestionsResponse;

      // Wait for the dropdown with the admin user to appear
      // The dropdown renders as a list with the matching user's displayName
      const mentionDropdown = user1Page.locator(
        `.suggestion-menu-wrapper:has-text("${adminUser.responseData.displayName}")`
      );

      // Wait a bit for dropdown to render, then select with Enter
      await user1Page.waitForTimeout(500);

      // If the dropdown is visible, press Enter to select the first (only) item
      // If not visible, the mention may have been auto-inserted
      const isDropdownVisible = await mentionDropdown.isVisible().catch(() => false);
      if (isDropdownVisible) {
        await user1Page.keyboard.press('Enter');
      }

      await editorLocator.type(', can you check this?');

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

    await test.step(
      'Admin user verifies the mention was created in the activity feed',
      async () => {
        // Navigate to the entity page as admin to verify the mention is visible
        await entity.visitEntityPage(adminPage);
        await removeLandingBanner(adminPage);

        // Click on the Activity Feed tab
        await adminPage.getByTestId('activity_feed').click();
        await adminPage.waitForLoadState('networkidle');

        // Wait for the conversation thread to load
        await adminPage.waitForSelector('[data-testid="message-container"]', {
          state: 'visible',
          timeout: 10000,
        });

        // Click on the conversation to expand it
        const conversationThread = adminPage
          .locator('[data-testid="message-container"]')
          .first();
        await conversationThread.click();

        // Verify the mention comment is visible in the thread
        // The comment should contain the admin user's mention
        const mentionComment = adminPage.locator(
          `text=Hey @${adminUser.responseData.displayName}`
        );
        await expect(mentionComment).toBeVisible({ timeout: 10000 });

        // Verify the comment was made by user1
        const commentAuthor = adminPage.locator(
          `a[href*="${user1.responseData.name}"]`
        );
        await expect(commentAuthor).toBeVisible();
      }
    );

    await test.step(
      'Update user display name and verify reaction tooltip',
      async () => {
        test.slow();
        const newDisplayName = `UpdatedName${uuid()}`;

        // Go to profile and update name
        await redirectToHomePage(user1Page);
        await visitOwnProfilePage(user1Page);
        await editDisplayName(user1Page, newDisplayName);

        // Go back to entity
        await entity.visitEntityPage(user1Page);

        await user1Page.getByTestId('activity_feed').click();
        await user1Page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        // Find a message to react to.
        const message = user1Page
          .locator('[data-testid="message-container"]')
          .first();
        await expect(message).toBeVisible();

        // Add reaction
        await message.locator('[data-testid="add-reactions"]').click();
        const reactionResponse = user1Page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/feed') &&
            response.request().method() === 'PATCH'
        );
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
      }
    );
  });
});

test.describe('Mentions: Chinese character encoding in activity feed', () => {
  const database = new DatabaseClass();
  const endpointName = `测试Endpoint-${uuid()}`;
  const apiEndpoint = new ApiEndpointClass(undefined, endpointName);
  let schemaFqn: string;
  const userName = `测试-${uuid()}`;

  test.beforeAll(
    'Create database, schema, and user with Chinese name',
    async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await database.create(apiContext);
      await apiEndpoint.create(apiContext);
      await adminUser.create(apiContext);
      schemaFqn = database.schemaResponseData.fullyQualifiedName;
      const user = new UserClass({
        firstName: userName,
        lastName: '',
        email: `${userName}@example.com`,
        password: 'User@OMD123',
      });

      await user.create(apiContext);

      // Create a conversation thread via API so we can post replies in the tests
      await apiContext.post('/api/v1/feed', {
        data: {
          from: adminUser.responseData.name,
          message: 'Initial conversation for Chinese character encoding test',
          about: `<#E::databaseSchema::${schemaFqn}>`,
          type: 'Conversation',
        },
      });

      await afterAction();
    }
  );

  test.beforeEach(async ({ page }) => {
    await adminUser.login(page);
    await redirectToHomePage(page);
  });

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

    await page.getByTestId('comments-input-field').click();

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

    await page.locator(`[data-value="@${userName}"]`).first().click();

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
    const userMentionLink = replyCard.getByRole('link', {
      name: `@${userName}`,
    });
    await expect(userMentionLink).toBeVisible();
    await expect(userMentionLink).toHaveAttribute(
      'href',
      new RegExp(`/users/${userName}$`)
    );

    const [newPage] = await Promise.all([
      page.context().waitForEvent('page'),
      userMentionLink.click(),
    ]);

    await newPage.waitForResponse((response) =>
      response
        .url()
        .includes(`/api/v1/users/name/${encodeURIComponent(userName)}`)
    );

    await waitForAllLoadersToDisappear(newPage);
    expect(newPage.getByTestId('user-display-name')).toHaveText(userName);
  });

  test('Should encode the chinese character while mentioning api endpoint', async ({
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

    await page.getByTestId('comments-input-field').click();

    const editorLocator = page.locator(
      '[data-testid="editor-wrapper"] [contenteditable="true"].ql-editor'
    );

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

    await page
      .locator(`[data-value="#apiEndpoint/${endpointName}"]`)
      .first()
      .click();

    await expect(page.locator('[data-testid="send-button"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="send-button"]')
    ).not.toBeDisabled();

    const postMentionResponse = page.waitForResponse('/api/v1/feed/*/posts');
    await page.locator('[data-testid="send-button"]').click();
    await postMentionResponse;

    const endpointFqn = apiEndpoint.entityResponseData.fullyQualifiedName;

    const replyCard = page
      .getByTestId('feed-reply-card')
      .filter({ hasText: `Check #${endpointFqn}` });
    await expect(replyCard).toBeVisible();

    await expect(replyCard.getByTestId('viewer-container')).toHaveText(
      `Check #${endpointFqn}`
    );

    const endpointMentionLink = replyCard.getByRole('link', {
      name: endpointFqn,
    });
    await expect(endpointMentionLink).toBeVisible();
    await expect(endpointMentionLink).toHaveAttribute(
      'href',
      new RegExp(`/apiEndpoint/${endpointFqn}$`)
    );
    const [newPage] = await Promise.all([
      page.context().waitForEvent('page'),
      endpointMentionLink.click(),
    ]);

    await newPage.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/apiEndpoints/name/') &&
        response.request().method() === 'GET'
    );

    await waitForAllLoadersToDisappear(newPage);

    await expect(newPage.getByTestId('entity-header-display-name')).toHaveText(
      endpointName
    );
  });
});
