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
import {
  PolicyClass,
  PolicyRulesType,
} from '../../support/access-control/PoliciesClass';
import { RolesClass } from '../../support/access-control/RolesClass';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { TableClass } from '../../support/entity/TableClass';
import { TeamClass } from '../../support/team/TeamClass';
import { UserClass } from '../../support/user/UserClass';
import {
  addMentionCommentInFeed,
  checkDescriptionInEditModal,
  FIRST_FEED_SELECTOR,
  REACTION_EMOJIS,
  reactOnFeed,
} from '../../utils/activityFeed';
import { performAdminLogin } from '../../utils/admin';
import {
  clickOutside,
  descriptionBox,
  redirectToHomePage,
  removeLandingBanner,
  toastNotification,
  uuid,
  visitOwnProfilePage,
} from '../../utils/common';
import { addOwner, updateDescription } from '../../utils/entity';
import {
  checkTaskCountInActivityFeed,
  createDescriptionTask,
  createTagTask,
  TaskDetails,
  TASK_OPEN_FETCH_LINK,
} from '../../utils/task';
import { performUserLogin } from '../../utils/user';

const entity = new TableClass();
const entity2 = new TableClass();
const entity3 = new TableClass();
const entity4 = new TableClass();
const entity5 = new TableClass();
const user1 = new UserClass();
const user2 = new UserClass();
const user3 = new UserClass();
const user4 = new UserClass();
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
    await entity5.create(apiContext);
    await user1.create(apiContext);
    await user2.create(apiContext);
    await user3.create(apiContext);
    await user4.create(apiContext);

    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await entity.delete(apiContext);
    await entity2.delete(apiContext);
    await entity3.delete(apiContext);
    await entity4.delete(apiContext);
    await entity5.delete(apiContext);
    await user1.delete(apiContext);
    await user2.delete(apiContext);
    await user3.delete(apiContext);
    await user4.delete(apiContext);
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

    // Assign reaction for latest feed
    await reactOnFeed(page, 1);

    // Verify if reaction is working or not
    for (const emoji of REACTION_EMOJIS) {
      await expect(
        page.locator(
          '[data-testid="activity-feed-widget"] [data-testid="message-container"]:first-child [data-testid="feed-reaction-container"]'
        )
      ).toContainText(emoji);
    }
  });

  test('Remove Emoji reaction from feed', async ({ page }) => {
    await removeLandingBanner(page);
    // Add reaction for latest feed
    await reactOnFeed(page, 2);

    // Remove reaction for 2nd feed
    await reactOnFeed(page, 2);

    // Verify if reaction is removed or not
    const feedReactionContainers = page
      .locator('[data-testid="message-container"]')
      .nth(2)
      .locator('[data-testid="feed-reaction-container"]');

    await expect(feedReactionContainers).toHaveCount(1);
  });

  test('Assigned task should appear to task tab', async ({ page }) => {
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
    const openTaskAfterTagResponse = page.waitForResponse(TASK_OPEN_FETCH_LINK);
    await createTagTask(page, { ...value, tag: 'PII.None' });
    await openTaskAfterTagResponse;

    await redirectToHomePage(page);

    const taskResponse = page.waitForResponse(
      '/api/v1/feed?type=Task&filterType=OWNER&taskStatus=Open&userId=*'
    );

    await page.getByTestId('activity-feed-widget').getByText('Tasks').click();

    await taskResponse;

    await expect(
      page.locator(
        '[data-testid="activity-feed-widget"] [data-testid="no-data-placeholder"]'
      )
    ).not.toBeVisible();

    const entityPageTaskTab = page.waitForResponse(TASK_OPEN_FETCH_LINK);

    const tagsTask = page.getByTestId('redirect-task-button-link').first();
    const tagsTaskContent = await tagsTask.innerText();

    expect(tagsTaskContent).toContain('Request tags for');

    await tagsTask.click();

    await entityPageTaskTab;

    // Task 1 - Request Tag right panel check
    const firstTaskContent = await page.getByTestId('task-title').innerText();

    expect(firstTaskContent).toContain('Request tags for');

    // Task 2 - Update Description right panel check

    await page.getByTestId('message-container').last().click();

    const lastTaskContent = await page.getByTestId('task-title').innerText();

    expect(lastTaskContent).toContain('Request to update description');

    await page.getByText('Accept Suggestion').click();

    await toastNotification(page, /Task resolved successfully/);

    // Task 1 - Request to update tag to be resolved

    const resolveSuggestion = page.waitForResponse(
      '/api/v1/feed/tasks/*/resolve'
    );

    await page.getByText('Accept Suggestion').click();

    await toastNotification(page, /Task resolved successfully/);

    await resolveSuggestion;

    await checkTaskCountInActivityFeed(page, 0, 2);
  });

  test('User should be able to reply in feeds in ActivityFeed', async ({
    page,
  }) => {
    await redirectToHomePage(page);

    await visitOwnProfilePage(page);

    const commentInput = page.locator('[data-testid="comments-input-field"]');
    commentInput.click();

    await page.fill(
      '[data-testid="editor-wrapper"] .ql-editor',
      `Reply message`
    );
    const sendReply = page.waitForResponse('/api/v1/feed/*/posts');
    await page.getByTestId('send-button').click({ force: true });
    await sendReply;

    await expect(
      page.locator('.right-container [data-testid="feed-replies"]')
    ).toContainText('Reply message');
  });

  test('Should be able to open and close emoji container in feed editor', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await visitOwnProfilePage(page);
    await page.waitForLoadState('networkidle');

    const commentInput = page.locator('[data-testid="comments-input-field"]');
    commentInput.click();

    await page.locator('.textarea-emoji-control').click();

    await expect(page.locator('#textarea-emoji')).toBeVisible();

    // Click on the main content area which is outside the emoji container
    await page.locator('.center-container').click();

    await expect(page.locator('#textarea-emoji')).not.toBeVisible();
  });

  test('Update Description Task on Columns', async ({ page }) => {
    const firstTaskValue: TaskDetails = {
      term: entity4.entity.displayName,
      assignee: user1.responseData.name,
      description: 'Column Description 1',
      columnName: entity4.entity.columns[0].name,
      oldDescription: entity4.entity.columns[0].description,
    };
    const secondTaskValue: TaskDetails = {
      ...firstTaskValue,
      description: 'Column Description 2',
      columnName: entity4.entity.columns[1].name,
      oldDescription: entity4.entity.columns[1].description,
    };

    await redirectToHomePage(page);

    await entity4.visitEntityPage(page);

    await page
      .getByRole('cell', { name: 'The ID of the store. This' })
      .getByTestId('task-element')
      .click();

    // create description task
    await createDescriptionTask(page, secondTaskValue);

    await page.getByTestId('schema').click();

    // create 2nd task for column description
    await page
      .getByRole('cell', { name: 'Unique identifier for the' })
      .getByTestId('task-element')
      .click();

    await createDescriptionTask(page, firstTaskValue);

    // Task 1 - check the description in edit and accept suggestion
    await checkDescriptionInEditModal(page, firstTaskValue);

    await page.getByText('Cancel').click();

    await page.waitForSelector('[role="dialog"].ant-modal', {
      state: 'detached',
    });

    // Task 2 - check the description in edit and accept suggestion

    await page.getByTestId('message-container').last().click();

    await checkDescriptionInEditModal(page, secondTaskValue);

    const resolveTask = page.waitForResponse('/api/v1/feed/tasks/*/resolve');
    await page.getByText('OK').click();
    await resolveTask;

    await toastNotification(page, /Task resolved successfully/);

    // Task 1 - Resolved the task

    const resolveTask2 = page.waitForResponse('/api/v1/feed/tasks/*/resolve');
    await page.getByText('Accept Suggestion').click();
    await resolveTask2;

    await toastNotification(page, /Task resolved successfully/);

    await checkTaskCountInActivityFeed(page, 0, 2);
  });

  test('Comment and Close Task should work in Task Flow', async ({ page }) => {
    const value: TaskDetails = {
      term: entity2.entity.displayName,
      assignee: user1.responseData.name,
    };
    await redirectToHomePage(page);

    await entity2.visitEntityPage(page);

    await page.getByTestId('request-description').click();

    await createDescriptionTask(page, value);

    // Task 1 - Update Description right panel check
    const descriptionTask = await page.getByTestId('task-title').innerText();

    expect(descriptionTask).toContain('Request to update description');

    // Close the task from the Button.Group, should throw error when no comment is added.
    await page.getByRole('button', { name: 'down' }).click();
    await page.waitForSelector('.ant-dropdown', {
      state: 'visible',
    });

    await page.getByRole('menuitem', { name: 'close' }).click();

    await toastNotification(page, 'Task cannot be closed without a comment.');

    // Close the task from the Button.Group, with comment is added.
    const commentInput = page.locator('[data-testid="comments-input-field"]');

    await commentInput.scrollIntoViewIfNeeded();
    await commentInput.click();
    await page.fill(
      '[data-testid="editor-wrapper"] .ql-editor',
      'Closing the task with comment'
    );
    await page.getByTestId('send-button').click();
    const commentWithCloseTask = page.waitForResponse(
      '/api/v1/feed/tasks/*/close'
    );
    await page.getByRole('button', { name: 'down' }).click();
    await page.waitForSelector('.ant-dropdown', {
      state: 'visible',
    });
    await page.getByRole('menuitem', { name: 'close' }).click();
    await commentWithCloseTask;

    await toastNotification(page, 'Task closed successfully.');

    await checkTaskCountInActivityFeed(page, 0, 1);
  });

  test('Replies should be visible in the task feed', async ({ page }) => {
    const value: TaskDetails = {
      term: entity2.entity.displayName,
      assignee: user1.responseData.name,
    };
    await redirectToHomePage(page);

    await entity2.visitEntityPage(page);

    await page.getByTestId('request-description').click();

    await createDescriptionTask(page, value);

    // Task 1 - Update Description right panel check
    const descriptionTask = await page.getByTestId('task-title').innerText();

    expect(descriptionTask).toContain('Request to update description');

    // check initial replies count
    await expect(page.getByTestId('replies-count')).not.toBeVisible();

    for (let i = 0; i < 10; i++) {
      const commentInput = page.locator('[data-testid="comments-input-field"]');
      commentInput.click();

      await page.fill(
        '[data-testid="editor-wrapper"] .ql-editor',
        `Reply message ${i}`
      );
      const sendReply = page.waitForResponse('/api/v1/feed/*/posts');
      await page.getByTestId('send-button').click({ force: true });
      await sendReply;
    }

    await page.reload();
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'hidden',
    });
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('feed-reply-card')).toHaveCount(10);

    for (let i = 0; i < 10; i++) {
      await expect(
        page.locator('.right-container [data-testid="feed-replies"]')
      ).toContainText(`Reply message ${i}`);
    }

    // check replies count in feed card
    await expect(page.getByTestId('replies-count')).toHaveText('10 Replies');
  });

  test('Open and Closed Task Tab with approve from Task Feed Card', async ({
    page,
  }) => {
    const value: TaskDetails = {
      term: entity3.entity.displayName,
      assignee: user1.responseData.name,
    };
    await redirectToHomePage(page);

    await entity3.visitEntityPage(page);

    await page.getByTestId('request-description').click();

    // create description task
    const openTaskAfterDescriptionResponse =
      page.waitForResponse(TASK_OPEN_FETCH_LINK);
    await createDescriptionTask(page, value);
    await openTaskAfterDescriptionResponse;

    // open task count after description
    await checkTaskCountInActivityFeed(page, 1, 0);

    await page.getByTestId('schema').click();

    await page.getByTestId('request-entity-tags').click();

    // create tag task
    const openTaskAfterTagResponse = page.waitForResponse(TASK_OPEN_FETCH_LINK);
    await createTagTask(page, { ...value, tag: 'PII.None' });
    await openTaskAfterTagResponse;

    // open task count after description
    await checkTaskCountInActivityFeed(page, 2, 0);

    page.locator('[data-testid="approve-button"]').first().click();
    await toastNotification(page, 'Task resolved successfully');
    await checkTaskCountInActivityFeed(page, 1, 1);
  });

  test('Assignee field should not be disabled for owned entity tasks', async ({
    page,
  }) => {
    const value: TaskDetails = {
      term: entity4.entity.displayName,
      assignee: user1.responseData.name,
    };
    await redirectToHomePage(page);

    await entity4.visitEntityPage(page);

    await addOwner({
      page,
      owner: user2.responseData.displayName,
      type: 'Users',
      endpoint: EntityTypeEndpoint.Table,
      dataTestId: 'data-assets-header',
    });

    await page.getByTestId('request-description').click();

    // create description task
    await createDescriptionTask(page, value);
  });

  test('Mention should work for the feed reply', async ({ page }) => {
    await test.step('Add Mention in Feed', async () => {
      await addMentionCommentInFeed(page, adminUser.responseData.name);

      // Close drawer
      await page.locator('[data-testid="closeDrawer"]').click();

      // Get the feed text
      const feedText = await page
        .locator(`${FIRST_FEED_SELECTOR} [data-testid="headerText"]`)
        .innerText();

      // Click on @Mentions tab
      const fetchMentionsFeedResponse = page.waitForResponse(
        '/api/v1/feed?filterType=MENTIONS&userId=*'
      );
      await page
        .locator('[data-testid="activity-feed-widget"]')
        .locator('text=@Mentions')
        .click();

      await fetchMentionsFeedResponse;

      const mentionedText = await page
        .locator(`${FIRST_FEED_SELECTOR} [data-testid="headerText"]`)
        .innerText();

      expect(mentionedText).toContain(feedText);
    });

    await test.step(
      'Add Mention should work if users having dot in their name',
      async () => {
        await addMentionCommentInFeed(page, 'aaron.warren5', true);

        const feedContainer = `[data-testid="feed-replies"]`;

        await expect(
          page
            .locator(feedContainer)
            .locator(
              '[data-testid="viewer-container"] [data-testid="markdown-parser"]'
            )
            .first()
        ).toContainText('Can you resolve this thread for me? @aaron.warren5');

        // Close drawer
        await page.locator('[data-testid="closeDrawer"]').click();
      }
    );
  });

  test('User 1 mentions user 2 and user 2 sees correct usernames in feed replies', async ({
    browser,
  }) => {
    const { page: page1, afterAction: afterActionUser1 } =
      await performUserLogin(browser, adminUser);
    const { page: page2, afterAction: afterActionUser2 } =
      await performUserLogin(browser, user2);

    await test.step('User 1 mentions user 2 in a feed reply', async () => {
      // Add mention comment in feed mentioning user2
      await addMentionCommentInFeed(page1, user2.responseData.name);

      await page1.locator('[data-testid="closeDrawer"]').click();

      await afterActionUser1();
    });

    await test.step('User 2 logs in and checks @Mentions tab', async () => {
      await redirectToHomePage(page2);
      await page2.waitForLoadState('networkidle');

      const fetchMentionsFeedResponse = page2.waitForResponse(
        '/api/v1/feed?filterType=MENTIONS&userId=*'
      );
      await page2
        .locator('[data-testid="activity-feed-widget"]')
        .locator('text=@Mentions')
        .click();

      await fetchMentionsFeedResponse;

      // Verify the mention appears in the feed
      await expect(
        page2.locator('[data-testid="message-container"]').first()
      ).toBeVisible();

      // Click on the feed to open replies
      await page2.locator('[data-testid="reply-count"]').first().click();

      await page2.waitForSelector('.ant-drawer-content', {
        state: 'visible',
      });

      // Verify the feed reply card shows correct usernames
      await expect(
        page2.locator('[data-testid="feed-reply-card"]').first()
      ).toBeVisible();

      // Check that the reply shows the correct username (user1 who made the mention)
      await expect(
        page2
          .locator('[data-testid="feed-reply-card"] .reply-card-user-name')
          .first()
      ).toContainText(adminUser.responseData.displayName);

      // Check that the mention text contains user2's name
      await expect(
        page2
          .locator(
            '[data-testid="feed-replies"] [data-testid="markdown-parser"]'
          )
          .first()
      ).toContainText(`@${user2.responseData.name}`);

      await page2.locator('[data-testid="closeDrawer"]').click();

      await afterActionUser2();
    });
  });

  test('Check Task Filter in Landing Page Widget', async ({ browser }) => {
    const { page: page1, afterAction: afterActionUser1 } =
      await performUserLogin(browser, user1);
    const { page: page2, afterAction: afterActionUser3 } =
      await performUserLogin(browser, user3);

    await base.step('Create and Assign Task to User 3', async () => {
      await redirectToHomePage(page1);
      await entity.visitEntityPage(page1);

      // Create task for the user 3
      await page1.getByTestId('request-description').click();
      await createDescriptionTask(page1, {
        term: entity.entity.displayName,
        assignee: user3.responseData.name,
      });

      await afterActionUser1();
    });

    await base.step('Create and Validate Task as per Filters', async () => {
      await redirectToHomePage(page2);
      await entity.visitEntityPage(page2);

      // Create task for the user 1
      await page2.getByTestId('request-entity-tags').click();
      const openTaskAfterTagResponse =
        page2.waitForResponse(TASK_OPEN_FETCH_LINK);
      await createTagTask(page2, {
        term: entity.entity.displayName,
        tag: 'PII.None',
        assignee: user1.responseData.name,
      });
      await openTaskAfterTagResponse;

      await redirectToHomePage(page2);
      const taskResponse = page2.waitForResponse(
        '/api/v1/feed?type=Task&filterType=OWNER&taskStatus=Open&userId=*'
      );

      await page2
        .getByTestId('activity-feed-widget')
        .getByText('Tasks')
        .click();

      await taskResponse;
      await page2.waitForLoadState('networkidle');

      await expect(
        page2.locator(
          '[data-testid="activity-feed-widget"] [data-testid="no-data-placeholder"]'
        )
      ).not.toBeVisible();

      // Check the Task based on ALL task filter
      await expect(page2.getByTestId('message-container')).toHaveCount(2);

      // Check the Task based on Assigned task filter
      await page2.getByTestId('filter-button').click();
      await page2.waitForSelector('.ant-popover ', { state: 'visible' });

      const taskAssignedResponse = page2.waitForResponse(
        '/api/v1/feed?type=Task&filterType=ASSIGNED_TO&taskStatus=Open&userId=*'
      );
      await page2.getByText('Assigned').click();
      await page2.getByTestId('selectable-list-update-btn').click();

      await taskAssignedResponse;

      await expect(page2.getByTestId('message-container')).toHaveCount(1);

      await page2.getByTestId('task-feed-card').locator('.ant-avatar').hover();

      await expect(
        page2.getByText(user3.responseData.displayName).first()
      ).toBeVisible();

      // Check the Task based on Created by me task filter

      await page2.getByTestId('filter-button').click();
      await page2.waitForSelector('.ant-popover ', { state: 'visible' });

      const taskCreatedByResponse = page2.waitForResponse(
        '/api/v1/feed?type=Task&filterType=ASSIGNED_BY&taskStatus=Open&userId=*'
      );
      await page2.getByText('Created By').click();
      await page2.getByTestId('selectable-list-update-btn').click();

      await taskCreatedByResponse;

      await expect(page2.getByTestId('message-container')).toHaveCount(1);

      await page2.getByTestId('task-feed-card').locator('.ant-avatar').hover();

      await expect(
        page2.getByText(user3.responseData.displayName).first()
      ).toBeVisible();

      await afterActionUser3();
    });
  });

  test('Verify feed count', async ({ page }) => {
    await redirectToHomePage(page);
    await entity5.visitEntityPage(page);
    await page.getByTestId('request-description').click();
    await createDescriptionTask(page, {
      term: entity5.entity.displayName,
      assignee: user4.responseData.name,
    });
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('left-panel-task-count')).toHaveText('1');
  });
});

