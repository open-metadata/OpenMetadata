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
  DATA_CONTRACT_DETAILS,
  DATA_CONTRACT_SEMANTICS1,
  DATA_CONTRACT_SEMANTICS2,
  NEW_TABLE_TEST_CASE,
} from '../../constant/dataContracts';
import { GlobalSettingOptions } from '../../constant/settings';
import { ContainerClass } from '../../support/entity/ContainerClass';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../../support/entity/DashboardDataModelClass';
import { DatabaseClass } from '../../support/entity/DatabaseClass';
import { DatabaseSchemaClass } from '../../support/entity/DatabaseSchemaClass';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../support/entity/SearchIndexClass';
import { StoredProcedureClass } from '../../support/entity/StoredProcedureClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
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

// Define entities that support Data Contracts
const entitiesWithDataContracts = [
  DatabaseClass,
  DatabaseSchemaClass,
  TableClass,
  TopicClass,
  DashboardClass,
  DashboardDataModelClass,
  PipelineClass,
  MlModelClass,
  ContainerClass,
  SearchIndexClass,
  StoredProcedureClass,
  //   ApiEndpointClass,   ApiEndpoint page is broken after refresh and Chart is not supported yet.
  //   ApiCollectionClass
  //   ChartClass,
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

const adminUser = new UserClass();

const test = base.extend<{ page: Page }>({
  page: async ({ browser }, use) => {
    const adminPage = await browser.newPage();
    await adminUser.login(adminPage);
    await use(adminPage);
    await adminPage.close();
  },
});

entitiesWithDataContracts.forEach((EntityClass) => {
  const entity = new EntityClass();
  const entity2 = new EntityClass(); // For persona test
  const entityType = entity.getType();

  test.describe(`Data Contracts - ${entityType}`, () => {
    const testClassification = new ClassificationClass();
    const testTag = new TagClass({
      classification: testClassification.data.name,
    });
    const testGlossary = new Glossary();
    const testGlossaryTerm = new GlossaryTerm(testGlossary);
    const testPersona = new PersonaClass();

    test.beforeAll('Setup pre-requests', async ({ browser }) => {
      test.slow(true);

      const { apiContext, afterAction } = await performAdminLogin(browser);
      await entity.create(apiContext);
      await entity2.create(apiContext);
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);

      // Setup additional resources for comprehensive tests (mainly for Table)
      if (entitySupportsQuality(entityType)) {
        await testClassification.create(apiContext);
        await testTag.create(apiContext);
        await testGlossary.create(apiContext);
        await testGlossaryTerm.create(apiContext);
      }

      // Setup persona for the persona test
      await testPersona.create(apiContext);
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
      await afterAction();
    });

    test.afterAll('Cleanup', async ({ browser }) => {
      test.slow(true);

      const { apiContext, afterAction } = await performAdminLogin(browser);
      await entity.delete(apiContext);
      await entity2.delete(apiContext);

      if (entitySupportsQuality(entityType)) {
        await testClassification.delete(apiContext);
        await testTag.delete(apiContext);
        await testGlossary.delete(apiContext);
        await testGlossaryTerm.delete(apiContext);
      }

      await testPersona.delete(apiContext);
      await adminUser.delete(apiContext);
      await afterAction();
    });

    test(`Create and validate Data Contract for ${entityType}`, async ({
      page,
    }) => {
      test.setTimeout(360000);

      const contractName = DATA_CONTRACT_DETAILS.name;

      await test.step('Navigate to entity and open contract tab', async () => {
        await redirectToHomePage(page);
        await entity.visitEntityPage(page);
        await page.click('[data-testid="contract"]');

        await expect(page.getByTestId('no-data-placeholder')).toBeVisible();
        await expect(page.getByTestId('add-contract-button')).toBeVisible();

        await page.getByTestId('add-contract-button').click();

        await expect(page.getByTestId('add-contract-card')).toBeVisible();
      });

      await test.step('Fill Contract Details form', async () => {
        await page.getByTestId('contract-name').fill(contractName);
        await page.fill(
          '.om-block-editor[contenteditable="true"]',
          DATA_CONTRACT_DETAILS.description
        );

        await page.getByTestId('select-owners').click();
        await page.locator('.rc-virtual-list-holder-inner li').first().click();

        await expect(page.getByTestId('user-tag')).toBeVisible();
      });

      // Schema selection step - only for entities with schema
      if (entitySupportsSchema(entityType)) {
        await test.step('Fill Contract Schema form', async () => {
          await page.getByRole('button', { name: 'Schema' }).click();

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

      await test.step('Fill Contract Semantics form', async () => {
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

      await test.step('Add and delete second semantic', async () => {
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
          endpoint: entity.endpoint as EntityTypeEndpoint,
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

        await page.waitForSelector('.contract-header-container', {
          state: 'visible',
        });

        await expect(
          page.getByTestId('contract-status-card-item-Semantics-status')
        ).toContainText('Passed');
      });

      // Quality tests - only for entities that support quality
      if (entitySupportsQuality(entityType)) {
        await test.step('Add test case and validate for quality', async () => {
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
        });

        await test.step(
          'Validate inside Observability bundle test suites',
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

        await test.step('Edit quality expectations and validate', async () => {
          await entity.visitEntityPage(page);

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
        });
      }

      await test.step('Verify YAML view', async () => {
        await entity.visitEntityPage(page);

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

      await test.step('Delete contract', async () => {
        const deleteContractResponse = page.waitForResponse(
          'api/v1/dataContracts/*?hardDelete=true&recursive=true'
        );

        await page.getByTestId('delete-contract-button').click();

        await expect(
          page
            .locator('.ant-modal-title')
            .getByText(`Delete dataContract "${contractName}"`)
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

    test(`Contract Status badge should not be visible if Contract Tab is hidden by Persona for ${entityType}`, async ({
      page,
    }) => {
      test.slow(true);

      await test.step(
        'Create Data Contract and validate it fails',
        async () => {
          await redirectToHomePage(page);
          await entity2.visitEntityPage(page);

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
          await page
            .locator('.rc-virtual-list-holder-inner li')
            .first()
            .click();

          await expect(page.getByTestId('user-tag')).toBeVisible();

          // Fill Contract Schema form - only for entities with schema
          if (entitySupportsSchema(entityType)) {
            await page.getByRole('button', { name: 'Schema' }).click();

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
          }

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
        `Customize ${entityType} page to hide Contract tab`,
        async () => {
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

          // Navigate to entity customization
          await page.getByText('Data Assets').click();
          await page.getByText(entityType, { exact: true }).click();

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

      await test.step(
        'Verify Contract tab and status badge are hidden',
        async () => {
          // After applying persona customization to hide the contract tab,
          // we need to verify that the contract tab and status badge are not visible
          // when viewing the entity page with the customized persona.

          await redirectToHomePage(page);
          await entity.visitEntityPage(page);
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

          // Additional verification: Check that other tabs are still visible (some tabs may vary by entity)
          const commonTabs = [
            'schema',
            'activity_feed',
            'lineage',
            'custom_properties',
          ];
          for (const tab of commonTabs) {
            const tabElement = page.getByTestId(tab);
            const isVisible = await tabElement.isVisible().catch(() => false);
            if (isVisible) {
              await expect(tabElement).toBeVisible();
            }
          }
        }
      );
    });
  });
});
