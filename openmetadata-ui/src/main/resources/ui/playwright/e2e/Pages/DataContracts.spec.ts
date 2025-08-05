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
import {
  DATA_CONTRACT_DETAILS,
  DATA_CONTRACT_SEMANTICS1,
  DATA_CONTRACT_SEMANTICS2,
  NEW_TABLE_TEST_CASE,
} from '../../constant/dataContracts';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { TableClass } from '../../support/entity/TableClass';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import { UserClass } from '../../support/user/UserClass';
import { selectOption } from '../../utils/advancedSearch';
import {
  clickOutside,
  createNewPage,
  redirectToHomePage,
  toastNotification,
} from '../../utils/common';
import { addOwner } from '../../utils/entity';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Data Contracts', () => {
  const table = new TableClass();
  const user = new UserClass();
  const testClassification = new ClassificationClass();
  const testTag = new TagClass({
    classification: testClassification.data.name,
  });
  const testGlossary = new Glossary();
  const testGlossaryTerm = new GlossaryTerm(testGlossary);

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    test.slow(true);

    const { apiContext, afterAction } = await createNewPage(browser);
    await table.create(apiContext);
    await user.create(apiContext);
    await testClassification.create(apiContext);
    await testTag.create(apiContext);
    await testGlossary.create(apiContext);
    await testGlossaryTerm.create(apiContext);
    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    test.slow(true);

    const { apiContext, afterAction } = await createNewPage(browser);
    await table.delete(apiContext);
    await user.delete(apiContext);
    await testClassification.delete(apiContext);
    await testTag.delete(apiContext);
    await testGlossary.delete(apiContext);
    await testGlossaryTerm.delete(apiContext);
    await afterAction();
  });

  test('Create Data Contract and validate', async ({ page }) => {
    test.slow(true);

    await test.step('Redirect to Home Page and visit entity', async () => {
      await redirectToHomePage(page);
      await table.visitEntityPage(page);
    });

    await test.step(
      'Open contract section and start adding contract',
      async () => {
        await page.click('[data-testid="contract"]');

        await expect(page.getByTestId('no-data-placeholder')).toBeVisible();
        await expect(page.getByTestId('add-contract-button')).toBeVisible();

        await page.getByTestId('add-contract-button').click();

        await expect(page.getByTestId('add-contract-card')).toBeVisible();
      }
    );

    await test.step('Fill Contract Details form', async () => {
      await page.getByTestId('contract-name').fill(DATA_CONTRACT_DETAILS.name);
      await page.fill(
        '.om-block-editor[contenteditable="true"]',
        DATA_CONTRACT_DETAILS.description
      );

      await page.getByTestId('add-owner').click();
      await page.getByRole('tab', { name: 'Users' }).click();
      await page
        .getByTestId('owner-select-users-search-bar')
        .fill(user.responseData.displayName);
      await page
        .getByRole('listitem', {
          name: user.responseData.displayName,
          exact: true,
        })
        .click();
      await page.getByTestId('selectable-list-update-btn').click();

      await expect(
        page
          .getByTestId('owner-link')
          .getByTestId(user.responseData.displayName)
      ).toBeVisible();
    });

    await test.step('Fill Contract Schema form', async () => {
      await page.getByRole('button', { name: 'Schema' }).click();

      await page
        .locator('input[type="checkbox"][aria-label="Select all"]')
        .check();

      await expect(
        page.getByRole('checkbox', { name: 'Select all' })
      ).toBeChecked();
    });

    await test.step('Fill first Contract Semantics form', async () => {
      await page.getByRole('button', { name: 'Semantics' }).click();

      await expect(page.getByTestId('add-semantic-button')).toBeDisabled();

      await page.fill('#semantics_0_name', DATA_CONTRACT_SEMANTICS1.name);
      await page.fill(
        '#semantics_0_description',
        DATA_CONTRACT_SEMANTICS1.description
      );

      await expect(page.locator('#semantics_0_enabled')).toHaveAttribute(
        'aria-checked',
        'true'
      );

      const ruleLocator = page.locator('.group').nth(0);
      await selectOption(
        page,
        ruleLocator.locator('.group--field .ant-select'),
        DATA_CONTRACT_SEMANTICS1.rules[0].field
      );
      await selectOption(
        page,
        ruleLocator.locator('.rule--operator .ant-select'),
        DATA_CONTRACT_SEMANTICS1.rules[0].operator
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
        DATA_CONTRACT_SEMANTICS1.rules[1].field
      );
      await selectOption(
        page,
        ruleLocator2.locator('.rule--operator .ant-select'),
        DATA_CONTRACT_SEMANTICS1.rules[1].operator
      );
      await page.getByTestId('save-semantic-button').click();

      await expect(
        page
          .getByTestId('contract-semantics-card-0')
          .locator('.semantic-form-item-title')
      ).toContainText(DATA_CONTRACT_SEMANTICS1.name);
      await expect(
        page
          .getByTestId('contract-semantics-card-0')
          .locator('.semantic-form-item-description')
      ).toContainText(DATA_CONTRACT_SEMANTICS1.description);

      await page.locator('.expand-collapse-icon').click();

      await expect(
        page.locator('.semantic-rule-editor-view-only')
      ).toBeVisible();
    });

    await test.step('Add second semantic and delete it', async () => {
      await page.getByTestId('add-semantic-button').click();
      await page.fill('#semantics_1_name', DATA_CONTRACT_SEMANTICS2.name);
      await page.fill(
        '#semantics_1_description',
        DATA_CONTRACT_SEMANTICS2.description
      );
      const ruleLocator3 = page.locator('.group').nth(2);
      await selectOption(
        page,
        ruleLocator3.locator('.group--field .ant-select'),
        DATA_CONTRACT_SEMANTICS2.rules[0].field
      );
      await selectOption(
        page,
        ruleLocator3.locator('.rule--operator .ant-select'),
        DATA_CONTRACT_SEMANTICS2.rules[0].operator
      );
      await page.getByTestId('save-semantic-button').click();

      await expect(
        page
          .getByTestId('contract-semantics-card-1')
          .locator('.semantic-form-item-title')
      ).toContainText(DATA_CONTRACT_SEMANTICS2.name);
      await expect(
        page
          .getByTestId('contract-semantics-card-1')
          .locator('.semantic-form-item-description')
      ).toContainText(DATA_CONTRACT_SEMANTICS2.description);

      await page.getByTestId('delete-semantic-1').click();

      await expect(
        page.getByTestId('contract-semantics-card-1')
      ).not.toBeVisible();
    });

    await test.step('Fill Contract Quality form', async () => {
      await page.getByRole('button', { name: 'Quality' }).click();

      // Fill Contract Quality form

      await page.getByTestId('add-test-button').click();

      await expect(page.getByRole('dialog')).toBeVisible();

      await page.fill(
        '[data-testid="test-case-name"]',
        NEW_TABLE_TEST_CASE.name
      );

      await page.click('#testCaseFormV1_testTypeId');
      await page.waitForSelector(`text=${NEW_TABLE_TEST_CASE.label}`);
      await page.click(`text=${NEW_TABLE_TEST_CASE.label}`);
      await page.fill(
        '#testCaseFormV1_params_columnName',
        NEW_TABLE_TEST_CASE.field
      );

      await page.click('[data-testid="tags-selector"] input');
      await page.fill('[data-testid="tags-selector"] input', testTag.data.name);
      await page
        .getByTestId(`tag-${testTag.responseData.fullyQualifiedName}`)
        .click();

      await clickOutside(page);

      await page.click('[data-testid="glossary-terms-selector"] input');
      await page.fill(
        '[data-testid="glossary-terms-selector"] input',
        testGlossaryTerm.data.name
      );

      await page
        .getByTestId(`tag-${testGlossaryTerm.responseData.fullyQualifiedName}`)
        .click();

      await clickOutside(page);

      const testCaseResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases'
      );
      await page.click('[data-testid="create-btn"]');
      await testCaseResponse;

      await page.waitForTimeout(100);

      await expect(
        page
          .locator('.ant-table-cell')
          .filter({ hasText: NEW_TABLE_TEST_CASE.name })
      ).toBeVisible();
    });

    await test.step('Save contract and validate', async () => {
      const saveContractResponse = page.waitForResponse(
        '/api/v1/dataContracts'
      );
      await page.getByTestId('save-contract-btn').click();
      await saveContractResponse;

      await toastNotification(page, 'Data contract saved successfully');

      await expect(
        page
          .getByTestId('contract-card-title-container')
          .filter({ hasText: 'Contract Status' })
      ).not.toBeVisible();

      const runNowResponse = page.waitForResponse(
        '/api/v1/dataContracts/*/validate'
      );
      await page.getByTestId('contract-run-now-button').click();
      await runNowResponse;

      await toastNotification(
        page,
        'Contract validation trigger successfully.'
      );

      await page.reload();

      await expect(
        page.getByTestId('contract-card-title-container').filter({
          hasText: 'Contract Status',
        })
      ).toBeVisible();
      await expect(
        page.getByTestId('contract-status-card-item-Semantics-status')
      ).toContainText('Failed');
      await expect(
        page.getByTestId('data-contract-latest-result-btn')
      ).toContainText('Contract Failed');

      await addOwner({
        page,
        owner: 'admin',
        type: 'Users',
        endpoint: EntityTypeEndpoint.Table,
        dataTestId: 'data-assets-header',
      });

      await page.getByTestId('contract-run-now-button').click();
      await runNowResponse;

      await toastNotification(
        page,
        'Contract validation trigger successfully.'
      );

      await page.reload();

      await expect(
        page.getByTestId('contract-status-card-item-Semantics-status')
      ).toContainText('Passed');
    });

    await test.step('Edit contract and validate', async () => {
      await page.getByTestId('contract-edit-button').click();

      await page.getByRole('tab', { name: 'Quality' }).click();

      await page
        .locator('input[type="checkbox"][aria-label="Select all"]')
        .check();

      await expect(
        page.getByRole('checkbox', { name: 'Select all' })
      ).toBeChecked();

      await page.getByTestId('save-contract-btn').click();

      await toastNotification(page, 'Data contract saved successfully');

      const runNowResponse = page.waitForResponse(
        '/api/v1/dataContracts/*/validate'
      );
      await page.getByTestId('contract-run-now-button').click();
      await runNowResponse;

      await toastNotification(
        page,
        'Contract validation trigger successfully.'
      );

      await page.reload();
    });

    await test.step('Verify YAML view', async () => {
      await page.getByTestId('contract-view-switch-tab-yaml').click();

      await expect(page.getByTestId('code-mirror-container')).toBeVisible();
      await expect(
        page
          .getByTestId('code-mirror-container')
          .getByTestId('query-copy-button')
      ).toBeVisible();
    });

    await test.step('Export YAML', async () => {
      const downloadPromise = page.waitForEvent('download');

      await page.getByTestId('export-contract-button').click();
      const download = await downloadPromise;
      // Wait for the download process to complete and save the downloaded file somewhere.
      await download.saveAs('downloads/' + download.suggestedFilename());
    });

    await test.step('Delete contract', async () => {
      const deleteContractResponse = page.waitForResponse(
        'api/v1/dataContracts/*?hardDelete=true'
      );

      await page.getByTestId('delete-contract-button').click();
      await deleteContractResponse;

      await toastNotification(page, '"Contract" deleted successfully!');

      await expect(page.getByTestId('no-data-placeholder')).toBeVisible();
      await expect(page.getByTestId('add-contract-button')).toBeVisible();
    });
  });
});
