/*
 *  Copyright 2025 Collate.
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
import { SidebarItem } from '../../../constant/sidebar';
import { DataProduct } from '../../../support/domain/DataProduct';
import { Domain } from '../../../support/domain/Domain';
import { EntityDataClass } from '../../../support/entity/EntityDataClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage, uuid } from '../../../utils/common';
import { addCustomPropertiesForEntity } from '../../../utils/customProperty';
import { selectDataProduct } from '../../../utils/domain';
import {
  assignRoleToUser,
  initializePermissions,
} from '../../../utils/permission';
import {
  settingClick,
  SettingOptionsType,
  sidebarClick,
} from '../../../utils/sidebar';

const adminUser = new UserClass();
const testUser = new UserClass();

const test = base.extend<{
  page: Page;
  testUserPage: Page;
}>({
  page: async ({ browser }, use) => {
    const adminPage = await browser.newPage();
    try {
      await adminUser.login(adminPage);
      await use(adminPage);
    } finally {
      await adminPage.close();
    }
  },
  testUserPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    try {
      await testUser.login(page);
      await use(page);
    } finally {
      await page.close();
    }
  },
});

test.beforeAll('Setup pre-requests', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await adminUser.create(apiContext);
  await adminUser.setAdminRole(apiContext);
  await testUser.create(apiContext);
  await afterAction();
});

const domain = new Domain();
const dataProduct = new DataProduct([domain]);
const customPropertyName = `pwDataProductCustomProperty${uuid()}`;

test.beforeAll(
  'Setup domain, data product and custom property',
  async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await EntityDataClass.preRequisitesForTests(apiContext);
    await domain.create(apiContext);
    await dataProduct.create(apiContext);

    const page = await browser.newPage();
    await adminUser.login(page);
    await settingClick(page, 'dataProducts' as SettingOptionsType, true);
    await addCustomPropertiesForEntity({
      page,
      propertyName: customPropertyName,
      customPropertyData: { description: 'Test data product custom property' },
      customType: 'String',
    });
    await page.close();

    await afterAction();
  }
);

const navigateToDataProduct = async (page: Page) => {
  await redirectToHomePage(page);
  await sidebarClick(page, SidebarItem.DATA_PRODUCT);
  await selectDataProduct(page, dataProduct.responseData);
};

test.describe('Data Product Permissions', () => {
  test('Data Product allow operations', async ({ testUserPage, browser }) => {
    test.slow(true);

    const page = await browser.newPage();
    await adminUser.login(page);
    await initializePermissions(page, 'allow', [
      'EditDescription',
      'EditOwners',
      'EditTags',
      'Delete',
      'EditDisplayName',
      'Create',
      'EditCustomFields',
    ]);
    await assignRoleToUser(page, testUser);
    await page.close();

    await navigateToDataProduct(testUserPage);

    const directElements = ['edit-description', 'add-tag'];

    const manageButtonElements = ['delete-button', 'rename-button'];

    await testUserPage.waitForLoadState('networkidle');

    for (const testId of directElements) {
      let element;
      if (testId === 'add-tag') {
        element = testUserPage
          .getByTestId('tags-container')
          .getByTestId('add-tag');
      } else {
        element = testUserPage.getByTestId(testId).first();
      }

      await expect(element).toBeVisible();
    }

    const ownerButton = testUserPage
      .getByTestId('add-owner')
      .or(testUserPage.getByTestId('edit-owner'))
      .first();

    await expect(ownerButton).toBeVisible();

    const manageButton = testUserPage.getByTestId('manage-button');

    if (await manageButton.isVisible()) {
      await manageButton.click();

      for (const testId of manageButtonElements) {
        const element = testUserPage.getByTestId(testId);

        await expect(element).toBeVisible();
      }
    }
  });

  test('Data Product deny operations', async ({ testUserPage, browser }) => {
    test.slow(true);

    const page = await browser.newPage();
    await adminUser.login(page);
    await initializePermissions(page, 'deny', [
      'EditDescription',
      'EditOwners',
      'EditTags',
      'Delete',
      'EditDisplayName',
      'Create',
      'EditCustomFields',
    ]);
    await assignRoleToUser(page, testUser);
    await page.close();

    await navigateToDataProduct(testUserPage);

    const directElements = ['edit-description', 'add-tag'];

    const manageButtonElements = ['delete-button', 'rename-button'];

    await testUserPage.waitForLoadState('networkidle');

    for (const testId of directElements) {
      let element;
      if (testId === 'add-tag') {
        element = testUserPage
          .getByTestId('tags-container')
          .getByTestId('add-tag');
      } else {
        element = testUserPage.getByTestId(testId).first();
      }

      await expect(element).not.toBeVisible();
    }

    const ownerButton = testUserPage
      .getByTestId('add-owner')
      .or(testUserPage.getByTestId('edit-owner'))
      .first();

    await expect(ownerButton).not.toBeVisible();

    const manageButton = testUserPage.getByTestId('manage-button');

    if (await manageButton.isVisible()) {
      await manageButton.click();

      for (const testId of manageButtonElements) {
        const element = testUserPage.getByTestId(testId);

        await expect(element).not.toBeVisible();
      }
    }
  });

  test('Data Product expert can edit data product details', async ({
    browser,
  }) => {
    test.slow(true);

    const expertUser = new UserClass();
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await expertUser.create(apiContext);

      const expertDataProduct = new DataProduct([domain]);
      await expertDataProduct.create(apiContext);

      await apiContext.patch(
        `/api/v1/dataProducts/${expertDataProduct.responseData.id}`,
        {
          data: [
            {
              op: 'add',
              path: '/experts/0',
              value: {
                id: expertUser.responseData.id,
                type: 'user',
              },
            },
          ],
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      );

      const expertPage = await browser.newPage();
      await expertUser.login(expertPage);
      await redirectToHomePage(expertPage);
      await sidebarClick(expertPage, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(expertPage, expertDataProduct.responseData);

      await expect(expertPage.getByTestId('edit-description')).toBeVisible();

      await expertPage.close();
      await expertDataProduct.delete(apiContext);
      await expertUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });
});

test.afterAll('Cleanup data product and domain', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await dataProduct.delete(apiContext);
  await domain.delete(apiContext);
  await EntityDataClass.postRequisitesForTests(apiContext);
  await afterAction();
});

test.afterAll('Cleanup users', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await adminUser.delete(apiContext);
  await testUser.delete(apiContext);
  await afterAction();
});
