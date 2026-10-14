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
import { Page } from '@playwright/test';
import { GlobalSettingOptions } from '../../constant/settings';
import { SidebarItem } from '../../constant/sidebar';
import { expect, test } from '../../support/fixtures/base';
import { AdminClass } from '../../support/user/AdminClass';
import { getApiContext, uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { settingClick, sidebarClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

async function goToLearningResourcesAdmin(page: Page) {
  const admin = new AdminClass();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');

  if (page.url().includes('/signin')) {
    await admin.signIn(page);
  }

  await page.waitForURL(
    (url) => url.pathname === '/' || url.pathname === '/my-data',
    { waitUntil: 'domcontentloaded' }
  );
  await settingClick(page, GlobalSettingOptions.LEARNING_RESOURCES);
  await waitForAllLoadersToDisappear(page);
  await expect(page.getByTestId('learning-resources-page')).toBeVisible();
  await expect(page.getByTestId('learning-resources-table-body')).toBeVisible();
}

async function selectDropdownOption(page: Page, optionText: string) {
  const option = page
    .locator('.ant-select-dropdown:visible')
    .locator('.ant-select-item-option')
    .filter({ hasText: new RegExp(`^${optionText}$`, 'i') });

  await expect(option).toBeVisible();
  await option.click();
}

async function fillResourceForm(
  page: Page,
  data: {
    resourceName: string;
    description: string;
    type: string;
    category: string;
    context: string;
    url: string;
    status: string;
  }
) {
  const nameInput = page.getByTestId('name-input');
  await expect(nameInput).toBeVisible();
  await nameInput.fill(data.resourceName);

  const descriptionInput = page.getByTestId('description-input');
  await expect(descriptionInput).toBeVisible();
  await descriptionInput.fill(data.description);

  const typeSelector = page
    .getByTestId('resource-type-form-item')
    .locator('.ant-select-selector');
  await expect(typeSelector).toBeVisible();
  await typeSelector.click();
  await selectDropdownOption(page, data.type);

  const categorySelector = page
    .getByTestId('categories-form-item')
    .locator('.ant-select-selector');
  await expect(categorySelector).toBeVisible();
  await categorySelector.click();
  await selectDropdownOption(page, data.category);
  await page.locator('.ant-drawer-header').click();
  await expect(page.locator('.ant-select-dropdown:visible')).not.toBeVisible();

  const contextSelector = page
    .getByTestId('contexts-form-item')
    .locator('.ant-select-selector');
  await expect(contextSelector).toBeVisible();
  await contextSelector.click();
  await page
    .locator('.ant-select-dropdown:visible')
    .getByTitle(data.context, { exact: true })
    .click();
  await page.locator('.ant-drawer-header').click();
  await expect(page.locator('.ant-select-dropdown:visible')).not.toBeVisible();

  const urlInput = page.getByTestId('source-url-input');
  await expect(urlInput).toBeVisible();
  await urlInput.fill(data.url);

  const statusSelector = page
    .getByTestId('status-form-item')
    .locator('.ant-select-selector');
  await expect(statusSelector).toBeVisible();
  await statusSelector.click();
  await selectDropdownOption(page, data.status);
}

async function scrollDrawerToShowResource(page: Page, resourceText: string) {
  const drawer = page.getByTestId('learning-drawer');
  await expect(drawer).toBeVisible();
  const targetElement = drawer.getByText(resourceText, { exact: false });
  await targetElement.scrollIntoViewIfNeeded();
  await expect(targetElement).toBeVisible();
}

test.describe(
  'Learning Resources Admin Page',
  { tag: ['@Pages', '@Platform'] },
  () => {
    test.beforeEach(async ({ page }) => {
      await goToLearningResourcesAdmin(page);
    });

    test('should create a new learning resource', async ({ page }) => {
      const uniqueId = uuid();
      const resourceName = `PW_Create_E2E_${uniqueId}`;
      await page.getByTestId('create-resource').click();
      await expect(
        page.getByTestId('learning-resource-form-drawer')
      ).toBeVisible();

      await fillResourceForm(page, {
        resourceName,
        description: 'E2E test learning resource',
        type: 'Video',
        category: 'Discovery',
        context: 'Glossary',
        url: 'https://www.youtube.com/watch?v=DqIT4vWALGk',
        status: 'Active',
      });

      const createResponse = page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/learning/resources') &&
          r.request().method() === 'POST'
      );
      await page.getByTestId('save-resource').click();
      await createResponse;

      await expect(
        page.getByTestId('learning-resource-form-drawer')
      ).not.toBeVisible();
      await waitForAllLoadersToDisappear(page);
    });

    test('should create a Link learning resource', async ({ page }) => {
      const resourceName = `PW_Create_Link_${uuid()}`;
      const guideUrl = 'https://docs.example.com/data-seeker-guide';
      const { apiContext, afterAction } = await getApiContext(page);

      await test.step('Fill the form with the Link type', async () => {
        await page.getByTestId('create-resource').click();
        await expect(
          page.getByTestId('learning-resource-form-drawer')
        ).toBeVisible();

        await fillResourceForm(page, {
          resourceName,
          description: 'Internal guidance linked from the learning drawer',
          type: 'Link',
          category: 'Discovery',
          context: 'Domain',
          url: guideUrl,
          status: 'Active',
        });
      });

      await test.step('Save and verify a Link resource is created', async () => {
        const createResponse = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/learning/resources') &&
            r.request().method() === 'POST'
        );
        await page.getByTestId('save-resource').click();
        const response = await createResponse;

        expect(response.status()).toBe(201);
        const created = await response.json();
        expect(created.resourceType).toBe('Link');
        expect(created.source.url).toBe(guideUrl);
        await expect(
          page.getByTestId('learning-resource-form-drawer')
        ).not.toBeVisible();

        await apiContext.delete(
          `/api/v1/learning/resources/${created.id}?hardDelete=true`
        );
      });

      await afterAction();
    });
  }
);

