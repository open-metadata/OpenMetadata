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
import { test as base, expect, Page } from '@playwright/test';
import {
  DATA_CONSUMER_RULES,
  DATA_STEWARD_RULES,
  EDIT_DESCRIPTION_RULE,
  EDIT_GLOSSARY_TERM_RULE,
  EDIT_TAGS_RULE,
  EDIT_USER_FOR_TEAM_RULES,
  OWNER_TEAM_RULES,
  VIEW_ALL_RULE,
  VIEW_ALL_WITH_MATCH_TAG_CONDITION,
} from '../../constant/permission';
import { GlobalSettingOptions } from '../../constant/settings';
import { SidebarItem } from '../../constant/sidebar';
import { PolicyClass } from '../../support/access-control/PoliciesClass';
import { RolesClass } from '../../support/access-control/RolesClass';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { TableClass } from '../../support/entity/TableClass';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { TeamClass } from '../../support/team/TeamClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  getApiContext,
  redirectToHomePage,
  toastNotification,
  uuid,
  visitOwnProfilePage,
} from '../../utils/common';
import { addOwner, waitForAllLoadersToDisappear } from '../../utils/entity';
import { settingClick, sidebarClick } from '../../utils/sidebar';
import {
  addUser,
  checkDataConsumerPermissions,
  checkEditOwnerButtonPermission,
  checkForUserExistError,
  checkStewardPermissions,
  checkStewardServicesPermissions,
  generateToken,
  hardDeleteUserProfilePage,
  performUserLogin,
  permanentDeleteUser,
  resetPassword,
  restoreUser,
  restoreUserProfilePage,
  revokeToken,
  settingPageOperationPermissionCheck,
  softDeleteUser,
  softDeleteUserProfilePage,
  updateExpiration,
  updateUserDetails,
  visitUserListPage,
  visitUserProfilePage,
} from '../../utils/user';

const userName = `pw-user-${uuid()}`;
const expirationTime = [1, 7, 30, 60, 90];

const updatedUserDetails = {
  name: userName,
  email: `${userName}@gmail.com`,
  updatedDisplayName: `Edited${uuid()}`,
  teamName: 'Applications',
  updatedDescription: `This is updated description ${uuid()}`,
  password: `User@${uuid()}`,
  newPassword: `NewUser@${uuid()}`,
};

const adminUser = new UserClass();
const dataConsumerUser = new UserClass();
const dataStewardUser = new UserClass();
const user = new UserClass();
const user2 = new UserClass();
const user3 = new UserClass();
const tableEntity = new TableClass();
const tableEntity2 = new TableClass();
const policy = new PolicyClass();
const role = new RolesClass();
const persona1 = new PersonaClass();
const persona2 = new PersonaClass();

const entities = [
  EntityDataClass.table1,
  EntityDataClass.topic1,
  EntityDataClass.dashboard1,
  EntityDataClass.pipeline1,
  EntityDataClass.mlModel1,
  EntityDataClass.metric1,
  EntityDataClass.chart1,
  EntityDataClass.storedProcedure1,
  EntityDataClass.apiEndpoint1,
  EntityDataClass.container1,
  EntityDataClass.searchIndex1,
  EntityDataClass.dashboardDataModel1,
  EntityDataClass.directory1,
  EntityDataClass.file1,
  EntityDataClass.spreadsheet1,
  EntityDataClass.worksheet1,
];

const test = base.extend<{
  adminPage: Page;
  dataConsumerPage: Page;
  dataStewardPage: Page;
}>({
  adminPage: async ({ browser }, use) => {
    const adminPage = await browser.newPage();
    await adminUser.login(adminPage);
    await use(adminPage);
    await adminPage.close();
  },
  dataConsumerPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await dataConsumerUser.login(page);
    await use(page);
    await page.close();
  },
  dataStewardPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await dataStewardUser.login(page);
    await use(page);
    await page.close();
  },
});

test.beforeAll('Setup pre-requests', async ({ browser }) => {
  test.slow(true);

  const { apiContext, afterAction } = await performAdminLogin(browser);

  await adminUser.create(apiContext);
  await adminUser.setAdminRole(apiContext);
  await dataConsumerUser.create(apiContext);
  await dataStewardUser.create(apiContext);
  await dataStewardUser.setDataStewardRole(apiContext);
  await user.create(apiContext);
  await user2.create(apiContext);
  await user3.create(apiContext);
  await user3.setAdminRole(apiContext);
  await tableEntity.create(apiContext);
  await tableEntity2.create(apiContext);
  await policy.create(apiContext, DATA_STEWARD_RULES);
  await role.create(apiContext, [policy.responseData.name]);
  await persona1.create(apiContext, [adminUser.responseData.id]);
  await persona2.create(apiContext, [adminUser.responseData.id]);

  await afterAction();
});

