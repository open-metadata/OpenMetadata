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
import { descriptionBox } from './common';
import { TaskDetails } from './task';

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

  await expect(page.getByTestId('markdown-parser')).toContainText(
    taskValue.oldDescription ?? ''
  );
};

export const deleteFeedComments = async (page: Page, feed: Locator) => {
  await feed.click();
  await page.locator('[data-testid="delete-message"]').click();

  await page.waitForSelector('[role="dialog"].ant-modal');

  const deleteResponse = page.waitForResponse('/api/v1/feed/*/posts/*');

  await page.getByTestId('save-button').click();

  await deleteResponse;
};
