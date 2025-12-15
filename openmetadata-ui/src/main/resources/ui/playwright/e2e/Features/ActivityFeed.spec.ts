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
import { Page, test as base, expect } from '@playwright/test';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { TableClass } from '../../support/entity/TableClass';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { UserClass } from '../../support/user/UserClass';
import { REACTION_EMOJIS, reactOnFeed } from '../../utils/activityFeed';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import {
  navigateToCustomizeLandingPage,
  setUserDefaultPersona,
} from '../../utils/customizeLandingPage';
import { waitForAllLoadersToDisappear } from '../../utils/entity';

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

  test.afterAll(
    'cleanup: delete entities, users, and persona',
    async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        await entity.delete(apiContext);
        await extraEntity.delete(apiContext);
        await user1.delete(apiContext);
        await testPersona.delete(apiContext);
        await adminUser.delete(apiContext);
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

    // Check for either content or empty state
    const messageContainers = container.locator(
      '[data-testid="message-container"]'
    );
    const emptyState = container.locator(
      '[data-testid="no-data-placeholder-container"]'
    );

    const hasMessages = (await messageContainers.count()) > 0;
    const hasEmpty = (await emptyState.count()) > 0;

    expect(hasMessages || hasEmpty).toBe(true);
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

    const feedResponse = page.waitForResponse('/api/v1/feed*');
    await myDataOption.click();
    await page.waitForLoadState('networkidle');
    await feedResponse;

    // Switch back to All Activity
    await sortDropdown.click();
    await page.waitForSelector('.ant-dropdown', { state: 'visible' });

    const allActivityOption = page.getByRole('menuitem', {
      name: 'All Activity',
    });
    if (await allActivityOption.isVisible()) {
      const feedResponse = page.waitForResponse('/api/v1/feed*');
      await allActivityOption.click();
      await page.waitForLoadState('networkidle');
      await feedResponse;
    }
  });

  test('footer shows view more link when applicable', async ({ page }) => {
    const widget = page.getByTestId('KnowledgePanel.ActivityFeed');

    await expect(widget).toBeVisible();

    // Check if View More link exists
    const viewMoreLink = widget.getByRole('link', { name: /View More/i });

    await expect(viewMoreLink).toBeVisible();

    // Click and verify navigation
    await viewMoreLink.click();
    await page.waitForLoadState('networkidle');

    // Should navigate away from home page
    expect(page.url()).not.toMatch(/home|welcome/i);
  });

  test('feed cards render with proper structure when available', async ({
    page,
  }) => {
    const container = page.locator('#feedWidgetData');

    await expect(container).toBeVisible();

    const messageContainers = container.locator(
      '[data-testid="message-container"]'
    );

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

  test.beforeAll('Setup entities and users', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await adminUser.create(apiContext);
    await adminUser.setAdminRole(apiContext);
    await user1.create(apiContext);
    await afterAction();
  });

  test('Mention notification shows correct user details in Notification box', async ({
    adminPage,
    user1Page,
  }) => {
    test.slow();

    await test.step(
      'Admin user creates a conversation on an entity',
      async () => {
        await entity.visitEntityPage(adminPage);
        // Added a safety check on waiting for activity feed count to avoid missing feed
        // Poll the activity feed tab count from the page until it's a valid non-negative number
        let count = NaN;
        const maxRetries = 30;
        for (let i = 0; i < maxRetries && (isNaN(count) || count <= 0); i++) {
          const countText = await adminPage
            .getByRole('tab', { name: 'Activity Feeds & Tasks' })
            .getByTestId('count')
            .textContent();
          count = Number(countText ?? '0');
          if (isNaN(count) || count <= 0) {
            // wait for 2s before querying again
            await adminPage.waitForTimeout(2000);
            await adminPage.reload();
            await adminPage.waitForLoadState('networkidle');
            await waitForAllLoadersToDisappear(adminPage);
          }
        }

        await adminPage.getByTestId('activity_feed').click();
        await adminPage.waitForLoadState('networkidle');

        await adminPage.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await adminPage.getByTestId('comments-input-field').click();

        await adminPage
          .locator(
            '[data-testid="editor-wrapper"] [contenteditable="true"].ql-editor'
          )
          .fill('Initial conversation thread for mention test');

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
      }
    );

    await test.step('User1 mentions admin user in a reply', async () => {
      await entity.visitEntityPage(user1Page);

      await user1Page.getByTestId('activity_feed').click();
      await user1Page.waitForLoadState('networkidle');

      await user1Page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

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
      'Admin user checks notification for correct user and timestamp',
      async () => {
        await adminPage.reload();
        await adminPage.waitForLoadState('networkidle');
        const notificationBell = adminPage.getByTestId('task-notifications');

        await expect(notificationBell).toBeVisible();

        const feedResponseForNotifications =
          adminPage.waitForResponse(`api/v1/feed?userId=*`);

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
        await adminPage.waitForLoadState('networkidle');

        expect(adminPage.url()).toContain('activity_feed');
        expect(adminPage.url()).toContain('/all');
      }
    );
  });
});