test.describe('User with Admin Roles', () => {
  test.slow(true);

  test('Update own admin details', async ({ adminPage }) => {
    await redirectToHomePage(adminPage);

    await updateUserDetails(
      adminPage,
      updatedUserDetails.updatedDisplayName,
      true
    );
  });

  test('Create and Delete user', async ({ adminPage }) => {
    await redirectToHomePage(adminPage);
    await visitUserListPage(adminPage);

    await addUser(adminPage, {
      ...updatedUserDetails,
      role: role.responseData.displayName,
    });

    await visitUserProfilePage(adminPage, updatedUserDetails.name);

    await visitUserListPage(adminPage);

    await test.step(
      "User shouldn't be allowed to create User with same Email",
      async () => {
        await checkForUserExistError(adminPage, {
          name: updatedUserDetails.name,
          email: updatedUserDetails.email,
          password: updatedUserDetails.password,
        });
      }
    );

    await permanentDeleteUser(
      adminPage,
      updatedUserDetails.name,
      updatedUserDetails.name,
      false
    );
  });

  test('Admin soft & hard delete and restore user', async ({ adminPage }) => {
    await redirectToHomePage(adminPage);
    await visitUserListPage(adminPage);
    await softDeleteUser(
      adminPage,
      user2.responseData.name,
      user2.responseData.displayName
    );

    const fetchUsers = adminPage.waitForResponse(
      '/api/v1/users?**include=non-deleted'
    );
    await adminPage.fill('[data-testid="searchbar"]', '');
    await fetchUsers;

    await restoreUser(
      adminPage,
      user2.responseData.name,
      user2.responseData.displayName
    );

    await permanentDeleteUser(
      adminPage,
      user2.responseData.name,
      user2.responseData.displayName
    );
  });

  test('Admin soft & hard delete and restore user from profile page', async ({
    adminPage,
  }) => {
    await redirectToHomePage(adminPage);
    await settingClick(adminPage, GlobalSettingOptions.USERS);
    await adminPage.waitForLoadState('networkidle');
    await adminPage.waitForSelector('.user-list-table [data-testid="loader"]', {
      state: 'detached',
    });
    await softDeleteUserProfilePage(
      adminPage,
      user.responseData.name,
      user.responseData.displayName
    );

    await restoreUserProfilePage(adminPage, user.responseData.displayName);
    await hardDeleteUserProfilePage(adminPage, user.responseData.displayName);
  });

  test('User should be visible in right panel on table page when added as custom property', async ({
    adminPage,
  }) => {
    const { apiContext } = await getApiContext(adminPage);

    // await redirectToHomePage(adminPage);
    // 1. Setup - Create Custom Property and assign to Table
    const customPropertyName = `pwCustomUserList${uuid()}`;
    const customPropertyDescription = 'test description';

    // Get Entity Reference List Type ID
    const typeResponse = await apiContext.get(
      '/api/v1/metadata/types/name/entityReferenceList'
    );
    const typeData = await typeResponse.json();
    const typeId = typeData.id;

    // Get Table Entity ID
    const tableTypeResponse = await apiContext.get(
      '/api/v1/metadata/types/name/table'
    );
    const tableTypeData = await tableTypeResponse.json();
    const tableTypeId = tableTypeData.id;

    // Create Custom Property
    await apiContext.put(`/api/v1/metadata/types/${tableTypeId}`, {
      data: {
        name: customPropertyName,
        description: customPropertyDescription,
        propertyType: {
          id: typeId,
          type: 'type',
        },
        customPropertyConfig: {
          config: ['user'],
        },
      },
    });

    const upperCasedName = user.responseData.name.toUpperCase();
    // Patch Table to add the user to the custom property
    await tableEntity.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/extension',
          value: {
            [customPropertyName]: [
              {
                id: user.responseData.id,
                type: 'user',
                name: upperCasedName,
                fullyQualifiedName: null,
              },
            ],
          },
        },
      ],
    });

    // 2. UI Verification
    await redirectToHomePage(adminPage);
    await tableEntity.visitEntityPage(adminPage);
    await adminPage.waitForLoadState('networkidle');

    // Check if the user details are visible in the right panel
    const userElement = adminPage.getByTestId(upperCasedName);
    const isUserVisible = await userElement.isVisible();

    // If not visible, click on Custom Properties tab to see all custom properties
    if (!isUserVisible) {
      await adminPage.getByTestId('custom_properties').click();
    }

    // Verify Custom Property in Right Panel
    const rightPanelSection = adminPage.getByTestId(customPropertyName);
    await expect(rightPanelSection).toBeVisible();

    // Verify User Link
    const userLink = adminPage.getByTestId(upperCasedName).getByRole('link');

    await expect(userLink).toContainText(upperCasedName);

    // Click User Link and Verify Navigation
    const userDetailsResponse = adminPage.waitForResponse(
      '/api/v1/users/name/*'
    );
    await userLink.click();
    await userDetailsResponse;

    await expect(adminPage).toHaveURL(new RegExp(`/users/${upperCasedName}`));
    await expect(adminPage.getByTestId('user-display-name')).toHaveText(
      user.responseData.displayName
    );
  });
});

