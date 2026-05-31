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

export const TASK_OPEN_FETCH_LINK = '/api/v1/tasks**';

const isTaskCreateRequest = (url: string) =>
  /\/api\/v1\/tasks(?:\?|$)/.test(url) &&
  !url.includes('/resolve') &&
  !url.includes('/close') &&
  !url.includes('/comments');

export const waitForTaskListResponse = (page: Page) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      (response.url().includes('/api/v1/tasks?') ||
        response.url().includes('/api/v1/tasks/assigned') ||
        response.url().includes('/api/v1/tasks/owned') ||
        response.url().includes('/api/v1/tasks/created'))
  );

export const waitForTaskCountResponse = (page: Page) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().includes('/api/v1/tasks/count')
  );

export const waitForTaskCreateResponse = (page: Page) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      isTaskCreateRequest(response.url())
  );

export const waitForTaskResolveResponse = (page: Page) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/api\/v1\/tasks\/[^/]+\/resolve(?:\?|$)/.test(response.url())
  );

export const waitForTaskActionResponse = (page: Page) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/api\/v1\/tasks\/[^/]+\/(resolve|close)(?:\?|$)/.test(response.url())
  );

export const waitForTaskCommentResponse = (page: Page) =>
  page.waitForResponse(
    (response) =>
      ['POST', 'PATCH', 'DELETE'].includes(response.request().method()) &&
      /\/api\/v1\/tasks\/[^/]+\/comments(?:\/[^/]+)?(?:\?|$)/.test(
        response.url()
      )
  );

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
    await assigneeField.fill(value.assignee);

    // select value from dropdown
    const dropdownValue = page.getByTestId(value.assignee);
    await expect(dropdownValue).toBeVisible();
    await dropdownValue.hover();
    await dropdownValue.click();
    await clickOutside(page);
  }

  if (addDescription) {
    await page
      .locator(descriptionBox)
      .fill(value.description ?? 'Updated description');
  }
  const taskResponse = waitForTaskCreateResponse(page);
  await page.click('button[type="submit"]');
  await taskResponse;

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
    await assigneeField.fill(value.assignee);

    // select value from dropdown
    const dropdownValue = page.getByTestId(value.assignee);
    await expect(dropdownValue).toBeVisible();
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

  const taskResponse = waitForTaskCreateResponse(page);
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
