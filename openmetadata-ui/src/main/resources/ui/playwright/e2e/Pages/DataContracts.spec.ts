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
import { expect, test } from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import { selectOption } from '../../utils/advancedSearch';
import { createNewPage, redirectToHomePage } from '../../utils/common';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Data Contracts', () => {
  const table = new TableClass();
  const user = new UserClass();

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    test.slow(true);

    const { apiContext, afterAction } = await createNewPage(browser);
    await table.create(apiContext);
    await user.create(apiContext);
    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    test.slow(true);

    const { apiContext, afterAction } = await createNewPage(browser);
    await table.delete(apiContext);
    await user.delete(apiContext);
    await afterAction();
  });

  test('Create Data Contract', async ({ page }) => {
    test.slow(true);

    await redirectToHomePage(page);
    await table.visitEntityPage(page);

    await page.click('[data-testid="contract"]');

    await expect(page.getByTestId('no-data-placeholder')).toBeVisible();
    await expect(page.getByTestId('add-contract-button')).toBeVisible();

    await page.getByTestId('add-contract-button').click();

    await expect(page.getByTestId('add-contract-card')).toBeVisible();

    // Fill Contract Details form
    await page.getByTestId('contract-name').fill('Test Contract');

    const descriptionInputBox = '.om-block-editor[contenteditable="true"]';
    await page.fill(descriptionInputBox, 'test description');

    await page.getByTestId('add-owner').click();
    await page.getByRole('tab', { name: 'Users' }).click();
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
    await page
      .getByTestId(`owner-select-users-search-bar`)
      .fill(user.responseData.displayName);
    await page
      .getByRole('listitem', {
        name: user.responseData.displayName,
        exact: true,
      })
      .click();
    await page.getByTestId('selectable-list-update-btn').click();

    await expect(
      page.getByTestId('owner-link').getByTestId(user.responseData.displayName)
    ).toBeVisible();

    await page.getByRole('button', { name: 'Schema' }).click();

    // Fill Contract Schema form
    await page
      .locator('input[type="checkbox"][aria-label="Select all"]')
      .check();

    await expect(
      page.getByRole('checkbox', { name: 'Select all' })
    ).toBeChecked();

    await page.getByRole('button', { name: 'Semantics' }).click();

    // Fill Contract Semantics form
    await expect(page.getByTestId('add-semantic-button')).toBeDisabled();

    await page.fill('#semantics_0_name', 'Test Semantic 1');
    await page.fill('#semantics_0_description', 'Test Description 1');

    await expect(page.locator('#semantics_0_enabled')).toHaveAttribute(
      'aria-checked',
      'true'
    );

    const ruleLocator = page.locator('.group').nth(0);
    await selectOption(
      page,
      ruleLocator.locator('.group--field .ant-select'),
      'Owners'
    );

    await selectOption(
      page,
      ruleLocator.locator('.rule--operator .ant-select'),
      'Not in'
    );

    await selectOption(
      page,
      ruleLocator.locator('.rule--value .ant-select'),
      'admin'
    );

    await page.getByRole('button', { name: 'Add New Rule' }).click();

    await expect(page.locator('.group--conjunctions')).toBeVisible();

    const ruleLocator2 = page.locator('.rule').nth(1);
    await selectOption(
      page,
      ruleLocator2.locator('.rule--field .ant-select'),
      'Description'
    );

    await selectOption(
      page,
      ruleLocator2.locator('.rule--operator .ant-select'),
      'Is Set'
    );

    await page.getByTestId('save-semantic-button').click();

    await expect(
      page
        .getByTestId('contract-semantics-card-0')
        .locator('.semantic-form-item-title')
    ).toContainText('Test Semantic 1');

    await expect(
      page
        .getByTestId('contract-semantics-card-0')
        .locator('.semantic-form-item-description')
    ).toContainText('Test Description 1');

    await page.locator('.expand-collapse-icon').click();

    await expect(page.locator('.semantic-rule-editor-view-only')).toBeVisible();

    await page.getByTestId('add-semantic-button').click();

    await page.fill('#semantics_1_name', 'Test Semantic 2');
    await page.fill('#semantics_1_description', 'Test Description 2');

    const ruleLocator3 = page.locator('.group').nth(2);
    await selectOption(
      page,
      ruleLocator3.locator('.group--field .ant-select'),
      'Name'
    );

    await selectOption(
      page,
      ruleLocator3.locator('.rule--operator .ant-select'),
      'Is Set'
    );

    await page.getByTestId('save-semantic-button').click();

    await expect(
      page
        .getByTestId('contract-semantics-card-1')
        .locator('.semantic-form-item-title')
    ).toContainText('Test Semantic 2');

    await expect(
      page
        .getByTestId('contract-semantics-card-1')
        .locator('.semantic-form-item-description')
    ).toContainText('Test Description 2');

    await page.getByTestId('delete-semantic-1').click();

    await expect(
      page.getByTestId('contract-semantics-card-1')
    ).not.toBeVisible();

    await page.getByRole('button', { name: 'Quality' }).click();

    await page.waitForTimeout(2000);
  });
});