test.describe('User with Data Consumer Roles', () => {
  test.slow(true);

  test('Token generation & revocation for Data Consumer', async ({
    dataConsumerPage,
  }) => {
    await redirectToHomePage(dataConsumerPage);
    await visitOwnProfilePage(dataConsumerPage);

    await dataConsumerPage.getByTestId('access-token').click();
    await generateToken(dataConsumerPage);
    await revokeToken(dataConsumerPage);
  });

  test(`Update token expiration for Data Consumer`, async ({
    dataConsumerPage,
  }) => {
    await redirectToHomePage(dataConsumerPage);
    await visitOwnProfilePage(dataConsumerPage);

    await dataConsumerPage.getByTestId('access-token').click();

    await expect(
      dataConsumerPage.locator('[data-testid="no-token"]')
    ).toBeVisible();

    await dataConsumerPage.click('[data-testid="auth-mechanism"] > span');

    for (const expiry of expirationTime) {
      await updateExpiration(dataConsumerPage, expiry);
    }
  });

  test('User should have only view permission for glossary and tags for Data Consumer', async ({
    dataConsumerPage,
  }) => {
    await redirectToHomePage(dataConsumerPage);

    // Check CRUD for Glossary
    await sidebarClick(dataConsumerPage, SidebarItem.GLOSSARY);

    await dataConsumerPage.waitForLoadState('networkidle');
    await dataConsumerPage.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await expect(
      dataConsumerPage.locator('[data-testid="add-glossary"]')
    ).not.toBeVisible();

    await expect(
      dataConsumerPage.locator('[data-testid="add-new-tag-button-header"]')
    ).not.toBeVisible();

    await expect(
      dataConsumerPage.locator('[data-testid="manage-button"]')
    ).not.toBeVisible();

    // Glossary Term Table Action column
    await expect(dataConsumerPage.getByText('Actions')).not.toBeVisible();

    // right panel
    await expect(
      dataConsumerPage.locator('[data-testid="add-domain"]')
    ).not.toBeVisible();
    await expect(
      dataConsumerPage.locator('[data-testid="edit-review-button"]')
    ).not.toBeVisible();

    const hasAddOwnerButton = dataConsumerPage.locator(
      '[data-testid="add-owner"]'
    );

    if (!hasAddOwnerButton) {
      await checkEditOwnerButtonPermission(dataConsumerPage);
    }

    // Check CRUD for Tags
    await sidebarClick(dataConsumerPage, SidebarItem.TAGS);

    await expect(
      dataConsumerPage.locator('[data-testid="add-classification"]')
    ).not.toBeVisible();

    await expect(
      dataConsumerPage.locator('[data-testid="add-new-tag-button"]')
    ).not.toBeVisible();

    await expect(
      dataConsumerPage.locator('[data-testid="manage-button"]')
    ).not.toBeVisible();
  });

  test('Operations for settings page for Data Consumer', async ({
    dataConsumerPage,
  }) => {
    await settingPageOperationPermissionCheck(dataConsumerPage);
  });

  test('Permissions for table details page for Data Consumer', async ({
    adminPage,
    dataConsumerPage,
  }) => {
    await redirectToHomePage(adminPage);

    await tableEntity.visitEntityPage(adminPage);

    await addOwner({
      page: adminPage,
      owner: user.responseData.displayName,
      type: 'Users',
      endpoint: EntityTypeEndpoint.Table,
      dataTestId: 'data-assets-header',
    });

    await tableEntity.visitEntityPage(dataConsumerPage);

    await checkDataConsumerPermissions(dataConsumerPage);
  });

  test('Update user details for Data Consumer', async ({
    dataConsumerPage,
  }) => {
    await redirectToHomePage(dataConsumerPage);

    await updateUserDetails(
      dataConsumerPage,
      updatedUserDetails.updatedDisplayName
    );
  });

  test('Reset Password for Data Consumer', async ({ dataConsumerPage }) => {
    await redirectToHomePage(dataConsumerPage);

    await resetPassword(
      dataConsumerPage,
      dataConsumerUser.data.password,
      updatedUserDetails.password,
      updatedUserDetails.newPassword
    );

    await dataConsumerUser.logout(dataConsumerPage);

    await dataConsumerUser.login(
      dataConsumerPage,
      dataConsumerUser.data.email,
      updatedUserDetails.newPassword
    );

    await visitOwnProfilePage(dataConsumerPage);
  });
});

test.describe('User with Data Steward Roles', () => {
  test.slow(true);

  test('Update user details for Data Steward', async ({ dataStewardPage }) => {
    await redirectToHomePage(dataStewardPage);

    await updateUserDetails(
      dataStewardPage,
      updatedUserDetails.updatedDisplayName
    );
  });

  test('Token generation & revocation for Data Steward', async ({
    dataStewardPage,
  }) => {
    await redirectToHomePage(dataStewardPage);
    await visitOwnProfilePage(dataStewardPage);

    await dataStewardPage.getByTestId('access-token').click();
    await generateToken(dataStewardPage);
    await revokeToken(dataStewardPage);
  });

  test('Update token expiration for Data Steward', async ({
    dataStewardPage,
  }) => {
    await redirectToHomePage(dataStewardPage);
    await visitOwnProfilePage(dataStewardPage);

    await dataStewardPage.getByTestId('access-token').click();

    await expect(
      dataStewardPage.locator('[data-testid="no-token"]')
    ).toBeVisible();

    await dataStewardPage.click('[data-testid="auth-mechanism"] > span');

    for (const expiry of expirationTime) {
      await updateExpiration(dataStewardPage, expiry);
    }
  });

  test('Operations for settings page for Data Steward', async ({
    dataStewardPage,
  }) => {
    await settingPageOperationPermissionCheck(dataStewardPage);
  });

  test('Check permissions for Data Steward', async ({
    adminPage,
    dataStewardPage,
  }) => {
    await redirectToHomePage(adminPage);

    await checkStewardServicesPermissions(dataStewardPage);

    await tableEntity2.visitEntityPage(adminPage);

    await addOwner({
      page: adminPage,
      owner: user.responseData.displayName ?? user.responseData.name,
      type: 'Users',
      endpoint: EntityTypeEndpoint.Table,
      dataTestId: 'data-assets-header',
    });

    await tableEntity2.visitEntityPage(dataStewardPage);

    await checkStewardPermissions(dataStewardPage);
  });

  test('Reset Password for Data Steward', async ({ dataStewardPage }) => {
    await redirectToHomePage(dataStewardPage);

    await resetPassword(
      dataStewardPage,
      dataStewardUser.data.password,
      updatedUserDetails.password,
      updatedUserDetails.newPassword
    );

    await dataStewardUser.logout(dataStewardPage);

    await dataStewardUser.login(
      dataStewardPage,
      dataStewardUser.data.email,
      updatedUserDetails.newPassword
    );

    await visitOwnProfilePage(dataStewardPage);
  });
});

