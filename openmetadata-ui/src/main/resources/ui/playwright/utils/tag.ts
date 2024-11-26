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
import { get } from 'lodash';
import { SidebarItem } from '../constant/sidebar';
import { DashboardClass } from '../support/entity/DashboardClass';
import { EntityClass } from '../support/entity/EntityClass';
import { TableClass } from '../support/entity/TableClass';
import { TopicClass } from '../support/entity/TopicClass';
import { TagClass } from '../support/tag/TagClass';
import {
  getApiContext,
  NAME_MIN_MAX_LENGTH_VALIDATION_ERROR,
  NAME_VALIDATION_ERROR,
  redirectToHomePage,
} from './common';
import { sidebarClick } from './sidebar';

export const TAG_INVALID_NAMES = {
  MIN_LENGTH: 'c',
  MAX_LENGTH:
    'a87439625b1c2d3e4f5061728394a5b6c7d8e90a1b2c3d4e5f67890aba87439625b1c2d3e4f5061728394a5',
  WITH_SPECIAL_CHARS: '!@#$%^&*()',
};

export const visitClassificationPage = async (
  page: Page,
  classificationName: string
) => {
  await redirectToHomePage(page);
  const classificationResponse = page.waitForResponse(
    '/api/v1/classifications?**'
  );
  await sidebarClick(page, SidebarItem.TAGS);
  await classificationResponse;
  await page
    .locator(`[data-testid="side-panel-classification"]`)
    .filter({ hasText: classificationName })
    .click();

  await expect(page.locator('.activeCategory')).toContainText(
    classificationName
  );
};

export const addAssetsToTag = async (page: Page, assets: EntityClass[]) => {
  await page.getByTestId('assets').click();
  await page.getByTestId('data-classification-add-button').click();

  await expect(page.getByRole('dialog')).toBeVisible();

  for (const asset of assets) {
    const name = get(asset, 'entityResponseData.name');
    const fqn = get(asset, 'entityResponseData.fullyQualifiedName');

    const searchRes = page.waitForResponse(
      `/api/v1/search/query?q=${name}&index=all&from=0&size=25&*`
    );
    await page
      .getByTestId('asset-selection-modal')
      .getByTestId('searchbar')
      .fill(name);
    await searchRes;

    await page.locator(`[data-testid="table-data-card_${fqn}"] input`).check();
  }

  const assetsAddRes = page.waitForResponse(`/api/v1/tags/*/assets/add`);
  await page.getByTestId('save-btn').click();
  await assetsAddRes;
};

export const removeAssetsFromTag = async (
  page: Page,
  assets: EntityClass[]
) => {
  await page.getByTestId('assets').click();
  for (const asset of assets) {
    const fqn = get(asset, 'entityResponseData.fullyQualifiedName');
    await page.locator(`[data-testid="table-data-card_${fqn}"] input`).check();
  }

  const assetsRemoveRes = page.waitForResponse(`/api/v1/tags/*/assets/remove`);

  await page.getByTestId('delete-all-button').click();
  await assetsRemoveRes;
};

export const checkAssetsCount = async (page: Page, count: number) => {
  await expect(
    page.getByTestId('assets').getByTestId('filter-count')
  ).toContainText(count.toString());
};

export const setupAssetsForTag = async (page: Page) => {
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const topic = new TopicClass();
  const dashboard = new DashboardClass();
  await Promise.all([
    table.create(apiContext),
    topic.create(apiContext),
    dashboard.create(apiContext),
  ]);

  const assetCleanup = async () => {
    await Promise.all([
      table.delete(apiContext),
      topic.delete(apiContext),
      dashboard.delete(apiContext),
    ]);
    await afterAction();
  };

  return {
    assets: [table, topic, dashboard],
    assetCleanup,
  };
};

export async function submitForm(page: Page) {
  await page.locator('button[type="submit"]').scrollIntoViewIfNeeded();
  await page.locator('button[type="submit"]').click();
}

