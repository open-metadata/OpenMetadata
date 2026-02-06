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
import { LearningResourceClass } from '../../support/learning/LearningResourceClass';
import { getApiContext, redirectToHomePage, uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { settingClick, sidebarClick } from '../../utils/sidebar';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';

test.use({ storageState: 'playwright/.auth/admin.json' });

// Helper function to select an option from Ant Design Select dropdown
async function selectDropdownOption(page: Page, optionText: string) {
  const option = page
    .locator('.ant-select-dropdown:visible')
    .locator('.ant-select-item-option')
    .filter({ hasText: optionText });
  await expect(option).toBeVisible();
  await option.click();
}

// Helper to scroll the learning drawer to bring an element into view
async function scrollDrawerToShowResource(page: Page, resourceText: string) {
  await page.locator('.learning-drawer').evaluate((drawer, text) => {
    const scrollContainer =
      drawer.querySelector<HTMLElement>('.ant-drawer-content-wrapper') ??
      drawer.querySelector<HTMLElement>('.ant-drawer-body');
    const target = Array.from(drawer.querySelectorAll('*')).find((el) =>
      el.textContent?.includes(text)
    );
    if (scrollContainer && target) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      if (targetRect.bottom > containerRect.bottom) {
        scrollContainer.scrollTop += targetRect.bottom - containerRect.bottom;
      } else if (targetRect.top < containerRect.top) {
        scrollContainer.scrollTop -= containerRect.top - targetRect.top;
      }
    }
  }, resourceText);
}

// Helper function to search for a resource by name (MUI TextField)
async function searchResource(page: Page, searchText: string) {
  const searchInput = page
    .locator('[data-testid="learning-resources-page"]')
    .getByPlaceholder(/search/i);
  await searchInput.fill(searchText);
}

// Helper function to select a filter option from SearchDropdown
async function selectSearchDropdownFilter(
  page: Page,
  filterKey: 'type' | 'category' | 'context' | 'status',
  optionText: string
) {
  const filterLabels: Record<string, RegExp> = {
    type: /type/i,
    category: /categor/i,
    context: /context/i,
    status: /status/i,
  };
  const filterBtn = page
    .locator('[data-testid="learning-resources-page"]')
    .getByRole('button', { name: filterLabels[filterKey] });
  await expect(filterBtn).toBeVisible();
  await expect(filterBtn).toBeEnabled();
  await filterBtn.click();

  const menuItem = page
    .locator('[data-testid="drop-down-menu"]')
    .locator('.ant-dropdown-menu-item')
    .filter({ hasText: optionText });
  await expect(menuItem).toBeVisible();
  await menuItem.click();

  const updateBtn = page.getByTestId('update-btn');
  await expect(updateBtn).toBeVisible();
  await updateBtn.click();
}