test.describe('User Profile Feed Interactions', () => {
  test('Should navigate to user profile from feed card avatar click', async ({
    browser,
  }) => {
    test.slow(true);

    const { page, afterAction } = await performUserLogin(browser, user3);

    await redirectToHomePage(page);
    const feedResponse = page.waitForResponse('/api/v1/feed?type=Conversation');

    await visitOwnProfilePage(page);
    await feedResponse;

    await page.waitForSelector('[data-testid="message-container"]');
    const userDetailsResponse = page.waitForResponse('/api/v1/users/name/*');

    const userFeedResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/feed') &&
        response.url().includes('type=Conversation') &&
        response.url().includes('filterType=OWNER_OR_FOLLOWS') &&
        response.url().includes('userId=')
    );

    const avatar = page
      .locator('#feedData [data-testid="message-container"]')
      .first()
      .locator('[data-testid="profile-avatar"]')
      .first();

    await avatar.hover();
    await page.waitForSelector('.ant-popover-card');

    // Ensure popover is stable and visible before clicking
    await page.waitForTimeout(500); // Give popover time to stabilize

    // Get the user name element and ensure it's ready for interaction
    const userNameElement = page.getByTestId('user-name').nth(1);

    // Click with force to handle pointer event interception
    await userNameElement.click({ force: true });

    await userDetailsResponse;
    await userFeedResponse;

    const [response] = await Promise.all([
      userDetailsResponse,
      userFeedResponse,
    ]);
    const { name, displayName } = await response.json();

    // The UI shows displayName if available, otherwise falls back to name
    const expectedText = displayName ?? name;

    await expect(page.locator('[data-testid="user-display-name"]')).toHaveText(
      expectedText
    );

    await afterAction();
  });

  test('Close the profile dropdown after redirecting to user profile page', async ({
    adminPage,
  }) => {
    await redirectToHomePage(adminPage);
    await adminPage.locator('[data-testid="dropdown-profile"] svg').click();
    await adminPage.waitForSelector('[role="menu"].profile-dropdown', {
      state: 'visible',
    });
    const userResponse = adminPage.waitForResponse(
      '/api/v1/users/name/*?fields=*&include=all'
    );
    await adminPage.getByTestId('user-name').click();
    await userResponse;
    await adminPage.waitForLoadState('networkidle');

    await expect(
      adminPage.locator('.user-profile-dropdown-overlay')
    ).not.toBeVisible();
  });
});

