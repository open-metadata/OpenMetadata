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
import test, { expect, Page } from '@playwright/test';
import {
  DEFAULT_POLICIES,
  DESCRIPTION,
  ERROR_MESSAGE_VALIDATION,
  NEW_RULE_DESCRIPTION,
  NEW_RULE_NAME,
  POLICY_NAME,
  RULE_DESCRIPTION,
  RULE_DETAILS,
  RULE_NAME,
  UPDATED_DESCRIPTION,
  UPDATED_POLICY_NAME,
  UPDATED_RULE_NAME,
} from '../../constant/permission';
import { GlobalSettingOptions } from '../../constant/settings';
import {
  PolicyClass,
  PolicyRulesType,
} from '../../support/access-control/PoliciesClass';
import {
  descriptionBox,
  getApiContext,
  redirectToHomePage,
  toastNotification,
} from '../../utils/common';
import { validateFormNameFieldInput } from '../../utils/form';
import { getElementWithPagination } from '../../utils/roles';
import { settingClick } from '../../utils/sidebar';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const addRule = async (
  page: Page,
  rulename: string,
  ruleDescription: string,
  descriptionIndex: number
) => {
  // Validate form name field input
  await page.fill('[data-testid="rule-name"]', rulename);

  // Enter rule description
  await page
    .locator(descriptionBox)
    .nth(descriptionIndex)
    .fill(ruleDescription);

  // Select resource dropdown
  await page.locator('[data-testid="resources"]').click();

  // Select All
  await page.locator('.ant-select-tree-checkbox-inner').first().click();

  // Click on operations dropdown
  await page.locator('[data-testid="operations"]').click();

  // Select operation
  await page.locator('.ant-select-tree-checkbox-inner').nth(1).click();

  // Click on condition combobox
  await page.locator('[data-testid="condition"]').click();

  // Select condition
  await page.locator(`[title="${RULE_DETAILS.condition}"]`).click();

  // Verify condition success
  await expect(page.locator('[data-testid="condition-success"]')).toContainText(
    '✅ Valid condition'
  );

  // Submit
  await page.locator('[data-testid="submit-btn"]').click();
};

