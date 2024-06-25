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
import { descriptionBox } from './common';

export type TaskDetails = {
  assignee?: string;
  term: string;
  displayName?: string;
  entity?: string;
  serviceName?: string;
  entityType?: string;
  schemaName?: string;
  tag?: string;
};

const assignee = 'adam.matthews2';
const tag = 'PII.None';

export const createDescriptionTask = async (
  page: Page,
  value: TaskDetails,
  assigneeDisabled?: boolean
) => {
  expect(await page.locator('#title').inputValue()).toBe(
    `Update description for table ${value.term}`
  );

  if (assigneeDisabled) {
    expect(
      await page
        .locator('[data-testid="select-assignee"] > .ant-select-selector')
        .innerText()
    ).toBe(value.assignee);

    expect(
      await page
        .locator('[data-testid="select-assignee"] > .ant-select-selector input')
        .isDisabled()
    );
  } else {
    const assigneeField = page.locator(
      '[data-testid="select-assignee"] > .ant-select-selector #assignees'
    );
    await assigneeField.click();

    await assigneeField.fill(value.assignee ?? assignee);

    // select value from dropdown
    const dropdownValue = page.getByTestId(value.assignee ?? assignee);
    await dropdownValue.hover();
    await dropdownValue.click();
    await page.click('body');
  }

  const descriptionContainer = page.locator(descriptionBox);
  await descriptionContainer.scrollIntoViewIfNeeded();
  await descriptionContainer.fill('Updated description');

  await page.click('button[type="submit"]');

  await expect(page.getByRole('alert').first()).toHaveText(
    /Task created successfully./
  );

  await page.getByLabel('close').first().click();
};

export const createTagTask = async (
  page: Page,
  value: TaskDetails,
  assigneeDisabled?: boolean
) => {
  expect(await page.locator('#title').inputValue()).toBe(
    `Request tags for table ${value.term}`
  );

  if (assigneeDisabled) {
    expect(
      await page
        .locator('[data-testid="select-assignee"] > .ant-select-selector')
        .innerText()
    ).toBe(value.assignee);

    expect(
      await page
        .locator('[data-testid="select-assignee"] > .ant-select-selector input')
        .isDisabled()
    );
  } else {
    // select assignee
    const assigneeField = page.locator(
      '[data-testid="select-assignee"] > .ant-select-selector #assignees'
    );
    await assigneeField.click();
    await assigneeField.fill(value.assignee ?? assignee);
    // select value from dropdown
    const dropdownValue = page.getByTestId(value.assignee ?? assignee);
    await dropdownValue.hover();
    await dropdownValue.click();
    await page.mouse.click(200, 200);
  }

  // select tags
  const suggestTags = page.locator(
    '[data-testid="tag-selector"] > .ant-select-selector .ant-select-selection-search-input'
  );
  await suggestTags.click();

  const querySearchResponse = page.waitForResponse(
    `/api/v1/search/query?q=*${value.tag ?? tag}*&index=tag_search_index&*`
  );
  await suggestTags.fill(value.tag ?? tag);

  await querySearchResponse;

  // select value from dropdown
  const dropdownValue = page.getByTestId(`tag-${value.tag ?? tag}`);
  await dropdownValue.hover();
  await dropdownValue.click();
  await page.mouse.click(200, 200);

  await page.click('button[type="submit"]');

  await expect(page.getByRole('alert').first()).toHaveText(
    /Task created successfully./
  );

  await page.getByLabel('close').first().click();
};