test.describe('Learning Resources Admin Page', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await settingClick(page, GlobalSettingOptions.LEARNING_RESOURCES);
    await waitForAllLoadersToDisappear(page);
    await expect(page.locator('.ant-table-tbody')).toBeVisible();
  });

  test('should display learning resources page', async ({ page }) => {
    await expect(page.getByTestId('learning-resources-page')).toBeVisible();
    await expect(page.getByTestId('page-title')).toContainText(
      'Learning Resource'
    );
    await expect(page.getByTestId('create-resource')).toBeVisible();
  });

  test('should open and close add resource drawer', async ({ page }) => {
    await test.step('Open add resource drawer', async () => {
      await page.getByTestId('create-resource').click();
      await expect(page.locator('.drawer-title')).toContainText('Add Resource');
    });

    await test.step('Close drawer', async () => {
      await page.locator('.drawer-close').click();
      await expect(page.locator('.drawer-title')).not.toBeVisible();
    });
  });

  test('should validate required fields', async ({ page }) => {
    await page.getByTestId('create-resource').click();
    await expect(page.locator('.drawer-title')).toBeVisible();

    // Try to submit without filling required fields
    await page.getByTestId('save-resource').click();

    await expect(page.getByText('Name is required')).toBeVisible();

    // Close drawer
    await page.locator('.drawer-close').click();
  });

  test('should edit an existing learning resource', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const uniqueId = uuid();
    const resource = new LearningResourceClass({
      name: `PW_Edit_Resource_${uniqueId}`,
      displayName: `PW Edit Resource ${uniqueId}`,
      description: 'Resource to be edited',
    });

    await resource.create(apiContext);

    await page.reload();
    await waitForAllLoadersToDisappear(page);
    await expect(page.locator('.ant-table-tbody')).toBeVisible();

    // Search for the resource to find it
    await searchResource(page, uniqueId);
    await expect(page.getByText(resource.data.displayName ?? '')).toBeVisible();

    await test.step('Click edit button and verify drawer opens', async () => {
      await page.getByTestId(`edit-${resource.data.name}`).click();
      await expect(page.locator('.drawer-title')).toContainText(
        'Edit Resource'
      );
      await expect(
        page.locator('.learning-resource-form').getByLabel(/name/i)
      ).toHaveValue(resource.data.name);
    });

    await test.step('Close the drawer', async () => {
      await page.locator('.drawer-close').click();
      await expect(page.locator('.drawer-title')).not.toBeVisible();
    });

    await resource.delete(apiContext);
    await afterAction();
  });

  test('should delete a learning resource', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const uniqueId = uuid();
    const resource = new LearningResourceClass({
      name: `PW_Delete_Resource_${uniqueId}`,
      displayName: `PW Delete Resource ${uniqueId}`,
    });

    await resource.create(apiContext);

    await page.reload();
    await waitForAllLoadersToDisappear(page);
    await expect(page.locator('.ant-table-tbody')).toBeVisible();

    // Search for the resource to find it
    await searchResource(page, uniqueId);
    await expect(page.getByText(resource.data.displayName ?? '')).toBeVisible();

    await test.step('Click delete button and confirm', async () => {
      await page.getByTestId(`delete-${resource.data.name}`).click();
      // Wait for the confirmation modal to appear
      await expect(page.locator('.ant-modal-confirm')).toBeVisible();
      // Click the OK/Delete button in the modal
      await page
        .locator('.ant-modal-confirm-btns button')
        .filter({ hasText: /delete|ok/i })
        .click();
    });

    await test.step('Verify resource is removed from list', async () => {
      // Wait for modal to close and table to update
      await expect(page.locator('.ant-modal-confirm')).not.toBeVisible();
      await expect(
        page.getByText(resource.data.displayName ?? '')
      ).not.toBeVisible();
    });

    await afterAction();
  });

  test('should preview a learning resource by clicking on name', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const uniqueId = uuid();
    const resource = new LearningResourceClass({
      name: `PW_Preview_Resource_${uniqueId}`,
      displayName: `PW Preview Resource ${uniqueId}`,
      source: {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        provider: 'YouTube',
      },
    });

    await resource.create(apiContext);

    await page.reload();
    await waitForAllLoadersToDisappear(page);
    await expect(page.locator('.ant-table-tbody')).toBeVisible();

    // Search for the resource to find it
    await searchResource(page, uniqueId);
    await expect(page.getByText(resource.data.displayName ?? '')).toBeVisible();

    await test.step('Click on resource name to preview', async () => {
      await page.getByText(resource.data.displayName ?? '').click();
    });

    await test.step('Verify preview modal opens', async () => {
      await expect(page.getByRole('dialog')).toBeVisible();
    });

    await test.step('Close preview modal', async () => {
      const closeBtn = page
        .locator('.MuiDialog-paper')
        .getByRole('button', { name: /close/i });
      await expect(closeBtn).toBeVisible();
      await closeBtn.click();
      await expect(page.locator('.MuiDialog-paper')).not.toBeVisible();
    });

    await resource.delete(apiContext);
    await afterAction();
  });

  test('should filter resources by type', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const uniqueId = uuid();
    const videoResource = new LearningResourceClass({
      name: `PW_Video_Resource_${uniqueId}`,
      displayName: `PW Video Resource ${uniqueId}`,
      resourceType: 'Video',
    });

    await videoResource.create(apiContext);

    // Reload to get fresh data
    await page.reload();
    await waitForAllLoadersToDisappear(page);
    await expect(page.locator('.ant-table-tbody')).toBeVisible();

    await test.step('Filter by Video type', async () => {
      await selectSearchDropdownFilter(page, 'type', 'Video');

      await searchResource(page, uniqueId);
      await expect(
        page.getByText(`PW Video Resource ${uniqueId}`)
      ).toBeVisible();
    });

    await videoResource.delete(apiContext);
    await afterAction();
  });

  test('should search resources by name', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const uniqueId = uuid();
    const resource = new LearningResourceClass({
      name: `PW_Search_Resource_${uniqueId}`,
      displayName: `PW Search Resource ${uniqueId}`,
    });

    await resource.create(apiContext);

    // Reload to get fresh data
    await page.reload();
    await waitForAllLoadersToDisappear(page);
    await expect(page.locator('.ant-table-tbody')).toBeVisible();

    await test.step('Search for resource', async () => {
      await searchResource(page, uniqueId);
      await expect(
        page.getByText(`PW Search Resource ${uniqueId}`)
      ).toBeVisible();
    });

    await resource.delete(apiContext);
    await afterAction();
  });
});

