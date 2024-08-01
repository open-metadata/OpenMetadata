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
import test, { expect } from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import {
  checkDescriptionInEditModal,
  deleteFeedComments,
} from '../../utils/activityFeed';
import { performAdminLogin } from '../../utils/admin';
import {
  createNewPage,
  descriptionBox,
  redirectToHomePage,
  toastNotification,
  visitUserProfilePage,
} from '../../utils/common';
import { updateDescription } from '../../utils/entity';
import { clickOnLogo } from '../../utils/sidebar';
import {
  createDescriptionTask,
  createTagTask,
  TaskDetails,
} from '../../utils/task';
import { performUserLogin } from '../../utils/user';

const entity = new TableClass();
const entity2 = new TableClass();
const user1 = new UserClass();
const user2 = new UserClass();

test.describe('Activity feed', () => {
  // use the admin user to login
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await entity.create(apiContext);
    await entity2.create(apiContext);
    await user1.create(apiContext);

    await afterAction();
  });

  test.beforeEach('Visit on landing page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await entity.delete(apiContext);
    await entity2.delete(apiContext);
    await user1.delete(apiContext);

    await afterAction();
  });

  test('Assigned task should appear to task tab', async ({ page }) => {
    const value: TaskDetails = {
      term: entity.entity.name,
      assignee: user1.responseData.name,
    };
    await entity.visitEntityPage(page);

    await page.getByTestId('request-description').click();

    // create description task
    await createDescriptionTask(page, value);

    await page.getByTestId('schema').click();

    await page.getByTestId('request-entity-tags').click();

    // create tag task
    await createTagTask(page, { ...value, tag: 'PII.None' });

    await clickOnLogo(page);

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

    const entityPageTaskTab = page.waitForResponse('/api/v1/feed?*&type=Task');

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

    await page.getByText('Accept Suggestion').click();

    await toastNotification(page, /Task resolved successfully/);

    const closedTask = await page.getByTestId('closed-task').textContent();

    expect(closedTask).toContain('2 Closed');
  });

  test('User should be able to reply and delete comment in feeds in ActivityFeed', async ({
    page,
  }) => {
    await visitUserProfilePage(page);

    const secondFeedConversation = page
      .locator('#center-container [data-testid="message-container"]')
      .nth(1);

    await secondFeedConversation.locator('.feed-card-v2-sidebar').click();

    await page.waitForSelector('#feed-panel', {
      state: 'visible',
    });

    // Compare the text of the second feed in the center container with the right panel feed
    const secondFeedText = await secondFeedConversation
      .locator('[data-testid="headerText"]')
      .innerText();

    const rightPanelFeedText = await page
      .locator(
        '.right-container [data-testid="message-container"] [data-testid="headerText"]'
      )
      .innerText();

    expect(secondFeedText).toBe(rightPanelFeedText);

    for (let i = 1; i <= 4; i++) {
      await page.fill(
        '[data-testid="editor-wrapper"] .ql-editor',
        `Reply message ${i}`
      );
      const sendReply = page.waitForResponse('/api/v1/feed/*/posts');
      await page.getByTestId('send-button').click({ force: true });
      await sendReply;
    }

    // Compare if feed is same after adding some comments in the right panel
    const rightPanelFeedTextCurrent = await page
      .locator(
        '.right-container [data-testid="message-container"] [data-testid="headerText"]'
      )
      .innerText();

    expect(secondFeedText).toBe(rightPanelFeedTextCurrent);

    // Verify if the comments are visible
    for (let i = 2; i <= 4; i++) {
      await expect(
        page.locator('.right-container [data-testid="feed-replies"]')
      ).toContainText(`Reply message ${i}`);
    }

    // Only show comment of latest 3 replies
    await expect(
      page.locator('.right-container [data-testid="feed-replies"]')
    ).not.toContainText('Reply message 1');

    await expect(
      page.locator(
        '[data-testid="message-container"] .active [data-testid="reply-count"]'
      )
    ).toContainText('04 Replies');

    // Deleting last 2 comments from the Feed
    const feedReplies = page.locator(
      '.right-container [data-testid="feed-replies"] .feed-card-v2-container'
    );

    await deleteFeedComments(page, feedReplies.nth(2));

    await deleteFeedComments(page, feedReplies.nth(2));

    // Compare if feed is same after deleting some comments in the right panel
    const rightPanelFeedTextCurrentAfterDelete = await page
      .locator(
        '.right-container [data-testid="message-container"] [data-testid="headerText"]'
      )
      .innerText();

    expect(secondFeedText).toBe(rightPanelFeedTextCurrentAfterDelete);

    await expect(
      page.locator(
        '[data-testid="message-container"] .active [data-testid="reply-count"]'
      )
    ).toContainText('02 Replies');
  });

  test('Update Description Task on Columns', async ({ page }) => {
    const firstTaskValue: TaskDetails = {
      term: entity.entity.name,
      assignee: user1.responseData.name,
      description: 'Column Description 1',
      columnName: entity.entity.columns[0].name,
      oldDescription: entity.entity.columns[0].description,
    };
    const secondTaskValue: TaskDetails = {
      ...firstTaskValue,
      description: 'Column Description 2',
      columnName: entity.entity.columns[1].name,
      oldDescription: entity.entity.columns[1].description,
    };
    await entity.visitEntityPage(page);

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

    await page.getByText('OK').click();

    await toastNotification(page, /Task resolved successfully/);

    // Task 1 - Resolved the task

    await page.getByText('Accept Suggestion').click();

    await toastNotification(page, /Task resolved successfully/);

    const closedTask = await page.getByTestId('closed-task').textContent();

    expect(closedTask).toContain('2 Closed');
  });

  test('Comment and Close Task should work in Task Flow', async ({ page }) => {
    const value: TaskDetails = {
      term: entity2.entity.name,
      assignee: user1.responseData.name,
    };
    await entity2.visitEntityPage(page);

    await page.getByTestId('request-description').click();

    await createDescriptionTask(page, value);

    // Task 1 - Update Description right panel check
    const descriptionTask = await page.getByTestId('task-title').innerText();

    expect(descriptionTask).toContain('Request to update description');

    // Check the editor send button is not visible and comment button is disabled when no text is added
    expect(page.locator('[data-testid="send-button"]')).not.toBeVisible();
    expect(
      await page.locator('[data-testid="comment-button"]').isDisabled()
    ).toBeTruthy();

    await page.fill(
      '[data-testid="editor-wrapper"] .ql-editor',
      'Test comment added'
    );
    const addComment = page.waitForResponse('/api/v1/feed/*/posts');
    await page.getByTestId('comment-button').click({ force: true });
    await addComment;

    // Close the task from the Button.Group, should throw error when no comment is added.
    await page.getByRole('button', { name: 'down' }).click();
    await page.waitForSelector('.ant-dropdown', {
      state: 'visible',
    });

    await page.getByRole('menuitem', { name: 'close' }).click();

    await toastNotification(page, 'Task cannot be closed without a comment.');

    // Close the task from the Button.Group, with comment is added.
    await page.fill(
      '[data-testid="editor-wrapper"] .ql-editor',
      'Closing the task with comment'
    );
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

    const openTask = await page.getByTestId('open-task').textContent();

    expect(openTask).toContain('0 Open');

    const closedTask = await page.getByTestId('closed-task').textContent();

    expect(closedTask).toContain('1 Closed');
  });
});

