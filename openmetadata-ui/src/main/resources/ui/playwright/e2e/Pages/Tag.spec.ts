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
import { expect, test } from '@playwright/test';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import {
  createNewPage,
  getApiContext,
  redirectToHomePage,
} from '../../utils/common';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Tag page', () => {
  const classification = new ClassificationClass({
    provider: 'system',
    mutuallyExclusive: true,
  });

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await classification.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await classification.delete(apiContext);
    await afterAction();
  });

  test('Verify Tag UI', async ({ page }) => {
    await redirectToHomePage(page);
    const { apiContext, afterAction } = await getApiContext(page);
    const tag = new TagClass({
      classification: classification.data.name,
    });
    try {
      await tag.create(apiContext);
      const res = page.waitForResponse(`/api/v1/tags/name/*`);
      await tag.visitPage(page);
      await res;

      await expect(page.getByText(tag.data.name)).toBeVisible();
      await expect(page.getByText(tag.data.description)).toBeVisible();

      const classificationTable = page.waitForResponse(
        `/api/v1/classifications/name/*`
      );
      await page.getByRole('link', { name: classification.data.name }).click();
      classificationTable;

      await page.getByTestId(tag.data.name).click();
      await res;

      const classificationPage = page.waitForResponse(
        `/api/v1/classifications*`
      );
      await page.getByRole('link', { name: 'Classifications' }).click();
      await classificationPage;
    } finally {
      await tag.delete(apiContext);
      await afterAction();
    }
  });

  test('Rename Tag name', async ({ page }) => {
    await redirectToHomePage(page);
    const { apiContext, afterAction } = await getApiContext(page);
    const tag = new TagClass({
      classification: classification.data.name,
    });
    try {
      await tag.create(apiContext);
      const res = page.waitForResponse(`/api/v1/tags/name/*`);
      await tag.visitPage(page);
      await res;
      await page.getByTestId('manage-button').click();

      await expect(
        page.locator('.ant-dropdown-placement-bottomRight')
      ).toBeVisible();

      await page.getByRole('menuitem', { name: 'Rename' }).click();

      await expect(page.getByRole('dialog')).toBeVisible();

      await page.getByPlaceholder('Enter display name').fill('TestDisplayName');

      const updateName = page.waitForResponse(`/api/v1/tags/*`);
      await page.getByTestId('save-button').click();
      updateName;

      await expect(page.getByText('TestDisplayName')).toBeVisible();
    } finally {
      await tag.delete(apiContext);
      await afterAction();
    }
  });

  test('Restyle Tag', async ({ page }) => {
    await redirectToHomePage(page);
    const { apiContext, afterAction } = await getApiContext(page);
    const tag = new TagClass({
      classification: classification.data.name,
    });
    try {
      await tag.create(apiContext);
      const res = page.waitForResponse(`/api/v1/tags/name/*`);
      await tag.visitPage(page);
      await res;
      await page.getByTestId('manage-button').click();

      await expect(
        page.locator('.ant-dropdown-placement-bottomRight')
      ).toBeVisible();

      await page.getByRole('menuitem', { name: 'Style' }).click();

      await expect(page.getByRole('dialog')).toBeVisible();

      await page.getByTestId('color-color-input').fill('#6366f1');

      const updateColor = page.waitForResponse(`/api/v1/tags/*`);
      await page.locator('button[type="submit"]').click();
      updateColor;

      await expect(page.getByText(tag.data.name)).toBeVisible();
    } finally {
      await tag.delete(apiContext);
      await afterAction();
    }
  });

  test('Edit Tag Description', async ({ page }) => {
    await redirectToHomePage(page);
    const { apiContext, afterAction } = await getApiContext(page);
    const tag = new TagClass({
      classification: classification.data.name,
    });
    try {
      await tag.create(apiContext);
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
    } finally {
      await tag.delete(apiContext);
      await afterAction();
    }
  });

  test('Delete a Tag', async ({ page }) => {
    await redirectToHomePage(page);
    const { apiContext, afterAction } = await getApiContext(page);
    const tag = new TagClass({
      classification: classification.data.name,
    });
    try {
      await tag.create(apiContext);
      const res = page.waitForResponse(`/api/v1/tags/name/*`);
      await tag.visitPage(page);
      await res;
      await page.getByTestId('manage-button').click();

      await expect(
        page.locator('.ant-dropdown-placement-bottomRight')
      ).toBeVisible();

      await page.getByRole('menuitem', { name: 'Delete' }).click();

      await expect(page.getByRole('dialog')).toBeVisible();

      await page.getByTestId('confirmation-text-input').fill('DELETE');

      const deleteTag = page.waitForResponse(`/api/v1/tags/*`);
      await page.getByTestId('confirm-button').click();
      deleteTag;

      await expect(
        page.getByText(classification.data.description)
      ).toBeVisible();
    } finally {
      await afterAction();
    }
  });

  test('Add Asset to a Tag', async ({ page }) => {
    await redirectToHomePage(page);
    const { apiContext, afterAction } = await getApiContext(page);
    const tag = new TagClass({
      classification: classification.data.name,
    });
    try {
      await tag.create(apiContext);
      const res = page.waitForResponse(`/api/v1/tags/name/*`);
      await tag.visitPage(page);
      await res;
      await page.getByTestId('data-classification-add-button').click();

      await expect(page.getByRole('dialog')).toBeVisible();

      await page
        .locator('#tabledatacard-aa1d01d8-42e6-4170-8a68-dbcf03905cea')
        .getByLabel('')
        .click();

      const deleteTag = page.waitForResponse(`/api/v1/tags/*/assets/add`);
      await page.getByTestId('save-btn').click();
      deleteTag;

      await page.getByRole('tab', { name: 'Assets' }).click();

      await expect(page.getByTestId('entity-link')).toContainText('shopify');
    } finally {
      await tag.delete(apiContext);
      await afterAction();
    }
  });
});