test.describe('Learning Resources Admin Page - Additional Tests', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await settingClick(page, GlobalSettingOptions.LEARNING_RESOURCES);
    await waitForAllLoadersToDisappear(page);
    await expect(page.locator('.ant-table-tbody')).toBeVisible();
  });

  test('should filter resources by category', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const uniqueId = uuid();
    const resource = new LearningResourceClass({
      name: `PW_Category_Resource_${uniqueId}`,
      displayName: `PW Category Resource ${uniqueId}`,
      categories: ['DataGovernance'],
    });

    await resource.create(apiContext);

    await page.reload();
    await waitForAllLoadersToDisappear(page);
    await expect(page.locator('.ant-table-tbody')).toBeVisible();

    await test.step('Filter by Governance category', async () => {
      await selectSearchDropdownFilter(page, 'category', 'Governance');

      await searchResource(page, uniqueId);
      await expect(
        page.getByText(`PW Category Resource ${uniqueId}`)
      ).toBeVisible();
    });

    await resource.delete(apiContext);
    await afterAction();
  });

  test('should filter resources by status', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const uniqueId = uuid();
    const resource = new LearningResourceClass({
      name: `PW_Status_Resource_${uniqueId}`,
      displayName: `PW Status Resource ${uniqueId}`,
      status: 'Draft',
    });

    await resource.create(apiContext);

    await page.reload();
    await waitForAllLoadersToDisappear(page);
    await expect(page.locator('.ant-table-tbody')).toBeVisible();

    await test.step('Filter by Draft status', async () => {
      await selectSearchDropdownFilter(page, 'status', 'Draft');

      await searchResource(page, uniqueId);
      await expect(
        page.getByText(`PW Status Resource ${uniqueId}`)
      ).toBeVisible();
    });

    await resource.delete(apiContext);
    await afterAction();
  });

  test('should edit and save resource changes via UI', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const uniqueId = uuid();
    const resource = new LearningResourceClass({
      name: `PW_Edit_Save_Resource_${uniqueId}`,
      displayName: `PW Edit Save Resource ${uniqueId}`,
      description: 'Original description',
    });

    await resource.create(apiContext);

    await page.reload();
    await waitForAllLoadersToDisappear(page);
    await expect(page.locator('.ant-table-tbody')).toBeVisible();

    await searchResource(page, uniqueId);
    await expect(page.getByText(resource.data.displayName ?? '')).toBeVisible();

    await test.step('Open edit drawer and modify description', async () => {
      await page.getByTestId(`edit-${resource.data.name}`).click();
      await expect(page.locator('.drawer-title')).toContainText(
        'Edit Resource'
      );

      const descriptionField = page
        .locator('.learning-resource-form .form-item-description')
        .locator('textarea');
      await descriptionField.fill(`Updated description ${uniqueId}`);
    });

    await test.step('Save changes', async () => {
      const updateResponse = page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/learning/resources') &&
          (r.request().method() === 'PUT' || r.request().method() === 'PATCH')
      );
      await page.getByTestId('save-resource').click();
      const response = await updateResponse;
      expect(response.status()).toBe(200);
      await expect(page.locator('.drawer-title')).not.toBeVisible();
    });

    await test.step('Verify resource still in list after edit', async () => {
      await page.reload();
      await waitForAllLoadersToDisappear(page);
      await searchResource(page, uniqueId);
      await expect(
        page.locator('.ant-table-tbody').getByText(new RegExp(uniqueId))
      ).toBeVisible();
    });

    await resource.delete(apiContext);
    await afterAction();
  });
});

