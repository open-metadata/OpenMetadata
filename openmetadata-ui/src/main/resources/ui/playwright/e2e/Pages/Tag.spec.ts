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
import test, { expect, Page } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { descriptionBox, redirectToHomePage, uuid } from '../../utils/common';
import { sidebarClick } from '../../utils/sidebar';
import { submitForm, validateForm } from '../../utils/tag';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Tag Page', async () => {
  const NEW_CLASSIFICATION = {
    name: `TestClassification-${uuid()}`,
    displayName: `TestClassification-${uuid()}`,
    description: 'This is a test Classification',
  };
  const NEW_TAG = {
    name: `TestTag-${uuid()}`,
    displayName: `TestTag-${uuid()}`,
    renamedName: `Tag-${uuid()}`,
    description: 'This is a test Tag',
    color: '#FF5733',
    id: `TestId-${uuid()}`,
  };

  const getTagPage = async (page: Page) => {
    await sidebarClick(page, SidebarItem.TAGS);
    await page.click('[data-testid="add-classification"]');
    await page.waitForSelector('.ant-modal-content', {
      state: 'visible',
    });

    await expect(page.locator('.ant-modal-content')).toBeVisible();

    await validateForm(page);

    await page.fill('[data-testid="name"]', NEW_CLASSIFICATION.name);
    await page.fill(
      '[data-testid="displayName"]',
      NEW_CLASSIFICATION.displayName
    );
    await page.fill(descriptionBox, NEW_CLASSIFICATION.description);
    await page.click('[data-testid="mutually-exclusive-button"]');

    const createTagCategoryResponse = page.waitForResponse(
      'api/v1/classifications'
    );
    await submitForm(page);
    await createTagCategoryResponse;

    await page.click(`text=${NEW_CLASSIFICATION.displayName}`);

    await expect(page.locator('.activeCategory')).toContainText(
      NEW_CLASSIFICATION.displayName
    );

    await page.click('[data-testid="add-new-tag-button"]');

    await page.waitForSelector('.ant-modal-content', {
      state: 'visible',
    });

    await expect(page.locator('.ant-modal-content')).toBeVisible();

    await validateForm(page);

    await page.fill('[data-testid="name"]', NEW_TAG.name);
    await page.fill('[data-testid="displayName"]', NEW_TAG.displayName);
    await page.fill(descriptionBox, NEW_TAG.description);
    await page.fill('[data-testid="tags_color-color-input"]', NEW_TAG.color);

    const createTagResponse = page.waitForResponse('api/v1/tags');
    await submitForm(page);
    await createTagResponse;

    await expect(page.locator('[data-testid="table"]')).toContainText(
      NEW_TAG.name
    );

    await expect(page.locator('[data-testid="table"]')).toContainText(
      NEW_TAG.name
    );

    await page.getByRole('link', { name: NEW_TAG.name }).click();
    await page.goto(`/tag/${NEW_CLASSIFICATION.name}.${NEW_TAG.name}`);
  };

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await getTagPage(page);
  });

  test('Name should be there when we move to the tag page', async ({
    page,
  }) => {
    await expect(page.getByText(NEW_TAG.name)).toBeVisible();
    await expect(page.getByText(NEW_TAG.description)).toBeVisible();
  });

  test('The breadcrumbs links should navigate to respective pages', async ({
    page,
  }) => {
    await page.getByRole('link', { name: 'Classifications' }).click();
    await page.goto('/tags');

    await page.getByText(NEW_CLASSIFICATION.displayName).click();
    await page.goto(`/tag/${NEW_CLASSIFICATION.name}.${NEW_TAG.name}`);

    await page.getByRole('link', { name: NEW_CLASSIFICATION.name }).click();
    await page.goto(`/tags/${NEW_CLASSIFICATION.name}`);
  });

  test('Rename should work', async ({ page }) => {
    await page.locator('[data-testid="manage-button"]').click();

    await expect(
      page.locator('.ant-dropdown-placement-bottomRight')
    ).toBeVisible();

    await page.getByRole('menuitem', { name: 'Rename' }).click();

    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByPlaceholder('Enter display name').fill('TestDisplayName');

    await page.getByTestId('save-button').scrollIntoViewIfNeeded();
    await page.getByTestId('save-button').click();

    await expect(page.getByText('TestDisplayName')).toBeVisible();
  });

  test('Style Update should work', async ({ page }) => {
    await page.locator('[data-testid="manage-button"]').click();

    await expect(
      page.locator('.ant-dropdown-placement-bottomRight')
    ).toBeVisible();

    await page.getByRole('menuitem', { name: 'Style' }).click();

    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByTestId('color-color-input').fill('#6366f1');

    await page.locator('button[type="submit"]').scrollIntoViewIfNeeded();
    await page.locator('button[type="submit"]').click();

    await expect(page.getByText(NEW_TAG.displayName)).toBeVisible();
  });

  test('Delete a Tag', async ({ page }) => {
    await page.locator('[data-testid="manage-button"]').click();

    await expect(
      page.locator('.ant-dropdown-placement-bottomRight')
    ).toBeVisible();

    await page.getByRole('menuitem', { name: 'Delete' }).click();

    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByTestId('confirmation-text-input').fill('DELETE');
    await page.getByTestId('confirm-button').scrollIntoViewIfNeeded();
    await page.getByTestId('confirm-button').click();
    await page.goto(`/tags/${NEW_CLASSIFICATION.name}`);

    await expect(page.locator('[data-testid="table"]')).not.toContainText(
      NEW_TAG.name
    );
  });

  test('Edit Tag Description', async ({ page }) => {
    await page.getByTestId('edit-description').click();

    await expect(page.getByRole('dialog')).toBeVisible();

    await page.locator('.toastui-editor-pseudo-clipboard').clear();
    await page
      .locator('.toastui-editor-pseudo-clipboard')
      .fill(`This is updated test description for tag ${NEW_TAG.name}.`);
    await page.getByTestId('save').scrollIntoViewIfNeeded();
    await page.getByTestId('save').click();

    await expect(page.getByTestId('viewer-container')).toContainText(
      `This is updated test description for tag ${NEW_TAG.name}.`
    );
  });

  test('Add assets to tag', async ({ page }) => {
    await page.getByTestId('data-classification-add-button').click();

    await expect(page.getByRole('dialog')).toBeVisible();

    await page
      .locator('#tabledatacard-aa1d01d8-42e6-4170-8a68-dbcf03905cea')
      .getByLabel('')
      .check();
    await page.getByTestId('save-btn').scrollIntoViewIfNeeded();
    await page.getByTestId('save-btn').click();
    await page.goto(`/tag/${NEW_CLASSIFICATION.name}.${NEW_TAG.name}`);
    await page.getByRole('tab', { name: 'Assets' }).click();
    await page.goto(`/tag/${NEW_CLASSIFICATION.name}.${NEW_TAG.name}/assets`);

    await expect(page.getByTestId('entity-link')).toContainText('shopify');
  });
});
