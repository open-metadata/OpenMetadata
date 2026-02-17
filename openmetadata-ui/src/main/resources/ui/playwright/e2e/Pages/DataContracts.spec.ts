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
import { test as base, expect, Page } from '@playwright/test';
import {
  DATA_CONTRACT_CONTAIN_SEMANTICS,
  DATA_CONTRACT_DETAILS,
  DATA_CONTRACT_NOT_CONTAIN_SEMANTICS,
  DATA_CONTRACT_SECURITY_DETAILS_1,
  DATA_CONTRACT_SECURITY_DETAILS_2,
  DATA_CONTRACT_SECURITY_DETAILS_2_VERIFIED_DETAILS,
  DATA_CONTRACT_SEMANTICS1,
  DATA_CONTRACT_SEMANTICS2,
  NEW_TABLE_TEST_CASE,
  ODCS_WITH_SLA_YAML,
  VALID_OM_SIMPLE_YAML,
} from '../../constant/dataContracts';
import { GlobalSettingOptions } from '../../constant/settings';
import { ApiCollectionClass } from '../../support/entity/ApiCollectionClass';
import { ApiEndpointClass } from '../../support/entity/ApiEndpointClass';
import { ChartClass } from '../../support/entity/ChartClass';
import { ContainerClass } from '../../support/entity/ContainerClass';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../../support/entity/DashboardDataModelClass';
import { DatabaseClass } from '../../support/entity/DatabaseClass';
import { DatabaseSchemaClass } from '../../support/entity/DatabaseSchemaClass';
import { DirectoryClass } from '../../support/entity/DirectoryClass';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { FileClass } from '../../support/entity/FileClass';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../support/entity/SearchIndexClass';
import { SpreadsheetClass } from '../../support/entity/SpreadsheetClass';
import { StoredProcedureClass } from '../../support/entity/StoredProcedureClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { WorksheetClass } from '../../support/entity/WorksheetClass';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { selectOption } from '../../utils/advancedSearch';
import {
  clickOutside,
  getApiContext,
  redirectToHomePage,
  toastNotification,
} from '../../utils/common';
import {
  clickAddContractButton,
  clickEditContractButton,
  deleteContract,
  exportContractYaml,
  importOdcsViaDropdown,
  importOMViaDropdown,
  navigateToContractTab,
  openContractActionsDropdown,
  saveAndTriggerDataContractValidation,
  saveContractAndWait,
  saveSecurityAndSLADetails,
  triggerContractValidation,
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
  waitForAllLoadersToDisappear
} from '../../utils/entity';
import { navigateToPersonaWithPagination } from '../../utils/persona';
import { settingClick } from '../../utils/sidebar';
import { test } from '../fixtures/pages';
import { PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ } from '../../constant/config';

// Define entities that support Data Contracts
const entitiesWithDataContracts = [
  TableClass,
  TopicClass,
  DashboardClass,
  DashboardDataModelClass,
  PipelineClass,
  MlModelClass,
  ContainerClass,
  SearchIndexClass,
  StoredProcedureClass,
  ApiEndpointClass,
  ApiCollectionClass,
  ChartClass,
  DirectoryClass,
  FileClass,
  SpreadsheetClass,
  WorksheetClass,
  DatabaseClass,
  DatabaseSchemaClass,
] as const;

// Helper function to check if entity supports specific features
const entitySupportsSchema = (entityType: string): boolean => {
  return ['Table', 'Topic', 'DashboardDataModel', 'ApiEndpoint'].includes(
    entityType
  );
};

const entitySupportsQuality = (entityType: string): boolean => {
  // Currently only Table entity has full quality test support
  return entityType === 'Table';
};

