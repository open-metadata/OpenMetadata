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
import { expect, Locator, Page } from '@playwright/test';
import { descriptionBox, removeLandingBanner } from './common';
import { TaskDetails } from './task';

export const REACTION_EMOJIS = ['🚀', '😕', '👀', '❤️', '🎉', '😄', '👎', '👍'];

export const FEED_REACTIONS = [
  'thumbsUp',
  'thumbsDown',
  'laugh',
  'hooray',
  'confused',
  'heart',
  'eyes',
  'rocket',
];
// Returns the nth feed message container (0-based) regardless of page context (widget, drawer, or full page)
const getNthFeedMessage = (page: Page, indexZeroBased: number) =>
  page.locator('[data-testid="message-container"]').nth(indexZeroBased);

export const checkDescriptionInEditModal = async (
  page: Page,
  taskValue: TaskDetails
) => {
  const taskContent = await page.getByTestId('task-title').innerText();

  expect(taskContent).toContain(`Request to update description for`);

  await page.getByRole('button', { name: 'down' }).click();
  await page.waitForSelector('.ant-dropdown', {
    state: 'visible',
  });

  await page.getByRole('menuitem', { name: 'edit' }).click();

  await expect(page.locator('[role="dialog"].ant-modal')).toBeVisible();

  await expect(page.locator('.ant-modal-title')).toContainText(
    `Update description for table ${taskValue.term} columns/${taskValue.columnName}`
  );

  await expect(page.locator(descriptionBox)).toContainText(
    taskValue.description ?? ''
  );

  // click on the Current tab
  await page.getByRole('tab', { name: 'current' }).click();

  const taskDescriptionTabs = page.getByTestId('task-description-tabs');

  await expect(
    taskDescriptionTabs
      .locator('.ant-tabs-content-holder')
      .getByTestId('markdown-parser')
      .first()
  ).toContainText(taskValue.oldDescription ?? '');
};

export const deleteFeedComments = async (page: Page, feed: Locator) => {
  await feed.locator('.feed-reply-card-v2').click();

  await page.waitForSelector('[data-testid="feed-actions"]', {
    state: 'visible',
  });

  await page.locator('[data-testid="delete-message"]').click();

  await page.waitForSelector('[role="dialog"].ant-modal');

  const deleteResponse = page.waitForResponse('/api/v1/feed/*/posts/*');

  await page.getByTestId('save-button').click();

  await deleteResponse;
};

export const reactOnFeed = async (page: Page, feedNumber: number) => {
  // Ensure at least one message exists; the caller usually checks, but we guard here
  const message = getNthFeedMessage(page, Math.max(0, feedNumber - 1));

  await expect(message).toBeVisible();

  for (const reaction of FEED_REACTIONS) {
    const addReactionButton = message
      .locator('[data-testid="feed-reaction-container"]')
      .locator('[data-testid="add-reactions"]');

    await expect(addReactionButton).toBeVisible();

    await addReactionButton.click();

    await page
      .locator('.ant-popover-feed-reactions .ant-popover-inner-content')
      .waitFor({ state: 'visible' });

    const waitForReactionResponse = page.waitForResponse('/api/v1/feed/*');
    await page
      .locator(`[data-testid="reaction-button"][title="${reaction}"]`)
      .click();
    await waitForReactionResponse;
  }
};

export const addMentionCommentInFeed = async (
  page: Page,
  user: string,
  isReply = false
) => {
  if (!isReply) {
    const fetchFeedResponse = page.waitForResponse(
      '/api/v1/feed?type=Conversation*'
    );
    await removeLandingBanner(page);
    await fetchFeedResponse;
  }

  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  const firstMessage = getNthFeedMessage(page, 0);

  await expect(firstMessage).toBeVisible();

  await firstMessage.locator('[data-testid="reply-count"]').click();
  await page.waitForSelector('.ant-drawer-content', {
    state: 'visible',
  });
  await page.getByTestId('comments-input-field').click();

  const userSuggestionsResponse = page.waitForResponse(
    `/api/v1/search/query?q=*${user}***`
  );

  await page
    .locator(
      '[data-testid="editor-wrapper"] [contenteditable="true"].ql-editor'
    )
    .fill(`Can you resolve this thread for me? @${user}`);
  await userSuggestionsResponse;

  await page.locator(`[data-value="@${user}"]`).first().click();

  // Send reply
  await expect(page.locator('[data-testid="send-button"]')).toBeVisible();
  await expect(page.locator('[data-testid="send-button"]')).not.toBeDisabled();

  const postReplyResponse = page.waitForResponse('/api/v1/feed/*/posts');
  await page.locator('[data-testid="send-button"]').click();
  await postReplyResponse;
};
