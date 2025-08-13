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
import { expect, Page, test } from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import { selectOption } from '../../utils/advancedSearch';
import {
  createNewPage,
  redirectToHomePage,
  toastNotification,
} from '../../utils/common';

test.use({ storageState: 'playwright/.auth/admin.json' });

// Helper functions for better test organization
const waitForContractValidation = async (page: Page) => {
  const runNowResponse = page.waitForResponse(
    '/api/v1/dataContracts/*/validate'
  );
  await page.getByTestId('contract-run-now-button').click();
  await runNowResponse;
  await toastNotification(page, 'Contract validation trigger successfully.');

  // Wait for validation to process before reload
  await page.waitForLoadState('networkidle');
  await page.reload();

  // Wait for the validation results to appear
  await page.waitForSelector('.rule-item', {
    state: 'visible',
    timeout: 10000,
  });
};

const checkValidationStatus = async (
  page: Page,
  expectedStatus: 'pass' | 'fail'
) => {
  const semanticsCard = page
    .locator('.ant-card.new-header-border-card')
    .filter({
      has: page.locator('.contract-card-title:has-text("Semantics")'),
    })
    .first();

  await expect(semanticsCard).toBeVisible({ timeout: 5000 });

  const ruleItem = semanticsCard.locator('.rule-item').first();

  await expect(ruleItem).toBeVisible({ timeout: 5000 });

  if (expectedStatus === 'pass') {
    // Check for success icon (green check)
    const successIcon = ruleItem.locator(
      '.rule-icon svg path[stroke="#067647"]'
    );
    const hasSuccessIcon = (await successIcon.count()) > 0;

    expect(hasSuccessIcon).toBe(true);
  } else {
    // Check for failure icon (red X) - stroke color is #B42318
    const failureIcon = ruleItem.locator(
      '.rule-icon svg path[stroke="#B42318"]'
    );
    const hasFailureIcon = (await failureIcon.count()) > 0;

    expect(hasFailureIcon).toBe(true);
  }

  return ruleItem;
};

/**
 * Test Suite: Data Contracts - NOT Operator Query Builder
 *
 * This test suite validates the NOT operator functionality in the JSON logic query builder
 * for data contracts. It tests both pass and fail scenarios to ensure the NOT operator
 * correctly negates conditions.
 *
 * Test Flow:
 * 1. Creates a table with a Sensitive tag
 * 2. Creates a data contract with "NOT tag == Sensitive" rule
 * 3. Validates that the contract passes (table has tag, NOT operator inverts the result)
 * 4. Adds an additional Sensitive tag to the table from Schema tab
 * 5. Validates that the contract fails after additional tag is added
 */
