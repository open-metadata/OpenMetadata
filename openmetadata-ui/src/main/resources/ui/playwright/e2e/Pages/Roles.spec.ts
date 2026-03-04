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
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { GlobalSettingOptions } from '../../constant/settings';
import { RolesClass } from '../../support/access-control/RolesClass';
import {
  descriptionBox,
  getApiContext,
  redirectToHomePage,
  toastNotification,
  uuid,
} from '../../utils/common';
import {
  getElementWithPagination,
  removePolicyFromRole,
} from '../../utils/roles';
import { settingClick } from '../../utils/sidebar';

const policies = {
  dataConsumerPolicy: 'Data Consumer Policy',
  dataStewardPolicy: 'Data Steward Policy',
  organizationPolicy: 'Organization Policy',
};

const errorMessageValidation = {
  ifPolicyNotSelected: 'Enter at least one policy',
  ifNameNotEntered: 'Name size must be between 1 and 128',
  lastPolicyCannotBeRemoved: 'At least one policy is required in a role',
};

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Roles page tests', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await settingClick(page, GlobalSettingOptions.ROLES);

    // Wait for loader to disappear using assertion-based wait
    await expect(page.locator('[data-testid="loader"]')).not.toBeVisible();

    // Verify roles page is ready
    await expect(page.locator('[data-testid="add-role"]')).toBeVisible();
  });

  test('Roles page should work properly', async ({ page }) => {
    test.slow();

    const roleName = `Role-test-${uuid()}`;
    const description = `This is ${roleName} description`;
    const updatedRoleName = `PW Updated ${roleName}`;

    await test.step('Add new role and check all tabs data', async () => {
      // Ensure add-role button is visible before clicking
      const addRoleButton = page.locator('[data-testid="add-role"]');
      await expect(addRoleButton).toBeVisible();
      await addRoleButton.click();

      // Wait for navigation and form to be ready
      await expect(page.locator('[data-testid="inactive-link"]')).toContainText(
        'Add New Role'
      );
      await expect(page.locator('#name')).toBeVisible();

      // Entering name
      await page.locator('#name').fill(roleName);

      // Entering description
      const descriptionField = page.locator(descriptionBox);
      await expect(descriptionField).toBeVisible();
      await descriptionField.fill(description);

      // Select the policies - search and select from dropdown
      const policiesDropdown = page.locator('[data-testid="policies"]');
      await expect(policiesDropdown).toBeVisible();
      await policiesDropdown.click();
      await policiesDropdown.locator('input').fill('Data');
      const dataConsumerOption = page
        .locator('.ant-select-dropdown:visible')
        .locator('[title="Data Consumer Policy"]');
      await expect(dataConsumerOption).toBeVisible();
      await dataConsumerOption.click();

      await policiesDropdown.locator('input').fill('Data');
      const dataStewardOption = page
        .locator('.ant-select-dropdown:visible')
        .locator('[title="Data Steward Policy"]');
      await expect(dataStewardOption).toBeVisible();
      await dataStewardOption.click();

      // close dropdown by clicking side panel
      await page.getByText('Add Role').click();

      // Wait for dropdown to close
      await expect(
        page.locator('.ant-select-dropdown:visible')
      ).not.toBeVisible();

      // Save the role - wait for API response and UI update
      const submitButton = page.locator('[data-testid="submit-btn"]');
      await expect(submitButton).toBeVisible();
      await expect(submitButton).toBeEnabled();

      await Promise.all([
        // Wait for API call to complete
        page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/roles') &&
            response.status() === 201
        ),
        submitButton.click(),
      ]);

      // Wait for loader to disappear after submission
      await expect(page.locator('[data-testid="loader"]')).not.toBeVisible();

      // Verify the role is added successfully
      await expect(page).toHaveURL(`/settings/access/roles/${roleName}`);
      await expect(page.locator('[data-testid="inactive-link"]')).toContainText(
        roleName
      );

      // Verify added description
      const descriptionContainer = page.locator(
        '[data-testid="asset-description-container"] [data-testid="viewer-container"]'
      );
      await expect(descriptionContainer).toBeVisible();
      await expect(descriptionContainer).toContainText(description);

      // click on the policies tab
      const policiesTab = page.locator('[role="tab"]:has-text("Policies")');
      await expect(policiesTab).toBeVisible();
      await policiesTab.click();

      // Wait for policies tab content to load
      await expect(page.locator('[data-testid="loader"]')).not.toBeVisible();

      // Verifying the added policies - use proper assertions
      await expect(
        page.getByRole('link', {
          name: policies.dataConsumerPolicy,
          exact: true,
        })
      ).toBeVisible();

      await expect(
        page.getByRole('link', {
          name: policies.dataStewardPolicy,
          exact: true,
        })
      ).toBeVisible();

      // click on the teams tab
      const teamsTab = page.locator('[role="tab"]:has-text("Teams")');
      await expect(teamsTab).toBeVisible();
      await teamsTab.click();

      // Wait for teams tab content to load
      await expect(page.locator('[data-testid="loader"]')).not.toBeVisible();
      await expect(page.getByRole('cell', { name: 'No data' })).toBeVisible();

      // click on the users tab
      const usersTab = page.locator('[role="tab"]:has-text("Users")');
      await expect(usersTab).toBeVisible();
      await usersTab.click();

      // Wait for users tab content to load
      await expect(page.locator('[data-testid="loader"]')).not.toBeVisible();
      await expect(page.getByRole('cell', { name: 'No data' })).toBeVisible();

      // Navigate to roles list page to verify the added role
      await settingClick(page, GlobalSettingOptions.ROLES);
      await expect(page.locator('[data-testid="loader"]')).not.toBeVisible();

      const roleLocator = page.locator(
        `[data-testid="role-name"][href="/settings/access/roles/${roleName}"]`
      );
      await getElementWithPagination(page, roleLocator, false);

      // Wait for plus-more-count button to be visible before clicking
      const plusMoreButton = page.locator(
        `[data-row-key="${roleName}"] [data-testid="plus-more-count"]`
      );
      await expect(plusMoreButton).toBeVisible();
      await plusMoreButton.click();

      // Wait for popover to be visible
      await expect(page.locator('.ant-popover-content')).toBeVisible();

      // Both policies should be visible - one in the table row and one in the popover
      // The order is non-deterministic, so check both are visible within the row + popover scope
      const rowAndPopover = page.locator(
        `[data-row-key="${roleName}"], .ant-popover-content`
      );
      await expect(
        rowAndPopover.getByRole('link', { name: policies.dataConsumerPolicy })
      ).toBeVisible();
      await expect(
        rowAndPopover.getByRole('link', { name: policies.dataStewardPolicy })
      ).toBeVisible();
    });

    await test.step('Add new role without selecting data', async () => {
      // Ensure add-role button is visible before clicking
      const addRoleButton = page.locator('[data-testid="add-role"]');
      await expect(addRoleButton).toBeVisible();
      await addRoleButton.click();

      // Wait for navigation and form to be ready
      await expect(page.locator('[data-testid="inactive-link"]')).toContainText(
        'Add New Role'
      );
      await expect(page.locator('#name')).toBeVisible();

      // Entering name
      await page.locator('#name').fill(roleName);

      // Entering description
      const descriptionField = page.locator(descriptionBox);
      await expect(descriptionField).toBeVisible();
      await descriptionField.fill(description);

      // Do not Select the policies
      // Save the role
      const submitButton = page.locator('[data-testid="submit-btn"]');
      await expect(submitButton).toBeVisible();
      await expect(submitButton).toBeEnabled();
      await submitButton.click();

      // Verify the error message that is displayed - wait for alert to appear
      const errorAlert = page.locator('[role="alert"]');
      await expect(errorAlert).toBeVisible();
      await expect(errorAlert).toContainText(
        errorMessageValidation.ifPolicyNotSelected
      );
    });

    await test.step('Edit created role', async () => {
      await settingClick(page, GlobalSettingOptions.ROLES);

      // Wait for roles page to be ready
      await expect(page.locator('[data-testid="loader"]')).not.toBeVisible();

      // Edit description
      const roleLocator = page.locator(
        `[data-testid="role-name"][href="/settings/access/roles/${roleName}"]`
      );
      await getElementWithPagination(page, roleLocator);

      // Wait for role details page to load
      await expect(page.locator('[data-testid="loader"]')).not.toBeVisible();

      const editDescriptionButton = page.locator(
        '[data-testid="edit-description"]'
      );
      await expect(editDescriptionButton).toBeVisible();
      await editDescriptionButton.click();

      // Wait for description editor to be visible
      const descriptionField = page.locator(descriptionBox);
      await expect(descriptionField).toBeVisible();
      await descriptionField.fill(`${description}-updated`);

      const saveButton = page.locator('[data-testid="save"]');
      await expect(saveButton).toBeVisible();
      await expect(saveButton).toBeEnabled();

      await Promise.all([
        // Wait for API call to complete
        page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/roles') &&
            (response.status() === 200 || response.status() === 201)
        ),
        saveButton.click(),
      ]);

      // Wait for loader to disappear and verify description updated
      await expect(page.locator('[data-testid="loader"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="inactive-link"]')).toBeVisible();

      // Asserting updated description
      const descriptionContainer = page.locator(
        '[data-testid="asset-description-container"] [data-testid="viewer-container"]'
      );
      await expect(descriptionContainer).toBeVisible();
      await expect(descriptionContainer).toContainText(
        `${description}-updated`
      );
    });

    await test.step('Edit role display name', async () => {
      const manageButton = page.getByTestId('manage-button');
      await expect(manageButton).toBeVisible();
      await manageButton.click();

      const renameButton = page.getByTestId('rename-button-title');
      await expect(renameButton).toBeVisible();
      await renameButton.click();

      // Wait for modal to be visible
      const displayNameField = page.locator('#displayName');
      await expect(displayNameField).toBeVisible();
      await displayNameField.click();
      await displayNameField.fill(updatedRoleName);

      const saveButton = page.getByTestId('save-button');
      await expect(saveButton).toBeVisible();
      await expect(saveButton).toBeEnabled();

      await Promise.all([
        // Wait for API call to complete
        page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/roles') &&
            (response.status() === 200 || response.status() === 201)
        ),
        saveButton.click(),
      ]);

      // Wait for loader and verify header updated
      await expect(page.locator('[data-testid="loader"]')).not.toBeVisible();
      const headerDisplayName = page.getByTestId('entity-header-display-name');
      await expect(headerDisplayName).toBeVisible();
      await expect(headerDisplayName).toContainText(updatedRoleName);
    });

    await test.step('Add new policy to created role', async () => {
      await settingClick(page, GlobalSettingOptions.ROLES);

      // Wait for roles page to be ready
      await expect(page.locator('[data-testid="loader"]')).not.toBeVisible();

      const roleLocator = page.locator(
        `[data-testid="role-name"][href="/settings/access/roles/${roleName}"]`
      );
      await getElementWithPagination(page, roleLocator);

      // Wait for role details page to load
      await expect(page.locator('[data-testid="loader"]')).not.toBeVisible();

      // Click add policy button
      const addPolicyButton = page.locator('[data-testid="add-policy"]');
      await expect(addPolicyButton).toBeVisible();
      await addPolicyButton.click();

      // Wait for modal to be fully visible
      const modalContainer = page.getByRole('dialog', { name: 'Add Policy' });
      await expect(modalContainer).toBeVisible();

      // Add new policy - wait for policy row to be visible
      const organizationPolicyOption = page
        .locator('[data-testid="policy-row"]')
        .getByText(policies.organizationPolicy);

      // Scroll into view if needed (modal might have scrollable content)
      await organizationPolicyOption.scrollIntoViewIfNeeded();
      await expect(organizationPolicyOption).toBeVisible();
      await organizationPolicyOption.click();

      // Verify policy is selected (appears in selected section)
      await expect(
        modalContainer
          .locator('.selected')
          .filter({ hasText: policies.organizationPolicy })
      ).toBeVisible();

      const submitButton = page.locator('[type="button"]:has-text("Submit")');
      await expect(submitButton).toBeVisible();
      await expect(submitButton).toBeEnabled();

      await Promise.all([
        // Wait for API call to complete
        page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/roles') &&
            (response.status() === 200 || response.status() === 201)
        ),
        submitButton.click(),
      ]);

      // Wait for modal to close and UI to update
      await expect(modalContainer).not.toBeVisible();
      await expect(page.locator('[data-testid="loader"]')).not.toBeVisible();

      // Verify policy was added
      await expect(
        page.getByRole('link', {
          name: policies.organizationPolicy,
          exact: true,
        })
      ).toBeVisible();
    });

    await test.step('Remove added policy from created role', async () => {
      await settingClick(page, GlobalSettingOptions.ROLES);

      // Wait for roles page to be ready
      await expect(page.locator('[data-testid="loader"]')).not.toBeVisible();

      const roleLocator = page.locator(
        `[data-testid="role-name"][href="/settings/access/roles/${roleName}"]`
      );
      await getElementWithPagination(page, roleLocator);

      // Wait for role details page to load
      await expect(page.locator('[data-testid="loader"]')).not.toBeVisible();

      // Remove policy
      await removePolicyFromRole(
        page,
        policies.organizationPolicy,
        updatedRoleName
      );

      // Wait for UI to update after removal
      await expect(page.locator('[data-testid="loader"]')).not.toBeVisible();

      // Validating if the policy is removed successfully
      await expect(
        page.getByRole('link', {
          name: policies.organizationPolicy,
          exact: true,
        })
      ).not.toBeVisible();
    });

    await test.step('Check if last policy is not removed', async () => {
      await settingClick(page, GlobalSettingOptions.ROLES);

      // Wait for roles page to be ready
      await expect(page.locator('[data-testid="loader"]')).not.toBeVisible();

      const roleLocator = page.locator(
        `[data-testid="role-name"][href="/settings/access/roles/${roleName}"]`
      );
      await getElementWithPagination(page, roleLocator);

      // Wait for role details page to load
      await expect(page.locator('[data-testid="loader"]')).not.toBeVisible();

      // Removing second policy from the role
      await removePolicyFromRole(
        page,
        policies.dataStewardPolicy,
        updatedRoleName
      );

      // Wait for UI to update after removal
      await expect(page.locator('[data-testid="loader"]')).not.toBeVisible();

      // Validating if the policy is removed successfully
      await expect(
        page.getByRole('link', {
          name: policies.dataStewardPolicy,
          exact: true,
        })
      ).not.toBeVisible();

      // Removing the last policy and validating the error message
      await removePolicyFromRole(
        page,
        policies.dataConsumerPolicy,
        updatedRoleName
      );

      // Wait for toast notification to appear
      await toastNotification(
        page,
        errorMessageValidation.lastPolicyCannotBeRemoved
      );

      // Verify policy is still present
      await expect(
        page.getByRole('link', {
          name: policies.dataConsumerPolicy,
          exact: true,
        })
      ).toBeVisible();
    });

    await test.step('Delete created Role', async () => {
      await settingClick(page, GlobalSettingOptions.ROLES);

      // Wait for roles page to be ready
      await expect(page.locator('[data-testid="loader"]')).not.toBeVisible();

      const roleLocator = page.locator(
        `[data-testid="delete-action-${updatedRoleName}"]`
      );
      await getElementWithPagination(page, roleLocator);

      // Wait for delete button to be visible and click it
      await expect(roleLocator).toBeVisible();

      // Wait for confirmation modal to be visible
      const confirmationInput = page.locator(
        '[data-testid="confirmation-text-input"]'
      );
      await expect(confirmationInput).toBeVisible();
      await confirmationInput.fill('DELETE');

      const confirmButton = page.locator('[data-testid="confirm-button"]');
      await expect(confirmButton).toBeVisible();
      await expect(confirmButton).toBeEnabled();

      await Promise.all([
        // Wait for API call to complete
        page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/roles') &&
            response.status() === 200
        ),
        confirmButton.click(),
      ]);

      // Wait for modal to close and UI to update
      await expect(page.locator('[data-testid="loader"]')).not.toBeVisible();

      // Validate deleted role is no longer visible
      await expect(
        page.locator(
          `[data-testid="role-name"][href="/settings/access/roles/${updatedRoleName}"]`
        )
      ).not.toBeVisible();
    });
  });

  test('Delete role action from manage button options', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);

    const role = new RolesClass();
    const policies = ['ApplicationBotPolicy'];
    const roleLocator = page.locator(
      `[data-testid="role-name"][href="/settings/access/roles/${encodeURIComponent(
        role.data.name
      )}"]`
    );

    await role.create(apiContext, policies);

    await page.reload();

    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });
    await expect(page.locator('[data-testid="add-role"]')).toBeVisible();

    await getElementWithPagination(page, roleLocator);

    // Wait for manage button to be visible
    const manageButton = page.getByTestId('manage-button');
    await expect(manageButton).toBeVisible();
    await manageButton.click();

    const deleteButton = page.getByTestId('delete-button');
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    // Wait for confirmation modal
    const confirmationInput = page.locator(
      '[data-testid="confirmation-text-input"]'
    );
    await expect(confirmationInput).toBeVisible();
    await confirmationInput.fill('DELETE');

    const confirmButton = page.locator('[data-testid="confirm-button"]');
    await expect(confirmButton).toBeVisible();
    await expect(confirmButton).toBeEnabled();

    await Promise.all([
      // Wait for API call to complete
      page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/roles') && response.status() === 200
      ),
      confirmButton.click(),
    ]);

    // Wait for UI to update and verify role is deleted
    await expect(page.locator('[data-testid="loader"]')).not.toBeVisible();
    await expect(roleLocator).not.toBeVisible();

    await role.delete(apiContext);
    await afterAction();
  });
});
