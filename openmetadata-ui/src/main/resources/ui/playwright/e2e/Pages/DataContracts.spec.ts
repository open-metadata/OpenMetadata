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
import { expect, Page, test as base } from '@playwright/test';
import {
  DATA_CONTRACT_CONTAIN_SEMANTICS,
  DATA_CONTRACT_DETAILS,
  DATA_CONTRACT_SECURITY_DETAILS_1,
  DATA_CONTRACT_SECURITY_DETAILS_2,
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
import { performAdminLogin } from '../../utils/admin';
import { selectOption } from '../../utils/advancedSearch';
import { resetTokenFromBotPage } from '../../utils/bot';
import {
  clickOutside,
  redirectToHomePage,
  toastNotification,
} from '../../utils/common';
import {
  saveAndTriggerDataContractValidation,
  saveSecurityAndSLADetails,
  validateDataContractInsideBundleTestSuites,
  validateSecurityAndSLADetails,
  waitForDataContractExecution,
} from '../../utils/dataContracts';
import {
  addOwner,
  addOwnerWithoutValidation,
  assignGlossaryTerm,
  assignTag,
  assignTier,
} from '../../utils/entity';
import { settingClick } from '../../utils/sidebar';

const adminUser = new UserClass();

const test = base.extend<{ page: Page }>({
  page: async ({ browser }, use) => {
    const adminPage = await browser.newPage();
    await adminUser.login(adminPage);
    await use(adminPage);
    await adminPage.close();
  },
});

test.describe('Data Contracts', () => {
  const table = new TableClass();
  const testClassification = new ClassificationClass();
  const testTag = new TagClass({
    classification: testClassification.data.name,
  });
  const testGlossary = new Glossary();
  const testGlossaryTerm = new GlossaryTerm(testGlossary);
  const testPersona = new PersonaClass();

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    test.slow(true);

    const { apiContext, afterAction, page } = await performAdminLogin(browser);
    await table.create(apiContext);
    await testClassification.create(apiContext);
    await testTag.create(apiContext);
    await testGlossary.create(apiContext);
    await testGlossaryTerm.create(apiContext);
    await testPersona.create(apiContext);
    await adminUser.create(apiContext);
    await adminUser.setAdminRole(apiContext);
    await adminUser.patch({
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

    if (!process.env.PLAYWRIGHT_IS_OSS) {
      // Todo: Remove this patch once the issue is fixed #19140
      await resetTokenFromBotPage(page, 'testsuite-bot');
    }

    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    test.slow(true);

    const { apiContext, afterAction } = await performAdminLogin(browser);
    await table.delete(apiContext);
    await testClassification.delete(apiContext);
    await testTag.delete(apiContext);
    await testGlossary.delete(apiContext);
    await testGlossaryTerm.delete(apiContext);
    await testPersona.delete(apiContext);
    await adminUser.delete(apiContext);
    await afterAction();
  });

  test('Create Data Contract and validate', async ({ page }) => {
    test.setTimeout(360000);

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

      await page.getByTestId('select-owners').click();
      await page.locator('.rc-virtual-list-holder-inner li').first().click();

      await expect(page.getByTestId('user-tag')).toBeVisible();
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

      const ruleLocator = page.locator('.group').nth(0);
      await selectOption(
        page,
        ruleLocator.locator('.group--field .ant-select'),
        DATA_CONTRACT_SEMANTICS1.rules[0].field,
        true
      );
      await selectOption(
        page,
        ruleLocator.locator('.rule--operator .ant-select'),
        DATA_CONTRACT_SEMANTICS1.rules[0].operator
      );
      await selectOption(
        page,
        ruleLocator.locator('.rule--value .ant-select'),
        'admin',
        true
      );
      await page.getByRole('button', { name: 'Add New Rule' }).click();

      await expect(page.locator('.group--conjunctions')).toBeVisible();

      const ruleLocator2 = page.locator('.rule').nth(1);
      await selectOption(
        page,
        ruleLocator2.locator('.rule--field .ant-select'),
        DATA_CONTRACT_SEMANTICS1.rules[1].field,
        true
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
        DATA_CONTRACT_SEMANTICS2.rules[0].field,
        true
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

    await test.step('Save contract and validate for semantics', async () => {
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

      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await expect(
        page.getByTestId('contract-status-card-item-Semantics-status')
      ).toContainText('Passed');
    });

    await test.step(
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

        await page.locator('[id="root\\/testType"]').click();

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

    await test.step(
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

    await test.step(
      'Edit quality expectations from the data contract and validate',
      async () => {
        await table.visitEntityPage(page);

        await page.getByTestId('contract').click();

        await page.getByTestId('contract-edit-button').click();

        const qualityResponse = page.waitForResponse(
          '/api/v1/dataQuality/testCases/search/list**'
        );

        await page.getByRole('tab', { name: 'Quality' }).click();

        await qualityResponse;
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

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

    await test.step('Verify YAML view', async () => {
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

    await test.step('Export YAML', async () => {
      const downloadPromise = page.waitForEvent('download');

      await page.getByTestId('export-contract-button').click();
      const download = await downloadPromise;
      // Wait for the download process to complete and save the downloaded file somewhere.
      await download.saveAs('downloads/' + download.suggestedFilename());
    });

    await test.step('Edit and Validate Contract data', async () => {
      await page.getByTestId('contract-edit-button').click();

      await expect(page.getByTestId('save-contract-btn')).toBeDisabled();

      // Change the Contract Details
      await page
        .getByTestId('contract-name')
        .fill(DATA_CONTRACT_DETAILS.displayName);
      await page.click('.om-block-editor[contenteditable="true"]');
      await page.keyboard.press('Control+A');
      await page.keyboard.type(DATA_CONTRACT_DETAILS.description2);

      await addOwnerWithoutValidation({
        page,
        owner: 'admin',
        type: 'Users',
        initiatorId: 'select-owners',
      });

      await expect(
        page.getByTestId('user-tag').getByText('admin')
      ).toBeVisible();

      // Move to Schema Tab
      await page.getByRole('button', { name: 'Schema' }).click();

      // TODO: will enable this once nested column is fixed
      //   await page.waitForSelector('[data-testid="loader"]', {
      //     state: 'detached',
      //   });

      //   await page.getByRole('checkbox', { name: 'Select all' }).click();

      //   await expect(
      //     page.getByRole('checkbox', { name: 'Select all' })
      //   ).not.toBeChecked();

      // Move to Semantic Tab
      await page.getByRole('button', { name: 'Semantics' }).click();

      await page.getByTestId('delete-condition-button').last().click();

      await expect(
        page.getByTestId('query-builder-form-field').getByText('Description')
      ).not.toBeVisible();

      await expect(page.getByTestId('save-contract-btn')).not.toBeDisabled();

      const saveContractResponse = page.waitForResponse(
        '/api/v1/dataContracts/*'
      );
      await page.getByTestId('save-contract-btn').click();
      await saveContractResponse;

      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Validate the Updated Values
      await expect(page.getByTestId('contract-title')).toContainText(
        DATA_CONTRACT_DETAILS.displayName
      );

      await expect(
        page.getByTestId('contract-owner-card').getByTestId('admin')
      ).toBeVisible();

      await expect(
        page.locator(
          '[data-testid="viewer-container"] [data-testid="markdown-parser"]'
        )
      ).toContainText(DATA_CONTRACT_DETAILS.description2);

      // TODO: will enable this once nested column is fixed
      //   await expect(page.getByTestId('schema-table-card')).not.toBeVisible();
    });

    await test.step('Delete contract', async () => {
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

  test('Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona', async ({
    page,
  }) => {
    test.slow(true);

    await test.step(
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
          DATA_CONTRACT_SEMANTICS1.rules[0].field,
          true
        );
        await selectOption(
          page,
          ruleLocator.locator('.rule--operator .ant-select'),
          DATA_CONTRACT_SEMANTICS1.rules[0].operator
        );
        await selectOption(
          page,
          ruleLocator.locator('.rule--value .ant-select'),
          'admin',
          true
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

    await test.step('Create Persona and assign user to it', async () => {
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
          adminUser.responseData.displayName
        )}*`
      );
      await page
        .getByTestId('searchbar')
        .fill(adminUser.responseData.displayName);
      await searchUser;

      await page
        .getByRole('listitem', { name: adminUser.responseData.displayName })
        .click();

      const personaResponse = page.waitForResponse('/api/v1/personas/*');

      await page.getByTestId('selectable-list-update-btn').click();
      await personaResponse;
    });

    await test.step(
      'Verify Contract tab and status badge are visible if persona is set',
      async () => {
        await redirectToHomePage(page);
        await table.visitEntityPage(page);
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        // Verify Contract tab is not visible (should be hidden by persona customization)
        await expect(page.getByTestId('contract')).toBeVisible();

        // Verify Contract status badge is not visible in header
        await expect(
          page.getByTestId('data-contract-latest-result-btn')
        ).toBeVisible();

        // Additional verification: Check that other tabs are still visible
        await expect(page.getByTestId('schema')).toBeVisible();
        await expect(page.getByTestId('activity_feed')).toBeVisible();
        await expect(page.getByTestId('sample_data')).toBeVisible();
        await expect(page.getByTestId('table_queries')).toBeVisible();
        await expect(page.getByTestId('profiler')).toBeVisible();
        await expect(page.getByTestId('lineage')).toBeVisible();
        await expect(page.getByTestId('custom_properties')).toBeVisible();
      }
    );

    await test.step('Customize Table page to hide Contract tab', async () => {
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
      await page.getByTestId('tab-contract').click();
      await page.getByText('Hide', { exact: true }).click();

      // Save the customization
      await page.getByTestId('save-button').click();
      await toastNotification(
        page,
        /^Page layout (created|updated) successfully\.$/
      );
    });

    await test.step(
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

        // Additional verification: Check that other tabs are still visible
        await expect(page.getByTestId('schema')).toBeVisible();
        await expect(page.getByTestId('activity_feed')).toBeVisible();
        await expect(page.getByTestId('sample_data')).toBeVisible();
        await expect(page.getByTestId('table_queries')).toBeVisible();
        await expect(page.getByTestId('profiler')).toBeVisible();
        await expect(page.getByTestId('lineage')).toBeVisible();
        await expect(page.getByTestId('custom_properties')).toBeVisible();
      }
    );
  });

  test('Pagination in Schema Tab with Selection Persistent', async ({
    page,
  }) => {
    test.slow();

    const entityFQN = 'sample_data.ecommerce_db.shopify.performance_test_table';

    try {
      await test.step('Redirect to Home Page and visit entity', async () => {
        await redirectToHomePage(page);
        await page.goto(`/table/${entityFQN}`);

        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });
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
        await page
          .getByTestId('contract-name')
          .fill(DATA_CONTRACT_DETAILS.name);
      });

      await test.step('Fill Contract Schema form', async () => {
        const columnResponse = page.waitForResponse(
          'api/v1/tables/name/sample_data.ecommerce_db.shopify.performance_test_table/columns?**'
        );

        await page.getByRole('button', { name: 'Schema' }).click();

        await columnResponse;
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await page
          .locator('input[type="checkbox"][aria-label="Select all"]')
          .check();

        await expect(
          page.getByRole('checkbox', { name: 'Select all' })
        ).toBeChecked();

        // Move to 2nd Page and Select columns

        const columnResponse2 = page.waitForResponse(
          'api/v1/tables/name/sample_data.ecommerce_db.shopify.performance_test_table/columns?**'
        );

        await page.getByTestId('next').click();

        await columnResponse2;
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await page
          .locator('input[type="checkbox"][aria-label="Select all"]')
          .check();

        await expect(
          page.getByRole('checkbox', { name: 'Select all' })
        ).toBeChecked();

        // Move to 3nd Page and Select columns

        const columnResponse3 = page.waitForResponse(
          'api/v1/tables/name/sample_data.ecommerce_db.shopify.performance_test_table/columns?**'
        );

        await page.getByTestId('next').click();

        await columnResponse3;
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await page
          .locator('input[type="checkbox"][aria-label="Select all"]')
          .check();

        await expect(
          page.getByRole('checkbox', { name: 'Select all' })
        ).toBeChecked();

        // Now UnSelect the Selected Columns of 3rd Page

        await page
          .locator('input[type="checkbox"][aria-label="Select all"]')
          .uncheck();

        await expect(
          page.getByRole('checkbox', { name: 'Select all' })
        ).not.toBeChecked();
      });

      await test.step('Save contract and validate for schema', async () => {
        const saveContractResponse = page.waitForResponse(
          '/api/v1/dataContracts/*'
        );
        await page.getByTestId('save-contract-btn').click();

        await saveContractResponse;

        // Check all schema from 1 to 50
        for (let i = 1; i <= 50; i++) {
          if (i < 10) {
            await expect(page.getByText(`test_col_000${i}`)).toBeVisible();
          } else {
            await expect(page.getByText(`test_col_00${i}`)).toBeVisible();
          }
        }

        // Schema from 51 to 75 Should not be visible
        for (let i = 51; i <= 75; i++) {
          await expect(page.getByText(`test_col_00${i}`)).not.toBeVisible();
        }
      });

      await test.step('Update the Schema and Validate', async () => {
        await page.getByTestId('contract-edit-button').click();

        const columnResponse = page.waitForResponse(
          'api/v1/tables/name/sample_data.ecommerce_db.shopify.performance_test_table/columns?**'
        );

        await page.getByRole('button', { name: 'Schema' }).click();

        await columnResponse;
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await page
          .locator('input[type="checkbox"][aria-label="Select all"]')
          .uncheck();

        await expect(
          page.getByRole('checkbox', { name: 'Select all' })
        ).not.toBeChecked();

        const saveContractResponse = page.waitForResponse(
          '/api/v1/dataContracts/*'
        );
        await page.getByTestId('save-contract-btn').click();

        await saveContractResponse;

        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        // Check all schema from 26 to 50
        for (let i = 26; i <= 50; i++) {
          await expect(page.getByText(`test_col_00${i}`)).toBeVisible();
        }
      });

      await test.step(
        'Re-select some columns on page 1, save and validate',
        async () => {
          await page.getByTestId('contract-edit-button').click();

          const columnResponse = page.waitForResponse(
            'api/v1/tables/name/sample_data.ecommerce_db.shopify.performance_test_table/columns?**'
          );

          await page.getByRole('button', { name: 'Schema' }).click();

          await columnResponse;
          await page.waitForSelector('[data-testid="loader"]', {
            state: 'detached',
          });

          for (let i = 1; i <= 5; i++) {
            await page
              .locator(
                `[data-row-key="${entityFQN}.test_col_000${i}"] .ant-checkbox-input`
              )
              .click();
          }

          const saveContractResponse = page.waitForResponse(
            '/api/v1/dataContracts/*'
          );
          await page.getByTestId('save-contract-btn').click();

          await saveContractResponse;

          await page.waitForLoadState('networkidle');
          await page.waitForSelector('[data-testid="loader"]', {
            state: 'detached',
          });

          // Check all schema from 1 to 5 and then, the one we didn't touch 26 to 50
          for (let i = 1; i <= 5; i++) {
            await expect(page.getByText(`test_col_000${i}`)).toBeVisible();
          }

          for (let i = 26; i <= 50; i++) {
            await expect(page.getByText(`test_col_00${i}`)).toBeVisible();
          }
        }
      );
    } finally {
      await test.step('Delete contract', async () => {
        await redirectToHomePage(page);
        await page.goto(`/table/${entityFQN}`);

        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await page.click('[data-testid="contract"]');

        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        const deleteContractResponse = page.waitForResponse(
          'api/v1/dataContracts/*?hardDelete=true&recursive=true'
        );

        await page.getByTestId('delete-contract-button').click();

        await expect(page.locator('.ant-modal-title')).toBeVisible();

        await page.getByTestId('confirmation-text-input').click();
        await page.getByTestId('confirmation-text-input').fill('DELETE');

        await expect(page.getByTestId('confirm-button')).toBeEnabled();

        await page.getByTestId('confirm-button').click();
        await deleteContractResponse;

        await toastNotification(page, '"Contract" deleted successfully!');

        await expect(page.getByTestId('no-data-placeholder')).toBeVisible();
        await expect(page.getByTestId('add-contract-button')).toBeVisible();
      });
    }
  });

  test('Semantic with Contains Operator should work for Tier, Tag and Glossary', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await table.visitEntityPage(page);
    await page.click('[data-testid="contract"]');
    await page.getByTestId('add-contract-button').click();

    await expect(page.getByTestId('add-contract-card')).toBeVisible();

    await expect(page.getByTestId('add-contract-card')).toBeVisible();

    await page.getByTestId('contract-name').fill(DATA_CONTRACT_DETAILS.name);

    await page.getByRole('tab', { name: 'Semantics' }).click();

    await expect(page.getByTestId('add-semantic-button')).toBeDisabled();

    await page.fill('#semantics_0_name', DATA_CONTRACT_CONTAIN_SEMANTICS.name);
    await page.fill(
      '#semantics_0_description',
      DATA_CONTRACT_CONTAIN_SEMANTICS.description
    );
    const ruleLocator = page.locator('.group').nth(0);
    await selectOption(
      page,
      ruleLocator.locator('.group--field .ant-select'),
      DATA_CONTRACT_CONTAIN_SEMANTICS.rules[0].field,
      true
    );
    await selectOption(
      page,
      ruleLocator.locator('.rule--operator .ant-select'),
      DATA_CONTRACT_CONTAIN_SEMANTICS.rules[0].operator
    );
    await selectOption(
      page,
      ruleLocator.locator('.rule--value .ant-select'),
      'Tier.Tier1',
      true
    );
    await page.getByRole('button', { name: 'Add New Rule' }).click();

    await expect(page.locator('.group--conjunctions')).toBeVisible();

    const ruleLocator2 = page.locator('.rule').nth(1);
    await selectOption(
      page,
      ruleLocator2.locator('.rule--field .ant-select'),
      DATA_CONTRACT_CONTAIN_SEMANTICS.rules[1].field,
      true
    );
    await selectOption(
      page,
      ruleLocator2.locator('.rule--operator .ant-select'),
      DATA_CONTRACT_CONTAIN_SEMANTICS.rules[1].operator
    );

    await selectOption(
      page,
      ruleLocator2.locator('.rule--value .ant-select'),
      testTag.responseData.name,
      true
    );

    await page.getByRole('button', { name: 'Add New Rule' }).click();

    await expect(page.locator('.group--conjunctions')).toBeVisible();

    const ruleLocator3 = page.locator('.rule').nth(2);
    await selectOption(
      page,
      ruleLocator3.locator('.rule--field .ant-select'),
      DATA_CONTRACT_CONTAIN_SEMANTICS.rules[2].field,
      true
    );
    await selectOption(
      page,
      ruleLocator3.locator('.rule--operator .ant-select'),
      DATA_CONTRACT_CONTAIN_SEMANTICS.rules[2].operator
    );

    await selectOption(
      page,
      ruleLocator3.locator('.rule--value .ant-select'),
      testGlossaryTerm.responseData.name,
      true
    );

    await page.getByTestId('save-semantic-button').click();

    await expect(
      page
        .getByTestId('contract-semantics-card-0')
        .locator('.semantic-form-item-title')
    ).toContainText(DATA_CONTRACT_CONTAIN_SEMANTICS.name);
    await expect(
      page
        .getByTestId('contract-semantics-card-0')
        .locator('.semantic-form-item-description')
    ).toContainText(DATA_CONTRACT_CONTAIN_SEMANTICS.description);

    await page.locator('.expand-collapse-icon').click();

    await expect(page.locator('.semantic-rule-editor-view-only')).toBeVisible();

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

    await page.getByTestId('schema').click();

    // Add the data in the Table Entity which Semantic Required
    await assignTier(page, 'Tier1', EntityTypeEndpoint.Table);
    await assignTag(
      page,
      testTag.responseData.displayName,
      'Add',
      EntityTypeEndpoint.Table,
      'KnowledgePanel.Tags',
      testTag.responseData.fullyQualifiedName
    );
    await assignGlossaryTerm(page, testGlossaryTerm.responseData);

    await page.click('[data-testid="contract"]');

    const runNowResponse = page.waitForResponse(
      '/api/v1/dataContracts/*/validate'
    );

    await page.getByTestId('contract-run-now-button').click();
    await runNowResponse;

    await toastNotification(page, 'Contract validation trigger successfully.');

    await page.reload();

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await expect(
      page.getByTestId('contract-status-card-item-Semantics-status')
    ).toContainText('Passed');
  });

  test('Nested Column should not be selectable', async ({ page }) => {
    const entityFQN = table.entityResponseData.fullyQualifiedName;
    await redirectToHomePage(page);
    await table.visitEntityPage(page);
    await page.click('[data-testid="contract"]');
    await page.getByTestId('add-contract-button').click();

    await expect(page.getByTestId('add-contract-card')).toBeVisible();

    await page.getByTestId('contract-name').fill(DATA_CONTRACT_DETAILS.name);

    await page.getByRole('button', { name: 'Schema' }).click();

    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    // First level column should be selectable
    await page
      .locator(
        `[data-row-key="${entityFQN}.${table.entityLinkColumnsName[1]}"] .ant-checkbox-input`
      )
      .click();

    await expect(
      page.locator(
        `[data-row-key="${entityFQN}.${table.entityLinkColumnsName[1]}"] .ant-checkbox-checked`
      )
    ).toBeVisible();

    // This Nested column should be closed on initial
    for (let i = 3; i <= 6; i++) {
      await expect(
        page.getByText(table.entityLinkColumnsName[i])
      ).not.toBeVisible();
    }

    // Expand the Column and check if they are disabled
    await page
      .locator(
        `[data-row-key="${entityFQN}.${table.entityLinkColumnsName[2]}"] [data-testid="expand-icon"]`
      )
      .click();

    await page
      .locator(
        `[data-row-key="${entityFQN}.${table.entityLinkColumnsName[4]}"] [data-testid="expand-icon"]`
      )
      .click();

    // This Nested column should be closed on initial
    for (let i = 3; i <= 6; i++) {
      await expect(page.getByText(table.columnsName[i])).toBeVisible();

      await expect(
        page.locator(
          `[data-row-key="${entityFQN}.${table.entityLinkColumnsName[i]}"] .ant-checkbox-input`
        )
      ).toBeDisabled();
    }
  });

  test('should allow adding a semantic with multiple rules', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await table.visitEntityPage(page);
    await page.click('[data-testid="contract"]');
    await page.getByTestId('add-contract-button').click();

    await expect(page.getByTestId('add-contract-card')).toBeVisible();

    await page.getByRole('tab', { name: 'Semantics' }).click();

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
      DATA_CONTRACT_SEMANTICS1.rules[0].field,
      true
    );
    await selectOption(
      page,
      ruleLocator.locator('.rule--operator .ant-select'),
      DATA_CONTRACT_SEMANTICS1.rules[0].operator
    );
    await selectOption(
      page,
      ruleLocator.locator('.rule--value .ant-select'),
      'admin',
      true
    );
    await page.getByRole('button', { name: 'Add New Rule' }).click();

    await expect(page.locator('.group--conjunctions')).toBeVisible();

    const ruleLocator2 = page.locator('.rule').nth(1);
    await selectOption(
      page,
      ruleLocator2.locator('.rule--field .ant-select'),
      DATA_CONTRACT_SEMANTICS1.rules[1].field,
      true
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

    await expect(page.locator('.semantic-rule-editor-view-only')).toBeVisible();
  });

  test('should allow adding a second semantic and verify its rule', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await table.visitEntityPage(page);
    await page.click('[data-testid="contract"]');
    await page.getByTestId('add-contract-button').click();
    await page.getByRole('tab', { name: 'Semantics' }).click();

    await expect(page.getByTestId('add-semantic-button')).toBeDisabled();

    // Add first semantic
    await page.fill('#semantics_0_name', DATA_CONTRACT_SEMANTICS1.name);
    await page.fill(
      '#semantics_0_description',
      DATA_CONTRACT_SEMANTICS1.description
    );
    const ruleLocator = page.locator('.group').nth(0);
    await selectOption(
      page,
      ruleLocator.locator('.group--field .ant-select'),
      DATA_CONTRACT_SEMANTICS1.rules[0].field,
      true
    );
    await selectOption(
      page,
      ruleLocator.locator('.rule--operator .ant-select'),
      DATA_CONTRACT_SEMANTICS1.rules[0].operator
    );
    await selectOption(
      page,
      ruleLocator.locator('.rule--value .ant-select'),
      'admin',
      true
    );
    await page.getByRole('button', { name: 'Add New Rule' }).click();

    await expect(page.locator('.group--conjunctions')).toBeVisible();

    const ruleLocator2 = page.locator('.rule').nth(1);
    await selectOption(
      page,
      ruleLocator2.locator('.rule--field .ant-select'),
      DATA_CONTRACT_SEMANTICS1.rules[1].field,
      true
    );
    await selectOption(
      page,
      ruleLocator2.locator('.rule--operator .ant-select'),
      DATA_CONTRACT_SEMANTICS1.rules[1].operator
    );
    await page.getByTestId('save-semantic-button').click();
    // Add second semantic
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
      DATA_CONTRACT_SEMANTICS2.rules[0].field,
      true
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
  });

  test('should allow editing a semantic and reflect changes', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await table.visitEntityPage(page);
    await page.click('[data-testid="contract"]');
    await page.getByTestId('add-contract-button').click();
    await page.getByRole('tab', { name: 'Semantics' }).click();

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
      DATA_CONTRACT_SEMANTICS1.rules[0].field,
      true
    );
    await selectOption(
      page,
      ruleLocator.locator('.rule--operator .ant-select'),
      DATA_CONTRACT_SEMANTICS1.rules[0].operator
    );
    await selectOption(
      page,
      ruleLocator.locator('.rule--value .ant-select'),
      'admin',
      true
    );
    await page.getByTestId('save-semantic-button').click();
    // Edit semantic
    await page
      .getByTestId('contract-semantics-card-0')
      .locator('.edit-expand-button')
      .click();
    await page.fill('#semantics_0_name', 'Edited Semantic Name');
    await page.getByTestId('save-semantic-button').click();

    await expect(
      page
        .getByTestId('contract-semantics-card-0')
        .locator('.semantic-form-item-title')
    ).toContainText('Edited Semantic Name');
  });

  test('should allow deleting a semantic and remove it from the list', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await table.visitEntityPage(page);
    await page.click('[data-testid="contract"]');
    await page.getByTestId('add-contract-button').click();
    await page.getByRole('tab', { name: 'Semantics' }).click();

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
      DATA_CONTRACT_SEMANTICS1.rules[0].field,
      true
    );
    await selectOption(
      page,
      ruleLocator.locator('.rule--operator .ant-select'),
      DATA_CONTRACT_SEMANTICS1.rules[0].operator
    );
    await selectOption(
      page,
      ruleLocator.locator('.rule--value .ant-select'),
      'admin',
      true
    );
    await page.getByTestId('save-semantic-button').click();
    // Add second semantic
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
      DATA_CONTRACT_SEMANTICS2.rules[0].field,
      true
    );
    await selectOption(
      page,
      ruleLocator3.locator('.rule--operator .ant-select'),
      DATA_CONTRACT_SEMANTICS2.rules[0].operator
    );
    await page.getByTestId('save-semantic-button').click();
    // Delete second semantic
    await page.getByTestId('delete-semantic-1').click();

    await expect(
      page.getByTestId('contract-semantics-card-1')
    ).not.toBeVisible();
  });

  test('Add and update Security and SLA tabs', async ({ page }) => {
    await redirectToHomePage(page);
    await table.visitEntityPage(page);

    await test.step('Add Security and SLA Details', async () => {
      await page.click('[data-testid="contract"]');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await page.getByTestId('add-contract-button').click();

      await page.getByTestId('contract-name').fill(DATA_CONTRACT_DETAILS.name);

      await saveSecurityAndSLADetails(page, DATA_CONTRACT_SECURITY_DETAILS_1);

      await expect(page.getByTestId('contract-title')).toContainText(
        DATA_CONTRACT_DETAILS.name
      );
    });

    await test.step('Validate Security and SLA Details', async () => {
      await page.getByTestId('contract-edit-button').click();
      await validateSecurityAndSLADetails(
        page,
        DATA_CONTRACT_SECURITY_DETAILS_1
      );
    });

    await test.step('Update Security and SLA Details', async () => {
      await saveSecurityAndSLADetails(page, DATA_CONTRACT_SECURITY_DETAILS_2);
    });

    await test.step(
      'Validate the updated values Security and SLA Details',
      async () => {
        await page.getByTestId('contract-edit-button').click();
        await validateSecurityAndSLADetails(
          page,
          DATA_CONTRACT_SECURITY_DETAILS_2
        );
      }
    );
  });
});
