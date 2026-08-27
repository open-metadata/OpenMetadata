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
import { expect } from '@playwright/test';
import { DOMAIN_TAGS } from '../../constant/config';
import { TableClass } from '../../support/entity/TableClass';
import {
  createConversationThread,
  FEED_ITEM_TIMEOUT,
  getFeedItemByText,
  getTableLeafName,
  insertActivityEventForTest,
  THUMBS_UP_EMOJI,
  toggleThumbsUpReaction,
  visitTableActivityFeed,
} from '../../utils/activityAPI';
import { postActivityComment } from '../../utils/activityFeed';
import { createAdminApiContext } from '../../utils/admin';
import { getApiContext, redirectToHomePage, uuid } from '../../utils/common';
import { waitForLandingPageWidget } from '../../utils/customizeLandingPage';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { selectActivityFeedFilterAndVerifyEndpoint } from '../../utils/widgetFilters';
import { test } from '../fixtures/pages';

const ACTIVITY_FEED_WIDGET_KEY = 'KnowledgePanel.ActivityFeed';

test.describe(
  'Activity API - Entity Changes',
  { tag: [DOMAIN_TAGS.DISCOVERY] },
  () => {
    let entityChangesTable: TableClass;
    let adminDisplayName: string;

    test.beforeAll('Setup: create table', async () => {
      const { apiContext, afterAction } = await createAdminApiContext();

      entityChangesTable = new TableClass();

      try {
        await entityChangesTable.create(apiContext);

        const userResponse = await apiContext.get('/api/v1/users/loggedInUser');
        const adminUser = await userResponse.json();
        adminDisplayName = adminUser.displayName ?? adminUser.name;
      } finally {
        await afterAction();
      }
    });

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
      await waitForAllLoadersToDisappear(page);
    });

    // Rendering-only smoke: seed a DescriptionUpdated event via test-insert and assert the feed
    // renders it (header + actor + entity link), like the Reactions/Comments/Homepage blocks below.
    // The seed marker has no event-type words, so the /description/i assertion exercises the
    // eventType-driven header, not the injected text. DescriptionUpdated is the representative case
    // (its card body shows the seeded text); per-type delivery is covered by the backend
    // ActivityResourceIT, which has no AUT load contention.

    test('renders a description-updated activity item in the feed', async ({
      page,
    }) => {
      const summaryText = `Activity feed render ${uuid()}`;

      await test.step('Seed a DescriptionUpdated activity event', async () => {
        const { apiContext, afterAction } = await getApiContext(page);

        try {
          await insertActivityEventForTest(
            apiContext,
            entityChangesTable,
            summaryText,
            'DescriptionUpdated'
          );
        } finally {
          await afterAction();
        }
      });

      await test.step('Verify the event renders with actor and entity link', async () => {
        await visitTableActivityFeed(page, entityChangesTable);

        const feedItem = await getFeedItemByText(page, summaryText);
        const entityLink = feedItem.locator('a[href*="/table/"]').first();
        const href = await entityLink.getAttribute('href');

        await expect(feedItem).toContainText(/description/i);
        await expect(feedItem).toContainText(adminDisplayName);
        await expect(entityLink).toBeVisible();
        expect(href).toContain('table');
        expect(href).toContain(getTableLeafName(entityChangesTable));
      });
    });
  }
);

test.describe(
  'Activity API - Reactions',
  { tag: [DOMAIN_TAGS.DISCOVERY] },
  () => {
    let reactionsTable: TableClass;
    let addReactionFeedText: string;
    let removeReactionFeedText: string;

    test.beforeAll('Setup: create table and feed items', async () => {
      const { apiContext, afterAction } = await createAdminApiContext();

      reactionsTable = new TableClass();
      addReactionFeedText = `Test activity for adding reaction ${uuid()}`;
      removeReactionFeedText = `Test activity for removing reaction ${uuid()}`;

      try {
        await reactionsTable.create(apiContext);
        await insertActivityEventForTest(
          apiContext,
          reactionsTable,
          addReactionFeedText
        );
        await insertActivityEventForTest(
          apiContext,
          reactionsTable,
          removeReactionFeedText
        );
      } finally {
        await afterAction();
      }
    });

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
      await waitForAllLoadersToDisappear(page);
    });

    test('adds a reaction to a feed item', async ({ page }) => {
      await test.step('Open the activity feed', async () => {
        await visitTableActivityFeed(page, reactionsTable);
      });

      await test.step('Add thumbs-up reaction and verify it is visible', async () => {
        const feedItem = await getFeedItemByText(page, addReactionFeedText);

        await toggleThumbsUpReaction(feedItem, page);
        await expect(
          feedItem.getByRole('button', { name: new RegExp(THUMBS_UP_EMOJI) })
        ).toBeVisible({ timeout: 5_000 });
      });
    });

    test('removes an existing reaction from a feed item', async ({ page }) => {
      await test.step('Open the activity feed', async () => {
        await visitTableActivityFeed(page, reactionsTable);
      });

      await test.step('Add and then remove thumbs-up reaction', async () => {
        const feedItem = await getFeedItemByText(page, removeReactionFeedText);

        await toggleThumbsUpReaction(feedItem, page);
        await expect(
          feedItem.getByRole('button', { name: new RegExp(THUMBS_UP_EMOJI) })
        ).toBeVisible({ timeout: 5_000 });

        await toggleThumbsUpReaction(feedItem, page);
        await expect(
          feedItem.getByRole('button', { name: new RegExp(THUMBS_UP_EMOJI) })
        ).not.toBeVisible({ timeout: 5_000 });
      });
    });
  }
);