test.describe('User Profile Dropdown Persona Interactions', () => {
  test.slow(true);

  test.beforeAll('Prerequisites', async ({ browser }) => {
    const { apiContext, afterAction } = await performUserLogin(
      browser,
      adminUser
    );

    await adminUser.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/personas',
          value: [
            {
              id: persona1.responseData.id,
              type: 'persona',
              name: persona1.responseData.name,
              fullyQualifiedName: persona1.responseData.fullyQualifiedName,
            },
            {
              id: persona2.responseData.id,
              type: 'persona',
              name: persona2.responseData.name,
              fullyQualifiedName: persona2.responseData.fullyQualifiedName,
            },
          ],
        },
        {
          op: 'add',
          path: '/defaultPersona',
          value: {
            id: persona1.responseData.id,
            name: persona1.responseData.name,
            displayName: persona1.responseData.displayName,
            fullyQualifiedName: persona1.responseData.fullyQualifiedName,
            type: 'persona',
          },
        },
      ],
    });

    await afterAction();
  });

  test('Should display persona dropdown with pagination', async ({
    adminPage,
  }) => {
    // Open user profile dropdown
    await adminPage.locator('[data-testid="dropdown-profile"]').click();
    await adminPage.waitForSelector('[role="menu"].profile-dropdown', {
      state: 'visible',
    });

    // Verify personas section is visible
    await expect(adminPage.getByText('Switch Persona')).toBeVisible();

    // Initially should show limited personas (2 by default)
    const initialPersonaLabels = adminPage.locator(
      '[data-testid="persona-label"]'
    );
    const initialCount = await initialPersonaLabels.count();

    expect(initialCount).toBeLessThanOrEqual(2);

    // Check if "more" button exists and click it
    const moreButton = adminPage.getByText(/\d+ More/);
    if (await moreButton.isVisible()) {
      await moreButton.click();

      // Verify all personas are now visible
      const expandedPersonaLabels = adminPage.locator(
        '[data-testid="persona-label"]'
      );
      const expandedCount = await expandedPersonaLabels.count();

      expect(expandedCount).toBeGreaterThan(initialCount);
    }
  });

  test('Should display default persona tag correctly', async ({
    adminPage,
  }) => {
    // Open user profile dropdown
    await adminPage.locator('[data-testid="dropdown-profile"]').click();
    await adminPage.waitForSelector('[role="menu"].profile-dropdown', {
      state: 'visible',
    });

    // Expand personas if needed
    const moreButton = adminPage.getByText(/\d+ More/);
    if (await moreButton.isVisible()) {
      await moreButton.click();
    }

    // Verify default persona tag is visible
    await expect(
      adminPage.locator('[data-testid="default-persona-tag"]')
    ).toBeVisible();

    // Verify default persona is first in the list
    const personaLabels = adminPage.locator('[data-testid="persona-label"]');
    const firstPersona = personaLabels.first();

    await expect(
      firstPersona.locator('[data-testid="default-persona-tag"]')
    ).toBeVisible();
  });

  test('Should switch personas correctly', async ({ adminPage }) => {
    // Open user profile dropdown
    await adminPage.locator('[data-testid="dropdown-profile"]').click();
    await adminPage.waitForSelector('[role="menu"].profile-dropdown', {
      state: 'visible',
    });

    // Expand personas if needed
    const moreButton = adminPage.getByText(/\d+ More/);
    if (await moreButton.isVisible()) {
      await moreButton.click();
    }

    // Find a non-default persona to select
    const personaLabels = adminPage.locator('[data-testid="persona-label"]');
    const personaCount = await personaLabels.count();

    if (personaCount > 1) {
      // Get the second persona (not the default one)
      const secondPersona = personaLabels.nth(1);

      // Click on the second persona
      const personaChangeResponse = adminPage.waitForResponse(
        '/api/v1/docStore/name/persona.*'
      );

      await secondPersona.click();

      // Wait for persona change API call
      await personaChangeResponse;

      // Close dropdown to see updated persona
      await adminPage.keyboard.press('Escape');

      // Reopen dropdown to verify the change
      await adminPage.locator('[data-testid="dropdown-profile"]').click();
      await adminPage.waitForSelector('[role="menu"].profile-dropdown', {
        state: 'visible',
      });

      // Verify the selected persona is checked
      const checkedRadio = adminPage.locator('input[type="radio"]:checked');

      await expect(checkedRadio).toBeVisible();
    }
  });

  test('Should handle persona sorting correctly', async ({ adminPage }) => {
    // Open user profile dropdown
    await adminPage.locator('[data-testid="dropdown-profile"]').click();
    await adminPage.waitForSelector('[role="menu"].profile-dropdown', {
      state: 'visible',
    });

    // Expand personas if needed
    const moreButton = adminPage.getByText(/\d+ More/);
    if (await moreButton.isVisible()) {
      await moreButton.click();
    }

    const personaLabels = adminPage.locator('[data-testid="persona-label"]');
    const personaCount = await personaLabels.count();

    if (personaCount > 1) {
      // First persona should have the default tag
      const firstPersona = personaLabels.first();

      await expect(
        firstPersona.locator('[data-testid="default-persona-tag"]')
      ).toBeVisible();

      // Get text of all personas to verify sorting
      const personaTexts = await personaLabels
        .locator('.ant-typography')
        .allTextContents();

      // Verify first one contains the default persona name
      expect(personaTexts[0]).toContain(persona1.responseData.displayName);
    }
  });

  test('Should revert to default persona after page refresh when non-default is selected', async ({
    adminPage,
  }) => {
    // First, verify default persona is selected initially
    await adminPage.locator('[data-testid="dropdown-profile"]').click();
    await adminPage.waitForSelector('[role="menu"].profile-dropdown', {
      state: 'visible',
    });

    // Expand personas if needed
    const moreButton = adminPage.getByText(/\d+ More/);
    if (await moreButton.isVisible()) {
      await moreButton.click();
    }

    const personaLabels = adminPage.locator('[data-testid="persona-label"]');
    const personaCount = await personaLabels.count();

    if (personaCount > 1) {
      // Verify default persona is initially selected (first one)
      const defaultPersonaRadio = personaLabels
        .first()
        .locator('input[type="radio"]');

      await expect(defaultPersonaRadio).toBeChecked();

      // Select the second (non-default) persona
      const secondPersona = personaLabels.nth(1);
      const personaChangeResponse = adminPage.waitForResponse(
        '/api/v1/docStore/name/persona.*'
      );

      await secondPersona.click();

      // Wait for persona change API call
      await personaChangeResponse;

      // Verify the second persona is now selected
      const secondPersonaRadio = personaLabels
        .nth(1)
        .locator('input[type="radio"]');

      await expect(secondPersonaRadio).toBeChecked();

      // Close dropdown
      await adminPage.keyboard.press('Escape');

      // Refresh the page
      await adminPage.reload();
      await adminPage.waitForLoadState('networkidle');

      // Open dropdown again after refresh
      await adminPage.locator('[data-testid="dropdown-profile"]').click();
      await adminPage.waitForSelector('[role="menu"].profile-dropdown', {
        state: 'visible',
      });

      // Expand personas if needed
      const moreButtonAfterRefresh = adminPage.getByText(/\d+ More/);
      if (await moreButtonAfterRefresh.isVisible()) {
        await moreButtonAfterRefresh.click();
      }

      // Verify default persona is selected again after refresh
      const personaLabelsAfterRefresh = adminPage.locator(
        '[data-testid="persona-label"]'
      );
      const defaultPersonaRadioAfterRefresh = personaLabelsAfterRefresh
        .first()
        .locator('input[type="radio"]');

      await expect(defaultPersonaRadioAfterRefresh).toBeChecked();

      // Verify default persona tag is still visible
      await expect(
        personaLabelsAfterRefresh
          .first()
          .locator('[data-testid="default-persona-tag"]')
      ).toBeVisible();
    }
  });

  test('Should handle default persona change and removal correctly', async ({
    adminPage,
  }) => {
    // Step 1: Verify default persona is initially selected
    await adminPage.locator('[data-testid="dropdown-profile"]').click();
    await adminPage.waitForSelector('[role="menu"].profile-dropdown', {
      state: 'visible',
    });

    // Expand personas if needed
    let moreButton = adminPage.getByText(/\d+ More/);
    if (await moreButton.isVisible()) {
      await moreButton.click();
    }

    // Verify first persona has default tag and is selected
    const personaLabels = adminPage.locator('[data-testid="persona-label"]');

    await expect(
      personaLabels.first().locator('[data-testid="default-persona-tag"]')
    ).toBeVisible();
    await expect(
      personaLabels.first().locator('input[type="radio"]')
    ).toBeChecked();

    // Get the current default persona name for later verification
    const originalDefaultPersonaText = await personaLabels
      .first()
      .locator('.ant-typography')
      .textContent();

    // Close dropdown
    await adminPage.keyboard.press('Escape');

    // Step 2: Go to profile page and change default persona
    await visitOwnProfilePage(adminPage);
    await adminPage.waitForSelector('[data-testid="persona-details-card"]');

    // Change default persona to the second persona
    await adminPage
      .locator('[data-testid="default-edit-user-persona"]')
      .click();
    await adminPage.waitForSelector(
      '[data-testid="default-persona-select-list"]'
    );

    await adminPage.waitForSelector('.ant-select-dropdown', {
      state: 'visible',
    });

    // Select the second persona as default
    await adminPage.getByTitle(persona2.data.displayName).click();

    const defaultPersonaChangeResponse =
      adminPage.waitForResponse('/api/v1/users/*');

    await adminPage
      .locator('[data-testid="user-profile-default-persona-edit-save"]')
      .click();
    await defaultPersonaChangeResponse;

    // Step 3: Go back to home page and verify new default persona is selected
    await redirectToHomePage(adminPage);

    await adminPage.locator('[data-testid="dropdown-profile"]').click();
    await adminPage.waitForSelector('[role="menu"].profile-dropdown', {
      state: 'visible',
    });

    // Expand personas if needed
    moreButton = adminPage.getByText(/\d+ More/);
    if (await moreButton.isVisible()) {
      await moreButton.click();
    }

    // Verify the new default persona (persona2) is now first and selected
    const updatedPersonaLabels = adminPage.locator(
      '[data-testid="persona-label"]'
    );
    const newDefaultPersonaText = await updatedPersonaLabels
      .first()
      .locator('.ant-typography')
      .textContent();

    expect(newDefaultPersonaText).toContain(persona2.responseData.displayName);
    expect(newDefaultPersonaText).not.toBe(originalDefaultPersonaText);

    await expect(
      updatedPersonaLabels
        .first()
        .locator('[data-testid="default-persona-tag"]')
    ).toBeVisible();
    await expect(
      updatedPersonaLabels.first().locator('input[type="radio"]')
    ).toBeChecked();

    // Close dropdown
    await adminPage.keyboard.press('Escape');

    // Step 4: Go back to profile and remove default persona
    await visitOwnProfilePage(adminPage);
    await adminPage.waitForSelector('[data-testid="persona-details-card"]');

    // Remove default persona
    await adminPage
      .locator('[data-testid="default-edit-user-persona"]')
      .click();
    await adminPage.waitForSelector(
      '[data-testid="default-persona-select-list"]'
    );
    await adminPage
      .locator('[data-testid="default-persona-select-list"] .ant-select-clear')
      .click();

    const removePersonaResponse = adminPage.waitForResponse('/api/v1/users/*');
    await adminPage
      .locator('[data-testid="user-profile-default-persona-edit-save"]')
      .click();
    await removePersonaResponse;

    // Verify NO notification appears when removing default persona
    await expect(adminPage.getByTestId('alert-bar')).not.toBeVisible();

    // Verify "No default persona" message appears
    await expect(adminPage.getByText('No default persona')).toBeVisible();

    // Step 5: Go back to home page and verify no default persona in dropdown
    await redirectToHomePage(adminPage);

    await adminPage.locator('[data-testid="dropdown-profile"]').click();
    await adminPage.waitForSelector('[role="menu"].profile-dropdown', {
      state: 'visible',
    });

    // Expand personas if needed
    moreButton = adminPage.getByText(/\d+ More/);
    if (await moreButton.isVisible()) {
      await moreButton.click();
    }

    // Verify no default persona tag exists
    const finalPersonaLabels = adminPage.locator(
      '[data-testid="persona-label"]'
    );

    await expect(
      finalPersonaLabels.locator('[data-testid="default-persona-tag"]')
    ).not.toBeVisible();

    // Verify there are no selected nor a default persona
    const checkedRadios = adminPage.locator('input[type="radio"]:checked');

    await expect(checkedRadios).toHaveCount(0);
  });
});

