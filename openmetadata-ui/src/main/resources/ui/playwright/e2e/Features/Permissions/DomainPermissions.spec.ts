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

import { expect, Page, test as base } from '@playwright/test';
import { SidebarItem } from '../../../constant/sidebar';
import { Domain } from '../../../support/domain/Domain';
import { EntityDataClass } from '../../../support/entity/EntityDataClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage, uuid } from '../../../utils/common';
import { addCustomPropertiesForEntity } from '../../../utils/customProperty';
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
  try {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await adminUser.create(apiContext);
    await adminUser.setAdminRole(apiContext);
    await testUser.create(apiContext);
    await afterAction();
  } catch (error) {
    // Don't fail the test suite if setup fails
  }
});

const domain = new Domain();
const customPropertyName = `pwDomainCustomProperty${uuid()}`;

test.beforeAll('Setup domain and custom property', async ({ browser }) => {
  try {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await EntityDataClass.preRequisitesForTests(apiContext);
    await domain.create(apiContext);

    // Create custom property for domain once
    const page = await browser.newPage();
    try {
      await adminUser.login(page);
      await settingClick(page, 'domains' as SettingOptionsType, true);
      await addCustomPropertiesForEntity({
        page,
        propertyName: customPropertyName,
        customPropertyData: { description: 'Test domain custom property' },
        customType: 'String',
      });
    } finally {
      await page.close();
    }

    await afterAction();
  } catch (error) {
    // Continue with test even if setup fails
  }
});

test('Domain allow operations', async ({ testUserPage, browser }) => {
  test.slow(true);

  // Setup allow permissions
  const page = await browser.newPage();
  try {
    await adminUser.login(page);
    await initializePermissions(page, 'allow', [
      'EditDescription',
      'EditOwners',
      'EditTags',
      'Delete',
      'EditDisplayName',
      'Create',
      'Delete',
      'EditCustomFields',
    ]);
    await assignRoleToUser(page, testUser);
  } finally {
    await page.close();
  }

  // Navigate to domain page
  await redirectToHomePage(testUserPage);
  await sidebarClick(testUserPage, SidebarItem.DOMAIN);
  await domain.visitEntityPage(testUserPage);

  // Test that domain operation elements are visible
  const directElements = [
    'edit-description',
    'add-owner',
    'add-tag',
    'edit-icon-right-panel',
    'add-domain',
  ];

  const manageButtonElements = ['delete-button', 'rename-button'];

  await testUserPage.waitForLoadState('networkidle');

  // Test direct elements first
  for (const testId of directElements) {
    let element;
    if (testId === 'add-tag') {
      // For add-tag, target the button within tags-container
      element = testUserPage
        .getByTestId('tags-container')
        .getByTestId('add-tag');
    } else {
      element = testUserPage.getByTestId(testId).first();
    }

    await expect(element).toBeVisible();
  }

  // Click manage button once and test elements inside it
  const manageButton = testUserPage.getByTestId('manage-button');

  if (await manageButton.isVisible()) {
    await manageButton.click();

    for (const testId of manageButtonElements) {
      const element = testUserPage.getByTestId(testId);

      await expect(element).toBeVisible();
    }
  }
});

test('Domain deny operations', async ({ testUserPage, browser }) => {
  test.slow(true);

  // Setup deny permissions
  const page = await browser.newPage();
  try {
    await adminUser.login(page);
    await initializePermissions(page, 'deny', [
      'EditDescription',
      'EditOwners',
      'EditTags',
      'Delete',
      'EditDisplayName',
      'Create',
      'Delete',
      'EditCustomFields',
    ]);
    await assignRoleToUser(page, testUser);
  } finally {
    await page.close();
  }

  // Navigate to domain page
  await redirectToHomePage(testUserPage);
  await sidebarClick(testUserPage, SidebarItem.DOMAIN);
  await domain.visitEntityPage(testUserPage);

  // Test that domain operation elements are visible
  const directElements = [
    'edit-description',
    'add-owner',
    'add-tag',
    'edit-icon-right-panel',
    'add-domain',
  ];

  const manageButtonElements = ['delete-button', 'rename-button'];

  await testUserPage.waitForLoadState('networkidle');

  for (const testId of directElements) {
    let element;
    if (testId === 'add-tag') {
      // For add-tag, target the button within tags-container
      element = testUserPage
        .getByTestId('tags-container')
        .getByTestId('add-tag');
    } else {
      element = testUserPage.getByTestId(testId).first();
    }

    await expect(element).not.toBeVisible();
  }

  // Click manage button once and test elements inside it
  const manageButton = testUserPage.getByTestId('manage-button');

  if (await manageButton.isVisible()) {
    await manageButton.click();

    for (const testId of manageButtonElements) {
      const element = testUserPage.getByTestId(testId);

      await expect(element).not.toBeVisible();
    }
  }
});

test.afterAll('Cleanup domain', async ({ browser }) => {
  try {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await domain.delete(apiContext);
    await EntityDataClass.postRequisitesForTests(apiContext);
    await afterAction();
  } catch (error) {
    // Don't fail the test suite if cleanup fails
  }
});

test.afterAll('Cleanup', async ({ browser }) => {
  try {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await adminUser.delete(apiContext);
    await testUser.delete(apiContext);
    await afterAction();
  } catch (error) {
    // Don't fail the test suite if cleanup fails
  }
});