base.describe('Activity feed with Data Consumer User', () => {
  base.slow(true);

  const id = uuid();
  const rules: PolicyRulesType[] = [
    {
      name: 'viewRuleAllowed',
      resources: ['All'],
      operations: ['ViewAll'],
      effect: 'allow',
    },
    {
      effect: 'deny',
      name: 'editNotAllowed',
      operations: ['EditAll'],
      resources: ['All'],
    },
  ];

  base.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { afterAction, apiContext } = await performAdminLogin(browser);

    await entity.create(apiContext);
    await entity2.create(apiContext);
    await entity3.create(apiContext);
    await user1.create(apiContext);
    await user2.create(apiContext);

    await afterAction();
  });

  base.afterAll('Cleanup', async ({ browser }) => {
    const { afterAction, apiContext } = await performAdminLogin(browser);
    await entity.delete(apiContext);
    await entity2.delete(apiContext);
    await entity3.delete(apiContext);
    await user1.delete(apiContext);
    await user2.delete(apiContext);

    await afterAction();
  });

  base('Create and Assign Task with Suggestions', async ({ browser }) => {
    const { page: page1, afterAction: afterActionUser1 } =
      await performUserLogin(browser, user1);
    const { page: page2, afterAction: afterActionUser2 } =
      await performUserLogin(browser, user2);

    const value: TaskDetails = {
      term: entity.entity.displayName,
      assignee: user2.responseData.name,
    };

    await base.step('Create, Close and Assign Task to User 2', async () => {
      await redirectToHomePage(page1);
      await entity.visitEntityPage(page1);

      // Create 2 task for the same entity, one to close and 2nd for the user2 action
      await page1.getByTestId('request-description').click();
      await createDescriptionTask(page1, value);

      await page1.getByTestId('schema').click();

      await page1.getByTestId('request-entity-tags').click();

      // create tag task
      const openTaskAfterTagResponse =
        page1.waitForResponse(TASK_OPEN_FETCH_LINK);
      await createTagTask(page1, { ...value, tag: 'PII.None' });
      await openTaskAfterTagResponse;

      // Should only see the close button
      expect(page1.locator('[data-testid="close-button"]')).toBeVisible();
      expect(
        page1.locator('[data-testid="edit-accept-task-dropdown"]')
      ).not.toBeVisible();

      const commentInput = page1.locator(
        '[data-testid="comments-input-field"]'
      );
      await commentInput.scrollIntoViewIfNeeded();
      await commentInput.click();
      // Close 1st task
      await page1.fill(
        '[data-testid="editor-wrapper"] .ql-editor',
        'Closing the task with comment'
      );

      const commentPostResponse = page1.waitForResponse('/api/v1/feed/*/posts');
      await page1.locator('.activity-feed-editor-send-btn').click();
      await commentPostResponse;
      const commentWithCloseTask = page1.waitForResponse(
        '/api/v1/feed/tasks/*/close'
      );
      await page1.locator('[data-testid="close-button"]').click();
      await commentWithCloseTask;

      await toastNotification(page1, 'Task closed successfully.');
      await page1.waitForLoadState('networkidle');
      await checkTaskCountInActivityFeed(page1, 1, 1);

      await afterActionUser1();
    });

    await base.step('Accept Task By User 2', async () => {
      await redirectToHomePage(page2);

      const taskResponse = page2.waitForResponse(
        '/api/v1/feed?type=Task&filterType=OWNER&taskStatus=Open&userId=*'
      );

      await page2
        .getByTestId('activity-feed-widget')
        .getByText('Tasks')
        .click();

      await taskResponse;

      await expect(
        page2.locator(
          '[data-testid="activity-feed-widget"] [data-testid="no-data-placeholder"]'
        )
      ).not.toBeVisible();

      const entityPageTaskTab = page2.waitForResponse(TASK_OPEN_FETCH_LINK);

      const tagsTask = page2.getByTestId('redirect-task-button-link').first();
      const tagsTaskContent = await tagsTask.innerText();

      expect(tagsTaskContent).toContain('Request to update description for');

      await tagsTask.click();
      await entityPageTaskTab;

      await page2.waitForLoadState('networkidle');
      // Count for task should be 1 both open and closed

      await checkTaskCountInActivityFeed(page2, 1, 1);

      // Should not see the close button
      expect(page2.locator('[data-testid="close-button"]')).not.toBeVisible();

      expect(
        page2.locator('[data-testid="edit-accept-task-dropdown"]')
      ).toBeVisible();

      const resolveTask = page2.waitForResponse('/api/v1/feed/tasks/*/resolve');
      await page2.getByText('Accept Suggestion').scrollIntoViewIfNeeded();
      await page2.getByText('Accept Suggestion').click();
      await resolveTask;
      await toastNotification(page2, /Task resolved successfully/);

      await page2.waitForLoadState('networkidle');
      await checkTaskCountInActivityFeed(page2, 0, 2);

      await afterActionUser2();
    });
  });

  base('Create and Assign Task without Suggestions', async ({ browser }) => {
    const { page: page1, afterAction: afterActionUser1 } =
      await performUserLogin(browser, user1);
    const { page: page2, afterAction: afterActionUser2 } =
      await performUserLogin(browser, user2);

    const value: TaskDetails = {
      term: entity2.entity.displayName,
      assignee: user2.responseData.name,
    };

    await base.step('Create, Close and Assign Task to user 2', async () => {
      await redirectToHomePage(page1);
      await entity2.visitEntityPage(page1);

      await updateDescription(page1, '');

      // Create 2 task for the same entity, one to close and 2nd for the user2 action
      await page1.getByTestId('request-description').click();

      await createDescriptionTask(page1, value, false);

      await page1.getByTestId('schema').click();

      await page1.getByTestId('request-entity-tags').click();

      // create tag task
      const openTaskAfterTagResponse =
        page1.waitForResponse(TASK_OPEN_FETCH_LINK);
      await createTagTask(page1, value, false);
      await openTaskAfterTagResponse;

      await page1.waitForLoadState('networkidle');

      // Should only see the close, add and comment button
      expect(
        page1.locator('[data-testid="comments-input-field"]')
      ).toBeVisible();

      expect(page1.locator('[data-testid="close-button"]')).toBeVisible();
      expect(
        page1.locator('[data-testid="edit-accept-task-dropdown"]')
      ).not.toBeVisible();
      expect(
        page1.locator('[data-testid="add-close-task-dropdown"]')
      ).not.toBeVisible();

      await afterActionUser1();
    });

    await base.step(
      'Accept Task By user 2 with adding suggestions',
      async () => {
        await redirectToHomePage(page2);

        const taskResponse = page2.waitForResponse(
          '/api/v1/feed?type=Task&filterType=OWNER&taskStatus=Open&userId=*'
        );

        await page2
          .getByTestId('activity-feed-widget')
          .getByText('Tasks')
          .click();

        await taskResponse;

        await expect(
          page2.locator(
            '[data-testid="activity-feed-widget"] [data-testid="no-data-placeholder"]'
          )
        ).not.toBeVisible();

        const entityPageTaskTab = page2.waitForResponse(TASK_OPEN_FETCH_LINK);

        const tagsTask = page2.getByTestId('redirect-task-button-link').first();
        const tagsTaskContent = await tagsTask.innerText();

        expect(tagsTaskContent).toContain('Request tags for');

        await tagsTask.click();
        await entityPageTaskTab;

        await page2.waitForLoadState('networkidle');

        await expect(
          page2.getByText('no diff available').first()
        ).toBeVisible();

        // Should see the add_close dropdown and comment button
        await expect(
          page2.locator('[data-testid="comments-input-field"]')
        ).toBeVisible();

        await expect(
          page2.getByTestId('add-close-task-dropdown')
        ).toBeVisible();
        await expect(
          page2.locator('[data-testid="close-button"]')
        ).not.toBeVisible();
        await expect(
          page2.locator('[data-testid="edit-accept-task-dropdown"]')
        ).not.toBeVisible();

        await page2.waitForSelector('.ant-skeleton-element', {
          state: 'detached',
        });

        const tagsSuggestionResponse = page2.waitForResponse(
          '/api/v1/search/query?q=***'
        );
        await page2.getByRole('button', { name: 'Add Tags' }).click();
        await tagsSuggestionResponse;

        await page2.waitForSelector('[role="dialog"].ant-modal');

        const modalTitleContent = await page2
          .locator('.ant-modal-header .ant-modal-title')
          .innerText();

        expect(modalTitleContent).toContain(
          `Request tags for table ${value.term}`
        );

        // select the Tag
        const suggestTags = page2.locator(
          '[data-testid="tag-selector"] > .ant-select-selector .ant-select-selection-search-input'
        );
        await suggestTags.click();

        const querySearchResponse = page2.waitForResponse(
          `/api/v1/search/query?q=*${'PII.None'}*&index=tag_search_index&*`
        );
        await suggestTags.fill('PII.None');

        await querySearchResponse;

        // select value from dropdown
        const dropdownValue = page2.getByTestId(`tag-PII.None`).first();
        await dropdownValue.hover();
        await dropdownValue.click();
        await clickOutside(page2);

        await expect(page2.getByTestId('selected-tag-PII.None')).toBeVisible();

        await page2.getByText('OK').click();

        await toastNotification(page2, /Task resolved successfully/);

        // Accept the description task

        await expect(page2.getByText('No Suggestion').first()).toBeVisible();

        await page2.getByRole('button', { name: 'Add Description' }).click();

        await page2.waitForSelector('[role="dialog"].ant-modal');

        const modalTitleDescriptionContent = await page2
          .locator('.ant-modal-header .ant-modal-title')
          .innerText();

        expect(modalTitleDescriptionContent).toContain(
          `Request description for table ${value.term}`
        );

        await page2.locator(descriptionBox).fill('New description');

        await page2.getByText('OK').click();

        await toastNotification(page2, /Task resolved successfully/);

        await afterActionUser2();
      }
    );
  });

  base(
    'Accepting task should throw error for not having edit permission',

    async ({ browser }) => {
      const { afterAction, apiContext } = await performAdminLogin(browser);

      const viewAllUser = new UserClass();
      const viewAllPolicy = new PolicyClass();
      const viewAllRoles = new RolesClass();

      await viewAllUser.create(apiContext);
      await viewAllPolicy.create(apiContext, rules);
      await viewAllRoles.create(apiContext, [viewAllPolicy.responseData.name]);
      const viewAllTeam = new TeamClass({
        name: `PW%team-${id}`,
        displayName: `PW Team ${id}`,
        description: 'playwright team description',
        teamType: 'Group',
        users: [viewAllUser.responseData.id],
        defaultRoles: viewAllRoles.responseData.id
          ? [viewAllRoles.responseData.id]
          : [],
      });
      await viewAllTeam.create(apiContext);

      const { page: page1, afterAction: afterActionUser1 } =
        await performUserLogin(browser, user1);
      const { page: page2, afterAction: afterActionUser2 } =
        await performUserLogin(browser, viewAllUser);

      const value: TaskDetails = {
        term: entity3.entity.displayName,
        assignee: viewAllUser.responseData.name,
      };

      try {
        await base.step('Create and Assign Task to user 3', async () => {
          await redirectToHomePage(page1);
          await entity3.visitEntityPage(page1);

          await page1.getByTestId('request-description').click();

          await createDescriptionTask(page1, value);

          await afterActionUser1();
        });

        await base.step(
          'Accept Task By user 2 should throw error for since it has only viewAll permission',
          async () => {
            await redirectToHomePage(page2);

            await entity3.visitEntityPage(page2);

            await page2.getByTestId('activity_feed').click();

            const taskResponse = page2.waitForResponse(
              '/api/v1/feed?entityLink=**type=Task&taskStatus=Open'
            );
            await page2.getByRole('menuitem', { name: 'Tasks' }).click();
            await taskResponse;

            await page2.getByText('Accept Suggestion').click();

            await toastNotification(
              page2,
              // eslint-disable-next-line max-len
              `Principal: CatalogPrincipal{name='${viewAllUser.responseData.name}'} operation EditDescription denied by role ${viewAllRoles.responseData.name}, policy ${viewAllPolicy.responseData.name}, rule editNotAllowed`
            );

            await afterActionUser2();
          }
        );
      } finally {
        await viewAllUser.delete(apiContext);
        await viewAllPolicy.delete(apiContext);
        await viewAllRoles.delete(apiContext);
        await viewAllTeam.delete(apiContext);

        await afterAction();
      }
    }
  );
});
