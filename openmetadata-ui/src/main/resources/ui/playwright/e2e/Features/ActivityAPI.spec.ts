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
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { test } from '../fixtures/pages';

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

    // Rendering-only: seed via test-insert and assert the feed renders it, like the
    // Reactions/Comments/Homepage blocks below. The seed summary is a neutral marker, so the
    // event-type word asserts the eventType-driven header rather than the injected text. The async
    // delivery contract (flaky under AUT load) is covered by the backend ActivityResourceIT.

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

    test('renders a tags-updated activity item in the feed', async ({
      page,
    }) => {
      const summaryText = `Activity feed render ${uuid()}`;

      await test.step('Seed a TagsUpdated activity event', async () => {
        const { apiContext, afterAction } = await getApiContext(page);

        try {
          await insertActivityEventForTest(
            apiContext,
            entityChangesTable,
            summaryText,
            'TagsUpdated'
          );
        } finally {
          await afterAction();
        }
      });

      await test.step('Verify the tag event renders', async () => {
        await visitTableActivityFeed(page, entityChangesTable);

        const feedItem = await getFeedItemByText(page, summaryText);
        const entityLink = feedItem.locator('a[href*="/table/"]').first();

        await expect(feedItem).toContainText(/tag/i);
        await expect(feedItem).toContainText(adminDisplayName);
        await expect(entityLink).toBeVisible();
      });
    });

    test('renders an owner-updated activity item in the feed', async ({
      page,
    }) => {
      const summaryText = `Activity feed render ${uuid()}`;

      await test.step('Seed an OwnerUpdated activity event', async () => {
        const { apiContext, afterAction } = await getApiContext(page);

        try {
          await insertActivityEventForTest(
            apiContext,
            entityChangesTable,
            summaryText,
            'OwnerUpdated'
          );
        } finally {
          await afterAction();
        }
      });

      await test.step('Verify the owner event renders', async () => {
        await visitTableActivityFeed(page, entityChangesTable);

        const feedItem = await getFeedItemByText(page, summaryText);
        const entityLink = feedItem.locator('a[href*="/table/"]').first();

        await expect(feedItem).toContainText(/owner/i);
        await expect(feedItem).toContainText(adminDisplayName);
        await expect(entityLink).toBeVisible();
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

    test.beforeAll('Setup: create table and activity', async () => {
      const { apiContext, afterAction } = await createAdminApiContext();

      homepageTable = new TableClass();

      try {
        await homepageTable.create(apiContext);
        await createConversationThread(
          apiContext,
          homepageTable,
          `Test conversation for homepage widget ${uuid()}`
        );
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
      const feedWidget = page.getByTestId('KnowledgePanel.ActivityFeed');
      const feedItems = feedWidget.getByTestId('message-container');

      await expect(feedWidget).toBeVisible();
      await expect(feedItems.first()).toBeVisible({
        timeout: FEED_ITEM_TIMEOUT,
      });
    });

    test('shows Activity Feed widget filter options', async ({ page }) => {
      const feedWidget = page.getByTestId('KnowledgePanel.ActivityFeed');

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
  }
);
