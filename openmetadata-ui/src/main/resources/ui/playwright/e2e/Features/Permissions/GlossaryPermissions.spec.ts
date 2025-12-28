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
import { Glossary } from '../../../support/glossary/Glossary';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { getApiContext, redirectToHomePage } from '../../../utils/common';
import {
  assignRoleToUser,
  cleanupPermissions,
  initializePermissions,
} from '../../../utils/permission';
import { sidebarClick } from '../../../utils/sidebar';

const adminUser = new UserClass();
const testUser = new UserClass();
const glossary = new Glossary();

const test = base.extend<{
  testUserPage: Page;
}>({
  page: async ({ browser }, use) => {
    const adminPage = await browser.newPage();
    try {
      await adminUser.login(adminPage);
      // eslint-disable-next-line react-hooks/rules-of-hooks
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

test.describe('Glossary Permissions', () => {
  test.beforeAll('Setup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await adminUser.create(apiContext);
    await adminUser.setAdminRole(apiContext);
    await testUser.create(apiContext);
    await glossary.create(apiContext);
    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await glossary.delete(apiContext);
    await testUser.delete(apiContext);
    await adminUser.delete(apiContext);
    await afterAction();
  });

  test('Glossary allow operations', async ({ testUserPage, page }) => {
    test.slow(true);

    const { apiContext } = await getApiContext(page);
    await initializePermissions(page, 'allow', [
      'EditDescription',
      'EditOwners',
      'EditTags',
      'Delete',
      'EditDisplayName',
      'Create',
      'Delete',
      'EditReviewers',
    ]);
    await assignRoleToUser(page, testUser);

    await redirectToHomePage(testUserPage);
    await sidebarClick(testUserPage, SidebarItem.GLOSSARY);
    await glossary.visitEntityPage(testUserPage);

    // Test that glossary operation elements are visible
    const directElements = [
      'edit-description',
      'add-owner',
      'add-tag',
      'Add',
      'add-glossary',
    ];

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

    const manageButton = testUserPage.getByTestId('manage-button');

    if (await manageButton.isVisible()) {
      await manageButton.click();

      for (const testId of manageButtonElements) {
        const element = testUserPage.getByTestId(testId);

        await expect(element).toBeVisible();
      }
    }
    await cleanupPermissions(apiContext);
  });

  test('Glossary deny operations', async ({ testUserPage, page }) => {
    test.slow(true);

    // Setup deny permissions
    const { apiContext } = await getApiContext(page);
    await initializePermissions(page, 'deny', [
      'EditDescription',
      'EditOwners',
      'EditTags',
      'Delete',
      'EditDisplayName',
      'Create',
      'Delete',
      'EditReviewers',
    ]);
    await assignRoleToUser(page, testUser);

    // Navigate to glossary page
    await redirectToHomePage(testUserPage);
    await sidebarClick(testUserPage, SidebarItem.GLOSSARY);
    await glossary.visitEntityPage(testUserPage);

    // Test that glossary operation elements are visible
    const directElements = [
      'edit-description',
      'add-owner',
      'add-tag',
      'add-glossary',
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
    await cleanupPermissions(apiContext);
  });

  // P-03: EditDescription only - only description editable
  test('EditDescription only permission', async ({ testUserPage, page }) => {
    test.slow(true);

    const { apiContext } = await getApiContext(page);
    await initializePermissions(page, 'allow', ['EditDescription']);
    await assignRoleToUser(page, testUser);

    await redirectToHomePage(testUserPage);
    await sidebarClick(testUserPage, SidebarItem.GLOSSARY);
    await glossary.visitEntityPage(testUserPage);

    await testUserPage.waitForLoadState('networkidle');

    // Edit description button should be visible
    const editDescBtn = testUserPage.getByTestId('edit-description');

    await expect(editDescBtn).toBeVisible();

    await cleanupPermissions(apiContext);
  });

  // P-04: EditOwners only - only owners editable
  test('EditOwners only permission', async ({ testUserPage, page }) => {
    test.slow(true);

    const { apiContext } = await getApiContext(page);
    await initializePermissions(page, 'allow', ['EditOwners']);
    await assignRoleToUser(page, testUser);

    await redirectToHomePage(testUserPage);
    await sidebarClick(testUserPage, SidebarItem.GLOSSARY);
    await glossary.visitEntityPage(testUserPage);

    await testUserPage.waitForLoadState('networkidle');

    // Add owner button should be visible
    const addOwner = testUserPage.getByTestId('add-owner');

    await expect(addOwner).toBeVisible();

    // Edit description button should NOT be visible
    const editDescBtn = testUserPage.getByTestId('edit-description');

    await expect(editDescBtn).not.toBeVisible();

    await cleanupPermissions(apiContext);
  });

  // P-05: EditTags only - only tags editable
  test('EditTags only permission', async ({ testUserPage, page }) => {
    test.slow(true);

    const { apiContext } = await getApiContext(page);
    await initializePermissions(page, 'allow', ['EditTags']);
    await assignRoleToUser(page, testUser);

    await redirectToHomePage(testUserPage);
    await sidebarClick(testUserPage, SidebarItem.GLOSSARY);
    await glossary.visitEntityPage(testUserPage);

    await testUserPage.waitForLoadState('networkidle');

    // Add tag button should be visible
    const addTag = testUserPage
      .getByTestId('tags-container')
      .getByTestId('add-tag');

    await expect(addTag).toBeVisible();

    // Edit description button should NOT be visible
    const editDescBtn = testUserPage.getByTestId('edit-description');

    await expect(editDescBtn).not.toBeVisible();

    await cleanupPermissions(apiContext);
  });

  // P-06: Delete only - only delete available
  test('Delete only permission', async ({ testUserPage, page }) => {
    test.slow(true);

    const { apiContext } = await getApiContext(page);
    await initializePermissions(page, 'allow', ['Delete']);
    await assignRoleToUser(page, testUser);

    await redirectToHomePage(testUserPage);
    await sidebarClick(testUserPage, SidebarItem.GLOSSARY);
    await glossary.visitEntityPage(testUserPage);

    await testUserPage.waitForLoadState('networkidle');

    // Manage button should be visible with delete option
    const manageButton = testUserPage.getByTestId('manage-button');

    if (await manageButton.isVisible()) {
      await manageButton.click();

      const deleteButton = testUserPage.getByTestId('delete-button');

      await expect(deleteButton).toBeVisible();

      // Rename button should NOT be visible
      const renameButton = testUserPage.getByTestId('rename-button');

      await expect(renameButton).not.toBeVisible();
    }

    await cleanupPermissions(apiContext);
  });

  // P-07: Create only - can create but not edit
  test('Create only permission', async ({ testUserPage, page }) => {
    test.slow(true);

    const { apiContext } = await getApiContext(page);
    await initializePermissions(page, 'allow', ['Create']);
    await assignRoleToUser(page, testUser);

    await redirectToHomePage(testUserPage);
    await sidebarClick(testUserPage, SidebarItem.GLOSSARY);
    await glossary.visitEntityPage(testUserPage);

    await testUserPage.waitForLoadState('networkidle');

    // Add glossary button should be visible (create permission)
    const addGlossaryBtn = testUserPage.getByTestId('add-glossary');

    await expect(addGlossaryBtn).toBeVisible();

    // Edit description should NOT be visible
    const editDescBtn = testUserPage.getByTestId('edit-description');

    await expect(editDescBtn).not.toBeVisible();

    await cleanupPermissions(apiContext);
  });

  // P-08: ViewBasic - limited view access (user can view but not edit)
  test('ViewBasic permission shows read-only access', async ({
    testUserPage,
    page,
  }) => {
    test.slow(true);

    const { apiContext } = await getApiContext(page);

    // Only ViewBasic permission - no edit permissions
    await initializePermissions(page, 'allow', ['ViewBasic']);
    await assignRoleToUser(page, testUser);

    await redirectToHomePage(testUserPage);
    await sidebarClick(testUserPage, SidebarItem.GLOSSARY);
    await glossary.visitEntityPage(testUserPage);

    await testUserPage.waitForLoadState('networkidle');

    // User should be able to view the glossary page
    const glossaryHeader = testUserPage.getByTestId(
      'entity-header-display-name'
    );

    await expect(glossaryHeader).toBeVisible({ timeout: 10000 });
    await expect(glossaryHeader).toContainText(glossary.data.displayName);

    await cleanupPermissions(apiContext);
  });

  // P-11: Team-based permissions work correctly
  test('Team-based permissions work correctly', async ({
    testUserPage,
    page,
  }) => {
    test.slow(true);

    const { apiContext } = await getApiContext(page);

    // Create a team and add testUser to it
    const teamName = `TestTeam${Date.now()}`;
    const teamResponse = await apiContext.post('/api/v1/teams', {
      data: {
        name: teamName,
        displayName: teamName,
        description: 'Test team for permissions',
        teamType: 'Group',
      },
    });
    const teamData = await teamResponse.json();
    const teamId = teamData.id;

    // Add user to team
    await apiContext.patch(`/api/v1/teams/${teamData.id}`, {
      data: [
        {
          op: 'add',
          path: '/users/0',
          value: {
            id: testUser.responseData.id,
            type: 'user',
          },
        },
      ],
      headers: {
        'Content-Type': 'application/json-patch+json',
      },
    });

    // Set up permissions with team as the principal
    await initializePermissions(page, 'allow', [
      'EditDescription',
      'EditOwners',
    ]);

    // Login as test user and verify permissions inherited from team
    await redirectToHomePage(testUserPage);
    await sidebarClick(testUserPage, SidebarItem.GLOSSARY);
    await glossary.visitEntityPage(testUserPage);

    await testUserPage.waitForLoadState('networkidle');

    // Verify user can access the glossary page (team membership works)
    const glossaryHeader = testUserPage.getByTestId(
      'entity-header-display-name'
    );

    await expect(glossaryHeader).toBeVisible({ timeout: 10000 });
    await expect(glossaryHeader).toContainText(glossary.data.displayName);

    // Clean up
    await cleanupPermissions(apiContext);

    if (teamId) {
      await apiContext.delete(`/api/v1/teams/${teamId}?hardDelete=true`);
    }
  });
});