test.describe(
  'Learning Resources E2E Flow',
  { tag: ['@Flow', '@Platform'] },
  () => {
    test('should create resource via UI and verify learning icon appears on target page', async ({
      page,
    }) => {
      const uniqueId = uuid();
      const resourceName = `PW_Create_E2E_${uniqueId}`;

      await test.step('Navigate to Learning Resources admin page', async () => {
        await goToLearningResourcesAdmin(page);
      });

      await test.step('Open add resource drawer and fill form', async () => {
        await page.getByTestId('create-resource').click();
        await expect(
          page.getByTestId('learning-resource-form-drawer')
        ).toBeVisible();

        await fillResourceForm(page, {
          resourceName,
          description: 'E2E test learning resource',
          type: 'Video',
          category: 'Discovery',
          context: 'Glossary',
          url: 'https://www.youtube.com/watch?v=DqIT4vWALGk',
          status: 'Active',
        });
      });

      await test.step('Save the resource and verify API response', async () => {
        const createResponse = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/learning/resources') &&
            r.request().method() === 'POST'
        );
        await page.getByTestId('save-resource').click();
        await createResponse;

        await expect(
          page.getByTestId('learning-resource-form-drawer')
        ).not.toBeVisible();
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Navigate to Glossary and verify resource in learning drawer', async () => {
        await sidebarClick(page, SidebarItem.GLOSSARY);
        await waitForAllLoadersToDisappear(page);

        const learningIcon = page.getByTestId('learning-icon');
        await expect(learningIcon).toBeVisible();
        await learningIcon.click();

        const drawer = page.getByTestId('learning-drawer');
        await expect(drawer).toBeVisible();
        await scrollDrawerToShowResource(page, resourceName);
        await expect(drawer.getByText(resourceName)).toBeVisible();
        await page.keyboard.press('Escape');
      });
    });
  }
);
