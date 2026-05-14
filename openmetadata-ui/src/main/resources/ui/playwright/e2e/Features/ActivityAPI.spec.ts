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
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { TableClass } from '../../support/entity/TableClass';
import { TagClass } from '../../support/tag/TagClass';
import {
  ACTIVITY_TEST_TIMEOUT,
  addTagToTable,
  createConversationThread,
  createDescriptionActivityEventFromPage,
  FEED_ITEM_TIMEOUT,
  getActivityFeedItems,
  getFeedItemByText,
  getTableFqn,
  getTableLeafName,
  openActivityFeedAndWaitForApi,
  patchTableDescription,
  THUMBS_UP_EMOJI,
  toggleThumbsUpReaction,
  visitTableActivityFeed,
  waitForActivityEvent,
} from '../../utils/activityAPI';
import { postActivityComment } from '../../utils/activityFeed';
import { performAdminLogin } from '../../utils/admin';
import { getApiContext, redirectToHomePage, uuid } from '../../utils/common';
import {
  addOwner,
  updateDescription,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';
import { test } from '../fixtures/pages';

// Investigation needed:
// 1. Profile actual event propagation time — measure how long it typically takes from a PATCH/PUT call to the event appearing in /api/v1/activity, then tighten the ceiling.
// 2. If synchronous flushing is not feasible, restructure tests to assert entity state directly via the entity API, seed a pre-built activity event, and verify only that the UI renders it decoupling UI assertions from event latency.
test.describe.fixme(
  'Activity API - Entity Changes',
  { tag: [DOMAIN_TAGS.DISCOVERY] },
  () => {
    let entityChangesTable: TableClass;
    let entityChangesTag: TagClass;
    let adminDisplayName: string;

    test.beforeAll('Setup: create table and tag', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      entityChangesTable = new TableClass();
      entityChangesTag = new TagClass({});

      try {
        await entityChangesTable.create(apiContext);
        await entityChangesTag.create(apiContext);

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

    test('creates an activity event when the description is updated', async ({
      page,
    }) => {
      test.setTimeout(ACTIVITY_TEST_TIMEOUT);

      const newDescription = `Test description updated at ${Date.now()}`;
      const entityFqn = getTableFqn(entityChangesTable);

      await test.step('Update the table description from the entity page', async () => {
        await entityChangesTable.visitEntityPage(page);
        await waitForAllLoadersToDisappear(page);
        await updateDescription(
          page,
          newDescription,
          false,
          'asset-description-container',
          EntityTypeEndpoint.Table
        );
      });

      await test.step('Verify the description event through API and UI', async () => {
        const descriptionEvent = await waitForActivityEvent({
          entityFqn,
          eventType: 'DescriptionUpdated',
          text: newDescription,
        });
        const activityResponse = await openActivityFeedAndWaitForApi(
          page,
          entityFqn
        );
        const renderedDescriptionEvent = activityResponse.data?.find(
          (event) =>
            event.eventType === 'DescriptionUpdated' &&
            JSON.stringify(event).includes(newDescription)
        );
        const feedItem = await getFeedItemByText(page, newDescription);

        expect(descriptionEvent).toBeDefined();
        expect(renderedDescriptionEvent).toBeDefined();
        await expect(feedItem).toContainText(/description/i);
      });
    });

    test('creates an activity event when tags are added', async ({ page }) => {
      test.setTimeout(ACTIVITY_TEST_TIMEOUT);

      const entityFqn = getTableFqn(entityChangesTable);
      const tagDisplayName = entityChangesTag.getTagDisplayName();

      await test.step('Add a tag to the table through API setup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);

        try {
          await addTagToTable(apiContext, entityChangesTable, entityChangesTag);
        } finally {
          await afterAction();
        }
      });

      await test.step('Verify the tag event through API and UI', async () => {
        const tagsEvent = await waitForActivityEvent({
          entityFqn,
          eventType: 'TagsUpdated',
        });
        const activityResponse = await visitTableActivityFeed(
          page,
          entityChangesTable
        );
        const renderedTagsEvent = activityResponse.data?.find(
          (event) => event.eventType === 'TagsUpdated'
        );
        const feedItem = getActivityFeedItems(page)
          .filter({ hasText: /tag/i })
          .filter({ hasText: tagDisplayName });

        expect(tagsEvent).toBeDefined();
        expect(renderedTagsEvent).toBeDefined();
        await expect(feedItem).toBeVisible({ timeout: FEED_ITEM_TIMEOUT });
      });
    });

    test('creates an activity event when owner is added', async ({ page }) => {
      test.setTimeout(ACTIVITY_TEST_TIMEOUT);

      const entityFqn = getTableFqn(entityChangesTable);

      await test.step('Add the owner from the entity page', async () => {
        await entityChangesTable.visitEntityPage(page);
        await waitForAllLoadersToDisappear(page);
        await addOwner({
          page,
          owner: adminDisplayName,
          endpoint: EntityTypeEndpoint.Table,
        });
      });

      await test.step('Verify the owner event through API and UI', async () => {
        const ownerEvent = await waitForActivityEvent({
          entityFqn,
          eventType: 'OwnerUpdated',
        });
        const activityResponse = await openActivityFeedAndWaitForApi(
          page,
          entityFqn
        );
        const renderedOwnerEvent = activityResponse.data?.find(
          (event) => event.eventType === 'OwnerUpdated'
        );
        const feedItem = getActivityFeedItems(page)
          .filter({ hasText: /owner/i })
          .filter({ hasText: adminDisplayName });

        expect(ownerEvent).toBeDefined();
        expect(renderedOwnerEvent).toBeDefined();
        await expect(feedItem).toBeVisible({ timeout: FEED_ITEM_TIMEOUT });
      });
    });

    test('shows the actor who made the activity change', async ({ page }) => {
      test.setTimeout(ACTIVITY_TEST_TIMEOUT);

      const entityFqn = getTableFqn(entityChangesTable);
      const uniqueDescription = `Actor test description ${Date.now()}`;

      await test.step('Make a table change as the logged-in admin user', async () => {
        const { apiContext, afterAction } = await getApiContext(page);

        try {
          await patchTableDescription(
            apiContext,
            entityChangesTable,
            uniqueDescription
          );
        } finally {
          await afterAction();
        }

        await waitForActivityEvent({
          entityFqn,
          eventType: 'DescriptionUpdated',
          text: uniqueDescription,
        });
      });

      await test.step('Verify the actor is visible in the matching feed item', async () => {
        await visitTableActivityFeed(page, entityChangesTable);

        const feedItem = await getFeedItemByText(page, uniqueDescription);

        await expect(feedItem).toContainText(adminDisplayName);
      });
    });

    test('links activity items to the correct entity', async ({ page }) => {
      test.setTimeout(ACTIVITY_TEST_TIMEOUT);

      const description = `Entity link description ${uuid()}`;

      await test.step('Create an activity event for the table', async () => {
        await createDescriptionActivityEventFromPage(
          page,
          entityChangesTable,
          description
        );
      });

      await test.step('Verify the feed card has the table entity link', async () => {
        await visitTableActivityFeed(page, entityChangesTable);

        const feedItem = await getFeedItemByText(page, description);
        const entityLink = feedItem.locator('a[href*="/table/"]').first();

        await expect(entityLink).toBeVisible();

        const href = await entityLink.getAttribute('href');

        expect(href).toContain('table');
        expect(href).toContain(getTableLeafName(entityChangesTable));
      });
    });
  }
);

test.describe.fixme(
  'Activity API - Reactions',
  { tag: [DOMAIN_TAGS.DISCOVERY] },
  () => {
    const reactionsTable = new TableClass();

    test.beforeAll('Setup: create table', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        await reactionsTable.create(apiContext);
      } finally {
        await afterAction();
      }
    });

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
      await waitForAllLoadersToDisappear(page);
    });

    test('adds a reaction to a feed item', async ({ page }) => {
      test.setTimeout(ACTIVITY_TEST_TIMEOUT);

      const description = `Test activity for adding reaction ${uuid()}`;

      await test.step('Create and open an activity feed item', async () => {
        await createDescriptionActivityEventFromPage(
          page,
          reactionsTable,
          description
        );
        await visitTableActivityFeed(page, reactionsTable);
      });

      await test.step('Add thumbs-up reaction and verify it is visible', async () => {
        const feedItem = await getFeedItemByText(page, description);

        await toggleThumbsUpReaction(feedItem, page);
        await expect(
          feedItem.getByRole('button', { name: new RegExp(THUMBS_UP_EMOJI) })
        ).toBeVisible({ timeout: 5_000 });
      });
    });

    test('removes an existing reaction from a feed item', async ({ page }) => {
      test.setTimeout(ACTIVITY_TEST_TIMEOUT);

      const description = `Test activity for removing reaction ${uuid()}`;

      await test.step('Create and open an activity feed item', async () => {
        await createDescriptionActivityEventFromPage(
          page,
          reactionsTable,
          description
        );
        await visitTableActivityFeed(page, reactionsTable);
      });

      await test.step('Add and then remove thumbs-up reaction', async () => {
        const feedItem = await getFeedItemByText(page, description);

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

test.describe.fixme(
  'Activity API - Comments',
  { tag: [DOMAIN_TAGS.DISCOVERY] },
  () => {
    const commentsTable = new TableClass();

    test.beforeAll('Setup: create table', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        await commentsTable.create(apiContext);
      } finally {
        await afterAction();
      }
    });

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
      await waitForAllLoadersToDisappear(page);
    });

    test('adds a comment to a feed item', async ({ page }) => {
      test.setTimeout(ACTIVITY_TEST_TIMEOUT);

      const description = `Test activity for comments ${uuid()}`;
      const commentText = `Test comment ${uuid()}`;

      await test.step('Create and open an activity feed item', async () => {
        await createDescriptionActivityEventFromPage(
          page,
          commentsTable,
          description
        );
        await visitTableActivityFeed(page, commentsTable);
      });

      await test.step('Open the feed detail and post a comment', async () => {
        const feedItem = await getFeedItemByText(page, description);

        await feedItem.click();
        await waitForAllLoadersToDisappear(page);
        await postActivityComment(page, commentText);
      });
    });

    test('shows the activity detail layout', async ({ page }) => {
      test.setTimeout(ACTIVITY_TEST_TIMEOUT);

      const description = `Test activity detail layout ${uuid()}`;

      await test.step('Create and open an activity feed item', async () => {
        await createDescriptionActivityEventFromPage(
          page,
          commentsTable,
          description
        );
        await visitTableActivityFeed(page, commentsTable);
      });

      await test.step('Open the detail view and verify layout regions', async () => {
        const feedItem = await getFeedItemByText(page, description);

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

test.describe.fixme(
  'Activity API - Homepage Widget',
  { tag: [DOMAIN_TAGS.DISCOVERY] },
  () => {
    const homepageTable = new TableClass();

    test.beforeAll('Setup: create table and activity', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

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