test.describe('Learning Icon on Pages', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
  test('should display learning icon on glossary page when resources exist', async ({
    page,
  }) => {
    // Navigate to home first to ensure auth context is established
    await redirectToHomePage(page);

    const { apiContext, afterAction } = await getApiContext(page);
    const resource = new LearningResourceClass({
      name: `PW_Glossary_Icon_Resource_${uuid()}`,
      displayName: `PW Glossary Icon Resource`,
      contexts: [{ pageId: 'glossary' }],
      status: 'Active',
    });

    await resource.create(apiContext);

    await sidebarClick(page, SidebarItem.GLOSSARY);
    await waitForAllLoadersToDisappear(page);

    const learningIcon = page.locator('[data-testid="learning-icon"]');
    await expect(learningIcon).toBeVisible();

    await resource.delete(apiContext);
    await afterAction();
  });

  test('should open learning drawer when icon is clicked', async ({ page }) => {
    // Navigate to home first to ensure auth context is established
    await redirectToHomePage(page);

    const { apiContext, afterAction } = await getApiContext(page);
    const resource = new LearningResourceClass({
      name: `PW_Glossary_Drawer_Resource_${uuid()}`,
      displayName: `PW Glossary Drawer Resource`,
      contexts: [{ pageId: 'glossary' }],
      status: 'Active',
    });

    await resource.create(apiContext);

    await sidebarClick(page, SidebarItem.GLOSSARY);
    await waitForAllLoadersToDisappear(page);

    await test.step('Click learning icon', async () => {
      const learningIcon = page.locator('[data-testid="learning-icon"]');
      await expect(learningIcon).toBeVisible();
      await learningIcon.click();
    });

    await test.step('Verify drawer opens with resources', async () => {
      await expect(page.locator('.learning-drawer')).toBeVisible();
    });

    await test.step('Close drawer', async () => {
      await page.keyboard.press('Escape');
    });

    await resource.delete(apiContext);
    await afterAction();
  });

  test.fixme(
    'should NOT show draft resources on target pages',
    async ({ page }) => {
      // Navigate to home first to ensure auth context is established
      await redirectToHomePage(page);

      const { apiContext, afterAction } = await getApiContext(page);
      const uniqueId = uuid();
      const draftResource = new LearningResourceClass({
        name: `PW_Draft_Resource_${uniqueId}`,
        displayName: `PW Draft Resource ${uniqueId}`,
        contexts: [{ pageId: 'glossary' }],
        status: 'Draft', // Draft status should NOT appear on pages
      });

      await draftResource.create(apiContext);

      await sidebarClick(page, SidebarItem.GLOSSARY);
      await waitForAllLoadersToDisappear(page);

      // Check if learning icon exists
      const learningIcon = page.locator('[data-testid="learning-icon"]');
      const isIconVisible = await learningIcon.isVisible().catch(() => false);

      if (isIconVisible) {
        // If icon is visible, our draft resource should NOT be in the drawer
        await learningIcon.click();
        await expect(page.locator('.learning-drawer')).toBeVisible();
        await expect(
          page.getByText(`PW Draft Resource ${uniqueId}`)
        ).not.toBeVisible();
        await page.keyboard.press('Escape');
      }
      // If icon is not visible, that's also valid (no active resources)

      await draftResource.delete(apiContext);
      await afterAction();
    }
  );

  test('should show learning icon on lineage page when resources exist', async ({
    page,
  }) => {
    test.slow();
    // Navigate to home first to ensure auth context is established
    await redirectToHomePage(page);

    const { apiContext, afterAction } = await getApiContext(page);
    const resource = new LearningResourceClass({
      name: `PW_Lineage_Resource_${uuid()}`,
      displayName: `PW Lineage Resource`,
      contexts: [{ pageId: 'lineage' }],
      status: 'Active',
    });

    await resource.create(apiContext);

    const lineageRes = page.waitForResponse(
      '/api/v1/lineage/getPlatformLineage?view=service*'
    );
    await sidebarClick(page, SidebarItem.LINEAGE);
    await lineageRes;

    const learningIcon = page.locator('[data-testid="learning-icon"]');
    await expect(learningIcon).toBeVisible();
    await learningIcon.scrollIntoViewIfNeeded();
    await learningIcon.click();
    await expect(page.locator('.learning-drawer')).toBeVisible();
    await scrollDrawerToShowResource(page, 'PW Lineage Resource');
    await expect(page.getByText('PW Lineage Resource')).toBeVisible();
    await page.keyboard.press('Escape');

    await resource.delete(apiContext);
    await afterAction();
  });

  test('should open resource player when clicking on resource card in drawer', async ({
    page,
  }) => {
    // Navigate to home first to ensure auth context is established
    await redirectToHomePage(page);

    const { apiContext, afterAction } = await getApiContext(page);
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

    await sidebarClick(page, SidebarItem.GLOSSARY);
    await waitForAllLoadersToDisappear(page);

    await test.step('Open learning drawer', async () => {
      const learningIcon = page.locator('[data-testid="learning-icon"]');
      await expect(learningIcon).toBeVisible();
      await learningIcon.click();
      await expect(page.locator('.learning-drawer')).toBeVisible();
    });

    await test.step('Click on resource card to open player', async () => {
      await scrollDrawerToShowResource(
        page,
        `PW Player Resource ${uniqueId}`
      );
      const resourceCard = page.getByTestId(
        `learning-resource-card-PW_Player_Resource_${uniqueId}`
      );
      await expect(resourceCard).toBeVisible();
      await resourceCard.click();
      await expect(page.locator('.MuiDialog-paper')).toBeVisible();
    });

    await test.step('Close player modal', async () => {
      await page.keyboard.press('Escape');
      await expect(page.locator('.MuiDialog-paper')).not.toBeVisible();
      await page.keyboard.press('Escape');
    });

    await resource.delete(apiContext);
    await afterAction();
  });
});

