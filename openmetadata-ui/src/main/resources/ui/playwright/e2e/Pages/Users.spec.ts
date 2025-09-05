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
import { DATA_STEWARD_RULES } from '../../constant/permission';
import { GlobalSettingOptions } from '../../constant/settings';
import { SidebarItem } from '../../constant/sidebar';
import { PolicyClass } from '../../support/access-control/PoliciesClass';
import { RolesClass } from '../../support/access-control/RolesClass';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { TableClass } from '../../support/entity/TableClass';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  redirectToHomePage,
  uuid,
  visitOwnProfilePage,
} from '../../utils/common';
import { addOwner } from '../../utils/entity';
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
const tableEntity = new TableClass();
const tableEntity2 = new TableClass();
const policy = new PolicyClass();
const role = new RolesClass();
const persona1 = new PersonaClass();
const persona2 = new PersonaClass();

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

base.beforeAll('Setup pre-requests', async ({ browser }) => {
  test.slow(true);

  const { apiContext, afterAction } = await performAdminLogin(browser);

  await adminUser.create(apiContext);
  await adminUser.setAdminRole(apiContext);
  await dataConsumerUser.create(apiContext);
  await dataStewardUser.create(apiContext);
  await dataStewardUser.setDataStewardRole(apiContext);
  await user.create(apiContext);
  await user2.create(apiContext);
  await tableEntity.create(apiContext);
  await tableEntity2.create(apiContext);
  await policy.create(apiContext, DATA_STEWARD_RULES);
  await role.create(apiContext, [policy.responseData.name]);
  await persona1.create(apiContext);
  await persona2.create(apiContext);

  await afterAction();
});

