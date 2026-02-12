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
import { expect, Page, test } from '@playwright/test';
import { GlobalSettingOptions } from '../../constant/settings';
import { SidebarItem } from '../../constant/sidebar';
import { Glossary } from '../../support/glossary/Glossary';
import { LearningResourceClass } from '../../support/learning/LearningResourceClass';
import {
  createNewPage,
  getApiContext,
  redirectToHomePage,
  uuid,
} from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { settingClick, sidebarClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

async function goToLearningResourcesAdmin(page: Page) {
  await redirectToHomePage(page);
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

    test('should validate required fields when creating a resource', async ({
      page,
    }) => {
      await test.step('Open create resource drawer', async () => {
        await page.getByTestId('create-resource').click();
        await expect(
          page.getByTestId('learning-resource-form-drawer')
        ).toBeVisible();
      });

      await test.step('Attempt to save without required fields', async () => {
        const saveButton = page.getByTestId('save-resource');
        await expect(saveButton).toBeVisible();
        await expect(saveButton).toBeEnabled();
        await saveButton.click();

        const errorMessage = page.getByText(
          /name.*required|field.*required.*name/i
        );
        await expect(errorMessage).toBeVisible();
      });

      await test.step('Close drawer', async () => {
        await page.getByTestId('cancel-resource').click();
        await expect(
          page.getByTestId('learning-resource-form-drawer')
        ).not.toBeVisible();
      });
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

    test('should preview a learning resource by clicking on row', async ({
      page,
    }) => {
      await test.step('Click row and verify player modal opens', async () => {
        await page.getByText('Collate Clues: Automations').click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect(
          dialog.getByText('Collate Clues: Automations')
        ).toBeVisible();
      });

      await test.step('Close preview modal', async () => {
        await page.getByTestId('close-resource-player').click();
        await expect(page.getByRole('dialog')).not.toBeVisible();
      });
    });

    test('should toggle between table and card views', async ({ page }) => {
      await test.step('Verify table view is default', async () => {
        await expect(
          page.getByTestId('learning-resources-table-body')
        ).toBeVisible();
      });

      await test.step('Switch to card view', async () => {
        const cardToggle = page.getByTestId('card-view-toggle');
        await expect(cardToggle).toBeVisible();
        await cardToggle.click();
        await waitForAllLoadersToDisappear(page);

        await expect(
          page.getByTestId('learning-resources-table-body')
        ).not.toBeVisible();
      });

      await test.step('Switch back to table view', async () => {
        const tableToggle = page.getByTestId('table-view-toggle');
        await expect(tableToggle).toBeVisible();
        await tableToggle.click();
        await waitForAllLoadersToDisappear(page);

        await expect(
          page.getByTestId('learning-resources-table-body')
        ).toBeVisible();
      });
    });
  }
);

test.describe(
  'Learning Icon on Pages',
  { tag: ['@Features', '@Platform'] },
  () => {
    const glossaryForLearningTests = new Glossary(
      `PW_Learning_Glossary_${uuid()}`,
      []
    );

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await glossaryForLearningTests.create(apiContext);
      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await glossaryForLearningTests.delete(apiContext);
      await afterAction();
    });

    test('should show correct learning resource in drawer on lineage page', async ({
      page,
    }) => {
      test.slow();
      await redirectToHomePage(page);

      const { apiContext, afterAction } = await getApiContext(page);
      const displayName = 'PW Lineage Resource';
      const resource = new LearningResourceClass({
        name: `PW_Lineage_Resource_${uuid()}`,
        displayName,
        contexts: [{ pageId: 'lineage' }],
        status: 'Active',
      });

      await resource.create(apiContext);

      await test.step('Navigate to lineage page', async () => {
        const lineageRes = page.waitForResponse(
          '/api/v1/lineage/getPlatformLineage?view=service*'
        );
        await sidebarClick(page, SidebarItem.LINEAGE);
        await lineageRes;
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Open learning drawer and verify resource', async () => {
        const learningIcon = page.getByTestId('learning-icon');
        await expect(learningIcon).toBeVisible();
        await learningIcon.scrollIntoViewIfNeeded();
        await learningIcon.click();

        const drawer = page.getByTestId('learning-drawer');
        await expect(drawer).toBeVisible();
        await scrollDrawerToShowResource(page, displayName);
        await expect(drawer.getByText(displayName)).toBeVisible();
      });

      await test.step('Close drawer', async () => {
        await page.keyboard.press('Escape');
      });

      await resource.delete(apiContext);
      await afterAction();
    });

    test('should open resource player when clicking on resource card in drawer', async ({
      page,
    }) => {
      await redirectToHomePage(page);

      const { apiContext } = await getApiContext(page);
      const uniqueId = uuid();
      const resource = new LearningResourceClass({
        name: `PW_Player_Resource_${uniqueId}`,
        displayName: `PW Player Resource ${uniqueId}`,
        contexts: [{ pageId: 'glossary' }],
        status: 'Active',
        source: {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          provider: 'YouTube',
        },
      });

      await resource.create(apiContext);

      await test.step('Navigate to glossary page', async () => {
        await sidebarClick(page, SidebarItem.GLOSSARY);
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Open learning drawer', async () => {
        const learningIcon = page.getByTestId('learning-icon');
        await expect(learningIcon).toBeVisible();
        await learningIcon.click();

        const drawer = page.getByTestId('learning-drawer');
        await expect(drawer).toBeVisible();
        await scrollDrawerToShowResource(
          page,
          `PW Player Resource ${uniqueId}`
        );
      });

      await test.step(
        'Click resource card and verify player opens',
        async () => {
          const resourceCard = page.getByTestId(
            `learning-resource-card-PW_Player_Resource_${uniqueId}`
          );
          await expect(resourceCard).toBeVisible();
          await resourceCard.click();

          const playerDialog = page.getByRole('dialog');
          await expect(playerDialog).toBeVisible();
          await expect(
            playerDialog.getByText(`PW Player Resource ${uniqueId}`)
          ).toBeVisible();
        }
      );
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

      await test.step(
        'Navigate to Glossary and verify resource in learning drawer',
        async () => {
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
        }
      );
    });
  }
);