test.describe('Activity feed with Data Steward User', () => {
  test.slow(true);

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { afterAction, apiContext } = await performAdminLogin(browser);

    await entity.create(apiContext);
    await entity2.create(apiContext);
    await user1.create(apiContext);
    await user2.create(apiContext);
    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { afterAction, apiContext } = await performAdminLogin(browser);
    await entity.delete(apiContext);
    await entity2.delete(apiContext);
    await user1.delete(apiContext);
    await user2.delete(apiContext);

    await afterAction();
  });

  test('Create and Assign Task with Suggestions', async ({ browser }) => {
    const { page: page1, afterAction: afterActionUser1 } =
      await performUserLogin(browser, user1);
    const { page: page2, afterAction: afterActionUser2 } =
      await performUserLogin(browser, user2);

    const value: TaskDetails = {
      term: entity.entity.name,
      assignee: user2.responseData.name,
    };

    await test.step('Create, Close and Assign Task to User 2', async () => {
      await redirectToHomePage(page1);
      await entity.visitEntityPage(page1);

      // Create 2 task for the same entity, one to close and 2nd for the user2 action
      await page1.getByTestId('request-description').click();
      await createDescriptionTask(page1, value);

      await page1.getByTestId('schema').click();

      await page1.getByTestId('request-entity-tags').click();

      // create tag task
      await createTagTask(page1, { ...value, tag: 'PII.None' });

      // Should only see the close and comment button
      expect(
        await page1.locator('[data-testid="comment-button"]').isDisabled()
      ).toBeTruthy();
      expect(page1.locator('[data-testid="close-button"]')).toBeVisible();
      expect(
        page1.locator('[data-testid="edit-accept-task-dropdown"]')
      ).not.toBeVisible();

      // Close 1st task
      await page1.fill(
        '[data-testid="editor-wrapper"] .ql-editor',
        'Closing the task with comment'
      );
      const commentWithCloseTask = page1.waitForResponse(
        '/api/v1/feed/tasks/*/close'
      );
      page1.locator('[data-testid="close-button"]').click();
      await commentWithCloseTask;

      // TODO: Ashish - Fix the toast notification once issue is resolved from Backend https://github.com/open-metadata/OpenMetadata/issues/17059

      //   await toastNotification(page1, 'Task closed successfully.');
      await toastNotification(
        page1,
        'An exception with message [Cannot invoke "java.util.List.stream()" because "owners" is null] was thrown while processing request.'
      );

      // TODO: Ashish - Enable them once issue is resolved from Backend https://github.com/open-metadata/OpenMetadata/issues/17059
      //   const openTask = await page1.getByTestId('open-task').textContent();
      //   expect(openTask).toContain('1 Open');
      //   const closedTask = await page1.getByTestId('closed-task').textContent();
      //   expect(closedTask).toContain('1 Closed');

      await afterActionUser1();
    });

    await test.step('Accept Task By User 2', async () => {
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

      const entityPageTaskTab = page2.waitForResponse(
        '/api/v1/feed?*&type=Task'
      );

      const tagsTask = page2.getByTestId('redirect-task-button-link').first();
      const tagsTaskContent = await tagsTask.innerText();

      expect(tagsTaskContent).toContain('Request tags for');

      await tagsTask.click();
      await entityPageTaskTab;

      // TODO: Ashish - Enable them once issue is resolved from Backend https://github.com/open-metadata/OpenMetadata/issues/17059
      // Count for task should be 1 both open and closed

      //   const openTaskBefore = await page2.getByTestId('open-task').textContent();
      //   expect(openTaskBefore).toContain('1 Open');

      //   const closedTaskBefore = await page2
      //     .getByTestId('closed-task')
      //     .textContent();
      //   expect(closedTaskBefore).toContain('1 Closed');

      // Should not see the close button
      expect(page2.locator('[data-testid="close-button"]')).not.toBeVisible();

      expect(
        await page2.locator('[data-testid="comment-button"]').isDisabled()
      ).toBeTruthy();

      expect(
        page2.locator('[data-testid="edit-accept-task-dropdown"]')
      ).toBeVisible();

      await page2.getByText('Accept Suggestion').click();

      await toastNotification(page2, /Task resolved successfully/);

      // TODO: Ashish - Enable them once issue is resolved from Backend https://github.com/open-metadata/OpenMetadata/issues/17059
      //   const openTask = await page2.getByTestId('open-task').textContent();
      //   expect(openTask).toContain('0 Open');

      const closedTask = await page2.getByTestId('closed-task').textContent();

      expect(closedTask).toContain('1 Closed');

      await afterActionUser2();
    });
  });

  test('Create and Assign Task without Suggestions', async ({ browser }) => {
    const { page: page1, afterAction: afterActionUser1 } =
      await performUserLogin(browser, user1);
    const { page: page2, afterAction: afterActionUser2 } =
      await performUserLogin(browser, user2);

    const value: TaskDetails = {
      term: entity2.entity.name,
      assignee: user2.responseData.name,
    };

    await test.step('Create, Close and Assign Task to user 2', async () => {
      await redirectToHomePage(page1);
      await entity2.visitEntityPage(page1);

      await updateDescription(page1, '');

      // Create 2 task for the same entity, one to close and 2nd for the user2 action
      await page1.getByTestId('request-description').click();

      await createDescriptionTask(page1, value, false);

      await page1.getByTestId('schema').click();

      await page1.getByTestId('request-entity-tags').click();

      // create tag task
      await createTagTask(page1, value, false);

      // Should only see the close, add and comment button
      expect(
        await page1.locator('[data-testid="comment-button"]').isDisabled()
      ).toBeTruthy();
      expect(page1.locator('[data-testid="close-button"]')).toBeVisible();
      expect(
        page1.locator('[data-testid="edit-accept-task-dropdown"]')
      ).not.toBeVisible();
      expect(
        page1.locator('[data-testid="add-close-task-dropdown"]')
      ).not.toBeVisible();

      await afterActionUser1();
    });

    await test.step(
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

        const entityPageTaskTab = page2.waitForResponse(
          '/api/v1/feed?*&type=Task'
        );

        const tagsTask = page2.getByTestId('redirect-task-button-link').first();
        const tagsTaskContent = await tagsTask.innerText();

        expect(tagsTaskContent).toContain('Request tags for');

        await tagsTask.click();
        await entityPageTaskTab;

        expect(page2.getByTestId('noDiff-placeholder')).toBeVisible();

        // Should see the add_close dropdown and comment button
        expect(
          await page2.locator('[data-testid="comment-button"]').isDisabled()
        ).toBeTruthy();
        await expect(
          page2.getByTestId('add-close-task-dropdown')
        ).toBeVisible();
        await expect(
          page2.locator('[data-testid="close-button"]')
        ).not.toBeVisible();
        await expect(
          page2.locator('[data-testid="edit-accept-task-dropdown"]')
        ).not.toBeVisible();

        await page2.getByRole('button', { name: 'Add Tags' }).click();

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
        const dropdownValue = page2.getByTestId(`tag-PII.None`);
        await dropdownValue.hover();
        await dropdownValue.click();

        await expect(page2.getByTestId('selected-tag-PII.None')).toBeVisible();

        await page2.getByText('OK').click();

        await toastNotification(page2, /Task resolved successfully/);

        // Accept the description task

        await expect(page2.getByText('No Suggestion')).toBeVisible();

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
});