export async function validateForm(page: Page) {
  // submit form without any data to trigger validation
  await submitForm(page);

  // error messages
  await expect(page.locator('#tags_name_help')).toBeVisible();
  await expect(page.locator('#tags_name_help')).toContainText(
    'Name is required'
  );

  await expect(page.locator('#tags_description_help')).toBeVisible();
  await expect(page.locator('#tags_description_help')).toContainText(
    'Description is required'
  );

  // validation should work for invalid names

  // min length validation
  await page.locator('[data-testid="name"]').scrollIntoViewIfNeeded();
  await page.locator('[data-testid="name"]').clear();
  await page.locator('[data-testid="name"]').fill(TAG_INVALID_NAMES.MIN_LENGTH);
  await page.waitForLoadState('domcontentloaded');

  await expect(
    page.getByText(NAME_MIN_MAX_LENGTH_VALIDATION_ERROR)
  ).toBeVisible();

  // max length validation
  await page.locator('[data-testid="name"]').clear();
  await page.locator('[data-testid="name"]').fill(TAG_INVALID_NAMES.MAX_LENGTH);
  await page.waitForLoadState('domcontentloaded');

  await expect(
    page.getByText(NAME_MIN_MAX_LENGTH_VALIDATION_ERROR)
  ).toBeVisible();

  // with special char validation
  await page.locator('[data-testid="name"]').clear();
  await page
    .locator('[data-testid="name"]')
    .fill(TAG_INVALID_NAMES.WITH_SPECIAL_CHARS);
  await page.waitForLoadState('domcontentloaded');

  await expect(page.getByText(NAME_VALIDATION_ERROR)).toBeVisible();
}

export const addTagToTableColumn = async (
  page: Page,
  {
    tagName,
    tagFqn,
    tagDisplayName,
    tableId,
    columnNumber,
    rowName,
  }: {
    tagName: string;
    tagFqn: string;
    tagDisplayName: string;
    tableId: string;
    columnNumber: number;
    rowName: string;
  }
) => {
  await page.click(
    `[data-testid="classification-tags-${columnNumber}"] [data-testid="entity-tags"] [data-testid="add-tag"]`
  );
  await page.fill('[data-testid="tag-selector"] input', tagName);
  await page.click(`[data-testid="tag-${tagFqn}"]`);

  await expect(
    page.locator('[data-testid="tag-selector"] > .ant-select-selector')
  ).toContainText(tagDisplayName);

  const saveAssociatedTag = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response.url().includes(`/api/v1/tables/${tableId}`)
  );
  await page.click('[data-testid="saveAssociatedTag"]');
  await saveAssociatedTag;

  await page.waitForSelector('.ant-select-dropdown', {
    state: 'detached',
  });

  await expect(
    page.getByRole('row', { name: rowName }).getByTestId('tags-container')
  ).toContainText(tagDisplayName);

  await expect(
    page.locator(
      `[data-testid="classification-tags-${columnNumber}"] [data-testid="tags-container"] [data-testid="tag-${tagFqn}"]`
    )
  ).toBeVisible();
};

export const verifyTagPageUI = async (
  page: Page,
  classificationName: string,
  tag: TagClass,
  limitedAccess = false
) => {
  await redirectToHomePage(page);
  const res = page.waitForResponse(`/api/v1/tags/name/*`);
  await tag.visitPage(page);
  await res;

  await expect(page.getByTestId('entity-header-name')).toContainText(
    tag.data.name
  );
  await expect(page.getByText(tag.data.description)).toBeVisible();

  if (limitedAccess) {
    await expect(
      page.getByTestId('data-classification-add-button')
    ).not.toBeVisible();
    await expect(page.getByTestId('manage-button')).not.toBeVisible();
    await expect(page.getByTestId('add-domain')).not.toBeVisible();

    // Asset tab should show no data placeholder and not add asset button
    await page.getByTestId('assets').click();

    await expect(page.getByTestId('no-data-placeholder')).toBeVisible();
  }

  const classificationTable = page.waitForResponse(
    `/api/v1/classifications/name/*`
  );
  await page.getByRole('link', { name: classificationName }).click();
  classificationTable;

  await page.getByTestId(tag.data.name).click();
  await res;

  const classificationPage = page.waitForResponse(`/api/v1/classifications*`);
  await page.getByRole('link', { name: 'Classifications' }).click();
  await classificationPage;
};

export const editTagPageDescription = async (page: Page, tag: TagClass) => {
  await redirectToHomePage(page);
  const res = page.waitForResponse(`/api/v1/tags/name/*`);
  await tag.visitPage(page);
  await res;
  await page.getByTestId('edit-description').click();

  await expect(page.getByRole('dialog')).toBeVisible();

  await page.locator('.toastui-editor-pseudo-clipboard').clear();
  await page
    .locator('.toastui-editor-pseudo-clipboard')
    .fill(`This is updated test description for tag ${tag.data.name}.`);

  const editDescription = page.waitForResponse(`/api/v1/tags/*`);
  await page.getByTestId('save').click();
  await editDescription;

  await expect(page.getByTestId('viewer-container')).toContainText(
    `This is updated test description for tag ${tag.data.name}.`
  );
};
