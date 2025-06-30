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
import { CUSTOM_PROPERTIES_ENTITIES } from '../../../constant/customProperty';
import { GlobalSettingOptions } from '../../../constant/settings';
import { SidebarItem } from '../../../constant/sidebar';
import { DashboardClass } from '../../../support/entity/DashboardClass';
import { selectOption } from '../../../utils/advancedSearch';
import { createNewPage, redirectToHomePage, uuid } from '../../../utils/common';
import {
  addCustomPropertiesForEntity,
  deleteCreatedProperty,
} from '../../../utils/customProperty';
import { settingClick, sidebarClick } from '../../../utils/sidebar';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const dashboardEntity = new DashboardClass();
const propertyName = `pwCustomPropertyDashboardTest${uuid()}`;
const propertyValue = `dashboardcustomproperty_${uuid()}`;

test.beforeAll('Setup pre-requests', async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await dashboardEntity.create(apiContext);
  await afterAction();
});

test.afterAll('Cleanup', async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await dashboardEntity.delete(apiContext);
  await afterAction();
});

test('CustomProperty Dashboard Filter', async ({ page }) => {
  test.slow(true);

  await redirectToHomePage(page);

  await test.step('Create Dashboard Custom Property', async () => {
    await settingClick(page, GlobalSettingOptions.DASHBOARDS, true);

    await addCustomPropertiesForEntity({
      page,
      propertyName,
      customPropertyData: CUSTOM_PROPERTIES_ENTITIES['entity_dashboard'],
      customType: 'String',
    });
  });

  await test.step('Add Custom Property in Dashboard', async () => {
    await dashboardEntity.visitEntityPage(page);

    const container = page.locator(
      `[data-testid="custom-property-${propertyName}-card"]`
    );

    await page.getByTestId('custom_properties').click();

    await expect(
      page.locator(
        `[data-testid="custom-property-${propertyName}-card"] [data-testid="property-name"]`
      )
    ).toHaveText(propertyName);

    const editButton = page.locator(
      `[data-testid="custom-property-${propertyName}-card"] [data-testid="edit-icon"]`
    );

    await editButton.scrollIntoViewIfNeeded();
    await editButton.click({ force: true });

    await page.getByTestId('value-input').fill(propertyValue);

    const saveResponse = page.waitForResponse('/api/v1/dashboards/*');

    await page.getByTestId('inline-save-btn').click();

    await saveResponse;

    await expect(container.getByTestId('value')).toContainText(propertyValue);
  });

  await test.step(
    'Filter Dashboard using AdvanceSearch Custom Property',
    async () => {
      await redirectToHomePage(page);

      const responseExplorePage = page.waitForResponse(
        '/api/v1/metadata/types/customProperties'
      );

      await sidebarClick(page, SidebarItem.EXPLORE);

      await responseExplorePage;

      await page.getByTestId('explore-tree-title-Dashboards').click();

      await page.getByTestId('advance-search-button').click();

      await page.waitForSelector('[role="dialog"].ant-modal');

      await expect(page.locator('[role="dialog"].ant-modal')).toBeVisible();

      await expect(page.locator('.ant-modal-title')).toContainText(
        'Advanced Search'
      );

      // Select Custom Property Filter

      await page
        .getByTestId('advanced-search-modal')
        .getByText('Owner')
        .click();

      const ruleLocator = page.locator('.rule').nth(0);

      // Perform click on rule field
      await selectOption(
        page,
        ruleLocator.locator('.rule--field .ant-select'),
        'Custom Properties'
      );

      await selectOption(
        page,
        ruleLocator.locator('.rule--field .ant-select'),
        'Dashboard'
      );

      // Select Custom Property Field when we want filter
      await page
        .locator(
          '.group--children .rule--field .ant-select-selector .ant-select-selection-search .ant-select-selection-search-input'
        )
        .fill(propertyName);
      await page.getByTitle(propertyName).click();

      await page
        .locator('.rule--operator .ant-select-selection-search-input')
        .click();
      await page.waitForSelector(`.ant-select-dropdown:visible`, {
        state: 'visible',
      });
      await page.click(`.ant-select-dropdown:visible [title="=="]`);

      // type custom property value based, on which the filter should be made on dashboard
      await page
        .locator('.group--children .rule--widget .ant-input')
        .fill(propertyValue);

      const applyAdvanceFilter = page.waitForRequest('/api/v1/search/query?*');

      await page.getByTestId('apply-btn').click();

      await applyAdvanceFilter;

      await page.waitForLoadState('networkidle');

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Validate if filter dashboard appeared

      await expect(
        page.getByTestId('advance-search-filter-text')
      ).toContainText(
        `extension.dashboard.${propertyName} = '${propertyValue}'`
      );

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await expect(
        page.getByTestId('entity-header-display-name')
      ).toContainText(dashboardEntity.entity.displayName);
    }
  );

  await test.step('Delete Custom Property ', async () => {
    await settingClick(page, GlobalSettingOptions.DASHBOARDS, true);
    await deleteCreatedProperty(page, propertyName);
  });
});
