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
import { Domain } from '../../support/domain/Domain';
import { SubDomain } from '../../support/domain/SubDomain';
import { TeamClass } from '../../support/team/TeamClass';
import { AdminClass } from '../../support/user/AdminClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { getApiContext, uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { visitUserProfilePage } from '../../utils/user';
import { redirectToUserPage } from '../../utils/userDetails';
import { TableClass } from '../../support/entity/TableClass';
import { PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ } from '../../constant/config';

const user1 = new UserClass();
const user2 = new UserClass();
const user3 = new UserClass();
const admin = new AdminClass();
const domain = new Domain();
const team = new TeamClass({
  name: `a-new-team-${uuid()}`,
  displayName: `A New Team ${uuid()}`,
  description: 'playwright team description',
  teamType: 'Group',
});

// Create 2 page and authenticate 1 with admin and another with normal user
const test = base.extend<{
  adminPage: Page;
  userPage: Page;
}>({
  adminPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await admin.login(page);
    await use(page);
    await page.close();
  },
  userPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await user1.login(page);
    await use(page);
    await page.close();
  },
});

test.describe('User with different Roles', () => {
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { afterAction, apiContext } = await performAdminLogin(browser);

    await user1.create(apiContext);
    await user2.create(apiContext);
    await user3.create(apiContext);

    await team.create(apiContext);
    await domain.create(apiContext);

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { afterAction, apiContext } = await performAdminLogin(browser);

    await user1.delete(apiContext);
    await user2.delete(apiContext);
    await user3.delete(apiContext);
    await team.delete(apiContext);
    await domain.delete(apiContext);

    await afterAction();
  });

  test('Admin user can get all the teams hierarchy and edit teams', PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ, async ({
    adminPage,
  }) => {
    await redirectToUserPage(adminPage);

    // Check if the avatar is visible
    await expect(adminPage.getByTestId('user-profile-teams')).toBeVisible();

    await adminPage.getByTestId('edit-teams-button').click();

    await expect(adminPage.getByTestId('team-select')).toBeVisible();

    await adminPage.waitForSelector('.ant-tree-select-dropdown', {
      state: 'visible',
    });

    await adminPage
      .locator('.ant-select-tree-title')
      .filter({ hasText: 'Accounting' })
      .first()
      .click();

    await adminPage.getByTestId('teams-edit-save-btn').click();

    await expect(adminPage.getByTestId('user-profile-teams')).toContainText(
      'Accounting'
    );
  });

  test('Create team with domain and verify visibility of inherited domain in user profile after team removal', async ({
    adminPage,
  }) => {
    await visitUserProfilePage(adminPage, user3.getUserName());
    await adminPage.waitForLoadState('networkidle');

    await expect(adminPage.getByTestId('user-profile-teams')).toBeVisible();

    await adminPage.getByTestId('edit-teams-button').click();

    await expect(adminPage.getByTestId('team-select')).toBeVisible();

    await adminPage.waitForSelector('.ant-tree-select-dropdown', {
      state: 'visible',
    });

    await adminPage.getByText(team.responseData.displayName).click();

    const updateTeamsResponse = adminPage.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/users/') &&
        response.request().method() === 'PATCH'
    );

    await adminPage.getByTestId('teams-edit-save-btn').click();

    await updateTeamsResponse;

    await expect(adminPage.getByTestId('user-profile-teams')).toContainText(
      team.responseData.displayName
    );

    await adminPage.getByText(team.responseData.displayName).first().click();

    await adminPage.waitForLoadState('networkidle');

    const domainResponse = adminPage.waitForResponse((response) =>
      response.url().includes('/api/v1/domains/hierarchy')
    );

    await adminPage.getByTestId('add-domain').click();

    await domainResponse;
    await adminPage
      .getByTestId('domain-selectable-tree')
      .getByTestId('loader')
      .waitFor({ state: 'detached' });

    const searchDomain = adminPage.waitForResponse(
      `/api/v1/search/query?q=*${encodeURIComponent(
        domain.responseData.displayName
      )}**`
    );

    await adminPage
      .getByTestId('domain-selectable-tree')
      .getByTestId('searchbar')
      .fill(domain.responseData.displayName);
    await searchDomain;
    await adminPage
      .getByTestId('domain-selectable-tree')
      .getByTestId('loader')
      .waitFor({ state: 'detached' });
    await adminPage.getByText(domain.responseData.displayName).click();

    const teamsResponse = adminPage.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/teams/') &&
        response.request().method() === 'PATCH'
    );

    await adminPage.getByText('Update').click();

    await teamsResponse;

    await visitUserProfilePage(adminPage, user3.getUserName());

    await adminPage.waitForLoadState('networkidle');

    // Wait for the team to be visible in the teams section
    await adminPage
      .getByTestId('loader')
      .first()
      .waitFor({ state: 'detached' });

    await adminPage
      .getByTestId('user-profile-teams')
      .getByText(team.responseData.displayName)
      .waitFor({ state: 'visible' });

    await expect(adminPage.getByTestId('user-profile-teams')).toContainText(
      team.responseData.displayName
    );

    await expect(
      adminPage.locator('[data-testid="header-domain-container"]')
    ).toContainText(domain.responseData.displayName);

    const teamsListResponse = adminPage.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/teams/hierarchy') &&
        response.request().method() === 'GET'
    );

    await adminPage.getByTestId('edit-teams-button').click();

    await teamsListResponse;

    await adminPage.waitForSelector('.ant-tree-select-dropdown', {
      state: 'visible',
    });

    await adminPage
      .locator('[title="' + team.responseData.displayName + '"]')
      .nth(1)
      .click();

    const userProfileResponse = adminPage.waitForResponse((response) =>
      response.url().includes('/api/v1/users/')
    );

    await adminPage.getByTestId('teams-edit-save-btn').click({ force: true });

    await userProfileResponse;

    await expect(
      adminPage.locator('[data-testid="header-domain-container"]')
    ).not.toContainText(domain.responseData.displayName);
  });

  test('User can search for a domain', async ({ adminPage }) => {
    await redirectToUserPage(adminPage);

    await expect(adminPage.getByTestId('edit-domains')).toBeVisible();

    await adminPage.getByTestId('edit-domains').click();

    await expect(adminPage.locator('.custom-domain-edit-select')).toBeVisible();

    await adminPage.locator('.custom-domain-edit-select').click();

    const searchPromise = adminPage.waitForResponse('/api/v1/search/query?q=*');
    await adminPage
      .locator('.custom-domain-edit-select .ant-select-selection-search-input')
      .fill(domain.responseData.displayName);

    await searchPromise;

    await adminPage.waitForSelector('.domain-custom-dropdown-class', {
      state: 'visible',
    });

    await expect(
      adminPage.locator('.domain-custom-dropdown-class')
    ).toContainText(domain.responseData.displayName);
  });

  test('Admin user can assign and remove domain from a user', async ({
    adminPage,
  }) => {
    test.slow();

    await redirectToUserPage(adminPage);
    await adminPage.waitForLoadState('networkidle');

    // Step 1: Assign domain to user
    // Verify domain edit button is visible
    await expect(adminPage.getByTestId('edit-domains')).toBeVisible();

    // Click on edit domains button
    await adminPage.getByTestId('edit-domains').click();

    // Wait for domain select dropdown to be visible
    await expect(adminPage.locator('.custom-domain-edit-select')).toBeVisible();

    // Click on the select to open dropdown
    await adminPage.locator('.custom-domain-edit-select').click();

    // Wait for domain tree to load
    await adminPage.waitForSelector('.domain-custom-dropdown-class', {
      state: 'visible',
    });

    // Wait for loader to disappear
    await adminPage
      .locator('.domain-custom-dropdown-class')
      .getByTestId('loader')
      .waitFor({ state: 'detached' });

    // Search for the domain
    const searchPromise = adminPage.waitForResponse(
      `/api/v1/search/query?q=*${encodeURIComponent(
        domain.responseData.displayName
      )}**`
    );
    await adminPage
      .locator('.custom-domain-edit-select .ant-select-selection-search-input')
      .fill(domain.responseData.displayName);

    await searchPromise;

    // Wait for search results to load
    await adminPage
      .locator('.domain-custom-dropdown-class')
      .getByTestId('loader')
      .waitFor({ state: 'detached' });

    // Click on the domain in the tree
    await adminPage
      .locator('.domain-selectable-tree-new')
      .getByText(domain.responseData.displayName)
      .click();

    // Click save button to assign domain
    let updateUserResponse = adminPage.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/users/') &&
        response.request().method() === 'PATCH'
    );

    await adminPage
      .getByTestId('user-profile-domain-edit-cancel')
      .click({ force: true });

    await updateUserResponse;

    // Verify domain is assigned and visible in user profile
    await expect(
      adminPage.locator('[data-testid="header-domain-container"]')
    ).toContainText(domain.responseData.displayName);

    // Verify domain link is clickable
    await expect(
      adminPage
        .getByTestId('header-domain-container')
        .getByRole('link', { name: domain.responseData.displayName })
    ).toBeVisible();

    // Step 2: Remove domain from user
    // Click on edit domains button
    await adminPage.getByTestId('edit-domains').click();

    // Wait for domain select dropdown to be visible
    await expect(adminPage.locator('.custom-domain-edit-select')).toBeVisible();

    // Click on the select to open dropdown
    await adminPage.locator('.custom-domain-edit-select').click();

    // Wait for domain tree to load
    await adminPage.waitForSelector('.domain-custom-dropdown-class', {
      state: 'visible',
    });

    // Wait for loader to disappear
    await adminPage
      .locator('.domain-custom-dropdown-class')
      .getByTestId('loader')
      .waitFor({ state: 'detached' });

    // Search for the domain
    const searchPromise2 = adminPage.waitForResponse(
      `/api/v1/search/query?q=*${encodeURIComponent(
        domain.responseData.displayName
      )}**`
    );
    await adminPage
      .locator('.custom-domain-edit-select .ant-select-selection-search-input')
      .fill(domain.responseData.displayName);

    await searchPromise2;

    // Wait for search results to load
    await adminPage
      .locator('.domain-custom-dropdown-class')
      .getByTestId('loader')
      .waitFor({ state: 'detached' });

    // Click on the domain checkbox in the tree to deselect it
    await adminPage
      .locator('.domain-selectable-tree-new')
      .getByText(domain.responseData.displayName)
      .click();

    // Click save button to remove domain
    updateUserResponse = adminPage.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/users/') &&
        response.request().method() === 'PATCH'
    );

    await adminPage
      .getByTestId('user-profile-domain-edit-cancel')
      .click({ force: true });

    await updateUserResponse;

    // Verify domain is removed
    await expect(
      adminPage
        .getByTestId('header-domain-container')
        .getByRole('link', { name: domain.responseData.displayName })
    ).not.toBeVisible();
  });

  test('Subdomain is visible when expanding parent domain in tree', async ({
    adminPage,
  }) => {
    const { apiContext } = await getApiContext(adminPage);

    // Create a subdomain for testing
    const subdomain = new SubDomain(domain);
    await subdomain.create(apiContext);

    await redirectToUserPage(adminPage);
    await adminPage.waitForLoadState('networkidle');

    // Click on edit domains button
    await adminPage.getByTestId('edit-domains').click();

    // Wait for domain select dropdown to be visible
    await expect(adminPage.locator('.custom-domain-edit-select')).toBeVisible();

    // Click on the select to open dropdown
    await adminPage.locator('.custom-domain-edit-select').click();

    // Wait for domain tree to load
    await adminPage.waitForSelector('.domain-custom-dropdown-class', {
      state: 'visible',
    });

    // Wait for loader to disappear
    await adminPage
      .locator('.domain-custom-dropdown-class')
      .getByTestId('loader')
      .waitFor({ state: 'detached' });

    // Search for the domain
    const searchPromise2 = adminPage.waitForResponse(
      `/api/v1/search/query?q=*${encodeURIComponent(
        domain.responseData.displayName
      )}**`
    );
    await adminPage
      .locator('.custom-domain-edit-select .ant-select-selection-search-input')
      .fill(domain.responseData.displayName);

    await searchPromise2;

    // Find the parent domain node switcher (expand icon)
    const parentDomainNode = adminPage
      .locator('.domain-custom-dropdown-class')
      .locator('.ant-tree-treenode')
      .filter({ hasText: domain.responseData.displayName })
      .first();

    // Click on the switcher icon to expand the parent domain
    await parentDomainNode.locator('.ant-tree-switcher').click();

    // Wait for the child domains to load
    await waitForAllLoadersToDisappear(adminPage);
    await adminPage.waitForLoadState('networkidle');

    // Verify that the subdomain is now visible in the tree
    await expect(
      adminPage
        .locator('.domain-custom-dropdown-class')
        .getByText(subdomain.responseData.displayName)
    ).toBeVisible();

    // Close the dropdown
    await adminPage.keyboard.press('Escape');

    // Cleanup: delete the subdomain
    await subdomain.delete(apiContext);
  });

  test('Admin user can get all the roles hierarchy and edit roles', async ({
    adminPage,
  }) => {
    await redirectToUserPage(adminPage);

    await expect(adminPage.getByTestId('user-profile-roles')).toBeVisible();

    await adminPage.getByTestId('edit-roles-button').click();

    await expect(
      adminPage.getByTestId('profile-edit-roles-select')
    ).toBeVisible();

    await adminPage.waitForSelector('.ant-select-dropdown', {
      state: 'visible',
    });

    await adminPage
      .locator('.ant-select-item-option-content')
      .getByText('Application bot role', { exact: true })
      .click();

    await adminPage.getByTestId('user-profile-edit-roles-save-button').click();

    await expect(adminPage.getByTestId('user-profile-roles')).toContainText(
      'Application bot role'
    );
  });

  test('Non admin user should be able to edit display name and description on own profile', async ({
    userPage,
  }) => {
    await redirectToUserPage(userPage);

    // Check if the display name is present
    await expect(userPage.getByTestId('user-display-name')).toHaveText(
      user1.responseData.displayName
    );

    await userPage.click('[data-testid="user-profile-manage-btn"]');
    await userPage.click('[data-testid="edit-displayname"]');
    await userPage.waitForSelector('[role="dialog"].ant-modal', {
      state: 'visible',
    });
    await userPage.fill(
      '[data-testid="displayName-input"]',
      'New Display Name'
    );
    await userPage.getByText('Save').click();

    await expect(userPage.getByTestId('user-display-name')).toHaveText(
      'New Display Name'
    );
  });

  test('Non admin user should not be able to edit the persona or roles', async ({
    userPage,
  }) => {
    await redirectToUserPage(userPage);

    await expect(userPage.getByTestId('persona-details-card')).toBeVisible();
    await expect(
      userPage.getByTestId('edit-user-persona').getByTestId('edit-persona')
    ).not.toBeVisible();
    await expect(userPage.getByTestId('user-profile-roles')).toBeVisible();
    await expect(
      userPage.getByTestId('user-profile-edit-roles-save-button')
    ).not.toBeVisible();
  });

  test('My Data Tab - AssetsTabs search functionality', async ({
    adminPage,
  }) => {
    const { apiContext } = await getApiContext(adminPage);
    const table = new TableClass();

    try {
      await table.create(apiContext);

      const adminUserResponse = await apiContext.get(
        '/api/v1/users/name/admin'
      );
      const adminUser = await adminUserResponse.json();

      await apiContext.patch(`/api/v1/tables/${table.entityResponseData?.id}`, {
        data: [
          {
            op: 'add',
            path: '/owners/0',
            value: {
              id: adminUser.id,
              type: 'user',
            },
          },
        ],
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      });

      await redirectToUserPage(adminPage);

      await adminPage.getByTestId('mydata').click();

      const assetsSearchBox = adminPage
        .locator('#asset-tab')
        .getByTestId('searchbar');

      await expect(assetsSearchBox).toBeVisible();

      const searchResponse = adminPage.waitForResponse(
        '**/api/v1/search/query*'
      );

      await assetsSearchBox.fill(table.entity.name);

      await searchResponse;

      const assetCard = adminPage.getByText(table.entity.name).first();

      await expect(assetCard).toBeVisible();

      await assetsSearchBox.clear();

      const incorrectSearchResponse = adminPage.waitForResponse(
        '**/api/v1/search/query*'
      );

      await assetsSearchBox.fill('nonexistent-asset-name-xyz-123');

      await incorrectSearchResponse;

      await expect(assetsSearchBox).toBeVisible();

      const incorrectAssetCard = adminPage.getByText(table.entity.name);

      await expect(incorrectAssetCard).not.toBeVisible();

      await expect(
        adminPage.getByText('No records found')
      ).toBeVisible();

      const rightPanel = adminPage.getByTestId(
        'entity-summary-panel-container'
      );

      await expect(rightPanel).not.toBeVisible();
    } finally {
      await table.delete(apiContext);
    }
  });
});