test.describe('User Profile Persona Interactions', () => {
  test.beforeEach(async ({ browser }) => {
    const { apiContext, afterAction } = await performUserLogin(
      browser,
      adminUser
    );

    // Patch admin user to add personas
    await adminUser.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/personas',
          value: [
            {
              id: persona1.responseData.id,
              type: 'persona',
              name: persona1.responseData.name,
              fullyQualifiedName: persona1.responseData.fullyQualifiedName,
            },
            {
              id: persona2.responseData.id,
              type: 'persona',
              name: persona2.responseData.name,
              fullyQualifiedName: persona2.responseData.fullyQualifiedName,
            },
          ],
        },
      ],
    });

    await afterAction();
  });

  test('Should add, remove, and navigate to persona pages for Personas section', async ({
    adminPage,
  }) => {
    test.slow(true);

    await redirectToHomePage(adminPage);
    await visitOwnProfilePage(adminPage);

    // Wait for the persona card to be visible
    await adminPage.waitForSelector('[data-testid="persona-details-card"]');

    // Test clicking on persona chip to navigate to persona page
    await test.step(
      'Navigate to persona page by clicking on persona chip',
      async () => {
        const personaCard = adminPage.locator(
          '[data-testid="persona-details-card"]'
        );
        const personaChip = personaCard
          .locator('[data-testid="chip-container"] [data-testid="tag-chip"]')
          .first();
        const personaLink = personaChip.locator('a').first();

        // Get the persona name/link for verification
        const personaText = await personaLink.textContent();

        expect(personaText).toBeTruthy();

        // Click the persona link to navigate
        await personaLink.click();
        await adminPage.waitForLoadState('networkidle');

        // Verify we're on the persona page
        await expect(adminPage.url()).toContain('/persona/');
      }
    );

    // Navigate back to user profile for removal test
    await test.step('Navigate back to user profile', async () => {
      await visitOwnProfilePage(adminPage);
      await adminPage.waitForSelector('[data-testid="persona-details-card"]');
    });

    // Test removing personas
    await test.step('Remove personas from user profile', async () => {
      // Click edit button for Personas section
      await adminPage
        .locator('[data-testid="edit-user-persona"]')
        .first()
        .click();

      // Wait for persona popover to be visible
      await adminPage.waitForSelector('[data-testid="persona-select-list"]');

      // Clear all selected personas
      await adminPage
        .locator('[data-testid="persona-select-list"] .ant-select-clear')
        .click();

      // Save the changes
      await adminPage
        .locator('[data-testid="user-profile-persona-edit-save"]')
        .click();

      // Wait for the API call to complete and verify no personas are shown
      await adminPage.waitForResponse('/api/v1/users/*');

      await expect(
        adminPage
          .getByTestId('persona-details-card')
          .getByText('No persona assigned')
      ).toBeVisible();
    });
  });

  test('Should add, remove, and navigate to persona pages for Default Persona section', async ({
    adminPage,
  }) => {
    test.slow(true);

    await redirectToHomePage(adminPage);
    await visitOwnProfilePage(adminPage);

    // Wait for the persona card to be visible
    await adminPage.waitForSelector('[data-testid="persona-details-card"]');

    // Test adding default persona
    await test.step('Add default persona to user profile', async () => {
      // Click edit button for Default Persona section using specific test ID
      await adminPage
        .locator('[data-testid="default-edit-user-persona"]')
        .click();

      // Wait for persona popover to be visible
      await adminPage.waitForSelector(
        '[data-testid="default-persona-select-list"]'
      );

      // Wait for dropdown to open and options to load
      await adminPage.waitForSelector('.ant-select-dropdown', {
        state: 'visible',
      });
      await adminPage.waitForLoadState('networkidle');

      // Select specific persona for default - try test ID first, fallback to role selector
      const defaultPersonaOptionTestId = adminPage.getByTitle(
        persona1.responseData.displayName
      );

      await defaultPersonaOptionTestId.click();

      // Save the changes
      const savePersonaResponse = adminPage.waitForResponse('/api/v1/users/*');
      await adminPage
        .locator('[data-testid="user-profile-default-persona-edit-save"]')
        .click();

      // Wait for the API call to complete and default persona to appear
      await savePersonaResponse;

      // Check that success notification appears with correct message
      await toastNotification(
        adminPage,
        `Your Default Persona changed to ${persona1.responseData.displayName}`
      );

      await adminPage.waitForSelector(
        '.default-persona-text [data-testid="tag-chip"]'
      );
    });

    // Test clicking on default persona chip to navigate to persona page
    await test.step(
      'Navigate to persona page by clicking on default persona chip',
      async () => {
        const defaultPersonaChip = adminPage
          .locator('.default-persona-text [data-testid="tag-chip"]')
          .first();
        const personaLink = defaultPersonaChip.locator('a').first();

        // Get the persona name/link for verification
        const personaText = await personaLink.textContent();

        expect(personaText).toBeTruthy();

        // Click the persona link to navigate
        await personaLink.click();
        await adminPage.waitForLoadState('networkidle');

        // Verify we're on the persona page
        await expect(adminPage.url()).toContain('/persona/');
      }
    );

    // Navigate back to user profile for removal test
    await test.step('Navigate back to user profile', async () => {
      await visitOwnProfilePage(adminPage);
      await adminPage.waitForSelector('[data-testid="persona-details-card"]');
    });

    // Test removing default persona
    await test.step('Remove default persona from user profile', async () => {
      // Click edit button for Default Persona section using specific test ID
      await adminPage
        .locator('[data-testid="default-edit-user-persona"]')
        .click();

      await waitForAllLoadersToDisappear(adminPage);

      // Wait for persona popover to be visible
      await adminPage.waitForSelector(
        '[data-testid="default-persona-select-list"]'
      );

      // Clear the selected default persona
      await adminPage
        .locator(
          '[data-testid="default-persona-select-list"] .ant-select-clear'
        )
        .click();

      const defaultPersonaChangeResponse =
        adminPage.waitForResponse('/api/v1/users/*');

      // Save the changes
      await adminPage
        .locator('[data-testid="user-profile-default-persona-edit-save"]')
        .click();

      // Wait for the API call to complete and verify no default persona is shown
      await defaultPersonaChangeResponse;

      // Verify NO notification appears when removing default persona
      await expect(adminPage.getByTestId('alert-bar')).not.toBeVisible();

      await expect(adminPage.getByText('No default persona')).toBeVisible();
    });
  });
});