test.describe('Data Contracts', PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ, () => {
  const user = new UserClass();
  test.slow(true);
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await user.create(apiContext);
    await afterAction();
  });

  test.beforeEach('Redirect to Home Page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  entitiesWithDataContracts.forEach((EntityClass) => {
    const entity = new EntityClass();
    const entityType = entity.getType();

    test(`Create Data Contract and validate for ${entityType}`, async ({
      page,
    }) => {
      test.setTimeout(360000);

      const testClassification = new ClassificationClass();
      const testTag = new TagClass({
        classification: testClassification.data.name,
      });
      const testGlossary = new Glossary();
      const testGlossaryTerm = new GlossaryTerm(testGlossary);

      const { apiContext } = await getApiContext(page);
      await entity.create(apiContext);
      await testClassification.create(apiContext);
      await testTag.create(apiContext);
      await testGlossary.create(apiContext);
      await testGlossaryTerm.create(apiContext);

      const contractName = DATA_CONTRACT_DETAILS.name;

      await test.step('Redirect to Home Page and visit entity', async () => {
        await redirectToHomePage(page);
        await entity.visitEntityPage(page);
      });

      await test.step(
        'Open contract section and start adding contract',
        async () => {
          await navigateToContractTab(page);
          await clickAddContractButton(page);
        }
      );

      await test.step('Fill Contract Details form', async () => {
        await page.getByTestId('contract-name').fill(contractName);
        await page.fill(
          '.om-block-editor[contenteditable="true"]',
          DATA_CONTRACT_DETAILS.description
        );

        // Add owner using created user to verify displayName is shown in UserTag
        await addOwnerWithoutValidation({
          page,
          owner: user.responseData.displayName,
          type: 'Users',
          initiatorId: 'select-owners',
        });

        // Verify the UserTag shows the user's displayName (not name)
        await expect(page.getByTestId('user-tag')).toBeVisible();
        await expect(
          page.getByTestId('user-tag').getByText(user.responseData.displayName)
        ).toBeVisible();
      });

      await test.step('Fill the Terms of Service Detail', async () => {
        // Scope to contract card to avoid conflicts with entity page tabs
        const contractCard = page.getByTestId('add-contract-card');
        await contractCard
          .getByRole('tab', { name: 'Terms of Service' })
          .click();
        await page.fill(
          '.om-block-editor .has-focus',
          DATA_CONTRACT_DETAILS.termsOfService
        );
      });

      // Schema selection step - only for entities with schema
      if (entitySupportsSchema(entityType)) {
        await test.step('Fill Contract Schema form', async () => {
          // Scope to contract card to avoid conflicts with entity page tabs (e.g., Topic, ApiEndpoint)
          const contractCard = page.getByTestId('add-contract-card');
          await contractCard.getByRole('tab', { name: 'Schema' }).click();

          // Check if there are schema fields to select
          const hasSchemaFields = await page
            .locator('input[type="checkbox"][aria-label="Select all"]')
            .isVisible()
            .catch(() => false);

          if (hasSchemaFields) {
            await page
              .locator('input[type="checkbox"][aria-label="Select all"]')
              .check();

            await expect(
              page.getByRole('checkbox', { name: 'Select all' })
            ).toBeChecked();
          }
        });
      }

      await test.step('Fill first Contract Semantics form', async () => {
        // Scope to contract card to avoid conflicts with entity page tabs
        const contractCard = page.getByTestId('add-contract-card');
        await contractCard.getByRole('tab', { name: 'Semantics' }).click();

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
          user.responseData.displayName,
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
          page.getByTestId('contract-status-card-item-semantics-status')
        ).toContainText('Failed');
        await expect(
          page.getByTestId('data-contract-latest-result-btn')
        ).toContainText('Contract Failed');

        await expect(page.getByText('Terms of Service')).toBeVisible();
        await expect(page.getByTestId('contract-sla-card')).not.toBeVisible();

        await addOwner({
          page,
          owner: user.responseData.displayName,
          type: 'Users',
          endpoint: entity.endpoint,
          dataTestId: 'data-assets-header',
        });

        await triggerContractValidation(page);

        await toastNotification(
          page,
          'Contract validation trigger successfully.'
        );

        await page.reload();

        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await expect(
          page.getByTestId('contract-status-card-item-semantics-status')
        ).toContainText('Passed');
      });

      // Quality tests - only for entities that support quality
      if (entitySupportsQuality(entityType)) {
        await test.step(
          'Add table test case and validate for quality',
          async () => {
            await clickEditContractButton(page);

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

            await page.getByRole('heading', { name: 'Tags' }).click();

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

            await page.getByRole('heading', { name: 'Glossary Terms' }).click();

            await page.getByTestId('pipeline-name').fill('test-pipeline');

            await page
              .locator('.selection-title', { hasText: 'On Demand' })
              .click();

            await expect(page.locator('.expression-text')).toContainText(
              'Pipeline will only be triggered manually.'
            );

            const pipelineResponse = page.waitForResponse(
              '/api/v1/services/ingestionPipelines'
            );
            const deploy = page.waitForResponse(
              '/api/v1/services/ingestionPipelines/deploy/*'
            );

            const testCaseResponse = page.waitForResponse(
              '/api/v1/dataQuality/testCases'
            );
            await page.click('[data-testid="create-btn"]');
            await testCaseResponse;
            await pipelineResponse;
            await deploy;

            await expect(page.getByRole('dialog')).not.toBeVisible();

            await page.waitForSelector('[data-testid="loader"]', {
              state: 'detached',
            });

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
            await entity.visitEntityPage(page);

            await page.getByRole('tab').getByTestId('contract').click();

            await clickEditContractButton(page);

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
      }

      // TODO: Add a step to validate the test suite is removed from observability -> bundle test suites

      await test.step('Verify YAML view', async () => {
        await entity.visitEntityPage(page);

        await page.getByRole('tab').getByTestId('contract').click();

        await page.getByTestId('contract-view-switch-tab-yaml').click();

        await expect(page.getByTestId('code-mirror-container')).toBeVisible();
        await expect(
          page
            .getByTestId('code-mirror-container')
            .getByTestId('query-copy-button')
        ).toBeVisible();
      });

      await test.step('Export YAML', async () => {
        const filename = await exportContractYaml(page, 'native');
        expect(filename).toBeTruthy();
      });

      await test.step('Export ODCS YAML', async () => {
        const filename = await exportContractYaml(page, 'odcs');
        expect(filename).toBeTruthy();
        await toastNotification(page, 'ODCS Contract exported successfully');
      });

      await test.step('Edit and Validate Contract data', async () => {
        await clickEditContractButton(page);

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

        if (entitySupportsSchema(entityType)) {
          // Move to Schema Tab
          await page
            .getByTestId('add-contract-card')
            .getByText('Schema')
            .click();

          await page.waitForSelector('[data-testid="loader"]', {
            state: 'detached',
          });

          await page.getByRole('checkbox', { name: 'Select all' }).click();

          await expect(
            page.getByRole('checkbox', { name: 'Select all' })
          ).not.toBeChecked();
        }

        // Move to Semantic Tab - scope to contract card to avoid conflicts with entity page tabs
        await page
          .getByTestId('add-contract-card')
          .getByRole('tab', { name: 'Semantics' })
          .click();

        await page.getByTestId('delete-condition-button').last().click();

        await expect(
          page.getByTestId('query-builder-form-field').getByText('Description')
        ).not.toBeVisible();

        await expect(page.getByTestId('save-contract-btn')).not.toBeDisabled();

        await saveContractAndWait(page);

        // Validate the Updated Values
        await expect(page.getByTestId('contract-title')).toContainText(
          DATA_CONTRACT_DETAILS.displayName
        );

        await expect(
          page.getByTestId('contract-owner-card').getByTestId('admin')
        ).toBeVisible();

        // Description with header
        await expect(page.getByText('DescriptionModified Data')).toBeVisible();

        if (entitySupportsSchema(entityType)) {
          await expect(page.getByTestId('schema-table-card')).not.toBeVisible();
        }
      });

      await test.step('Delete contract', async () => {
        const contractRefreshResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/dataContracts/entity') &&
            response.request().method() === 'GET'
        );

        await deleteContract(page, DATA_CONTRACT_DETAILS.name);

        await toastNotification(page, '"Contract" deleted successfully!');

        await contractRefreshResponse;
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await expect(page.getByTestId('no-data-placeholder')).toBeVisible();
        await expect(page.getByTestId('add-contract-button')).toBeVisible();
      });

      await test.step('Import contract from ODCS YAML', async () => {
        await importOdcsViaDropdown(page, ODCS_WITH_SLA_YAML, 'contract.yaml');

        await toastNotification(page, 'ODCS Contract imported successfully');

        await expect(page.getByTestId('contract-title')).toBeVisible();

        await expect(page.getByTestId('contract-sla-card')).toBeVisible();
      });

      await test.step('Delete imported contract', async () => {
        const contractRefreshResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/dataContracts/entity') &&
            response.request().method() === 'GET'
        );

        await deleteContract(page);

        await toastNotification(page, '"Contract" deleted successfully!');

        await contractRefreshResponse;
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await expect(page.getByTestId('no-data-placeholder')).toBeVisible();
      });

      await test.step('Import contract from OM YAML', async () => {
        await importOMViaDropdown(
          page,
          VALID_OM_SIMPLE_YAML,
          'om-contract.yaml'
        );

        await toastNotification(page, 'Contract imported successfully');

        await expect(page.getByTestId('contract-title')).toBeVisible();

        await expect(page.getByTestId('contract-sla-card')).toBeVisible();
      });

      await test.step('Export OM YAML', async () => {
        const filename = await exportContractYaml(page, 'native');
        expect(filename).toBeTruthy();
        await toastNotification(page, 'Contract exported successfully');
      });

      await test.step('Delete OM imported contract', async () => {
        const contractRefreshResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/dataContracts/entity') &&
            response.request().method() === 'GET'
        );

        await deleteContract(page);

        const response = await contractRefreshResponse;
        expect(response.status()).toBe(404);
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await expect(page.getByTestId('no-data-placeholder')).toBeVisible();
      });
    });
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

        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });
      });

      await test.step(
        'Open contract section and start adding contract',
        async () => {
          await navigateToContractTab(page);
          await clickAddContractButton(page);
        }
      );

      await test.step('Fill Contract Details form', async () => {
        await page
          .getByTestId('contract-name')
          .fill(DATA_CONTRACT_DETAILS.name);
      });

      await test.step('Fill Contract Schema form', async () => {
        const columnResponse = page.waitForResponse(
          '/api/v1/tables/name/sample_data.ecommerce_db.shopify.performance_test_table/columns?**'
        );

        await page
          .getByTestId('add-contract-card')
          .getByRole('tab', { name: 'Schema' })
          .click();

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
          '/api/v1/tables/name/sample_data.ecommerce_db.shopify.performance_test_table/columns?**'
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
        await page.getByTestId('save-contract-btn').click();
        await page.waitForResponse('/api/v1/dataContracts/*');

        // Check all schema from 1 to 50, and 10 is the max-pagination chip
        await expect(page.getByTitle('10')).toBeVisible();

        for (let i = 1; i <= 50; i++) {
          if (i < 10) {
            await expect(page.getByText(`test_col_000${i}`)).toBeVisible();
          } else {
            await expect(page.getByText(`test_col_00${i}`)).toBeVisible();
          }

          // Click "Next Page" after every 5 checks
          if (i % 5 === 0) {
            // Schema from 51 to 75 Should not be visible
            for (let i = 51; i <= 75; i++) {
              await expect(page.getByText(`test_col_00${i}`)).not.toBeVisible();
            }
            await page.getByRole('listitem', { name: 'Next Page' }).click();
          }
        }
      });

      await test.step('Update the Schema and Validate', async () => {
        await clickEditContractButton(page);

        const columnResponse = page.waitForResponse(
          'api/v1/tables/name/sample_data.ecommerce_db.shopify.performance_test_table/columns?**'
        );

        await page
          .getByTestId('add-contract-card')
          .getByRole('tab', { name: 'Schema' })
          .click();

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

        await saveContractAndWait(page);

        // Check all schema from 26 to 50
        for (let i = 26; i <= 50; i++) {
          await expect(page.getByText(`test_col_00${i}`)).toBeVisible();

          // Click "Next Page" after every 5 checks
          if (i % 5 === 0) {
            await page.getByRole('listitem', { name: 'Next Page' }).click();
          }
        }
      });

      await test.step(
        'Re-select some columns on page 1, save and validate',
        async () => {
          await page.getByTestId('manage-contract-actions').click();

          await page.waitForSelector('.contract-action-dropdown', {
            state: 'visible',
          });
          await page.getByTestId('contract-edit-button').click();

          const columnResponse = page.waitForResponse(
            'api/v1/tables/name/sample_data.ecommerce_db.shopify.performance_test_table/columns?**'
          );

          await page
            .getByTestId('add-contract-card')
            .getByRole('tab', { name: 'Schema' })
            .click();

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

          await saveContractAndWait(page);

          // Check all schema from 1 to 5 and then, the one we didn't touch 26 to 50
          for (let i = 26; i <= 50; i++) {
            await expect(page.getByText(`test_col_00${i}`)).toBeVisible();

            // Click "Next Page" after every 5 checks
            if (i % 5 === 0) {
              await page.getByRole('listitem', { name: 'Next Page' }).click();
            }
          }

          await page.getByRole('listitem', { name: 'Next Page' }).click();

          for (let i = 1; i <= 5; i++) {
            await expect(page.getByText(`test_col_000${i}`)).toBeVisible();
          }
        }
      );
    } finally {
      await test.step('Delete contract', async () => {
        await redirectToHomePage(page);
        await page.goto(`/table/${entityFQN}`);

        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await navigateToContractTab(page);

        await deleteContract(page);

        await toastNotification(page, '"Contract" deleted successfully!');

        // Wait for loaders to disappear and verify page is ready
        await waitForAllLoadersToDisappear(page);

        await expect(page.getByTestId('no-data-placeholder')).toBeVisible({
          timeout: 10000,
        });
        await expect(page.getByTestId('add-contract-button')).toBeVisible();
      });
    }
  });

  test('Semantic with Contains Operator should work for Tier, Tag and Glossary', async ({
    page,
  }) => {
    test.slow(true);

    const table = new TableClass();
    const testClassification = new ClassificationClass();
    const testTag = new TagClass({
      classification: testClassification.data.name,
    });
    const testGlossary = new Glossary();
    const testGlossaryTerm = new GlossaryTerm(testGlossary);

    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);
    await testClassification.create(apiContext);
    await testTag.create(apiContext);
    await testGlossary.create(apiContext);
    await testGlossaryTerm.create(apiContext);

    await redirectToHomePage(page);
    await table.visitEntityPage(page);
    await navigateToContractTab(page);

    await page.getByTestId('add-contract-button').click();

    await expect(page.getByTestId('add-contract-menu')).toBeVisible();
    await page.getByTestId('create-contract-button').click();

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

    await clickOutside(page);

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

    await clickOutside(page);

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
      page.getByTestId('contract-status-card-item-semantics-status')
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
    await assignGlossaryTerm(
      page,
      testGlossaryTerm.responseData,
      'Add',
      EntityTypeEndpoint.Table
    );

    await navigateToContractTab(page);

    await triggerContractValidation(page);

    await toastNotification(page, 'Contract validation trigger successfully.');

    await page.reload();

    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await expect(
      page.getByTestId('contract-status-card-item-semantics-status')
    ).toContainText('Passed');
  });

  test('Semantic with Not_Contains Operator should work for Tier, Tag and Glossary', async ({
    page,
  }) => {
    test.slow(true);

    const table = new TableClass();
    const testClassification = new ClassificationClass();
    const testTag = new TagClass({
      classification: testClassification.data.name,
    });
    const testGlossary = new Glossary();
    const testGlossaryTerm = new GlossaryTerm(testGlossary);

    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);
    await testClassification.create(apiContext);
    await testTag.create(apiContext);
    await testGlossary.create(apiContext);
    await testGlossaryTerm.create(apiContext);

    await redirectToHomePage(page);
    await table.visitEntityPage(page);
    await navigateToContractTab(page);

    await page.getByTestId('add-contract-button').click();

    await expect(page.getByTestId('add-contract-menu')).toBeVisible();
    await page.getByTestId('create-contract-button').click();

    await expect(page.getByTestId('add-contract-card')).toBeVisible();

    await expect(page.getByTestId('add-contract-card')).toBeVisible();

    await page.getByTestId('contract-name').fill(DATA_CONTRACT_DETAILS.name);

    await page.getByRole('tab', { name: 'Semantics' }).click();

    await expect(page.getByTestId('add-semantic-button')).toBeDisabled();

    await page.fill(
      '#semantics_0_name',
      DATA_CONTRACT_NOT_CONTAIN_SEMANTICS.name
    );
    await page.fill(
      '#semantics_0_description',
      DATA_CONTRACT_NOT_CONTAIN_SEMANTICS.description
    );
    const ruleLocator = page.locator('.group').nth(0);
    await selectOption(
      page,
      ruleLocator.locator('.group--field .ant-select'),
      DATA_CONTRACT_NOT_CONTAIN_SEMANTICS.rules[0].field,
      true
    );
    await selectOption(
      page,
      ruleLocator.locator('.rule--operator .ant-select'),
      DATA_CONTRACT_NOT_CONTAIN_SEMANTICS.rules[0].operator
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
      DATA_CONTRACT_NOT_CONTAIN_SEMANTICS.rules[1].field,
      true
    );
    await selectOption(
      page,
      ruleLocator2.locator('.rule--operator .ant-select'),
      DATA_CONTRACT_NOT_CONTAIN_SEMANTICS.rules[1].operator
    );

    await selectOption(
      page,
      ruleLocator2.locator('.rule--value .ant-select'),
      testTag.responseData.name,
      true
    );

    await clickOutside(page);

    await page.getByRole('button', { name: 'Add New Rule' }).click();

    await expect(page.locator('.group--conjunctions')).toBeVisible();

    const ruleLocator3 = page.locator('.rule').nth(2);
    await selectOption(
      page,
      ruleLocator3.locator('.rule--field .ant-select'),
      DATA_CONTRACT_NOT_CONTAIN_SEMANTICS.rules[2].field,
      true
    );
    await selectOption(
      page,
      ruleLocator3.locator('.rule--operator .ant-select'),
      DATA_CONTRACT_NOT_CONTAIN_SEMANTICS.rules[2].operator
    );

    await selectOption(
      page,
      ruleLocator3.locator('.rule--value .ant-select'),
      testGlossaryTerm.responseData.name,
      true
    );

    await clickOutside(page);

    await page.getByTestId('save-semantic-button').click();

    await expect(
      page
        .getByTestId('contract-semantics-card-0')
        .locator('.semantic-form-item-title')
    ).toContainText(DATA_CONTRACT_NOT_CONTAIN_SEMANTICS.name);
    await expect(
      page
        .getByTestId('contract-semantics-card-0')
        .locator('.semantic-form-item-description')
    ).toContainText(DATA_CONTRACT_NOT_CONTAIN_SEMANTICS.description);

    await page.locator('.expand-collapse-icon').click();

    await expect(page.locator('.semantic-rule-editor-view-only')).toBeVisible();

    // save and trigger contract validation
    await saveAndTriggerDataContractValidation(page, true);

    await expect(
      page.getByTestId('contract-status-card-item-semantics-status')
    ).toContainText('Passed');

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
    await assignGlossaryTerm(
      page,
      testGlossaryTerm.responseData,
      'Add',
      EntityTypeEndpoint.Table
    );

    await navigateToContractTab(page);

    await triggerContractValidation(page);

    await toastNotification(page, 'Contract validation trigger successfully.');

    await page.reload();

    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await expect(
      page.getByTestId('contract-status-card-item-semantics-status')
    ).toContainText('Failed');

    await expect(
      page.getByTestId('data-contract-latest-result-btn')
    ).toContainText('Contract Failed');
  });

  test('Nested Column should not be selectable', async ({ page }) => {
    test.slow(true);

    const { apiContext } = await getApiContext(page);
    const table = new TableClass();
    await table.create(apiContext);

    const entityFQN = table.entityResponseData.fullyQualifiedName;
    await redirectToHomePage(page);
    await table.visitEntityPage(page);
    await navigateToContractTab(page);

    await page.getByTestId('add-contract-button').click();

    await expect(page.getByTestId('add-contract-menu')).toBeVisible();
    await page.getByTestId('create-contract-button').click();

    await expect(page.getByTestId('add-contract-card')).toBeVisible();

    await page.getByTestId('contract-name').fill(DATA_CONTRACT_DETAILS.name);

    await page.getByRole('tab', { name: 'Schema' }).click();

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

  test('Operation on Old Schema Columns Contract', async ({ page }) => {
    test.slow(true);

    const { apiContext } = await getApiContext(page);
    const table = new TableClass();
    await table.create(apiContext);

    await redirectToHomePage(page);
    await table.visitEntityPage(page);

    const entityFQN = table.entityResponseData.fullyQualifiedName;

    await navigateToContractTab(page);

    await page.getByTestId('add-contract-button').click();

    await expect(page.getByTestId('add-contract-menu')).toBeVisible();
    await page.getByTestId('create-contract-button').click();

    await expect(page.getByTestId('add-contract-card')).toBeVisible();

    await page.getByTestId('contract-name').fill(DATA_CONTRACT_DETAILS.name);

    await page.getByRole('tab', { name: 'Schema' }).click();

    await page
      .locator('input[type="checkbox"][aria-label="Select all"]')
      .check();

    await expect(
      page.getByRole('checkbox', { name: 'Select all' })
    ).toBeChecked();

    // save and trigger contract validation
    await saveAndTriggerDataContractValidation(page, true);

    await expect(
      page.getByTestId('contract-status-card-item-schema-status')
    ).toContainText('Passed');

    // Modify the first 2 columns with PATCH API
    await table.patch({
      apiContext,
      patchData: [
        {
          op: 'replace',
          path: '/columns/0/name',
          value: 'new_column_0',
        },
        {
          op: 'replace',
          path: '/columns/0/fullyQualifiedName',
          value: `${table.entityResponseData.fullyQualifiedName}.new_column_0`,
        },
        {
          op: 'replace',
          path: '/columns/1/name',
          value: 'new_column_1',
        },
        {
          op: 'replace',
          path: '/columns/1/fullyQualifiedName',
          value: `${table.entityResponseData.fullyQualifiedName}.new_column_1`,
        },
      ],
    });

    // Run Contract After Schema Change should Fail
    await page.getByTestId('manage-contract-actions').click();

    await page.waitForSelector('.contract-action-dropdown', {
      state: 'visible',
    });

    await page.getByTestId('contract-run-now-button').click();

    await page.reload();

    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await expect(
      page.getByTestId('contract-status-card-item-schema-status')
    ).toContainText('Failed');
    await expect(
      page.getByTestId('data-contract-latest-result-btn')
    ).toContainText('Contract Failed');

    await expect(
      page.getByTestId(`schema-column-${table.entityLinkColumnsName[0]}-failed`)
    ).toBeVisible();

    await expect(
      page.getByTestId(`schema-column-${table.entityLinkColumnsName[1]}-failed`)
    ).toBeVisible();

    // Check the Columns Present in Contract Schema Form Component

    await page.getByTestId('manage-contract-actions').click();

    await page.waitForSelector('.contract-action-dropdown', {
      state: 'visible',
    });
    await page.getByTestId('contract-edit-button').click();

    await page.getByRole('tab', { name: 'Schema' }).click();

    // Old column should be visible and we should un-check them
    await page
      .locator(
        `[data-row-key="${entityFQN}.${table.entityLinkColumnsName[0]}"] .ant-checkbox-input`
      )
      .click();

    await page
      .locator(
        `[data-row-key="${entityFQN}.${table.entityLinkColumnsName[1]}"] .ant-checkbox-input`
      )
      .click();

    // Select newly added column
    await page
      .locator(`[data-row-key="${entityFQN}.new_column_0"] .ant-checkbox-input`)
      .click();
    await page
      .locator(`[data-row-key="${entityFQN}.new_column_1"] .ant-checkbox-input`)
      .click();

    // save and trigger contract validation
    await saveAndTriggerDataContractValidation(page, true);

    await expect(
      page.getByTestId('contract-status-card-item-schema-status')
    ).toContainText('Passed');
  });

  test('should allow adding a semantic with multiple rules', async ({
    page,
  }) => {
    test.slow(true);

    const { apiContext } = await getApiContext(page);
    const table = new TableClass();
    await table.create(apiContext);

    await redirectToHomePage(page);
    await table.visitEntityPage(page);
    await navigateToContractTab(page);

    await page.getByTestId('add-contract-button').click();

    await expect(page.getByTestId('add-contract-menu')).toBeVisible();
    await page.getByTestId('create-contract-button').click();

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
    const { apiContext } = await getApiContext(page);
    const table = new TableClass();
    await table.create(apiContext);

    await redirectToHomePage(page);
    await table.visitEntityPage(page);
    await page.click('[data-testid="contract"]');
    await page.getByTestId('add-contract-button').click();
    await expect(page.getByTestId('add-contract-menu')).toBeVisible();
    await page.getByTestId('create-contract-button').click();

    await expect(page.getByTestId('add-contract-card')).toBeVisible();

    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

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
    const { apiContext } = await getApiContext(page);
    const table = new TableClass();
    await table.create(apiContext);

    await redirectToHomePage(page);
    await table.visitEntityPage(page);
    await navigateToContractTab(page);

    await page.getByTestId('add-contract-button').click();

    await expect(page.getByTestId('add-contract-menu')).toBeVisible();
    await page.getByTestId('create-contract-button').click();

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
    const { apiContext } = await getApiContext(page);
    const table = new TableClass();
    await table.create(apiContext);

    await redirectToHomePage(page);
    await table.visitEntityPage(page);
    await navigateToContractTab(page);

    await page.getByTestId('add-contract-button').click();

    await expect(page.getByTestId('add-contract-menu')).toBeVisible();
    await page.getByTestId('create-contract-button').click();

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
    test.slow(true);

    const { apiContext } = await getApiContext(page);
    const table = new TableClass();
    await table.create(apiContext);

    await test.step('Add Security and SLA Details', async () => {
      await redirectToHomePage(page);
      await table.visitEntityPage(page);

      await navigateToContractTab(page);

      await page.getByTestId('add-contract-button').click();

      await expect(page.getByTestId('add-contract-menu')).toBeVisible();
      await page.getByTestId('create-contract-button').click();

      await expect(page.getByTestId('add-contract-card')).toBeVisible();

      await page.getByTestId('contract-name').fill(DATA_CONTRACT_DETAILS.name);

      await saveSecurityAndSLADetails(
        page,
        DATA_CONTRACT_SECURITY_DETAILS_1,
        table,
        true
      );

      await expect(page.getByTestId('contract-title')).toContainText(
        DATA_CONTRACT_DETAILS.name
      );
    });

    await test.step('Validate Security and SLA Details', async () => {
      // Validate on Contract Detail Page For Security
      await expect(page.getByTestId('security-card')).toBeVisible();

      await expect(
        page.getByTestId('contract-security-classification')
      ).toContainText(DATA_CONTRACT_SECURITY_DETAILS_1.dataClassificationName);

      await expect(
        page.getByTestId('contract-security-access-policy-0')
      ).toContainText(
        DATA_CONTRACT_SECURITY_DETAILS_1.consumers.accessPolicyName
      );

      for (const identity of DATA_CONTRACT_SECURITY_DETAILS_1.consumers
        .identities) {
        await expect(
          page.getByTestId(`contract-security-identities-0-${identity}`)
        ).toBeVisible();
      }

      for (const filter of DATA_CONTRACT_SECURITY_DETAILS_1.consumers
        .row_filters) {
        await expect(
          page.getByTestId(`contract-security-rowFilter-0-${filter.index}`)
        ).toContainText(
          `${table.columnsName[filter.index]} = ${filter.values[0]},${filter.values[1]
          }`
        );
      }

      // Validate on Contract Detail Page
      await expect(page.getByTestId('contract-sla-card')).toBeVisible();
      await expect(
        page.getByText('Freshness: Data must be updated within the last 10 day')
      ).toBeVisible();
      await expect(
        page.getByText(
          'Completeness: Data availability is scheduled for 12:15 each day'
        )
      ).toBeVisible();
      await expect(
        page.getByText('Latency: Query response must be under 20 hour')
      ).toBeVisible();
      await expect(
        page.getByText('Retention: Data should be retained for 30 week')
      ).toBeVisible();

      await expect(
        page.getByText(
          `Column: Represents data refresh time corresponding to ${table.columnsName[0]}`
        )
      ).toBeVisible();

      await openContractActionsDropdown(page);
      await page.getByTestId('contract-edit-button').click();
      await validateSecurityAndSLADetails(
        page,
        DATA_CONTRACT_SECURITY_DETAILS_1,
        table
      );
    });

    await test.step('Update Security and SLA Details', async () => {
      await saveSecurityAndSLADetails(
        page,
        DATA_CONTRACT_SECURITY_DETAILS_2,
        table,
        false,
        true
      );
    });

    await test.step(
      'Validate the updated values Security and SLA Details',
      async () => {
        const updatedContractSecurityData = {
          ...DATA_CONTRACT_SECURITY_DETAILS_2,
          ...DATA_CONTRACT_SECURITY_DETAILS_2_VERIFIED_DETAILS,
        };

        // Validate on Contract Detail Page For Security
        await expect(page.getByTestId('security-card')).toBeVisible();

        await expect(
          page.getByTestId('contract-security-classification')
        ).toContainText(updatedContractSecurityData.dataClassificationName);

        await expect(
          page.getByTestId('contract-security-access-policy-0')
        ).toContainText(updatedContractSecurityData.consumers.accessPolicyName);

        for (const identity of updatedContractSecurityData.consumers
          .identities) {
          await expect(
            page.getByTestId(`contract-security-identities-0-${identity}`)
          ).toBeVisible();
        }

        for (const filter of updatedContractSecurityData.consumers
          .row_filters) {
          await expect(
            page.getByTestId(`contract-security-rowFilter-0-${filter.index}`)
          ).toContainText(
            `${table.columnsName[filter.index]} = ${filter.values[0]},${filter.values[1]
            },${filter.values[2]},${filter.values[3]}`
          );
        }

        // Validate the updated data on Contract Detail Page
        await expect(page.getByTestId('contract-sla-card')).toBeVisible();
        await expect(
          page.getByText(
            'Freshness: Data must be updated within the last 50 hour'
          )
        ).toBeVisible();
        await expect(
          page.getByText(
            'Completeness: Data availability is scheduled for 05:34 each day'
          )
        ).toBeVisible();
        await expect(
          page.getByText('Latency: Query response must be under 60 minute')
        ).toBeVisible();
        await expect(
          page.getByText('Retention: Data should be retained for 70 year')
        ).toBeVisible();

        await expect(
          page.getByText(
            `Column: Represents data refresh time corresponding to ${table.columnsName[1]}`
          )
        ).toBeVisible();

        await clickEditContractButton(page);
        await validateSecurityAndSLADetails(
          page,
          {
            ...DATA_CONTRACT_SECURITY_DETAILS_2,
            ...DATA_CONTRACT_SECURITY_DETAILS_2_VERIFIED_DETAILS,
          },
          table,
          true
        );
      }
    );

    await test.step('Validate after removing security policies', async () => {
      await page.getByRole('tab', { name: 'Security' }).click();

      await page.getByTestId('cancel-policy-button').click();
      await page.getByTestId('delete-policy-0').click();

      const saveContractResponse = page.waitForResponse(
        '/api/v1/dataContracts/*'
      );
      await page.getByTestId('save-contract-btn').click();
      await saveContractResponse;

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await expect(
        page.getByTestId('contract-security-policy-container')
      ).not.toBeVisible();

      await openContractActionsDropdown(page);

      await page.getByTestId('contract-edit-button').click();

      await page.getByRole('tab', { name: 'Security' }).click();

      await expect(page.getByTestId('add-policy-button')).not.toBeDisabled();

      await page.getByTestId('add-policy-button').click();

      await expect(page.getByTestId('access-policy-input-0')).toBeVisible();
      await expect(page.getByTestId('columnName-input-0-0')).toBeVisible();
    });
  });

  test('ODCS Import Modal with Merge Mode should preserve existing contract ID', async ({
    page,
  }) => {
    test.slow(true);

    const { apiContext } = await getApiContext(page);
    const table = new TableClass();
    await table.create(apiContext);

    try {
      await test.step('Create initial contract via ODCS import', async () => {
        await redirectToHomePage(page);
        await table.visitEntityPage(page);
        await navigateToContractTab(page);
        await importOdcsViaDropdown(page, ODCS_WITH_SLA_YAML, 'initial.yaml');

        await toastNotification(page, 'ODCS Contract imported successfully');

        await expect(page.getByTestId('contract-title')).toBeVisible();
        await expect(page.getByTestId('contract-sla-card')).toBeVisible();
      });

      await test.step(
        'Import again via modal with merge mode (default)',
        async () => {
          // Click to import via the modal
          await page.getByTestId('manage-contract-actions').click();

          await page.waitForSelector('.contract-action-dropdown', {
            state: 'visible',
          });

          await page.getByTestId('import-odcs-contract-button').click();

          // Modal should be visible
          await page.getByTestId('import-contract-modal').waitFor();

          // Upload a new ODCS file with different content
          const dropzone = page.locator('.import-content-wrapper');
          await dropzone.click();

          const fileInput = page.getByTestId('file-upload-input');
          await fileInput.setInputFiles({
            name: 'update.yaml',
            mimeType: 'application/yaml',
            buffer: Buffer.from(`apiVersion: v3.1.0
kind: DataContract
id: merge-update
name: Updated via Merge
version: "2.0.0"
status: active
description:
  purpose: Updated description via merge mode
`),
          });

          // Modal should show "existing contract detected" warning and merge/replace options
          await expect(
            page.getByTestId('existing-contract-warning')
          ).toBeVisible();

          // Verify merge is default selected
          const mergeRadio = page.locator('input[type="radio"][value="merge"]');
          await expect(mergeRadio).toBeVisible();
          await expect(mergeRadio).toBeChecked();

          // Import with merge mode
          const importResponse = page.waitForResponse(
            '/api/v1/dataContracts/odcs/yaml**mode=merge**'
          );

          await page.getByRole('button', { name: 'Import' }).click();
          await importResponse;

          await toastNotification(page, 'ODCS Contract imported successfully');

          // SLA should still be preserved from original import (merge mode preserves fields)
          await expect(page.getByTestId('contract-sla-card')).toBeVisible();
        }
      );
    } finally {
      await test.step('Cleanup: Delete contract', async () => {
        await deleteContract(page);
      });
    }
  });

  test('ODCS Import Modal with Replace Mode should overwrite all fields', async ({
    page,
  }) => {
    test.slow(true);

    const { apiContext } = await getApiContext(page);
    const table = new TableClass();
    await table.create(apiContext);

    try {
      await test.step(
        'Create initial contract with SLA via ODCS import',
        async () => {
          await redirectToHomePage(page);
          await table.visitEntityPage(page);
          await navigateToContractTab(page);
          await importOdcsViaDropdown(page, ODCS_WITH_SLA_YAML, 'initial.yaml');

          await toastNotification(page, 'ODCS Contract imported successfully');

          // Verify SLA is present
          await expect(page.getByTestId('contract-sla-card')).toBeVisible();
        }
      );

      await test.step('Import again via modal with replace mode', async () => {
        await page.getByTestId('manage-contract-actions').click();

        await page.waitForSelector('.contract-action-dropdown', {
          state: 'visible',
        });

        await page.getByTestId('import-odcs-contract-button').click();

        // Modal should be visible
        await page.getByTestId('import-contract-modal').waitFor();

        // Upload a new ODCS file with different content
        const dropzone = page.locator('.import-content-wrapper');
        await dropzone.click();

        const fileInput = page.getByTestId('file-upload-input');
        await fileInput.setInputFiles({
          name: 'replace.yaml',
          mimeType: 'application/yaml',
          buffer: Buffer.from(`apiVersion: v3.1.0
kind: DataContract
id: replace-contract
name: Replaced Contract
version: "3.0.0"
status: active
description:
  purpose: Completely replaced via replace mode
`),
        });

        await expect(
          page.getByTestId('existing-contract-warning')
        ).toBeVisible();

        // Select replace mode
        const replaceRadio = page.locator(
          'input[type="radio"][value="replace"]'
        );
        await expect(replaceRadio).toBeVisible();
        await replaceRadio.click();

        const importResponse = page.waitForResponse(
          '/api/v1/dataContracts/odcs/yaml**mode=replace**'
        );

        await page.getByRole('button', { name: 'Import' }).click();
        await importResponse;

        await toastNotification(page, 'ODCS Contract imported successfully');

        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        // SLA should NOT be visible (replace mode clears fields not in import)
        await expect(page.getByTestId('contract-sla-card')).not.toBeVisible();
      });
    } finally {
      await test.step('Cleanup: Delete contract', async () => {
        await deleteContract(page);
      });
    }
  });
});

