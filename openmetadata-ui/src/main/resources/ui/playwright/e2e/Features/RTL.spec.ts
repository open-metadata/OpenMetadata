/*
 *  Copyright 2026 Collate.
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

import { expect, Page, test as base } from '@playwright/test';
import { toLower } from 'lodash';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { clickOutside, redirectToHomePage } from '../../utils/common';
import {
  followEntity,
  validateFollowedEntityToWidget,
} from '../../utils/entity';

const user = new UserClass();

export const test = base.extend<{ adminPage: Page }>({
  adminPage: async ({ browser }, use) => {
    const adminPage = await browser.newPage();
    await user.login(adminPage);
    await use(adminPage);
    await adminPage.close();
  },
});

test.describe('Verify RTL Layout for landing page', () => {
  const table = EntityDataClass.table1;

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await user.create(apiContext);
    await user.setAdminRole(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ adminPage: page }) => {
    await redirectToHomePage(page);

    await page.getByTestId('language-selector-button').click();
    await page
      .locator('.ant-dropdown:visible [data-menu-id*="-he-HE"]')
      .click();
    await page.waitForLoadState('domcontentloaded');
  });

  test('Verify DataAssets widget functionality', async ({
    adminPage: page,
  }) => {
    const serviceType = toLower(table.service.serviceType);

    await clickOutside(page);
    const quickFilterResponse = page.waitForResponse(
      `/api/v1/search/query?q=&index=dataAsset*${serviceType}*`
    );

    await page
      .locator(`[data-testid="data-asset-service-${serviceType}"]`)
      .click();

    await quickFilterResponse;

    await expect(
      page.getByRole('button', { name: `סוג השירות : ${serviceType}` })
    ).toBeAttached();

    await expect(
      page
        .getByTestId('explore-tree')
        .locator('span')
        .filter({ hasText: serviceType })
        .first()
    ).toHaveClass(/ant-tree-node-selected/);
  });

  test('Verify Following widget functionality', async ({ adminPage }) => {
    await table.visitEntityPage(adminPage);

    const entityName = table.entityResponseData?.['displayName'];

    await followEntity(adminPage, table.endpoint, 'בטל מעקב');
    await validateFollowedEntityToWidget(adminPage, entityName ?? '', true);
  });
});
