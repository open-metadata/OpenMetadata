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
import { expect, Page, test as base } from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import { REACTION_EMOJIS, reactOnFeed } from '../../utils/activityFeed';
import { performAdminLogin } from '../../utils/admin';
import {
  redirectToHomePage,
  removeLandingBanner,
  toastNotification,
  visitOwnProfilePage,
} from '../../utils/common';
import {
  checkTaskCountInProfilePage,
  createDescriptionTask,
  createTagTask,
  TaskDetails,
} from '../../utils/task';

const entity = new TableClass();
const entity2 = new TableClass();
const entity3 = new TableClass();
const entity4 = new TableClass();
const user1 = new UserClass();
const user2 = new UserClass();
const adminUser = new UserClass();

const test = base.extend<{ page: Page }>({
  page: async ({ browser }, use) => {
    const adminPage = await browser.newPage();
    await adminUser.login(adminPage);
    await use(adminPage);
    await adminPage.close();
  },
});

test.describe('Activity feed', () => {
  test.slow(true);

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await adminUser.create(apiContext);
    await adminUser.setAdminRole(apiContext);
    await entity.create(apiContext);
    await entity2.create(apiContext);
    await entity3.create(apiContext);
    await entity4.create(apiContext);
    await user1.create(apiContext);
    await user2.create(apiContext);

    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await entity.delete(apiContext);
    await entity2.delete(apiContext);
    await entity3.delete(apiContext);
    await entity4.delete(apiContext);
    await user1.delete(apiContext);
    await user2.delete(apiContext);
    await adminUser.delete(apiContext);

    await afterAction();
  });

  test('Feed widget should be visible', async ({ page }) => {
    await removeLandingBanner(page);
    // Locate the feed widget
    const feedWidget = page.locator('[data-testid="activity-feed-widget"]');

    // Check if the feed widget is visible
    await expect(feedWidget).toBeVisible();

    // Check if the feed widget contains specific text
    await expect(feedWidget).toContainText('All');
    await expect(feedWidget).toContainText('@Mentions');
    await expect(feedWidget).toContainText('Tasks');
  });

  test('Emoji reaction on feed should be working fine', async ({ page }) => {
    await removeLandingBanner(page);

    await test.step('Add Emoji reaction', async () => {
      // Assign reaction for latest feed
      await reactOnFeed(page);

      // Verify if reaction is working or not
      for (const emoji of REACTION_EMOJIS) {
        await expect(
          page.locator(
            '[data-testid="activity-feed-widget"] [data-testid="message-container"]:first-child [data-testid="feed-reaction-container"]'
          )
        ).toContainText(emoji);
      }
    });

    await test.step('Remove Emoji reaction from feed', async () => {
      // Remove reaction for latest feed
      await reactOnFeed(page);

      // Verify if reaction is removed or not
      const feedReactionContainer = page
        .locator('[data-testid="message-container"]')
        .nth(1)
        .locator('[data-testid="feed-reaction-container"]');

      await expect(feedReactionContainer).toHaveCount(1);
    });
  });

  test('Assigned task should appear in task tab of user profile page and accept suggestion should work fine', async ({
    page,
  }) => {
    const value: TaskDetails = {
      term: entity.entity.displayName,
      assignee: user1.responseData.name,
    };
    await redirectToHomePage(page);

    await entity.visitEntityPage(page);

    await page.getByTestId('request-description').click();

    // create description task
    await createDescriptionTask(page, value);

    await page.getByTestId('schema').click();

    await page.getByTestId('request-entity-tags').click();

    // create tag task
    await createTagTask(page, { ...value, tag: 'PII.None' });

    await visitOwnProfilePage(page);

    await page.getByText('Tasks').click();

    const resolveSuggestion = page.waitForResponse(
      '/api/v1/feed/tasks/*/resolve'
    );

    await page.getByText('Accept Suggestion').click();
    await resolveSuggestion;
    await toastNotification(page, /Task resolved successfully/);
    await checkTaskCountInProfilePage(page, 1, 1);

    await page.getByText('Open').click();

    await page.waitForLoadState('networkidle');
    const resolveDescriptionSuggestion = page.waitForResponse(
      '/api/v1/feed/tasks/*/resolve'
    );
    await page.getByText('Accept Suggestion').click();
    await resolveDescriptionSuggestion;
    await toastNotification(page, /Task resolved successfully/);
    await checkTaskCountInProfilePage(page, 0, 2);

    await entity.visitEntityPage(page);

    await page.getByTestId('schema').click();

    // verification for PII.None tag
    await expect(
      page.getByTestId('tags-container').getByText('None')
    ).toBeVisible();

    // Check the updated description
    await expect(
      page.getByText('descriptionUpdated description')
    ).toBeVisible();
  });

  test('Assigned task should appear in task tab of user profile page and edit suggestion should work fine', async ({
    page,
  }) => {
    const value: TaskDetails = {
      term: entity.entity.displayName,
      assignee: user1.responseData.name,
    };
    await redirectToHomePage(page);

    await entity.visitEntityPage(page);

    await page.getByTestId('schema').click();

    await page.getByTestId('request-entity-tags').click();

    // create tag task
    await createTagTask(page, { ...value, tag: 'PII.None' });

    await visitOwnProfilePage(page);

    await page.getByText('Tasks').click();

    await page
      .getByTestId('edit-accept-task-dropdown')
      .locator(
        '.ant-btn-compact-item.ant-btn.ant-btn-compact-last-item:not(.ant-btn-compact-item-rtl)'
      )
      .click();
    await page.getByText('Edit Suggestion').click();

    // Handle the PII selection dropdown
    await page
      .getByTestId('tag-selector')
      .locator('div')
      .filter({ hasText: 'PII.None' })
      .first()
      .click();
    await page.locator('.ant-select-dropdown').waitFor({ state: 'visible' });
    const option1 = page.getByTestId('tag-PersonalData.Personal').first();
    await option1.waitFor({ state: 'visible' });
    await option1.click();

    await page.mouse.click(0, 0);
    const resolveSuggestion = page.waitForResponse(
      '/api/v1/feed/tasks/*/resolve'
    );

    // Click OK to confirm the edit
    await page.getByRole('button', { name: 'OK' }).click();

    await resolveSuggestion;
    await toastNotification(page, /Task resolved successfully/);
    await checkTaskCountInProfilePage(page, 0, 1);

    await entity.visitEntityPage(page);

    await page.getByTestId('schema').click();

    // verification for PII.Sensitive tag
    await expect(
      page.getByTestId('tags-container').getByText('Personal')
    ).toBeVisible();
  });

  test('Assigned task should appear in task tab of user profile page and accept task should work fine from task card', async ({
    page,
  }) => {
    const value: TaskDetails = {
      term: entity.entity.displayName,
      assignee: user1.responseData.name,
    };
    await redirectToHomePage(page);

    await entity.visitEntityPage(page);

    await page.getByTestId('request-description').click();

    // create description task
    await createDescriptionTask(page, value);

    await page.getByTestId('schema').click();

    await page.getByTestId('request-entity-tags').click();

    // create tag task
    await createTagTask(page, { ...value, tag: 'PII.None' });

    await visitOwnProfilePage(page);

    await page.getByText('Tasks').click();

    const resolveSuggestion = page.waitForResponse(
      '/api/v1/feed/tasks/*/resolve'
    );

    await page.getByText('Approve').first().click();

    await resolveSuggestion;
    await toastNotification(page, /Task resolved successfully/);
    await checkTaskCountInProfilePage(page, 1, 1);

    await page.getByText('Open').click();

    await page.waitForLoadState('networkidle');
    const resolveDescriptionSuggestion = page.waitForResponse(
      '/api/v1/feed/tasks/*/resolve'
    );
    await page.getByText('Approve').first().click();
    await resolveDescriptionSuggestion;
    await toastNotification(page, /Task resolved successfully/);
    await checkTaskCountInProfilePage(page, 0, 2);

    await entity.visitEntityPage(page);

    await page.getByTestId('schema').click();

    // verification for PII.None tag
    await expect(
      page.getByTestId('tags-container').getByText('None')
    ).toBeVisible();

    // Check the updated description
    await expect(
      page.getByText('descriptionUpdated description')
    ).toBeVisible();
  });
});