test.describe('Policy page should work properly', () => {
  test.beforeEach('Visit entity details page', async ({ page }) => {
    await redirectToHomePage(page);
    await settingClick(page, GlobalSettingOptions.POLICIES);
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
  });

  test('Add new policy with invalid condition', async ({ page }) => {
    await test.step(
      'Default Policies and Roles should be displayed',
      async () => {
        // Verifying the default roles and policies are present
        for (const policy of Object.values(DEFAULT_POLICIES)) {
          const policyElement = page.locator('[data-testid="policy-name"]', {
            hasText: policy,
          });

          await getElementWithPagination(page, policyElement, false);
        }
      }
    );

    await test.step('Add new policy', async () => {
      // Click on add new policy
      await page.locator('[data-testid="add-policy"]').click();

      await expect(page.locator('[data-testid="inactive-link"]')).toBeVisible();

      // Enter policy name
      await page.locator('[data-testid="policy-name"]').fill(POLICY_NAME);
      await validateFormNameFieldInput({
        page,
        value: POLICY_NAME,
        fieldName: 'Name',
        fieldSelector: '[data-testid="policy-name"]',
        errorDivSelector: '#name_help',
      });

      // Enter description
      await page.locator(descriptionBox).nth(0).fill(DESCRIPTION);

      // Enter rule name
      await addRule(page, RULE_NAME, RULE_DESCRIPTION, 1);

      // Validate the added policy
      await expect(page.locator('[data-testid="inactive-link"]')).toHaveText(
        POLICY_NAME
      );

      await page.getByText(RULE_NAME, { exact: true }).isVisible();

      // Verify policy description
      await expect(
        page
          .locator(
            '[data-testid="asset-description-container"] [data-testid="viewer-container"]'
          )
          .nth(0)
      ).toContainText(DESCRIPTION);

      // Verify rule description
      await expect(
        page
          .locator(
            '[data-testid="viewer-container"] > [data-testid="markdown-parser"]'
          )
          .nth(1)
      ).toContainText(RULE_DESCRIPTION);

      // Verify other details
      await page.locator('[data-testid="rule-name"]').click();

      await expect(page.locator('[data-testid="resources"]')).toContainText(
        RULE_DETAILS.resources
      );

      await expect(page.locator('[data-testid="operations"]')).toContainText(
        RULE_DETAILS.operations
      );

      await expect(page.locator('[data-testid="effect"]')).toContainText(
        RULE_DETAILS.effect
      );

      await expect(page.locator('[data-testid="condition"]')).toContainText(
        RULE_DETAILS.condition
      );
    });

    await test.step('Edit policy description', async () => {
      // Click on edit description
      await page.locator('[data-testid="edit-description"]').click();

      await page
        .locator(descriptionBox)
        .fill(`${UPDATED_DESCRIPTION}-${POLICY_NAME}`);

      // Click on save
      await page.locator('[data-testid="save"]').click();

      // Validate added description
      await expect(
        page
          .locator(
            '[data-testid="asset-description-container"] [data-testid="viewer-container"]'
          )
          .nth(0)
      ).toContainText(`${UPDATED_DESCRIPTION}-${POLICY_NAME}`);
    });

    await test.step('Edit policy display name', async () => {
      await page.getByTestId('manage-button').click();
      await page.getByTestId('rename-button-title').click();
      await page.locator('#displayName').click();
      await page.locator('#displayName').fill(UPDATED_POLICY_NAME);
      await page.getByTestId('save-button').click();

      await expect(
        page.getByTestId('entity-header-display-name')
      ).toContainText(UPDATED_POLICY_NAME);
    });

    await test.step('Add new rule', async () => {
      // Click on add rule button
      await page.locator('[data-testid="add-rule"]').click();

      // Add rule (assuming addRule is a function you have defined elsewhere)
      await addRule(page, NEW_RULE_NAME, NEW_RULE_DESCRIPTION, 0);

      // Validate added rule
      await page.getByText(RULE_NAME, { exact: true }).isVisible();

      // Verify other details
      await page.getByText(RULE_NAME, { exact: true }).click();

      await expect(
        page.locator('[data-testid="resources"]').last()
      ).toContainText(RULE_DETAILS.resources);

      await expect(
        page.locator('[data-testid="operations"]').last()
      ).toContainText(RULE_DETAILS.operations);

      await expect(page.locator('[data-testid="effect"]').last()).toContainText(
        RULE_DETAILS.effect
      );

      await expect(
        page.locator('[data-testid="condition"]').last()
      ).toContainText(RULE_DETAILS.condition);
    });

    await test.step('Edit rule name for created Rule', async () => {
      // Click on new rule manage button
      await page
        .locator(`[data-testid="manage-button-${NEW_RULE_NAME}"]`)
        .click();

      // Click on edit rule button
      await page.locator('[data-testid="edit-rule"]').click();

      // Enter new name
      await page.locator('[data-testid="rule-name"]').fill(UPDATED_RULE_NAME);

      // Click on submit button
      await page.locator('[data-testid="submit-btn"]').click();

      // Verify the URL contains the policy name
      await expect(page).toHaveURL(new RegExp(POLICY_NAME));

      // Verify the rule name is updated
      await page.getByText(UPDATED_RULE_NAME, { exact: true }).isVisible();
    });

    await test.step('Delete new rule', async () => {
      // Click on new rule manage button
      await page
        .locator(`[data-testid="manage-button-${UPDATED_RULE_NAME}"]`)
        .click();

      // Click on delete rule button
      await page.locator('[data-testid="delete-rule"]').click();

      await expect(
        page.getByText(UPDATED_RULE_NAME, { exact: true })
      ).not.toBeVisible();
    });

    await test.step('Delete last rule and validate', async () => {
      // Click on new rule manage button
      await page.locator(`[data-testid="manage-button-${RULE_NAME}"]`).click();

      // Click on delete rule button
      await page.locator('[data-testid="delete-rule"]').click();

      // Validate the error message
      await toastNotification(
        page,
        ERROR_MESSAGE_VALIDATION.lastRuleCannotBeRemoved
      );
    });

    await test.step('Delete created policy', async () => {
      await settingClick(page, GlobalSettingOptions.POLICIES);
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });
      // Click on delete action button
      await page
        .locator(`[data-testid="delete-action-${UPDATED_POLICY_NAME}"]`)
        .click({ force: true });

      // Type 'DELETE' in the confirmation text input
      await page
        .locator('[data-testid="confirmation-text-input"]')
        .fill('DELETE');

      // Click on confirm button
      await page.locator('[data-testid="confirm-button"]').click();

      // Validate deleted policy
      await expect(
        page.getByText(UPDATED_POLICY_NAME, { exact: true })
      ).not.toBeVisible();
    });
  });

  test('Policy should have associated rules and teams', async ({ page }) => {
    const policyResponsePromise = page.waitForResponse(
      '/api/v1/policies/name/OrganizationPolicy?fields=owners%2Clocation%2Cteams%2Croles'
    );

    await page
      .getByRole('link', {
        name: DEFAULT_POLICIES.organizationPolicy,
        exact: true,
      })
      .click();

    await policyResponsePromise;

    // validate rules tab

    await expect(
      page.getByText('OrganizationPolicy-NoOwner-Rule')
    ).toBeVisible();

    await expect(page.getByText('OrganizationPolicy-Owner-Rule')).toBeVisible();

    // validate roles tab
    await page.getByRole('tab', { name: 'Roles', exact: true }).click();

    await expect(
      page.getByRole('tabpanel', { name: 'Roles', exact: true })
    ).toBeVisible();

    // validate teams tab

    await page.getByRole('tab', { name: 'Teams', exact: true }).click();

    await expect(
      page.getByRole('link', { name: 'Organization', exact: true })
    ).toBeVisible();
  });

  test('Delete policy action from manage button options', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);

    const policy = new PolicyClass();
    const policyRules: PolicyRulesType[] = [
      {
        name: `${RULE_NAME}`,
        resources: ['bot'],
        operations: ['ViewAll'],
        effect: 'allow',
      },
    ];
    const policyLocator = page.locator(
      `[data-testid="policy-name"][href="/settings/access/policies/${encodeURIComponent(
        policy.data.name
      )}"]`
    );

    await policy.create(apiContext, policyRules);

    await page.reload();

    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await page.waitForLoadState('networkidle');

    await getElementWithPagination(page, policyLocator);

    await page.getByTestId('manage-button').click();
    await page.getByTestId('delete-button').click();
    await page
      .locator('[data-testid="confirmation-text-input"]')
      .fill('DELETE');
    await page.locator('[data-testid="confirm-button"]').click();

    await expect(policyLocator).not.toBeVisible();

    await policy.delete(apiContext);
    await afterAction();
  });
});