base.afterAll('Cleanup', async ({ browser }) => {
  test.slow(true);

  const { apiContext, afterAction } = await performAdminLogin(browser);
  await adminUser.delete(apiContext);
  await dataConsumerUser.delete(apiContext);
  await dataStewardUser.delete(apiContext);
  await tableEntity.delete(apiContext);
  await tableEntity2.delete(apiContext);
  await policy.delete(apiContext);
  await role.delete(apiContext);
  await persona1.delete(apiContext);
  await persona2.delete(apiContext);

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
    adminPage,
  }) => {
    await redirectToHomePage(adminPage);
    const feedResponse = adminPage.waitForResponse(
      '/api/v1/feed?type=Conversation'
    );

    await visitOwnProfilePage(adminPage);
    await feedResponse;

    await adminPage.waitForSelector('[data-testid="message-container"]');
    const userDetailsResponse = adminPage.waitForResponse(
      '/api/v1/users/name/*'
    );
    const userFeedResponse = adminPage.waitForResponse(
      '/api/v1/feed?type=Conversation&filterType=OWNER_OR_FOLLOWS&userId=*'
    );

    const avatar = adminPage
      .locator('#feedData [data-testid="message-container"]')
      .first()
      .locator('[data-testid="profile-avatar"]')
      .first();

    await avatar.hover();
    await adminPage.waitForSelector('.ant-popover-card');

    // Ensure popover is stable and visible before clicking
    await adminPage.waitForTimeout(500); // Give popover time to stabilize

    // Get the user name element and ensure it's ready for interaction
    const userNameElement = adminPage.getByTestId('user-name').nth(1);

    // Click with force to handle pointer event interception
    await userNameElement.click({ force: true });

    const [response] = await Promise.all([
      userDetailsResponse,
      userFeedResponse,
    ]);
    const { name, displayName } = await response.json();

    // The UI shows displayName if available, otherwise falls back to name
    const expectedText = displayName ?? name;

    await expect(
      adminPage.locator('[data-testid="user-display-name"]')
    ).toHaveText(expectedText);
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

  test.describe('User Profile Persona Interactions', () => {
    test('Should add, remove, and navigate to persona pages for Personas section', async ({
      adminPage,
    }) => {
      await redirectToHomePage(adminPage);
      await visitOwnProfilePage(adminPage);

      // Wait for the persona card to be visible
      await adminPage.waitForSelector('[data-testid="persona-details-card"]');

      // Test adding personas
      await test.step('Add personas to user profile', async () => {
        // Click edit button for Personas section
        await adminPage
          .locator('[data-testid="edit-user-persona"]')
          .first()
          .click();

        // Wait for persona popover to be visible
        await adminPage.waitForSelector('[data-testid="persona-select-list"]');

        // Open the persona select dropdown
        await adminPage.locator('[data-testid="persona-select-list"]').click();

        // Select first available persona
        const firstPersonaOption = adminPage
          .locator('.ant-select-item-option')
          .first();
        await firstPersonaOption.click();

        // Save the changes
        await adminPage
          .locator('[data-testid="user-profile-persona-edit-save"]')
          .click();

        // Wait for the API call to complete and persona to appear
        await adminPage.waitForResponse(/\/api\/v1\/users\/.*/);
        await adminPage.waitForSelector(
          '[data-testid="chip-container"] [data-testid="tag-chip"]'
        );
      });

      // Test clicking on persona chip to navigate to persona page
      await test.step(
        'Navigate to persona page by clicking on persona chip',
        async () => {
          const personaChip = adminPage
            .locator('[data-testid="chip-container"] [data-testid="tag-chip"]')
            .first();
          const personaLink = personaChip.locator('a').first();

          // Get the persona name/link for verification
          const personaText = await personaLink.textContent();

          expect(personaText).toBeTruthy();

          // Wait for navigation response
          const navigationResponse = adminPage.waitForResponse(
            /\/api\/v1\/personas\/.*/
          );
          await personaLink.click();
          await navigationResponse;

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
        await adminPage.waitForResponse(/\/api\/v1\/users\/.*/);

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
      await redirectToHomePage(adminPage);
      await visitOwnProfilePage(adminPage);

      // Wait for the persona card to be visible
      await adminPage.waitForSelector('[data-testid="persona-details-card"]');

      // First, add some personas to the user so we can select a default persona
      await test.step('Add personas to user profile first', async () => {
        // Click edit button for Personas section (regular personas, not default)
        await adminPage
          .locator('[data-testid="edit-user-persona"]')
          .first()
          .click();

        // Wait for persona popover and select multiple personas
        await adminPage.waitForSelector('[data-testid="persona-select-list"]');
        await adminPage.locator('[data-testid="persona-select-list"]').click();

        // Select multiple personas
        const personaOptions = adminPage.locator('.ant-select-item-option');
        const optionCount = await personaOptions.count();
        for (let i = 0; i < Math.min(2, optionCount); i++) {
          await personaOptions.nth(i).click();
        }

        // Save the changes
        await adminPage
          .locator('[data-testid="user-profile-persona-edit-save"]')
          .click();
        await adminPage.waitForResponse(/\/api\/v1\/users\/.*/);
      });

      // Test adding default persona
      await test.step('Add default persona to user profile', async () => {
        // Click edit button for Default Persona section (should be the second edit button)
        const editButtons = adminPage.locator(
          '[data-testid="edit-user-persona"]'
        );
        await editButtons.nth(1).click();

        // Wait for persona popover to be visible
        await adminPage.waitForSelector('[data-testid="persona-select-list"]');

        // Open the persona select dropdown (single select for default)
        await adminPage
          .getByRole('tooltip', { name: 'Default Persona' })
          .getByTestId('persona-select-list')
          .click();

        await adminPage.waitForLoadState('networkidle');

        // Select first available persona
        const firstPersonaOption = adminPage
          .locator('.ant-select-item-option')
          .first();
        await firstPersonaOption.click();

        // Save the changes
        await adminPage
          .locator('[data-testid="user-profile-persona-edit-save"]')
          .click();

        // Wait for the API call to complete and default persona to appear
        await adminPage.waitForResponse(/\/api\/v1\/users\/.*/);
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

          // Wait for navigation response
          const navigationResponse = adminPage.waitForResponse(
            /\/api\/v1\/personas\/.*/
          );
          await personaLink.click();
          await navigationResponse;

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
        // Click edit button for Default Persona section
        const editButtons = adminPage.locator(
          '[data-testid="edit-user-persona"]'
        );
        await editButtons.nth(1).click();

        // Wait for persona popover to be visible
        await adminPage.waitForSelector('[data-testid="persona-select-list"]');

        // Clear the selected default persona
        await adminPage
          .locator('[data-testid="persona-select-list"] .ant-select-clear')
          .click();

        // Save the changes
        await adminPage
          .locator('[data-testid="user-profile-persona-edit-save"]')
          .click();

        // Wait for the API call to complete and verify no default persona is shown
        await adminPage.waitForResponse(/\/api\/v1\/users\/.*/);

        await expect(adminPage.getByText('No default persona')).toBeVisible();
      });
    });
  });
});