test.describe.serial('Learning Resources E2E Flow', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
  test('should create resource via UI and verify learning icon appears on target page', async ({
    page,
  }) => {
    const uniqueId = uuid();
    const resourceName = `PW_Create_E2E_${uniqueId}`;

    await test.step('Navigate to Learning Resources admin page', async () => {
      await redirectToHomePage(page);
      await settingClick(page, GlobalSettingOptions.LEARNING_RESOURCES);
      await waitForAllLoadersToDisappear(page);
      await expect(page.locator('.ant-table-tbody')).toBeVisible();
    });

    await test.step('Open add resource drawer and fill form', async () => {
      await page.getByTestId('create-resource').click();
      await expect(page.locator('.drawer-title')).toContainText('Add Resource');

      await page
        .locator('.learning-resource-form')
        .getByPlaceholder(/enter.*name|name/i)
        .fill(resourceName);
      await page
        .locator('.learning-resource-form')
        .locator('textarea')
        .fill('E2E test learning resource');

      await page
        .getByTestId('resource-type-form-item')
        .locator('.ant-select-selector')
        .click();
      await selectDropdownOption(page, 'Video');

      await page
        .getByTestId('categories-form-item')
        .locator('.ant-select-selector')
        .click();
      await selectDropdownOption(page, 'Discovery');
      await page.keyboard.press('Escape');

      await page
        .getByTestId('contexts-form-item')
        .locator('.ant-select-selector')
        .click();
      await page
        .locator('.ant-select-dropdown:visible')
        .getByTitle('Glossary', { exact: true })
        .click();
      await page.keyboard.press('Escape');

      await page
        .locator('.learning-resource-form')
        .getByPlaceholder(/youtube\.com/)
        .fill('https://www.youtube.com/watch?v=test123');

      await page
        .locator('.ant-form-item')
        .filter({ hasText: 'Status' })
        .locator('.ant-select-selector')
        .click();
      await selectDropdownOption(page, 'Active');
    });

    await test.step('Save the resource', async () => {
      const createResponse = page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/learning/resources') &&
          r.request().method() === 'POST'
      );
      await page.getByTestId('save-resource').click();
      const response = await createResponse;
      expect([200, 201]).toContain(response.status());
      await expect(page.locator('.drawer-title')).not.toBeVisible();
    });

    await test.step(
      'Navigate to Glossary page and verify learning icon appears',
      async () => {
        await sidebarClick(page, SidebarItem.GLOSSARY);
        await waitForAllLoadersToDisappear(page);

        const learningIcon = page.locator('[data-testid="learning-icon"]');
        await expect(learningIcon).toBeVisible();
      }
    );

    await test.step(
      'Click learning icon and verify the created resource is shown',
      async () => {
        await page.locator('[data-testid="learning-icon"]').click();
        await expect(page.locator('.learning-drawer')).toBeVisible();
        await scrollDrawerToShowResource(page, resourceName);
        await expect(page.getByText(resourceName)).toBeVisible();
        await page.keyboard.press('Escape');
      }
    );

    await test.step('Cleanup - delete the created resource', async () => {
      await settingClick(page, GlobalSettingOptions.LEARNING_RESOURCES);
      await waitForAllLoadersToDisappear(page);
      await expect(page.locator('.ant-table-tbody')).toBeVisible();

      await searchResource(page, uniqueId);
      await expect(page.getByText(resourceName)).toBeVisible();

      await page.getByTestId(`delete-${resourceName}`).click();
      await expect(page.locator('.ant-modal-confirm')).toBeVisible();
      await page
        .locator('.ant-modal-confirm-btns button')
        .filter({ hasText: /delete|ok/i })
        .click();
      await expect(page.locator('.ant-modal-confirm')).not.toBeVisible();
    });
  });

  test('should update resource context and verify learning icon moves to new page', async ({
    page,
  }) => {
    test.slow();
    // Navigate to home first to ensure auth context is established
    await redirectToHomePage(page);

    const { apiContext, afterAction } = await getApiContext(page);
    const uniqueId = uuid();
    const resource = new LearningResourceClass({
      name: `PW_Update_Context_${uniqueId}`,
      displayName: `Update Context Resource ${uniqueId}`,
      contexts: [{ pageId: 'glossary' }],
      status: 'Active',
    });

    const createdResource = await resource.create(apiContext);
    expect(
      createdResource,
      `Failed to create resource: ${JSON.stringify(createdResource)}`
    ).toBeDefined();
    expect(
      createdResource.id,
      `Resource ID is undefined: ${JSON.stringify(createdResource)}`
    ).toBeDefined();
    expect(createdResource.displayName).toBe(
      `Update Context Resource ${uniqueId}`
    );

    await test.step(
      'Verify resource appears on Glossary page initially',
      async () => {
        await sidebarClick(page, SidebarItem.GLOSSARY);
        await waitForAllLoadersToDisappear(page);

        const learningIcon = page.locator('[data-testid="learning-icon"]');
        await expect(learningIcon).toBeVisible();

        // Verify our resource is in the drawer
        await learningIcon.click();
        await expect(page.locator('.learning-drawer')).toBeVisible();
        await scrollDrawerToShowResource(
          page,
          `Update Context Resource ${uniqueId}`
        );
        await expect(
          page.getByText(`Update Context Resource ${uniqueId}`)
        ).toBeVisible();
        await page.keyboard.press('Escape');
      }
    );

    await test.step(
      'Navigate to admin page and update resource context to Lineage',
      async () => {
        await settingClick(page, GlobalSettingOptions.LEARNING_RESOURCES);
        await waitForAllLoadersToDisappear(page);
        await expect(page.locator('.ant-table-tbody')).toBeVisible();

        await searchResource(page, uniqueId);
        await expect(
          page.getByText(`Update Context Resource ${uniqueId}`)
        ).toBeVisible();

        // Click edit button
        await page.getByTestId(`edit-${resource.data.name}`).click();
        await expect(page.locator('.drawer-title')).toContainText(
          'Edit Resource'
        );

        const contextsFormItem = page.getByTestId('contexts-form-item');
        await contextsFormItem.locator('.ant-select-selector').click();

        await page
          .locator('.ant-select-dropdown:visible')
          .getByTitle('Glossary', { exact: true })
          .click();

        await contextsFormItem.locator('.ant-select-selector').click();
        await contextsFormItem
          .locator('.ant-select-selection-search-input')
          .fill('lineage');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await page.keyboard.press('Escape');

        const updateResponse = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/learning/resources') &&
            (r.request().method() === 'PUT' || r.request().method() === 'PATCH')
        );
        await page.getByTestId('save-resource').click();
        const response = await updateResponse;
        expect(response.status()).toBe(200);
        await expect(page.locator('.drawer-title')).not.toBeVisible();
      }
    );

    await test.step(
      'Verify learning icon no longer appears on Glossary page',
      async () => {
        await sidebarClick(page, SidebarItem.GLOSSARY);
        await waitForAllLoadersToDisappear(page);

        // The learning icon should not be visible or should not show our resource
        const learningIcon = page.locator('[data-testid="learning-icon"]');
        const isIconVisible = await learningIcon.isVisible().catch(() => false);

        if (isIconVisible) {
          // If icon is visible, our resource should not be in the drawer
          await learningIcon.click();
          await expect(page.locator('.learning-drawer')).toBeVisible();
          await expect(
            page.getByText(`Update Context Resource ${uniqueId}`)
          ).not.toBeVisible();
          await page.keyboard.press('Escape');
        }
      }
    );

    await test.step(
      'Verify learning icon now appears on Lineage page',
      async () => {
        const lineageRes = page.waitForResponse(
          '/api/v1/lineage/getPlatformLineage?view=service*'
        );
        await sidebarClick(page, SidebarItem.LINEAGE);
        await lineageRes;

        const learningIcon = page.locator('[data-testid="learning-icon"]');
        await expect(learningIcon).toBeVisible();

        await learningIcon.scrollIntoViewIfNeeded();
        await learningIcon.click();
        await expect(page.locator('.learning-drawer')).toBeVisible();
        await waitForAllLoadersToDisappear(page);
        const resourceCard = page.getByTestId(
          `learning-resource-card-PW_Update_Context_${uniqueId}`
        );
        await scrollDrawerToShowResource(page, resource.data.name);
        await expect(resourceCard).toBeVisible();
        await page.keyboard.press('Escape');
      }
    );

    await resource.delete(apiContext);
    await afterAction();
  });

  test('should delete resource and verify learning icon disappears from target page', async ({
    page,
  }) => {
    // Navigate to home first to ensure auth context is established
    await redirectToHomePage(page);

    const { apiContext, afterAction } = await getApiContext(page);
    const uniqueId = uuid();
    const resource = new LearningResourceClass({
      name: `PW_Delete_E2E_${uniqueId}`,
      displayName: `Delete E2E Resource ${uniqueId}`,
      contexts: [{ pageId: 'glossary' }],
      status: 'Active',
    });

    const createdResource = await resource.create(apiContext);
    expect(createdResource.id).toBeDefined();
    expect(createdResource.displayName).toBe(`Delete E2E Resource ${uniqueId}`);

    await test.step(
      'Verify resource appears on Glossary page initially',
      async () => {
        await sidebarClick(page, SidebarItem.GLOSSARY);
        await waitForAllLoadersToDisappear(page);

        const learningIcon = page.locator('[data-testid="learning-icon"]');
        await expect(learningIcon).toBeVisible();

        // Verify our resource is in the drawer
        await learningIcon.click();
        await expect(page.locator('.learning-drawer')).toBeVisible();
        await scrollDrawerToShowResource(
          page,
          `Delete E2E Resource ${uniqueId}`
        );
        await expect(
          page.getByText(`Delete E2E Resource ${uniqueId}`)
        ).toBeVisible();
        await page.keyboard.press('Escape');
      }
    );

    await test.step(
      'Navigate to admin page and delete the resource',
      async () => {
        await settingClick(page, GlobalSettingOptions.LEARNING_RESOURCES);
        await waitForAllLoadersToDisappear(page);
        await expect(page.locator('.ant-table-tbody')).toBeVisible();

        await searchResource(page, uniqueId);
        await expect(
          page.getByText(`Delete E2E Resource ${uniqueId}`)
        ).toBeVisible();

        await page.getByTestId(`delete-${resource.data.name}`).click();
        await expect(page.locator('.ant-modal-confirm')).toBeVisible();
        await page
          .locator('.ant-modal-confirm-btns button')
          .filter({ hasText: /delete|ok/i })
          .click();
        await expect(page.locator('.ant-modal-confirm')).not.toBeVisible();
      }
    );

    await test.step(
      'Verify learning icon no longer shows deleted resource on Glossary page',
      async () => {
        await sidebarClick(page, SidebarItem.GLOSSARY);
        await waitForAllLoadersToDisappear(page);

        const learningIcon = page.locator('[data-testid="learning-icon"]');
        const isIconVisible = await learningIcon.isVisible().catch(() => false);

        if (isIconVisible) {
          // If icon is visible, our deleted resource should not be in the drawer
          await learningIcon.click();
          await expect(page.locator('.learning-drawer')).toBeVisible();
          await expect(
            page.getByText(`Delete E2E Resource ${uniqueId}`)
          ).not.toBeVisible();
          await page.keyboard.press('Escape');
        }
        // If icon is not visible at all, that's also valid (no resources for glossary)
      }
    );

    await afterAction();
  });
});