test.describe(
  'Activity API - Comments',
  { tag: [DOMAIN_TAGS.DISCOVERY] },
  () => {
    let commentsTable: TableClass;
    let commentFeedText: string;
    let layoutFeedText: string;
    let adminDisplayName: string;

    test.beforeAll('Setup: create table and feed items', async () => {
      const { apiContext, afterAction } = await createAdminApiContext();

      commentsTable = new TableClass();
      commentFeedText = `Test activity for comments ${uuid()}`;
      layoutFeedText = `Test activity detail layout ${uuid()}`;

      try {
        await commentsTable.create(apiContext);
        await insertActivityEventForTest(
          apiContext,
          commentsTable,
          commentFeedText
        );
        await insertActivityEventForTest(
          apiContext,
          commentsTable,
          layoutFeedText
        );
        const userResponse = await apiContext.get('/api/v1/users/loggedInUser');
        const adminUser = await userResponse.json();
        adminDisplayName = adminUser.displayName ?? adminUser.name;
      } finally {
        await afterAction();
      }
    });

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
      await waitForAllLoadersToDisappear(page);
    });

    test('adds a comment to a feed item', async ({ page }) => {
      const commentText = `Test comment ${uuid()}`;

      await test.step('Open the activity feed', async () => {
        await visitTableActivityFeed(page, commentsTable);
      });

      await test.step('Open the feed detail and post a comment', async () => {
        const feedItem = await getFeedItemByText(page, commentFeedText);

        await feedItem.click();
        await waitForAllLoadersToDisappear(page);
        await postActivityComment(page, commentText);
      });
    });

    test('creates exactly one reply and isolates activities with the same about', async ({
      page,
    }) => {
      const firstActivityText = `First isolated activity ${uuid()}`;
      const secondActivityText = `Second isolated activity ${uuid()}`;
      const firstReply = `First activity reply ${uuid()}`;
      const subsequentReply = `Subsequent activity reply ${uuid()}`;
      const editedFirstReply = `Edited activity reply ${uuid()}`;
      let firstActivityId = '';
      let secondActivityId = '';

      await test.step('Seed two activities for the same entity', async () => {
        const { apiContext, afterAction } = await getApiContext(page);

        try {
          firstActivityId = await insertActivityEventForTest(
            apiContext,
            commentsTable,
            firstActivityText
          );
          secondActivityId = await insertActivityEventForTest(
            apiContext,
            commentsTable,
            secondActivityText
          );
        } finally {
          await afterAction();
        }
      });

      await test.step('Post first and subsequent replies through the activity route', async () => {
        const activityReplyRequests: string[] = [];
        const conversationCreateRequests: string[] = [];

        page.on('request', (request) => {
          if (request.method() !== 'POST') {
            return;
          }
          if (
            request
              .url()
              .includes(`/api/v1/activity/${firstActivityId}/replies`)
          ) {
            activityReplyRequests.push(request.url());
          }
          if (/\/api\/v1\/conversations(?:\?|$)/.test(request.url())) {
            conversationCreateRequests.push(request.url());
          }
        });

        await visitTableActivityFeed(page, commentsTable);
        const firstActivity = await getFeedItemByText(page, firstActivityText);
        await firstActivity.click();
        await waitForAllLoadersToDisappear(page);

        await postActivityComment(page, firstReply);
        await expect(
          page.getByTestId('feed-reply-card').filter({ hasText: firstReply })
        ).toHaveCount(1);
        expect(activityReplyRequests).toHaveLength(1);
        expect(conversationCreateRequests).toHaveLength(0);

        await postActivityComment(page, subsequentReply);
        await expect(
          page
            .getByTestId('feed-reply-card')
            .filter({ hasText: subsequentReply })
        ).toHaveCount(1);
        expect(activityReplyRequests).toHaveLength(2);
        expect(conversationCreateRequests).toHaveLength(0);
      });

      await test.step('Edit, react to, and delete an activity reply', async () => {
        const firstReplyCard = page
          .getByTestId('feed-reply-card')
          .filter({ hasText: firstReply });
        await firstReplyCard.hover();
        await firstReplyCard.getByTestId('edit-message').click();

        const editingReplyCard = page
          .getByTestId('feed-reply-card')
          .filter({ has: page.locator('.is_edit_post') });
        const replyEditor = editingReplyCard.locator(
          '[data-testid="editor-wrapper"] [contenteditable="true"]'
        );
        await replyEditor.fill(editedFirstReply);
        const editResponse = page.waitForResponse(
          (response) =>
            response
              .url()
              .includes(`/api/v1/conversations/${firstActivityId}/replies/`) &&
            response.request().method() === 'PATCH'
        );
        await editingReplyCard.getByTestId('send-button').click();
        await editResponse;

        const editedReplyCard = page
          .getByTestId('feed-reply-card')
          .filter({ hasText: editedFirstReply });
        await expect(editedReplyCard).toHaveCount(1);
        await editedReplyCard.getByTestId('add-reactions').click();
        const reactionResponse = page.waitForResponse(
          (response) =>
            response
              .url()
              .includes(`/api/v1/conversations/${firstActivityId}/replies/`) &&
            response.url().endsWith('/reaction/rocket') &&
            response.request().method() === 'PUT'
        );
        await page.locator('[title="rocket"]:visible').click();
        await reactionResponse;

        await editedReplyCard.getByTestId('emoji-button').hover();
        await expect(
          page
            .getByTestId('popover-content')
            .filter({ hasText: adminDisplayName })
            .last()
        ).toContainText(adminDisplayName);

        await editedReplyCard.hover();
        await editedReplyCard.getByTestId('delete-message').click();
        const deleteResponse = page.waitForResponse(
          (response) =>
            response
              .url()
              .includes(`/api/v1/conversations/${firstActivityId}/replies/`) &&
            response.request().method() === 'DELETE'
        );
        await page.locator('.ant-modal').getByTestId('save-button').click();
        await deleteResponse;

        await expect(editedReplyCard).toHaveCount(0);
        await expect(
          page
            .getByTestId('feed-reply-card')
            .filter({ hasText: subsequentReply })
        ).toHaveCount(1);
      });

      await test.step('Verify the second activity has an independent reply container', async () => {
        const { apiContext, afterAction } = await getApiContext(page);

        try {
          const firstResponse = await apiContext.get(
            `/api/v1/activity/${firstActivityId}/replies`
          );
          const secondResponse = await apiContext.get(
            `/api/v1/activity/${secondActivityId}/replies`
          );
          const firstPayload = await firstResponse.json();
          const secondPayload = await secondResponse.json();

          expect(firstResponse.ok()).toBeTruthy();
          expect(secondResponse.ok()).toBeTruthy();
          expect(firstPayload.data).toHaveLength(1);
          expect(firstPayload.data[0].message.replace(/\s+/g, ' ')).toBe(
            subsequentReply
          );
          expect(secondPayload.data).toHaveLength(0);
        } finally {
          await afterAction();
        }

        await visitTableActivityFeed(page, commentsTable);
        const secondActivity = await getFeedItemByText(
          page,
          secondActivityText
        );
        await secondActivity.click();
        await waitForAllLoadersToDisappear(page);

        await expect(page.getByText(editedFirstReply)).not.toBeVisible();
        await expect(page.getByText(subsequentReply)).not.toBeVisible();
      });
    });

    test('shows the activity detail layout', async ({ page }) => {
      await test.step('Open the activity feed', async () => {
        await visitTableActivityFeed(page, commentsTable);
      });

      await test.step('Open the detail view and verify layout regions', async () => {
        const feedItem = await getFeedItemByText(page, layoutFeedText);

        await feedItem.click();
        await waitForAllLoadersToDisappear(page);

        const activityPanel = page.locator('#activity-panel');

        await expect(activityPanel).toBeVisible();
        await expect(
          activityPanel.getByTestId('comments-input-field')
        ).toBeVisible();
      });
    });
  }
);

