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
import { expect, Page } from '@playwright/test';
import { isUndefined } from 'lodash';
import { clickOutside, descriptionBox, toastNotification } from './common';

export type TaskDetails = {
  term: string;
  assignee?: string;
  tag?: string;
  description?: string;
  oldDescription?: string;
  columnName?: string;
};

const tag = 'PII.None';

export const TASK_OPEN_FETCH_LINK = '/api/v1/feed**&type=Task&taskStatus=Open';

export const createDescriptionTask = async (
  page: Page,
  value: TaskDetails,
  addDescription = true,
  assigneeDisabled?: boolean
) => {
  await expect(page.locator('#title')).toHaveValue(
    `${addDescription ? 'Update' : 'Request'} description for table ${
      value.columnName
        ? `${value.term} columns/${value.columnName}`
        : value.term
    }`
  );

  if (isUndefined(value.assignee) || assigneeDisabled) {
    await expect(
      page.locator('[data-testid="select-assignee"] > .ant-select-selector')
    ).toHaveText(value.assignee);

    await expect(
      page.locator(
        '[data-testid="select-assignee"] > .ant-select-selector input'
      )
    ).toBeDisabled();
  } else {
    const assigneeField = page.locator(
      '[data-testid="select-assignee"] > .ant-select-selector #assignees'
    );
    await assigneeField.click();

    const userSearchResponse = page.waitForResponse(
      `/api/v1/search/query?q=*${value.assignee}**&index=user%2Cteam*`
    );

    await assigneeField.fill(value.assignee);
    await userSearchResponse;

    // select value from dropdown
    const dropdownValue = page.getByTestId(value.assignee);
    await dropdownValue.hover();
    await dropdownValue.click();
    await clickOutside(page);
  }

  if (addDescription) {
    await page
      .locator(descriptionBox)
      .fill(value.description ?? 'Updated description');
  }
  await page.click('button[type="submit"]');

  await toastNotification(page, /Task created successfully./);
};

export const createTagTask = async (
  page: Page,
  value: TaskDetails,
  addTag = true,
  assigneeDisabled?: boolean
) => {
  await expect(page.locator('#title')).toHaveValue(
    `Request tags for table ${value.term}`
  );

  if (isUndefined(value.assignee) || assigneeDisabled) {
    await expect(
      page.locator('[data-testid="select-assignee"] > .ant-select-selector')
    ).toHaveText(value.assignee);

    await expect(
      page.locator(
        '[data-testid="select-assignee"] > .ant-select-selector input'
      )
    ).toBeDisabled();
  } else {
    // select assignee
    const assigneeField = page.locator(
      '[data-testid="select-assignee"] > .ant-select-selector #assignees'
    );
    await assigneeField.click();

    const userSearchResponse = page.waitForResponse(
      `/api/v1/search/query?q=*${value.assignee}**&index=user%2Cteam*`
    );
    await assigneeField.fill(value.assignee);
    await userSearchResponse;

    // select value from dropdown
    const dropdownValue = page.getByTestId(value.assignee);
    await dropdownValue.hover();
    await dropdownValue.click();
    await clickOutside(page);
  }

  if (addTag) {
    // select tags
    const suggestTags = page.locator(
      '[data-testid="tag-selector"] > .ant-select-selector .ant-select-selection-search-input'
    );
    await suggestTags.click();

    const querySearchResponse = page.waitForResponse(
      `/api/v1/search/query?q=*${value.tag ?? tag}*&index=tag&*`
    );
    await suggestTags.fill(value.tag ?? tag);

    await querySearchResponse;

    // select value from dropdown
    const dropdownValue = page.getByTestId(`tag-${value.tag ?? tag}`).first();
    await dropdownValue.hover();
    await dropdownValue.click();
    await clickOutside(page);
  }

  const taskResponse = page.waitForResponse(`/api/v1/feed`);
  await page.click('button[type="submit"]');
  await taskResponse;

  await toastNotification(page, /Task created successfully./);
};

export const checkTaskCountInActivityFeed = async (
  page: Page,
  openTask = 0,
  closedTask = 0
) => {
  await page.locator('.ant-skeleton-element').first().waitFor({
    state: 'detached',
  });
  await page.getByTestId('user-profile-page-task-filter-icon').click();
  const openTaskItem = page
    .locator('.task-tab-custom-dropdown .task-count-text')
    .first();

  await expect(openTaskItem).toHaveText(String(openTask));

  const closedTaskItem = page
    .locator('.task-tab-custom-dropdown .task-count-text')
    .last();

  await expect(closedTaskItem).toHaveText(String(closedTask));
};