entitiesWithDataContracts.forEach((EntityClass) => {
  const adminUser = new UserClass();
  const entity = new EntityClass();
  const entityType = entity.getType();

  const testPersona = base.extend<{ page: Page }>({
    page: async ({ browser }, use) => {
      const adminPage = await browser.newPage();
      await adminUser.login(adminPage);
      await use(adminPage);
      await adminPage.close();
    },
  });

  testPersona.describe(`Data Contracts With Persona ${entityType}`, () => {
    test.beforeAll('Setup pre-requests', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await afterAction();
    });

    testPersona(
      'Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona',
      async ({ page }) => {
        testPersona.slow(true);
        const { apiContext } = await getApiContext(page);
        const persona = new PersonaClass();
        await entity.create(apiContext);
        await persona.create(apiContext);
        await adminUser.patch({
          apiContext,
          patchData: [
            {
              op: 'add',
              path: '/personas/0',
              value: {
                id: persona.responseData.id,
                name: persona.responseData.name,
                displayName: persona.responseData.displayName,
                fullyQualifiedName: persona.responseData.fullyQualifiedName,
                type: 'persona',
              },
            },
            {
              op: 'add',
              path: '/defaultPersona',
              value: {
                id: persona.responseData.id,
                name: persona.responseData.name,
                displayName: persona.responseData.displayName,
                fullyQualifiedName: persona.responseData.fullyQualifiedName,
                type: 'persona',
              },
            },
          ],
        });

        try {
          await testPersona.step(
            'Create Data Contract in Table and validate it fails',
            async () => {
              await entity.visitEntityPage(page);

              // Open contract section and start adding contract
              await navigateToContractTab(page);

              await expect(
                page.getByTestId('no-data-placeholder')
              ).toBeVisible();
              await expect(
                page.getByTestId('add-contract-button')
              ).toBeVisible();

              await page.getByTestId('add-contract-button').click();

              await expect(page.getByTestId('add-contract-menu')).toBeVisible();
              await page.getByTestId('create-contract-button').click();

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
              await page
                .locator('.rc-virtual-list-holder-inner li')
                .first()
                .click();

              await expect(page.getByTestId('user-tag')).toBeVisible();

              // Fill Contract Semantics form
              await page.getByRole('tab', { name: 'Semantics' }).click();

              await expect(
                page.getByTestId('add-semantic-button')
              ).toBeDisabled();

              await page.fill(
                '#semantics_0_name',
                DATA_CONTRACT_SEMANTICS1.name
              );
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
                page.getByTestId('contract-status-card-item-semantics-status')
              ).toContainText('Failed');
              await expect(
                page.getByTestId('data-contract-latest-result-btn')
              ).toContainText('Contract Failed');
            }
          );

          await testPersona.step(
            'Create Persona and assign user to it',
            async () => {
              await redirectToHomePage(page);

              const personaGetResponse =
                page.waitForResponse('/api/v1/personas**');
              await settingClick(page, GlobalSettingOptions.PERSONA);
              await personaGetResponse;

              await page.waitForSelector('.ant-skeleton-content', {
                state: 'detached',
              });

              // Navigate to persona details
              await navigateToPersonaWithPagination(
                page,
                persona.data.name,
                true
              );
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
                .getByRole('listitem', {
                  name: adminUser.responseData.displayName,
                })
                .click();

              const personaResponse =
                page.waitForResponse('/api/v1/personas/*');

              await page.getByTestId('selectable-list-update-btn').click();
              await personaResponse;
            }
          );

          await testPersona.step(
            'Verify Contract tab and status badge are visible if persona is set',
            async () => {
              await redirectToHomePage(page);
              await entity.visitEntityPage(page);

              await page.waitForSelector('[data-testid="loader"]', {
                state: 'detached',
              });

              // Verify Contract tab is not visible (should be hidden by persona customization)
              await expect(
                page.getByRole('tab').getByTestId('contract')
              ).toBeVisible();

              // Verify Contract status badge is not visible in header
              await expect(
                page.getByTestId('data-contract-latest-result-btn')
              ).toBeVisible();

              // Additional verification: Check that other common tabs are still visible
              await expect(page.getByTestId('activity_feed')).toBeVisible();
              await expect(page.getByTestId('custom_properties')).toBeVisible();
            }
          );

          await testPersona.step(
            `Customize ${entityType} page to hide Contract tab`,
            async () => {
              const entityName: Record<string, string> = {
                MlModel: 'Ml Model',
                DashboardDataModel: 'Dashboard Data Model',
                'Api Collection': 'API Collection',
                ApiEndpoint: 'API Endpoint',
                SearchIndex: 'Search Index',
                'Store Procedure': 'Stored Procedure',
              };
              await settingClick(page, GlobalSettingOptions.PERSONA);

              await page.waitForSelector('[data-testid="loader"]', {
                state: 'detached',
              });

              // Navigate to persona details and customize UI
              await navigateToPersonaWithPagination(
                page,
                persona.data.name,
                true
              );
              await page.getByRole('tab', { name: 'Customize UI' }).click();

              // Navigate to Table customization
              await page
                .getByTestId('data-assets')
                .getByText('Data Assets')
                .click();
              await page
                .getByText(entityName[entityType] ?? entityType, {
                  exact: true,
                })
                .click();

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
            }
          );

          await testPersona.step(
            'Verify Contract tab and status badge are hidden after persona customization',
            async () => {
              // After applying persona customization to hide the contract tab,
              // we need to verify that the contract tab and status badge are not visible
              // when viewing the table page with the customized persona.

              await redirectToHomePage(page);
              await entity.visitEntityPage(page);

              await page.waitForSelector('[data-testid="loader"]', {
                state: 'detached',
              });

              // Verify Contract tab is not visible (should be hidden by persona customization)
              await expect(
                page.getByRole('tab').getByTestId('contract')
              ).not.toBeVisible();

              // Verify Contract status badge is not visible in header
              await expect(
                page.getByTestId('data-contract-latest-result-btn')
              ).not.toBeVisible();

              // Additional verification: Check that other common tabs are still visible
              await expect(page.getByTestId('activity_feed')).toBeVisible();
              await expect(page.getByTestId('custom_properties')).toBeVisible();
            }
          );
        } finally {
          await persona.delete(apiContext);
        }
      }
    );
  });
});