test.describe(
  'Activity API - Homepage Widget',
  { tag: [DOMAIN_TAGS.DISCOVERY] },
  () => {
    let homepageTable: TableClass;
    let followedTable: TableClass;
    const followedActivitySummary = `Followed table activity ${uuid()}`;

    test.beforeAll('Setup: create table and activity', async () => {
      const { apiContext, afterAction } = await createAdminApiContext();

      homepageTable = new TableClass();
      followedTable = new TableClass();

      try {
        await homepageTable.create(apiContext);
        await createConversationThread(
          apiContext,
          homepageTable,
          `Test conversation for homepage widget ${uuid()}`
        );

        // The Following filter reads the FOLLOWS relationship, so the table has
        // to be followed by the logged-in user before it can surface any event.
        await followedTable.create(apiContext);

        const userResponse = await apiContext.get('/api/v1/users/loggedInUser');
        const adminUser = await userResponse.json();

        await followedTable.followTable(apiContext, adminUser.id);
        await insertActivityEventForTest(
          apiContext,
          followedTable,
          followedActivitySummary
        );
      } finally {
        await afterAction();
      }
    });

    test.afterAll('Cleanup: delete tables', async () => {
      const { apiContext, afterAction } = await createAdminApiContext();

      try {
        await homepageTable.delete(apiContext);
        await followedTable.delete(apiContext);
      } finally {
        await afterAction();
      }
    });

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
      await waitForAllLoadersToDisappear(page);
    });

    test('displays feed content in the Activity Feed widget', async ({
      page,
    }) => {
      const feedWidget = page.getByTestId(ACTIVITY_FEED_WIDGET_KEY);
      const feedItems = feedWidget.getByTestId('message-container');

      await expect(feedWidget).toBeVisible();
      await expect(feedItems.first()).toBeVisible({
        timeout: FEED_ITEM_TIMEOUT,
      });
    });

    test('shows Activity Feed widget filter options', async ({ page }) => {
      const feedWidget = page.getByTestId(ACTIVITY_FEED_WIDGET_KEY);

      await expect(feedWidget).toBeVisible();

      const sortDropdown = feedWidget.getByTestId('widget-sort-by-dropdown');

      await expect(sortDropdown).toBeVisible();
      await expect(sortDropdown).toBeEnabled();
      await sortDropdown.click();

      const filterMenu = page.getByRole('menu').filter({
        hasText: 'All Activity',
      });

      await expect(filterMenu).toBeVisible();
      await expect(
        page.getByRole('menuitem', { name: 'All Activity' })
      ).toBeVisible();
      await expect(
        page.getByRole('menuitem', { name: 'My Data' })
      ).toBeVisible();
      await expect(
        page.getByRole('menuitem', { name: 'Following' })
      ).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(filterMenu).not.toBeVisible();
    });

    // Regression guard: every filter used to call the my-feed endpoint, so the
    // widget showed the same list whichever option was picked.
    test('routes each Activity Feed widget filter to its own endpoint', async ({
      page,
    }) => {
      test.slow(true);

      const allActivityResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'GET' &&
          new URL(response.url()).pathname === '/api/v1/activity'
      );

      await redirectToHomePage(page);

      expect((await allActivityResponse).status()).toBe(200);

      const feedWidget = await waitForLandingPageWidget(
        page,
        ACTIVITY_FEED_WIDGET_KEY
      );

      await selectActivityFeedFilterAndVerifyEndpoint(
        page,
        feedWidget,
        'My Data',
        '/api/v1/activity/my-feed'
      );

      await selectActivityFeedFilterAndVerifyEndpoint(
        page,
        feedWidget,
        'Following',
        '/api/v1/activity/following'
      );

      await selectActivityFeedFilterAndVerifyEndpoint(
        page,
        feedWidget,
        'All Activity',
        '/api/v1/activity'
      );
    });

    test('shows the followed entity activity under the Following filter', async ({
      page,
    }) => {
      test.slow(true);

      const feedWidget = await waitForLandingPageWidget(
        page,
        ACTIVITY_FEED_WIDGET_KEY
      );

      await selectActivityFeedFilterAndVerifyEndpoint(
        page,
        feedWidget,
        'Following',
        '/api/v1/activity/following'
      );

      await expect(
        feedWidget
          .getByTestId('message-container')
          .filter({ hasText: followedActivitySummary })
          .first()
      ).toBeVisible({ timeout: FEED_ITEM_TIMEOUT });
    });
  }
);