base.describe(
  'Users Performance around application with multiple team inheriting roles and policy',
  () => {
    base.slow(true);
    const policy = new PolicyClass();
    const policy2 = new PolicyClass();
    const policy3 = new PolicyClass();
    const policy4 = new PolicyClass();
    const policy5 = new PolicyClass();
    const role = new RolesClass();
    const role2 = new RolesClass();
    const role3 = new RolesClass();
    const role4 = new RolesClass();
    const role5 = new RolesClass();

    const user = new UserClass();

    base.beforeAll('Setup pre-requests', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await user.create(apiContext);

      await Promise.all([
        policy.create(apiContext, DATA_STEWARD_RULES),
        policy2.create(apiContext, DATA_CONSUMER_RULES),
        policy3.create(apiContext, VIEW_ALL_RULE),
        policy4.create(apiContext, VIEW_ALL_WITH_MATCH_TAG_CONDITION),
        policy5.create(apiContext, [
          ...OWNER_TEAM_RULES,
          ...EDIT_TAGS_RULE,
          ...EDIT_USER_FOR_TEAM_RULES,
          ...EDIT_DESCRIPTION_RULE,
          ...EDIT_GLOSSARY_TERM_RULE,
        ]),
      ]);

      await Promise.all([
        role.create(apiContext, [policy.responseData.name]),
        role2.create(apiContext, [policy2.responseData.name]),
        role3.create(apiContext, [policy3.responseData.name]),
        role4.create(apiContext, [policy4.responseData.name]),
        role5.create(apiContext, [policy5.responseData.name]),
      ]);

      const createTeam = (roleId: string) =>
        new TeamClass({
          name: `PW%data_consumer_team-${uuid()}`,
          displayName: `PW Data Consumer Team ${uuid()}`,
          description: 'playwright data consumer team description',
          teamType: 'Group',
          users: [user.responseData.id],
          defaultRoles: [roleId],
        });

      const team = createTeam(role.responseData.id ?? '');
      const team2 = createTeam(role2.responseData.id ?? '');
      const team3 = createTeam(role3.responseData.id ?? '');
      const team4 = createTeam(role4.responseData.id ?? '');
      const team5 = createTeam(role5.responseData.id ?? '');

      await Promise.all([
        team.create(apiContext),
        team2.create(apiContext),
        team3.create(apiContext),
        team4.create(apiContext),
        team5.create(apiContext),
      ]);

      await afterAction();
    });

    base.afterAll('Cleanup', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await Promise.all([
        policy.delete(apiContext),
        role.delete(apiContext),
        policy2.delete(apiContext),
        role2.delete(apiContext),
        policy3.delete(apiContext),
        role3.delete(apiContext),
        policy4.delete(apiContext),
        role4.delete(apiContext),
        policy5.delete(apiContext),
        role5.delete(apiContext),
      ]);
      await afterAction();
    });

    base(
      'User Performance across different entities pages',
      async ({ browser }) => {
        const { page, afterAction } = await performUserLogin(browser, user);

        for (const entity of entities) {
          await entity.visitEntityPage(page);
          await page.waitForLoadState('networkidle');
          await page.waitForSelector('[data-testid="loader"]', {
            state: 'detached',
          });

          await expect(page.getByTestId('entity-header-name')).toHaveText(
            entity.entityResponseData.name
          );

          const feedResponse = page.waitForResponse(
            '/api/v1/feed?entityLink=*&type=Conversation'
          );

          await page.getByTestId('activity_feed').click();
          await feedResponse;

          await page.waitForSelector('[data-testid="loader"]', {
            state: 'detached',
          });

          await expect(
            page.getByTestId('global-setting-left-panel').getByText('All')
          ).toBeVisible();

          await expect(
            page.getByTestId('global-setting-left-panel').getByText('Tasks')
          ).toBeVisible();

          const lineageResponse = page.waitForResponse(
            `/api/v1/lineage/getLineage?fqn=${entity.entityResponseData.fullyQualifiedName}&type=**`
          );

          await page.getByTestId('lineage').click();
          await lineageResponse;

          await page.waitForSelector('[data-testid="loader"]', {
            state: 'detached',
          });

          await expect(
            page.getByTestId(
              `lineage-node-${entity.entityResponseData.fullyQualifiedName}`
            )
          ).toBeVisible();
        }

        await afterAction();
      }
    );
  }
);