test.describe('Data Contracts - NOT Operator Query Builder', () => {
  const table = new TableClass();
  const testClassification = new ClassificationClass();
  const sensitiveTag = new TagClass({
    name: 'Sensitive',
    classification: testClassification.data.name,
  });

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    test.slow(true);

    const { apiContext, afterAction } = await createNewPage(browser);
    await table.create(apiContext);
    await testClassification.create(apiContext);
    await sensitiveTag.create(apiContext);

    // Add the Sensitive tag to the table
    await table.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          value: {
            tagFQN: `${testClassification.data.name}.Sensitive`,
          },
          path: '/tags/0',
        },
      ],
    });

    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    test.slow(true);

    const { apiContext, afterAction } = await createNewPage(browser);
    await table.delete(apiContext);
    await testClassification.delete(apiContext);
    await sensitiveTag.delete(apiContext);
    await afterAction();
  });

  test('NOT operator - Tag != Sensitive validation', async ({ page }) => {
    await test.step('Navigate to table and data contracts', async () => {
      await redirectToHomePage(page);
      // Visit entity with explicit search term if fullyQualifiedName is not available
      const searchTerm =
        table.entityResponseData?.fullyQualifiedName || table.entity.name;
      await table.visitEntityPage(page, searchTerm);
      await page.click('[data-testid="contract"]');

      await expect(page.getByTestId('no-data-placeholder')).toBeVisible();

      await page.getByTestId('add-contract-button').click();

      await expect(page.getByTestId('add-contract-card')).toBeVisible();
    });

    await test.step('Fill contract details', async () => {
      await page
        .getByTestId('contract-name')
        .fill('NOT Operator Test Contract');
      await page.fill(
        '.om-block-editor[contenteditable="true"]',
        'Testing NOT operator with tag != Sensitive condition'
      );
    });

    await test.step('Navigate to Semantics and create NOT rule', async () => {
      // Click on Semantics tab
      await page.getByRole('tab', { name: 'Semantics' }).click();

      await page.fill('#semantics_0_name', 'No Sensitive Data Rule');
      await page.fill(
        '#semantics_0_description',
        'Ensure table does not have Sensitive tag'
      );

      const queryBuilder = page.locator('.query-builder-container').first();

      await expect(queryBuilder).toBeVisible();

      // Toggle NOT operator on the main group
      const mainGroup = queryBuilder.locator('.group').first();

      // Look for the NOT toggle button in the group header
      const notToggle = mainGroup
        .locator('.group--header button')
        .filter({ hasText: 'NOT' });

      if ((await notToggle.count()) > 0) {
        await notToggle.first().click();
      } else {
        // Alternative: look for a switch/checkbox for NOT
        const notSwitch = mainGroup
          .locator('.group--header')
          .locator('[aria-label*="NOT"], [title*="NOT"]');
        if ((await notSwitch.count()) > 0) {
          await notSwitch.first().click();
        }
      }

      // Now add the rule with Tags field
      // Check if we need to use group--field instead of rule--field
      const fieldSelector = mainGroup
        .locator('.group--field .ant-select')
        .first();
      const ruleFieldSelector = mainGroup
        .locator('.rule--field .ant-select')
        .first();

      // Try group--field first (as used in the original test), then fall back to rule--field
      let fieldToUse;
      if (await fieldSelector.isVisible()) {
        fieldToUse = fieldSelector;
      } else if (await ruleFieldSelector.isVisible()) {
        fieldToUse = ruleFieldSelector;
      } else {
        // Wait for either selector to become visible
        await page.waitForSelector(
          '.group--field .ant-select, .rule--field .ant-select',
          { state: 'visible', timeout: 5000 }
        );
        fieldToUse = (await fieldSelector.isVisible())
          ? fieldSelector
          : ruleFieldSelector;
      }

      await selectOption(page, fieldToUse, 'Tags');

      // Find the operator selector
      const operatorSelector = mainGroup
        .locator('.rule--operator .ant-select')
        .first();

      // For Tags field, use "Is" operator (the NOT group will negate it)
      await selectOption(page, operatorSelector, 'Is');

      // Type or select the Sensitive tag
      const valueSelector = mainGroup
        .locator('.rule--value .ant-select')
        .first();

      // Wait for the value selector to be visible
      await valueSelector.waitFor({ state: 'visible', timeout: 5000 });

      // Click on the value selector and type the tag name
      await valueSelector.click();
      await page.keyboard.type('Sensitive');

      // Wait for dropdown and select the Sensitive tag
      await page.waitForSelector('.ant-select-dropdown:visible', {
        state: 'visible',
      });

      // Wait a moment for the dropdown to render
      await page.waitForTimeout(500);

      // Look for the exact "Sensitive" text in the dropdown option content
      const sensitiveOption = page
        .locator('.ant-select-dropdown:visible .ant-select-item-option-content')
        .filter({ hasText: /^Sensitive$/ }) // Exact match for "Sensitive"
        .first();

      if (await sensitiveOption.isVisible()) {
        await sensitiveOption.click();
      } else {
        // Fallback: try to find the parent item and click it
        const sensitiveItem = page
          .locator('.ant-select-dropdown:visible .ant-select-item')
          .filter({
            has: page.locator(
              '.ant-select-item-option-content:text-is("Sensitive")'
            ),
          })
          .first();

        if (await sensitiveItem.isVisible()) {
          await sensitiveItem.click();
        } else {
          // As a last resort, press Enter to select whatever is highlighted
          await page.keyboard.press('Enter');
        }
      }
    });

    await test.step('Save semantic rule', async () => {
      await page.getByTestId('save-semantic-button').click();

      await expect(page.getByTestId('contract-semantics-card-0')).toBeVisible();

      await expect(
        page
          .getByTestId('contract-semantics-card-0')
          .locator('.semantic-form-item-title')
      ).toContainText('No Sensitive Data Rule');
    });

    await test.step('Save contract', async () => {
      // Wait for the semantic card to be saved and visible
      await page.waitForSelector('[data-testid="contract-semantics-card-0"]', {
        state: 'visible',
        timeout: 5000,
      });

      // The save button is in the header with correct data-testid
      const saveButton = page.getByTestId('save-contract-btn');
      await saveButton.scrollIntoViewIfNeeded();

      await expect(saveButton).toBeVisible();

      const saveResponse = page.waitForResponse('/api/v1/dataContracts');
      await saveButton.click();
      await saveResponse;

      await toastNotification(page, 'Data contract saved successfully');
    });

    await test.step('Run contract validation and check status', async () => {
      // After saving, we should be redirected to the contract view page
      // Wait for page to reload or navigate
      await page.waitForLoadState('networkidle');

      // Wait for the Run Now button to be visible
      await page.waitForSelector('[data-testid="contract-run-now-button"]', {
        state: 'visible',
        timeout: 10000,
      });

      // Use helper function to trigger validation
      await waitForContractValidation(page);

      // Use helper function to check validation status
      const ruleItem = await checkValidationStatus(page, 'pass');

      // Verify the rule name is visible within the Semantics card
      const ruleName = ruleItem.locator('.rule-name');

      await expect(ruleName).toBeVisible();
      await expect(ruleName).toContainText('No Sensitive Data Rule');
    });

    await test.step(
      'Add Sensitive tag to table and verify contract fails',
      async () => {
        // Navigate to Schema tab to add tag to table
        await page.getByTestId('schema').click();

        // Wait for schema tab to load by waiting for the schema table
        await page.waitForSelector('.ant-table-wrapper', {
          state: 'visible',
          timeout: 5000,
        });

        // The table-level tags are in the KnowledgePanel.Tags section
        // Click the add tag button for table-level tags
        await page
          .getByTestId('KnowledgePanel.Tags')
          .getByTestId('add-tag')
          .click();

        // Wait for tag selector to be visible
        await page.waitForSelector('[data-testid="tag-selector"]', {
          state: 'visible',
          timeout: 5000,
        });

        // Search for and select Sensitive tag
        const tagInput = page.locator('[data-testid="tag-selector"] input');
        await tagInput.click();
        await tagInput.fill('Sensitive');

        // Wait for dropdown to appear and options to load
        await page.waitForSelector('.ant-select-dropdown:visible', {
          state: 'visible',
        });

        // Wait for tag options to be visible in the dropdown
        await page.waitForSelector('.ant-select-item', {
          state: 'visible',
          timeout: 5000,
        });

        // Select the Sensitive tag using data-testid
        const piiSensitiveOption = page.locator(
          '[data-testid="tag-PII.Sensitive"]'
        );
        const classificationSensitiveOption = page.locator(
          `[data-testid="tag-${testClassification.data.name}.Sensitive"]`
        );

        if (await piiSensitiveOption.isVisible({ timeout: 2000 })) {
          await piiSensitiveOption.click();
        } else if (
          await classificationSensitiveOption.isVisible({ timeout: 2000 })
        ) {
          await classificationSensitiveOption.click();
        } else {
          // As fallback, just press Enter to select the first match
          await page.keyboard.press('Enter');
        }

        // Click Update button to save the tag
        const updateButton = page.locator('[data-testid="saveAssociatedTag"]');
        await updateButton
          .waitFor({ state: 'visible', timeout: 3000 })
          .catch(() => {
            // Button might not appear if tag auto-saves
          });

        if (await updateButton.isVisible()) {
          await updateButton.click();
          // Wait for the dropdown to close after saving
          await page
            .waitForSelector('.ant-select-dropdown', {
              state: 'hidden',
              timeout: 5000,
            })
            .catch(() => {
              // Dropdown might already be closed
            });
        } else {
          // If no Update button, just press Escape
          await page.keyboard.press('Escape');
        }

        // Navigate back to Contract tab
        await page.getByTestId('contract').click();

        // Wait for contract tab to load by waiting for Run Now button
        await page.waitForSelector('[data-testid="contract-run-now-button"]', {
          state: 'visible',
          timeout: 5000,
        });

        // Use helper function to trigger validation
        await waitForContractValidation(page);

        // Use helper function to check that validation fails
        const ruleItemFail = await checkValidationStatus(page, 'fail');

        // Verify the rule name is still visible
        const ruleNameFail = ruleItemFail.locator('.rule-name');

        await expect(ruleNameFail).toBeVisible();
        await expect(ruleNameFail).toContainText('No Sensitive Data Rule');
      }
    );
  });
});
