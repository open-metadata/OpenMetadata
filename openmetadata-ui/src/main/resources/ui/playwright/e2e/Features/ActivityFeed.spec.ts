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
  createNewPage,
  redirectToHomePage,
  toastNotification,
  visitUserProfilePage,
} from '../../utils/common';
import { clickOnLogo } from '../../utils/sidebar';
import {
  createDescriptionTask,
  createTagTask,
  TaskDetails,
} from '../../utils/task';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const entity = new TableClass();
const user = new UserClass();

test.describe('Activity feed', () => {
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await entity.create(apiContext);
    await user.create(apiContext);

    await afterAction();
  });

  test.beforeEach('Visit on landing page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await entity.delete(apiContext);
    await user.delete(apiContext);

    await afterAction();
  });

  test('Assigned task should appear to task tab', async ({ page }) => {
    const value: TaskDetails = {
      term: entity.entity.name,
      assignee: `${user.data.firstName}.${user.data.lastName}`,
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

  test('User should be able to reply on feeds in ActivityFeed', async ({
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

    for (let i = 1; i <= 3; i++) {
      await page.fill(
        '[data-testid="editor-wrapper"] .ql-editor',
        `Reply message ${i}`
      );
      const sendReply = page.waitForResponse('/api/v1/feed/*/posts');
      await page.getByTestId('send-button').click();
      await sendReply;
    }

    // Compare after adding some feeds in the right panel
    const rightPanelFeedTextCurrent = await page
      .locator(
        '.right-container [data-testid="message-container"] [data-testid="headerText"]'
      )
      .innerText();

    expect(secondFeedText).toBe(rightPanelFeedTextCurrent);

    for (let i = 1; i <= 3; i++) {
      await expect(
        page.locator('.right-container [data-testid="feed-replies"]')
      ).toContainText(`Reply message ${i}`);
    }
  });

  test('Comment and Close Task should work in Task Flow', async ({ page }) => {
    const value: TaskDetails = {
      term: entity.entity.name,
      assignee: `${user.data.firstName}.${user.data.lastName}`,
    };
    await entity.visitEntityPage(page);

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
    await page.getByTestId('comment-button').click();
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
