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
import { expect, test as base } from '@playwright/test';
import {
  DATA_CONTRACT_DETAILS,
  DATA_CONTRACT_SEMANTICS1,
  DATA_CONTRACT_SEMANTICS2,
  NEW_TABLE_TEST_CASE,
} from '../../constant/dataContracts';
import { GlobalSettingOptions } from '../../constant/settings';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { TableClass } from '../../support/entity/TableClass';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { PersonaClass } from '../../support/persona/PersonaClass';
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
import {
  saveAndTriggerDataContractValidation,
  validateDataContractInsideBundleTestSuites,
  waitForDataContractExecution,
} from '../../utils/dataContracts';
import { addOwner } from '../../utils/entity';
import { settingClick } from '../../utils/sidebar';
import { test } from '../fixtures/pages';

base.use({ storageState: 'playwright/.auth/admin.json' });

base.describe('Data Contracts', () => {
  const table = new TableClass();
  const testClassification = new ClassificationClass();
  const testTag = new TagClass({
    classification: testClassification.data.name,
  });
  const testGlossary = new Glossary();
  const testGlossaryTerm = new GlossaryTerm(testGlossary);
  const testPersona = new PersonaClass();
  const testUser = new UserClass();

  base.beforeAll('Setup pre-requests', async ({ browser }) => {
    base.slow(true);

    const { apiContext, afterAction } = await createNewPage(browser);
    await table.create(apiContext);
    await testClassification.create(apiContext);
    await testTag.create(apiContext);
    await testGlossary.create(apiContext);
    await testGlossaryTerm.create(apiContext);
    await testPersona.create(apiContext);
    await testUser.create(apiContext);
    await afterAction();
  });

  base.afterAll('Cleanup', async ({ browser }) => {
    base.slow(true);

    const { apiContext, afterAction } = await createNewPage(browser);
    await table.delete(apiContext);
    await testClassification.delete(apiContext);
    await testTag.delete(apiContext);
    await testGlossary.delete(apiContext);
    await testGlossaryTerm.delete(apiContext);
    await testPersona.delete(apiContext);
    await testUser.delete(apiContext);
    await afterAction();
  });

  base('Create Data Contract and validate', async ({ page }) => {
    base.slow(true);

    await base.step('Redirect to Home Page and visit entity', async () => {
      await redirectToHomePage(page);
      await table.visitEntityPage(page);
    });

    await base.step(
      'Open contract section and start adding contract',
      async () => {
        await page.click('[data-testid="contract"]');

        await expect(page.getByTestId('no-data-placeholder')).toBeVisible();
        await expect(page.getByTestId('add-contract-button')).toBeVisible();

        await page.getByTestId('add-contract-button').click();

        await expect(page.getByTestId('add-contract-card')).toBeVisible();
      }
    );

    await base.step('Fill Contract Details form', async () => {
      await page.getByTestId('contract-name').fill(DATA_CONTRACT_DETAILS.name);
      await page.fill(
        '.om-block-editor[contenteditable="true"]',
        DATA_CONTRACT_DETAILS.description
      );

      await page.getByTestId('select-owners').click();
      await page.locator('.rc-virtual-list-holder-inner li').first().click();

      await expect(page.getByTestId('user-tag')).toBeVisible();
    });

    await base.step('Fill Contract Schema form', async () => {
      await page.getByRole('button', { name: 'Schema' }).click();

      await page
        .locator('input[type="checkbox"][aria-label="Select all"]')
        .check();

      await expect(
        page.getByRole('checkbox', { name: 'Select all' })
      ).toBeChecked();
    });

    await base.step('Fill first Contract Semantics form', async () => {
      await page.getByRole('button', { name: 'Semantics' }).click();

      await expect(page.getByTestId('add-semantic-button')).toBeDisabled();

      await page.fill('#semantics_0_name', DATA_CONTRACT_SEMANTICS1.name);
      await page.fill(
        '#semantics_0_description',
        DATA_CONTRACT_SEMANTICS1.description
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

    await base.step('Add second semantic and delete it', async () => {
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

    await base.step('Save contract and validate for semantics', async () => {
      // save and trigger contract validation
      await saveAndTriggerDataContractValidation(page, true);

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
        page.getByTestId('contract-status-card-item-Semantics-status')
      ).toContainText('Passed');
    });

    await base.step(
      'Add table test case and validate for quality',
      async () => {
        await page.getByTestId('contract-edit-button').click();

        await page.getByRole('tab', { name: 'Quality' }).click();

        await page.getByTestId('add-test-button').click();

        await expect(page.getByRole('dialog')).toBeVisible();

        await page.fill(
          '[data-testid="test-case-name"]',
          NEW_TABLE_TEST_CASE.name
        );

        await page.locator('#testCaseFormV1_testTypeId').click();

        const dropdown = page.locator('.rc-virtual-list-holder-inner');

        await expect(dropdown).toBeVisible();

        for (let i = 0; i < 20; i++) {
          const optionVisible = await dropdown
            .getByText(NEW_TABLE_TEST_CASE.label)
            .isVisible();
          if (optionVisible) {
            break;
          }
          await dropdown.press('ArrowDown');
        }

        await dropdown.getByText(NEW_TABLE_TEST_CASE.label).click();

        await page.click(`text=${NEW_TABLE_TEST_CASE.label}`);
        await page.fill(
          '#testCaseFormV1_params_columnCount',
          NEW_TABLE_TEST_CASE.value
        );

        await page.click('[data-testid="tags-selector"] input');
        await page.fill(
          '[data-testid="tags-selector"] input',
          testTag.data.name
        );
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
          .getByTestId(
            `tag-${testGlossaryTerm.responseData.fullyQualifiedName}`
          )
          .click();

        await clickOutside(page);

        await page.getByTestId('pipeline-name').fill('test-pipeline');

        await page
          .locator('.selection-title', { hasText: 'On Demand' })
          .click();

        await expect(page.locator('.expression-text')).toContainText(
          'Pipeline will only be triggered manually.'
        );

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

        await page
          .locator('input[type="checkbox"][aria-label="Select all"]')
          .check();

        await expect(
          page.getByRole('checkbox', { name: 'Select all' })
        ).toBeChecked();

        // save and trigger contract validation
        const response = await saveAndTriggerDataContractValidation(page);

        if (
          typeof response === 'object' &&
          response !== null &&
          'latestResult' in response
        ) {
          const {
            id: contractId,
            latestResult: { resultId: latestResultId },
          } = response;

          if (contractId && latestResultId) {
            await waitForDataContractExecution(
              page,
              contractId,
              latestResultId
            );
          }
        }

        await expect(
          page.getByTestId('data-contract-latest-result-btn')
        ).toBeVisible();
      }
    );

    await base.step(
      'Validate inside the Observability, bundle test suites, that data contract test suite is present',
      async () => {
        await validateDataContractInsideBundleTestSuites(page);

        await expect(
          page
            .getByTestId('test-suite-table')
            .locator('.ant-table-cell')
            .filter({
              hasText: `Data Contract - ${DATA_CONTRACT_DETAILS.name}`,
            })
        ).toBeVisible();
      }
    );

    await base.step(
      'Edit quality expectations from the data contract and validate',
      async () => {
        await table.visitEntityPage(page);

        await page.getByTestId('contract').click();

        await page.getByTestId('contract-edit-button').click();

        await page.getByRole('tab', { name: 'Quality' }).click();

        await page
          .locator('input[type="checkbox"][aria-label="Select all"]')
          .uncheck();

        await expect(
          page.getByRole('checkbox', { name: 'Select all' })
        ).not.toBeChecked();

        await saveAndTriggerDataContractValidation(page);

        await expect(
          page.getByTestId('contract-status-card-item-Quality Status')
        ).not.toBeVisible();

        await expect(
          page.getByTestId('data-contract-latest-result-btn')
        ).not.toBeVisible();
      }
    );

    // TODO: Add a step to validate the test suite is removed from observability -> bundle test suites

    await base.step('Verify YAML view', async () => {
      await table.visitEntityPage(page);

      await page.getByTestId('contract').click();

      await page.getByTestId('contract-view-switch-tab-yaml').click();

      await expect(page.getByTestId('code-mirror-container')).toBeVisible();
      await expect(
        page
          .getByTestId('code-mirror-container')
          .getByTestId('query-copy-button')
      ).toBeVisible();
    });

    await base.step('Export YAML', async () => {
      const downloadPromise = page.waitForEvent('download');

      await page.getByTestId('export-contract-button').click();
      const download = await downloadPromise;
      // Wait for the download process to complete and save the downloaded file somewhere.
      await download.saveAs('downloads/' + download.suggestedFilename());
    });

    await base.step('Delete contract', async () => {
      const deleteContractResponse = page.waitForResponse(
        'api/v1/dataContracts/*?hardDelete=true&recursive=true'
      );

      await page.getByTestId('delete-contract-button').click();

      await expect(
        page
          .locator('.ant-modal-title')
          .getByText(`Delete dataContract "${DATA_CONTRACT_DETAILS.name}"`)
      ).toBeVisible();

      await page.getByTestId('confirmation-text-input').click();
      await page.getByTestId('confirmation-text-input').fill('DELETE');

      await expect(page.getByTestId('confirm-button')).toBeEnabled();

      await page.getByTestId('confirm-button').click();
      await deleteContractResponse;

      await toastNotification(page, '"Contract" deleted successfully!');

      await expect(page.getByTestId('no-data-placeholder')).toBeVisible();
      await expect(page.getByTestId('add-contract-button')).toBeVisible();
    });
  });

  test('Contract Status badge should not be visible if Contract Tab is hidden by Person', async ({
    dataConsumerPage: page,
  }) => {
    base.slow(true);

    const loggedInUserRequest = page.waitForResponse(
      `/api/v1/users/loggedInUser*`
    );
    await redirectToHomePage(page);
    const loggedInUserResponse = await loggedInUserRequest;
    const loggedInUser = await loggedInUserResponse.json();

    await base.step(
      'Create Data Contract in Table and validate it fails',
      async () => {
        await table.visitEntityPage(page);

        // Open contract section and start adding contract
        await page.click('[data-testid="contract"]');

        await expect(page.getByTestId('no-data-placeholder')).toBeVisible();
        await expect(page.getByTestId('add-contract-button')).toBeVisible();

        await page.getByTestId('add-contract-button').click();

        await expect(page.getByTestId('add-contract-card')).toBeVisible();

        // Fill Contract Details form
        await page
          .getByTestId('contract-name')
          .fill(DATA_CONTRACT_DETAILS.name);
        await page.fill(
          '.om-block-editor[contenteditable="true"]',
          DATA_CONTRACT_DETAILS.description
        );

        await page.getByTestId('select-owners').click();
        await page.locator('.rc-virtual-list-holder-inner li').first().click();

        await expect(page.getByTestId('user-tag')).toBeVisible();

        // Fill Contract Schema form
        await page.getByRole('button', { name: 'Schema' }).click();
        await page
          .locator('input[type="checkbox"][aria-label="Select all"]')
          .check();

        await expect(
          page.getByRole('checkbox', { name: 'Select all' })
        ).toBeChecked();

        // Fill Contract Semantics form
        await page.getByRole('button', { name: 'Semantics' }).click();

        await expect(page.getByTestId('add-semantic-button')).toBeDisabled();

        await page.fill('#semantics_0_name', DATA_CONTRACT_SEMANTICS1.name);
        await page.fill(
          '#semantics_0_description',
          DATA_CONTRACT_SEMANTICS1.description
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
        await page.getByTestId('save-semantic-button').click();

        await expect(
          page
            .getByTestId('contract-semantics-card-0')
            .locator('.semantic-form-item-title')
        ).toContainText(DATA_CONTRACT_SEMANTICS1.name);

        // Save contract and validate for semantics - should fail initially
        await saveAndTriggerDataContractValidation(page, true);

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
      }
    );

    await base.step('Create Persona and assign user to it', async () => {
      await redirectToHomePage(page);
      await settingClick(page, GlobalSettingOptions.PERSONA);
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Navigate to persona details
      await page
        .getByTestId(`persona-details-card-${testPersona.data.name}`)
        .click();
      await page.getByRole('tab', { name: 'Users' }).click();

      // Add user to persona
      await page.getByTestId('add-persona-button').click();
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      const searchUser = page.waitForResponse(
        `/api/v1/search/query?q=*${encodeURIComponent(
          loggedInUser.displayName
        )}*`
      );
      await page.getByTestId('searchbar').fill(loggedInUser.displayName);
      await searchUser;

      await page
        .getByRole('listitem', { name: loggedInUser.displayName })
        .click();
      await page.getByTestId('selectable-list-update-btn').click();

      // Set as default persona for the user using API
      const browser = page.context().browser();
      if (!browser) {
        throw new Error('Browser context not available');
      }
      const { apiContext, afterAction } = await createNewPage(browser);
      await testUser.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/personas/0',
            value: {
              id: testPersona.responseData.id,
              name: testPersona.responseData.name,
              displayName: testPersona.responseData.displayName,
              fullyQualifiedName: testPersona.responseData.fullyQualifiedName,
              type: 'persona',
            },
          },
          {
            op: 'add',
            path: '/defaultPersona',
            value: {
              id: testPersona.responseData.id,
              name: testPersona.responseData.name,
              displayName: testPersona.responseData.displayName,
              fullyQualifiedName: testPersona.responseData.fullyQualifiedName,
              type: 'persona',
            },
          },
        ],
      });
      await afterAction();
    });

    await base.step('Customize Table page to hide Contract tab', async () => {
      await redirectToHomePage(page);
      await settingClick(page, GlobalSettingOptions.PERSONA);
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Navigate to persona details and customize UI
      await page
        .getByTestId(`persona-details-card-${testPersona.data.name}`)
        .click();
      await page.getByRole('tab', { name: 'Customize UI' }).click();
      await page.waitForLoadState('networkidle');

      // Navigate to Table customization
      await page.getByText('Data Assets').click();
      await page.getByText('Table', { exact: true }).click();

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Hide the Contract tab
      await page.getByTestId('tab-Contract').click();
      await page.getByText('Hide', { exact: true }).click();

      // Save the customization
      await page.getByTestId('save-button').click();
      await toastNotification(
        page,
        /^Page layout (created|updated) successfully\.$/
      );
    });

    await base.step(
      'Verify Contract tab and status badge are hidden after persona customization',
      async () => {
        // After applying persona customization to hide the contract tab,
        // we need to verify that the contract tab and status badge are not visible
        // when viewing the table page with the customized persona.

        await redirectToHomePage(page);
        await table.visitEntityPage(page);
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        // Verify Contract tab is not visible (should be hidden by persona customization)
        await expect(page.getByTestId('contract')).not.toBeVisible();

        // Verify Contract status badge is not visible in header
        await expect(
          page.getByTestId('data-contract-latest-result-btn')
        ).not.toBeVisible();

        // Verify no contract-related elements are visible
        await expect(
          page.getByTestId('contract-status-card-item-Semantics-status')
        ).not.toBeVisible();
        await expect(
          page.getByTestId('contract-card-title-container')
        ).not.toBeVisible();

        // Additional verification: Check that other tabs are still visible
        await expect(page.getByTestId('overview')).toBeVisible();
        await expect(page.getByTestId('schema')).toBeVisible();
        await expect(page.getByTestId('activity_feed')).toBeVisible();
      }
    );
  });
});
