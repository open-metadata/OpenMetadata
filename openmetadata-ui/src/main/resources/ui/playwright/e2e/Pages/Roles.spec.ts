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

const roleName = `Role-test-${uuid()}`;
const description = `This is ${roleName} description`;
const updatedRoleName = `PW Updated ${roleName}`;

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
  await settingClick(page, GlobalSettingOptions.ROLES);
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
});

test('Roles page should work properly', async ({ page }) => {
  test.slow(true);

  await test.step('Add new role and check all tabs data', async () => {
    await page.locator('[data-testid="add-role"]').click();

    // Asserting navigation
    await expect(page.locator('[data-testid="inactive-link"]')).toContainText(
      'Add New Role'
    );

    // Entering name
    await page.locator('#name').fill(roleName);
    // Entering description
    await page.locator(descriptionBox).fill(description);
    // Select the policies
    await page.locator('[data-testid="policies"]').click();
    await page.locator('[title="Data Consumer Policy"]').click();
    await page.locator('[title="Data Steward Policy"]').click();
    // Save the role
    await page.locator('[data-testid="submit-btn"]').click();

    // Verify the role is added successfully
    await expect(page).toHaveURL(`/settings/access/roles/${roleName}`);
    await expect(page.locator('[data-testid="inactive-link"]')).toContainText(
      roleName
    );
    // Verify added description
    await expect(
      page.locator(
        '[data-testid="asset-description-container"] [data-testid="viewer-container"]'
      )
    ).toContainText(description);

    // click on the policies tab
    await page.locator('[role="tab"]:has-text("Policies")').click();

    // Verifying the added policies

    await page
      .getByRole('link', { name: policies.dataConsumerPolicy, exact: true })
      .isVisible();

    await page
      .getByRole('link', { name: policies.dataStewardPolicy, exact: true })
      .isVisible();

    // click on the teams tab
    await page.locator('[role="tab"]:has-text("Teams")').click();

    await expect(page.getByRole('cell', { name: 'No data' })).toBeVisible();

    // click on the users tab
    await page.locator('[role="tab"]:has-text("Users")').click();

    await expect(page.getByRole('cell', { name: 'No data' })).toBeVisible();

    // Navigating to roles tab to verify the added role
    await page.locator('[data-testid="breadcrumb-link"]').first().click();

    const roleLocator = page.getByRole('cell', { name: roleName, exact: true });

    await getElementWithPagination(page, roleLocator, false);

    await page
      .locator(`[data-row-key="${roleName}"] [data-testid="plus-more-count"]`)
      .click();

    await expect(
      page.getByRole('tooltip', { name: policies.dataStewardPolicy })
    ).toBeVisible();
  });

  await test.step('Add new role without selecting data', async () => {
    await page.locator('[data-testid="add-role"]').click();

    // Asserting navigation
    await expect(page.locator('[data-testid="inactive-link"]')).toContainText(
      'Add New Role'
    );

    // Entering name
    await page.locator('#name').fill(roleName);
    // Entering description
    await page.locator(descriptionBox).fill(description);
    // Do not Select the policies
    // Save the role
    await page.locator('[data-testid="submit-btn"]').click();

    // Verify the error message that is displayed
    await expect(page.locator('[role="alert"]')).toContainText(
      errorMessageValidation.ifPolicyNotSelected
    );
  });

  await test.step('Edit created role', async () => {
    await settingClick(page, GlobalSettingOptions.ROLES);
    // Edit description

    const roleLocator = page.getByRole('link', { name: roleName });

    await getElementWithPagination(page, roleLocator);

    await page.locator('[data-testid="edit-description"]').click();

    await page.locator(descriptionBox).fill(`${description}-updated`);
    await page.locator('[data-testid="save"]').click();

    await expect(page.locator('[data-testid="inactive-link"]')).toBeVisible();
    // Asserting updated description
    await expect(
      page.locator(
        '[data-testid="asset-description-container"] [data-testid="viewer-container"]'
      )
    ).toContainText(`${description}-updated`);
  });

  await test.step('Edit role display name', async () => {
    await page.getByTestId('manage-button').click();
    await page.getByTestId('rename-button-title').click();
    await page.locator('#displayName').click();
    await page.locator('#displayName').fill(updatedRoleName);
    await page.getByTestId('save-button').click();

    await expect(page.getByTestId('entity-header-display-name')).toContainText(
      updatedRoleName
    );
  });

  await test.step('Add new policy to created role', async () => {
    await settingClick(page, GlobalSettingOptions.ROLES);

    const roleLocator = page.getByRole('link', { name: roleName });

    await getElementWithPagination(page, roleLocator);

    // Asserting navigation
    await page.locator('[data-testid="add-policy"]').click();
    // Checking the added policy is selected in the add policy modal
    page.getByTestId('modal-container').getByText(policies.dataConsumerPolicy);
    page.getByTestId('modal-container').getByText(policies.dataStewardPolicy);

    // Add policy
    await page
      .locator('[data-testid="policy-row"]')
      .getByText(policies.organizationPolicy)
      .click();
    page.getByTestId('modal-container').getByText(policies.organizationPolicy);

    await page.locator('[type="button"]:has-text("Submit")').click();

    await page
      .getByRole('link', { name: policies.dataStewardPolicy, exact: true })
      .isVisible();
  });

  await test.step('Remove added policy from created role', async () => {
    await settingClick(page, GlobalSettingOptions.ROLES);

    const roleLocator = page.getByRole('link', { name: roleName });

    await getElementWithPagination(page, roleLocator);

    // Asserting navigation
    await removePolicyFromRole(
      page,
      policies.organizationPolicy,
      updatedRoleName
    );

    // Validating if the policy is removed successfully
    await expect(page.locator('.ant-table-row').last()).not.toContainText(
      policies.organizationPolicy
    );
  });

  await test.step('Check if last policy is not removed', async () => {
    await settingClick(page, GlobalSettingOptions.ROLES);

    const roleLocator = page.getByRole('link', { name: roleName });

    await getElementWithPagination(page, roleLocator);

    // Removing second policy from the role
    await removePolicyFromRole(
      page,
      policies.dataStewardPolicy,
      updatedRoleName
    );

    // Validating if the policy is removed successfully
    await expect(page.locator('.ant-table-row').last()).not.toContainText(
      policies.dataStewardPolicy
    );

    // Removing the last policy and validating the error message
    await removePolicyFromRole(
      page,
      policies.dataConsumerPolicy,
      updatedRoleName
    );

    await toastNotification(
      page,
      errorMessageValidation.lastPolicyCannotBeRemoved
    );

    await expect(page.locator('.ant-table-row')).toContainText(
      policies.dataConsumerPolicy
    );
  });

  await test.step('Delete created Role', async () => {
    await settingClick(page, GlobalSettingOptions.ROLES);

    const roleLocator = page.locator(
      `[data-testid="delete-action-${updatedRoleName}"]`
    );

    await getElementWithPagination(page, roleLocator);

    await page
      .locator('[data-testid="confirmation-text-input"]')
      .fill('DELETE');
    await page.locator('[data-testid="confirm-button"]').click();

    // Validate deleted role
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

  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  await page.waitForLoadState('networkidle');

  await getElementWithPagination(page, roleLocator);

  await page.getByTestId('manage-button').click();
  await page.getByTestId('delete-button').click();
  await page.locator('[data-testid="confirmation-text-input"]').fill('DELETE');
  await page.locator('[data-testid="confirm-button"]').click();

  await expect(roleLocator).not.toBeVisible();

  await role.delete(apiContext);
  await afterAction();
});
