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
import { GlobalSettingOptions } from '../../constant/settings';
import { descriptionBox, redirectToHomePage, uuid } from '../../utils/common';
import { validateFormNameFieldInput } from '../../utils/form';
import { settingClick } from '../../utils/sidebar';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const policies = {
  dataConsumerPolicy: 'Data Consumer Policy',
  dataStewardPolicy: 'Data Steward Policy',
  organizationPolicy: 'Organization Policy',
  teamOnlyAccessPolicy: 'Team only access Policy',
};

const ruleDetails = {
  resources: 'All',
  operations: 'All',
  effect: 'Allow',
  condition: 'isOwner()',
  inValidCondition: 'isOwner(',
};

const errorMessageValidation = {
  lastPolicyCannotBeRemoved: 'At least one policy is required in a role',
  lastRuleCannotBeRemoved: 'At least one rule is required in a policy',
};

const policyName = `Policy-test-${uuid()}`;
const description = `This is ${policyName} description`;

const ruleName = `Rule / test-${uuid()}`;
const ruleDescription = `This is ${ruleName} description`;
const updatedDescription = 'This is updated description';

const newRuleName = `New / Rule-test-${uuid()}`;
const newRuledescription = `This is ${newRuleName} description`;

const updatedRuleName = `New-Rule-test-${uuid()}-updated`;

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
  await page.locator(`[title="${ruleDetails.condition}"]`).click();

  // Verify condition success
  await expect(page.locator('[data-testid="condition-success"]')).toContainText(
    '✅ Valid condition'
  );

  // Wait for a short period
  await page.waitForTimeout(500);

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
        for (const policy of Object.values(policies)) {
          const policyElement = page.locator('[data-testid="policy-name"]', {
            hasText: policy,
          });

          await expect(policyElement).toBeVisible();
        }
      }
    );

    await test.step('Add new policy', async () => {
      // Click on add new policy
      await page.locator('[data-testid="add-policy"]').click();

      await expect(page.locator('[data-testid="inactive-link"]')).toBeVisible();

      // Enter policy name
      await page.locator('[data-testid="policy-name"]').fill(policyName);
      await validateFormNameFieldInput({
        page,
        value: policyName,
        fieldName: 'Name',
        fieldSelector: '[data-testid="policy-name"]',
        errorDivSelector: '#name_help',
      });

      // Enter description
      await page.locator(descriptionBox).nth(0).fill(description);

      // Enter rule name
      await addRule(page, ruleName, ruleDescription, 1);

      // Validate the added policy
      await expect(page.locator('[data-testid="inactive-link"]')).toHaveText(
        policyName
      );

      await page.getByText(ruleName, { exact: true }).isVisible();

      // Verify policy description
      await expect(
        page
          .locator(
            '[data-testid="asset-description-container"] [data-testid="viewer-container"]'
          )
          .nth(0)
      ).toContainText(description);

      // Verify rule description
      await expect(
        page
          .locator(
            '[data-testid="viewer-container"] > [data-testid="markdown-parser"]'
          )
          .nth(1)
      ).toContainText(ruleDescription);

      // Verify other details
      await page.locator('[data-testid="rule-name"]').click();

      await expect(page.locator('[data-testid="resources"]')).toContainText(
        ruleDetails.resources
      );

      await expect(page.locator('[data-testid="operations"]')).toContainText(
        ruleDetails.operations
      );

      await expect(page.locator('[data-testid="effect"]')).toContainText(
        ruleDetails.effect
      );

      await expect(page.locator('[data-testid="condition"]')).toContainText(
        ruleDetails.condition
      );
    });

    await test.step('Edit policy description', async () => {
      // Click on edit description
      await page.locator('[data-testid="edit-description"]').click();

      await page
        .locator(descriptionBox)
        .fill(`${updatedDescription}-${policyName}`);

      // Click on save
      await page.locator('[data-testid="save"]').click();

      // Validate added description
      await expect(
        page
          .locator(
            '[data-testid="asset-description-container"] [data-testid="viewer-container"]'
          )
          .nth(0)
      ).toContainText(`${updatedDescription}-${policyName}`);
    });

    await test.step('Add new rule', async () => {
      // Click on add rule button
      await page.locator('[data-testid="add-rule"]').click();

      // Add rule (assuming addRule is a function you have defined elsewhere)
      await addRule(page, newRuleName, newRuledescription, 0);

      // Validate added rule
      await page.getByText(ruleName, { exact: true }).isVisible();

      // Verify other details
      await page.getByText(ruleName, { exact: true }).click();

      await expect(
        page.locator('[data-testid="resources"]').last()
      ).toContainText(ruleDetails.resources);

      await expect(
        page.locator('[data-testid="operations"]').last()
      ).toContainText(ruleDetails.operations);

      await expect(page.locator('[data-testid="effect"]').last()).toContainText(
        ruleDetails.effect
      );

      await expect(
        page.locator('[data-testid="condition"]').last()
      ).toContainText(ruleDetails.condition);
    });

    await test.step('Edit rule name for created Rule', async () => {
      // Click on new rule manage button
      await page
        .locator(`[data-testid="manage-button-${newRuleName}"]`)
        .click();

      // Click on edit rule button
      await page.locator('[data-testid="edit-rule"]').click();

      // Enter new name
      await page.locator('[data-testid="rule-name"]').fill(updatedRuleName);

      // Click on submit button
      await page.locator('[data-testid="submit-btn"]').click();

      // Verify the URL contains the policy name
      await expect(page).toHaveURL(new RegExp(policyName));

      // Verify the rule name is updated
      await page.getByText(updatedRuleName, { exact: true }).isVisible();
    });

    await test.step('Delete new rule', async () => {
      // Click on new rule manage button
      await page
        .locator(`[data-testid="manage-button-${updatedRuleName}"]`)
        .click();

      // Click on delete rule button
      await page.locator('[data-testid="delete-rule"]').click();

      await expect(
        page.getByText(updatedRuleName, { exact: true })
      ).not.toBeVisible();
    });

    await test.step('Delete last rule and validate', async () => {
      // Click on new rule manage button
      await page.locator(`[data-testid="manage-button-${ruleName}"]`).click();

      // Click on delete rule button
      await page.locator('[data-testid="delete-rule"]').click();

      // Validate the error message
      await expect(page.locator('.Toastify__toast-body')).toContainText(
        errorMessageValidation.lastRuleCannotBeRemoved
      );
    });

    await test.step('Delete created policy', async () => {
      await settingClick(page, GlobalSettingOptions.POLICIES);
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });
      // Click on delete action button
      await page
        .locator(`[data-testid="delete-action-${policyName}"]`)
        .click({ force: true });

      // Type 'DELETE' in the confirmation text input
      await page
        .locator('[data-testid="confirmation-text-input"]')
        .fill('DELETE');

      // Click on confirm button
      await page.locator('[data-testid="confirm-button"]').click();

      // Validate deleted policy
      await expect(
        page.getByText(policyName, { exact: true })
      ).not.toBeVisible();
    });
  });
});
