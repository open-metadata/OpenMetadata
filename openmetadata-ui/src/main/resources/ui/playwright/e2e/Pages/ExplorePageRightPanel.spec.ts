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

import { expect, test as baseTest } from '../../support/fixtures/userPages';
import { CustomPropertiesPageObject } from '../PageObject/Explore/CustomPropertiesPageObject';
import { DataQualityPageObject } from '../PageObject/Explore/DataQualityPageObject';
import { LineagePageObject } from '../PageObject/Explore/LineagePageObject';
import { OverviewPageObject } from '../PageObject/Explore/OverviewPageObject';
import { RightPanelPageObject } from '../PageObject/Explore/RightPanelPageObject';
import { SchemaPageObject } from '../PageObject/Explore/SchemaPageObject';
import { TableClass } from '../../support/entity/TableClass';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { uuid } from '../../utils/common';
import { performAdminLogin } from '../../utils/admin';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { DatabaseClass } from '../../support/entity/DatabaseClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { DatabaseSchemaClass } from '../../support/entity/DatabaseSchemaClass';
import { DashboardDataModelClass } from '../../support/entity/DashboardDataModelClass';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { ContainerClass } from '../../support/entity/ContainerClass';
import { SearchIndexClass } from '../../support/entity/SearchIndexClass';
import { Domain } from '../../support/domain/Domain';
import { UserClass } from '../../support/user/UserClass';
import { navigateToExploreAndSelectEntity } from '../../utils/explore';
import { getEntityFqn } from '../../utils/entityPanel';
import { connectEdgeBetweenNodesViaAPI } from '../../utils/lineage';
import { getCurrentMillis } from '../../utils/dateTime';
import { PolicyClass } from '../../support/access-control/PoliciesClass';
import { RolesClass } from '../../support/access-control/RolesClass';
import { openColumnDetailPanel } from '../../utils/entity';

const domainEntity = new Domain();
const user1 = new UserClass();
// Dedicated entity for the DataConsumer owner-restriction test.
// Keeping it separate prevents race conditions with parallel tests that add/remove
// owners on the shared entityMap entities.
const dcOwnerTestTable = new TableClass();
// Dedicated entity and user for ViewBasic permission guard tests.
// Separate from other entities to avoid race conditions with parallel tests.
const viewBasicTable = new TableClass();
const viewBasicUser = new UserClass();

const testClassification = new ClassificationClass();
const testTag = new TagClass({
  classification: testClassification.data.name,
});
const testGlossary = new Glossary();
const testGlossaryTerm = new GlossaryTerm(testGlossary);
const testClassification2 = new ClassificationClass();
const testTag2 = new TagClass({
  classification: testClassification2.data.name,
});

// Define local fixture using test.extend
const test = baseTest.extend<{
  rightPanel: RightPanelPageObject;
  overview: OverviewPageObject;
  schema: SchemaPageObject;
  lineage: LineagePageObject;
  dataQuality: DataQualityPageObject;
  customProperties: CustomPropertiesPageObject;
}>({
  rightPanel: async ({ adminPage }, use) => {
    await use(new RightPanelPageObject(adminPage));
  },
  overview: async ({ rightPanel }, use) => {
    await use(new OverviewPageObject(rightPanel));
  },
  schema: async ({ rightPanel }, use) => {
    await use(new SchemaPageObject(rightPanel));
  },
  lineage: async ({ rightPanel }, use) => {
    await use(new LineagePageObject(rightPanel));
  },
  dataQuality: async ({ rightPanel }, use) => {
    await use(new DataQualityPageObject(rightPanel));
  },
  customProperties: async ({ rightPanel }, use) => {
    await use(new CustomPropertiesPageObject(rightPanel));
  },
});

const domainToUpdate =
  domainEntity.responseData?.displayName ?? domainEntity.data.displayName;
const glossaryTermToUpdate =
  testGlossaryTerm.responseData?.displayName ??
  testGlossaryTerm.data.displayName;
const tagToUpdate =
  testTag.responseData?.displayName ?? testTag.data.displayName;
const testTier = 'Tier1';
const customPropertyData: Record<string, { property: { name: string } }> = {};

test.describe('Right Panel Test Suite', () => {
  // Setup test data and page objects
  test.beforeAll(async ({ browser }) => {
    test.slow(true); // 5 minutes
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await testClassification.create(apiContext);
      await testTag.create(apiContext);
      await testGlossary.create(apiContext);
      await testGlossaryTerm.create(apiContext);
      await testClassification2.create(apiContext);
      await testTag2.create(apiContext);
      await domainEntity.create(apiContext);
      await user1.create(apiContext);
      await dcOwnerTestTable.create(apiContext);
    } finally {
      await afterAction();
    }
  });

  // No need for explicit beforeEach instantiation as fixtures handle it
  test.beforeEach(async () => {
    test.slow(true);
  });

  // Cleanup test data
  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await testTag.delete(apiContext);
      await testClassification.delete(apiContext);
      await testTag2.delete(apiContext);
      await testClassification2.delete(apiContext);
      await testGlossaryTerm.delete(apiContext);
      await testGlossary.delete(apiContext);
      await user1.delete(apiContext);
      await domainEntity.delete(apiContext);
      await dcOwnerTestTable.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.describe('Explore page right panel tests', () => {
    test.describe('Overview panel CRUD and Removal operations', () => {
      const crudEntityMap = {
        table: new TableClass(),
        dashboard: new DashboardClass(),
        pipeline: new PipelineClass(),
        topic: new TopicClass(),
        database: new DatabaseClass(),
        databaseSchema: new DatabaseSchemaClass(),
        dashboardDataModel: new DashboardDataModelClass(),
        mlmodel: new MlModelClass(),
        container: new ContainerClass(),
        searchIndex: new SearchIndexClass(),
      };

      test.beforeAll(async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        try {
          await Promise.all(
            Object.values(crudEntityMap).map((e) => e.create(apiContext))
          );
        } finally {
          await afterAction();
        }
      });

      test.afterAll(async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        try {
          await Promise.all(
            Object.values(crudEntityMap).map((e) => e.delete(apiContext))
          );
        } finally {
          await afterAction();
        }
      });

      Object.entries(crudEntityMap).forEach(([entityType, entityInstance]) => {
        test(`Should perform CRUD and Removal operations for ${entityType}`, async ({
          adminPage,
          rightPanel,
          overview,
        }) => {
          const fqn = getEntityFqn(entityInstance);

          await test.step('Navigate to entity', async () => {
            await navigateToExploreAndSelectEntity(
              adminPage,
              entityInstance.entity.name,
              entityInstance.endpoint,
              fqn
            );
            await rightPanel.waitForPanelVisible();
            rightPanel.setEntityConfig(entityInstance);
            await overview.navigateToOverviewTab();
            await overview.shouldBeVisible();
          });

          const descriptionToUpdate = `${entityType} Test description - ${uuid()}`;
          await test.step('Update description', async () => {
            await overview.shouldShowDescriptionSection();
            await overview.editDescription(descriptionToUpdate);
            await overview.shouldShowDescriptionWithText(descriptionToUpdate);
          });

          await test.step('Update/edit tags', async () => {
            await overview.editTags(tagToUpdate);
            await overview.shouldShowTagsSection();
            await overview.shouldShowTag(tagToUpdate);
          });

          await test.step('Update/edit tier', async () => {
            await overview.assignTier(testTier);
            await overview.shouldShowTierSection();
            await overview.shouldShowTier(testTier);
          });

          await test.step('Update/edit glossary terms', async () => {
            await overview.editGlossaryTerms(glossaryTermToUpdate);
            await overview.shouldShowGlossaryTermsSection();
          });

          await test.step('Update owners', async () => {
            await overview.addOwnerWithoutValidation(
              user1.getUserDisplayName()
            );
            await overview.shouldShowOwner(user1.getUserDisplayName());
          });

          await test.step('Update domain', async () => {
            await overview.editDomain(domainToUpdate);
            await overview.shouldShowDomainsSection();
            await overview.shouldShowDomain(domainToUpdate);
          });

          // Removal operations
          await test.step('Remove tag', async () => {
            await overview.removeTag([tagToUpdate]);
            await adminPage.waitForSelector('[data-testid="loader"]', {
              state: 'detached',
            });

            await navigateToExploreAndSelectEntity(
              adminPage,
              entityInstance.entity.name,
              entityInstance.endpoint,
              fqn
            );
            await rightPanel.waitForPanelVisible();
            rightPanel.setEntityConfig(entityInstance);
            await overview.navigateToOverviewTab();

            const tagElement = adminPage.getByTestId(
              `tag-${testClassification.data.name}.${testTag.data.name}`
            );
            await expect(tagElement).not.toBeVisible();
          });

          await test.step('Remove tier', async () => {
            await overview.removeTier();
            await adminPage.waitForSelector('[data-testid="loader"]', {
              state: 'detached',
            });

            await navigateToExploreAndSelectEntity(
              adminPage,
              entityInstance.entity.name,
              entityInstance.endpoint,
              fqn
            );
            await rightPanel.waitForPanelVisible();
            rightPanel.setEntityConfig(entityInstance);
            await overview.navigateToOverviewTab();

            const tierElement = adminPage
              .locator('.tier-section')
              .getByText(testTier);
            await expect(tierElement).not.toBeVisible();
          });

          await test.step('Remove glossary term', async () => {
            await overview.removeGlossaryTerm([glossaryTermToUpdate]);
            await adminPage.waitForSelector('[data-testid="loader"]', {
              state: 'detached',
            });

            await navigateToExploreAndSelectEntity(
              adminPage,
              entityInstance.entity.name,
              entityInstance.endpoint,
              fqn
            );
            await rightPanel.waitForPanelVisible();
            rightPanel.setEntityConfig(entityInstance);
            await overview.navigateToOverviewTab();

            const glossarySection = adminPage.locator(
              '.glossary-terms-section'
            );
            await expect(
              glossarySection.getByText(glossaryTermToUpdate)
            ).not.toBeVisible();
          });

          await test.step('Remove domain', async () => {
            await overview.removeDomain(domainToUpdate);
            await adminPage.waitForSelector('[data-testid="loader"]', {
              state: 'detached',
            });

            await navigateToExploreAndSelectEntity(
              adminPage,
              entityInstance.entity.name,
              entityInstance.endpoint,
              fqn
            );
            await rightPanel.waitForPanelVisible();
            rightPanel.setEntityConfig(entityInstance);
            await overview.navigateToOverviewTab();

            const domainsSection = adminPage.locator('.domains-section');
            await expect(
              domainsSection.getByText(domainToUpdate)
            ).not.toBeVisible();
          });

          await test.step('Remove user owner', async () => {
            await overview.removeOwner([user1.getUserDisplayName()], 'Users');
            await adminPage.waitForSelector('[data-testid="loader"]', {
              state: 'detached',
            });

            await navigateToExploreAndSelectEntity(
              adminPage,
              entityInstance.entity.name,
              entityInstance.endpoint,
              fqn
            );
            await rightPanel.waitForPanelVisible();
            rightPanel.setEntityConfig(entityInstance);
            await overview.navigateToOverviewTab();

            const ownerElement = adminPage
              .locator('.owners-section')
              .getByText(user1.getUserDisplayName());
            await expect(ownerElement).not.toBeVisible();
          });
        });
      });
    });

    test.describe('Entity validation with shared read-only entities', () => {
      const entityMap = {
        table: new TableClass(),
        dashboard: new DashboardClass(),
        pipeline: new PipelineClass(),
        topic: new TopicClass(),
        database: new DatabaseClass(),
        databaseSchema: new DatabaseSchemaClass(),
        dashboardDataModel: new DashboardDataModelClass(),
        mlmodel: new MlModelClass(),
        container: new ContainerClass(),
        searchIndex: new SearchIndexClass(),
      };

      test.beforeAll(async ({ browser }) => {
        test.slow(true);
        const { apiContext, afterAction } = await performAdminLogin(browser);
        try {
          await Promise.all(
            Object.values(entityMap).map((e) => e.create(apiContext))
          );
          for (const [entityType, entityInstance] of Object.entries(
            entityMap
          )) {
            try {
              await entityInstance.prepareCustomProperty(apiContext);
              const firstProperty = Object.values(
                entityInstance.customPropertyValue
              )[0];
              if (firstProperty) {
                customPropertyData[entityType] = {
                  property: firstProperty.property,
                };
              }
            } catch (error) {
              console.warn(
                `Failed to create custom property for ${entityType}:`,
                error
              );
            }
          }
        } finally {
          await afterAction();
        }
      });

      test.afterAll(async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        try {
          await Promise.all(
            Object.values(entityMap).map((e) => e.delete(apiContext))
          );
        } finally {
          await afterAction();
        }
      });

      test.describe('Schema panel tests', () => {
        Object.entries(entityMap).forEach(([entityType, entityInstance]) => {
          test(`Should display and verify schema fields for ${entityType}`, async ({
            adminPage,
            rightPanel,
            schema,
          }) => {
            rightPanel.setEntityConfig(entityInstance);
            test.skip(
              !rightPanel.isTabAvailable('schema'),
              `Schema tab not available for ${entityType}`
            );

            const fqn = getEntityFqn(entityInstance);
            await navigateToExploreAndSelectEntity(
              adminPage,
              entityInstance.entity.name,
              entityInstance.endpoint,
              fqn
            );
            await rightPanel.waitForPanelVisible();
            await schema.navigateToSchemaTab();
            await schema.shouldBeVisible();

            // Extract fields from DOM to test search dynamically
            const fieldCards = adminPage.locator(
              '.schema-field-cards-container .field-card'
            );
            if ((await fieldCards.count()) === 0) {
              // Wait for fields to render
              await fieldCards
                .first()
                .waitFor({ state: 'visible', timeout: 5000 })
                .catch(() => null);
            }
            const count = await fieldCards.count();

            if (count >= 2) {
              const firstCardId = await fieldCards
                .nth(0)
                .getAttribute('data-testid');
              const secondCardId = await fieldCards
                .nth(1)
                .getAttribute('data-testid');

              const firstField = firstCardId?.replace('field-card-', '');
              const secondField = secondCardId?.replace('field-card-', '');

              // Entities that use server-side schema search
              const usesServerSideSearch = [
                'table',
                'dashboardDataModel',
              ].includes(entityType);

              if (firstField && secondField) {
                // 1. Search for first field
                let searchRes;
                if (usesServerSideSearch) {
                  searchRes = adminPage.waitForResponse(
                    (res) =>
                      res.url().includes('columns/search?offset=') &&
                      res.url().includes('q=') &&
                      res.status() === 200
                  );
                }
                await schema.searchFor(firstField);
                if (searchRes) await searchRes;

                await schema.shouldShowFieldByName(firstField);
                await schema.shouldNotShowFieldByName(secondField);

                // 2. Clear search
                let clearRes;
                if (usesServerSideSearch) {
                  clearRes = adminPage.waitForResponse(
                    (res) =>
                      res.url().includes('/columns?offset=') &&
                      res.status() === 200
                  );
                }
                await schema.clearSearch();
                if (clearRes) await clearRes;

                await schema.shouldShowFieldByName(firstField);
                await schema.shouldShowFieldByName(secondField);

                // 3. Search for non-existent field
                let noMatchRes;
                if (usesServerSideSearch) {
                  noMatchRes = adminPage.waitForResponse(
                    (res) =>
                      res.url().includes('columns/search?offset=') &&
                      res.url().includes('q=') &&
                      res.status() === 200
                  );
                }
                await schema.searchFor('zzz_no_match_xyz');
                if (noMatchRes) await noMatchRes;

                await schema.shouldNotShowFieldByName(firstField);
                await schema.shouldShowNoResults();
              }
            }
          });
        });
      });

      test.describe('Right panel validation by asset type', () => {
        Object.entries(entityMap).forEach(([entityType, entityInstance]) => {
          test(`validates visible/hidden tabs and tab content for ${entityType}`, async ({
            adminPage,
            rightPanel,
          }) => {
            const fqn = getEntityFqn(entityInstance);
            await navigateToExploreAndSelectEntity(
              adminPage,
              entityInstance.entity.name,
              entityInstance.endpoint,
              fqn
            );
            await rightPanel.waitForPanelLoaded();
            await rightPanel.validateRightPanelForAsset(entityType);
          });
        });
      });

      test.describe('Lineage - Navigation and Expansion', () => {
        Object.entries(entityMap).forEach(([entityType, entityInstance]) => {
          test(`Should navigate to lineage and test controls for ${entityType}`, async ({
            adminPage,
            rightPanel,
            lineage,
          }) => {
            rightPanel.setEntityConfig(entityInstance);
            test.skip(
              !rightPanel.isTabAvailable('lineage'),
              `Lineage tab not available for ${entityType}`
            );

            const fqn = getEntityFqn(entityInstance);
            await navigateToExploreAndSelectEntity(
              adminPage,
              entityInstance.entity.name,
              entityInstance.endpoint,
              fqn
            );
            await rightPanel.waitForPanelVisible();
            await lineage.navigateToLineageTab();
            await lineage.shouldBeVisible();
            await lineage.shouldShowLineageControls();
          });

          test(`Should handle lineage expansion buttons for ${entityType}`, async ({
            adminPage,
            rightPanel,
            lineage,
          }) => {
            rightPanel.setEntityConfig(entityInstance);
            test.skip(
              !rightPanel.isTabAvailable('lineage'),
              `Lineage tab not available for ${entityType}`
            );

            const fqn = getEntityFqn(entityInstance);
            await navigateToExploreAndSelectEntity(
              adminPage,
              entityInstance.entity.name,
              entityInstance.endpoint,
              fqn
            );
            await rightPanel.waitForPanelLoaded();
            await rightPanel.waitForPanelVisible();
            await lineage.navigateToLineageTab();
            const hasUpstreamButton = await lineage.hasUpstreamButton();
            if (hasUpstreamButton) {
              await lineage.clickUpstreamButton();
            }

            const hasDownstreamButton = await lineage.hasDownstreamButton();
            if (hasDownstreamButton) {
              await lineage.clickDownstreamButton();
            }
          });
        });
      });

      test.describe('Lineage - With real upstream and downstream data', () => {
        test('Should show lineage connections created via API in the lineage tab', async ({
          adminPage,
        }) => {
          test.slow();
          const testTable = new TableClass();
          const upstreamTable = new TableClass();
          const downstreamTable = new TableClass();
          const { apiContext, afterAction } = await performAdminLogin(
            adminPage.context().browser()!
          );
          try {
            await testTable.create(apiContext);
            await upstreamTable.create(apiContext);
            await downstreamTable.create(apiContext);

            await connectEdgeBetweenNodesViaAPI(
              apiContext,
              { id: upstreamTable.entityResponseData.id, type: 'table' },
              { id: testTable.entityResponseData.id, type: 'table' },
              []
            );
            await connectEdgeBetweenNodesViaAPI(
              apiContext,
              { id: testTable.entityResponseData.id, type: 'table' },
              { id: downstreamTable.entityResponseData.id, type: 'table' },
              []
            );

            const fqn = getEntityFqn(testTable);
            await navigateToExploreAndSelectEntity(
              adminPage,
              testTable.entity.name,
              testTable.endpoint,
              fqn
            );

            const rightPanel = new RightPanelPageObject(adminPage, testTable);
            const localLineage = new LineagePageObject(rightPanel);
            await rightPanel.waitForPanelLoaded();

            await localLineage.navigateToLineageTab();
            await localLineage.shouldBeVisible();
            await localLineage.shouldShowLineageControls();

            const summaryPanel = adminPage.locator(
              '[data-testid="entity-summary-panel-container"]'
            );
            const lineageContainer = summaryPanel.locator(
              '.lineage-tab-content'
            );

            // Default view is downstream — verify downstream entity card
            const downstreamCard = lineageContainer
              .locator('.lineage-item-card')
              .first();
            await expect(downstreamCard).toBeVisible();
            await expect(downstreamCard).toContainText(
              downstreamTable.entityResponseData?.displayName ??
                downstreamTable.entity.name
            );

            // Switch to upstream view and verify upstream entity card
            await localLineage.clickUpstreamButton();
            const upstreamCard = lineageContainer
              .locator('.lineage-item-card')
              .first();
            await expect(upstreamCard).toBeVisible();
            await expect(upstreamCard).toContainText(
              upstreamTable.entityResponseData?.displayName ??
                upstreamTable.entity.displayName
            );
          } finally {
            await testTable.delete(apiContext);
            await upstreamTable.delete(apiContext);
            await downstreamTable.delete(apiContext);
            await afterAction();
          }
        });
      });

      test.describe('DataQuality - Comprehensive UI Verification', () => {
        Object.entries(entityMap).forEach(([entityType, entityInstance]) => {
          test(`Should navigate to data quality and verify tab structure for ${entityType}`, async ({
            adminPage,
            rightPanel,
            dataQuality,
          }) => {
            rightPanel.setEntityConfig(entityInstance);
            test.skip(
              !rightPanel.isTabAvailable('data quality'),
              `Data Quality tab not available for ${entityType}`
            );

            const fqn = getEntityFqn(entityInstance);
            await navigateToExploreAndSelectEntity(
              adminPage,
              entityInstance.entity.name,
              entityInstance.endpoint,
              fqn
            );
            await rightPanel.waitForPanelLoaded();
            await rightPanel.waitForPanelVisible();
            await dataQuality.navigateToDataQualityTab();
            await dataQuality.shouldBeVisible();
          });

          test(`Should display incidents tab for ${entityType}`, async ({
            adminPage,
            rightPanel,
            dataQuality,
          }) => {
            rightPanel.setEntityConfig(entityInstance);
            test.skip(
              !rightPanel.isTabAvailable('data quality'),
              `Data Quality tab not available for ${entityType}`
            );

            const fqn = getEntityFqn(entityInstance);
            await navigateToExploreAndSelectEntity(
              adminPage,
              entityInstance.entity.name,
              entityInstance.endpoint,
              fqn
            );
            await rightPanel.waitForPanelLoaded();
            await rightPanel.waitForPanelVisible();
            await dataQuality.navigateToDataQualityTab();
            await dataQuality.shouldBeVisible();
            await dataQuality.navigateToIncidentsTab();
            await dataQuality.shouldShowIncidentsTab();
          });

          test(`Should verify empty state when no test cases for ${entityType}`, async ({
            adminPage,
            rightPanel,
            dataQuality,
          }) => {
            rightPanel.setEntityConfig(entityInstance);
            test.skip(
              !rightPanel.isTabAvailable('data quality'),
              `Data Quality tab not available for ${entityType}`
            );

            const fqn = getEntityFqn(entityInstance);
            await navigateToExploreAndSelectEntity(
              adminPage,
              entityInstance.entity.name,
              entityInstance.endpoint,
              fqn
            );
            await rightPanel.waitForPanelLoaded();
            await rightPanel.waitForPanelVisible();
            await dataQuality.navigateToDataQualityTab();
            await dataQuality.shouldBeVisible();
            await dataQuality.shouldShowTestCaseCardsCount(0);
          });
        });
      });

      test.describe('DataQuality - With real test data and incidents', () => {
        test('Should display stat cards and filterable test case cards when runs exist', async ({
          adminPage,
        }) => {
          test.slow();
          const testTable = new TableClass();
          const { apiContext, afterAction } = await performAdminLogin(
            adminPage.context().browser()!
          );
          try {
            await testTable.create(apiContext);
            await testTable.createTestSuiteAndPipelines(apiContext);

            const successCase = await testTable.createTestCase(apiContext, {
              name: `pw_dq_success_${uuid()}`,
              testDefinition: 'tableRowCountToBeBetween',
              parameterValues: [
                { name: 'minValue', value: 1 },
                { name: 'maxValue', value: 100 },
              ],
            });
            const failedCase = await testTable.createTestCase(apiContext, {
              name: `pw_dq_failed_${uuid()}`,
              testDefinition: 'tableRowCountToBeBetween',
              parameterValues: [
                { name: 'minValue', value: 1 },
                { name: 'maxValue', value: 100 },
              ],
            });
            const abortedCase = await testTable.createTestCase(apiContext, {
              name: `pw_dq_aborted_${uuid()}`,
              testDefinition: 'tableRowCountToBeBetween',
              parameterValues: [
                { name: 'minValue', value: 1 },
                { name: 'maxValue', value: 100 },
              ],
            });

            await testTable.addTestCaseResult(
              apiContext,
              successCase.fullyQualifiedName,
              { testCaseStatus: 'Success', timestamp: getCurrentMillis() }
            );
            await testTable.addTestCaseResult(
              apiContext,
              failedCase.fullyQualifiedName,
              {
                testCaseStatus: 'Failed',
                result: 'Test failed',
                timestamp: getCurrentMillis(),
              }
            );
            await testTable.addTestCaseResult(
              apiContext,
              abortedCase.fullyQualifiedName,
              { testCaseStatus: 'Aborted', timestamp: getCurrentMillis() }
            );

            const fqn = getEntityFqn(testTable);
            await navigateToExploreAndSelectEntity(
              adminPage,
              testTable.entity.name,
              testTable.endpoint,
              fqn
            );
            const rightPanel = new RightPanelPageObject(adminPage);
            const localDQ = new DataQualityPageObject(rightPanel);
            await rightPanel.waitForPanelLoaded();

            await localDQ.navigateToDataQualityTab();
            await localDQ.shouldBeVisible();
            await localDQ.shouldShowAllStatCards();
            await localDQ.shouldShowStatCardWithText('success', '1');
            await localDQ.shouldShowStatCardWithText('failed', '1');
            await localDQ.shouldShowStatCardWithText('aborted', '1');

            const tabContent = adminPage.locator('.data-quality-tab-container');
            // Validate each status filter shows the right single test case and badge
            await localDQ.clickStatCard('success');
            await localDQ.shouldShowTestCaseCardsCount(1);
            await localDQ.shouldShowTestCaseCardWithName(successCase.name);
            await localDQ.shouldShowTestCaseCardWithStatus('success');

            await localDQ.clickStatCard('aborted');
            await localDQ.shouldShowTestCaseCardsCount(1);
            await localDQ.shouldShowTestCaseCardWithName(abortedCase.name);
            await localDQ.shouldShowTestCaseCardWithStatus('aborted');

            await localDQ.clickStatCard('failed');
            await localDQ.shouldShowTestCaseCardsCount(1);
            await localDQ.shouldShowTestCaseCardWithName(failedCase.name);
            await localDQ.shouldShowTestCaseCardWithStatus('failed');

            // Verify the test case link navigates to the correct detail page
            const testCaseLink = tabContent
              .locator(`[data-testid="test-case-${failedCase.name}"]`)
              .first();
            await testCaseLink.waitFor({ state: 'visible' });
            const href = await testCaseLink.getAttribute('href');
            expect(href).toContain(failedCase.fullyQualifiedName);
          } finally {
            await testTable.delete(apiContext);
            await afterAction();
          }
        });

        test('Should search and filter test cases in Data Quality tab', async ({
          adminPage,
        }) => {
          test.slow();
          const testTable = new TableClass();
          const { apiContext, afterAction } = await performAdminLogin(
            adminPage.context().browser()!
          );
          try {
            await testTable.create(apiContext);
            await testTable.createTestSuiteAndPipelines(apiContext);

            const successCase1 = await testTable.createTestCase(apiContext, {
              name: `pw_dq_search_target_${uuid()}`,
              testDefinition: 'tableRowCountToBeBetween',
              parameterValues: [
                { name: 'minValue', value: 1 },
                { name: 'maxValue', value: 100 },
              ],
            });
            const successCase2 = await testTable.createTestCase(apiContext, {
              name: `pw_dq_search_noise_${uuid()}`,
              testDefinition: 'tableRowCountToBeBetween',
              parameterValues: [
                { name: 'minValue', value: 1 },
                { name: 'maxValue', value: 100 },
              ],
            });

            await testTable.addTestCaseResult(
              apiContext,
              successCase1.fullyQualifiedName,
              { testCaseStatus: 'Success', timestamp: getCurrentMillis() }
            );
            await testTable.addTestCaseResult(
              apiContext,
              successCase2.fullyQualifiedName,
              { testCaseStatus: 'Success', timestamp: getCurrentMillis() }
            );

            const fqn = getEntityFqn(testTable);
            await navigateToExploreAndSelectEntity(
              adminPage,
              testTable.entity.name,
              testTable.endpoint,
              fqn
            );
            const rightPanel = new RightPanelPageObject(adminPage);
            const localDQ = new DataQualityPageObject(rightPanel);
            await rightPanel.waitForPanelLoaded();

            await localDQ.navigateToDataQualityTab();
            await localDQ.shouldBeVisible();
            await localDQ.shouldShowTestCaseCardsCount(2);

            // 1. Search for specific test case
            const searchRes = adminPage.waitForResponse(
              (res) =>
                res.url().includes('dataQuality/testCases/search/list') &&
                res.url().includes('q=')
            );
            await localDQ.searchFor('search_target');
            const searchResponse = await searchRes;
            expect(searchResponse.status()).toBe(200);
            await localDQ.shouldShowTestCaseCardsCount(1);
            await localDQ.shouldShowTestCaseCardWithName(successCase1.name);

            // 2. Clear Search
            const clearRes = adminPage.waitForResponse(
              (res) =>
                res.url().includes('dataQuality/testCases/search/list') &&
                !res.url().includes('q=')
            );
            await localDQ.clearSearch();
            const clearResponse = await clearRes;
            expect(clearResponse.status()).toBe(200);
            await localDQ.shouldShowTestCaseCardsCount(2);

            // 3. Search for non-existent test case
            const noMatchRes = adminPage.waitForResponse(
              (res) =>
                res.url().includes('dataQuality/testCases/search/list') &&
                res.url().includes('q=') &&
                res.status() === 200
            );
            await localDQ.searchFor('zzz_non_existent_search');
            await noMatchRes;
            await localDQ.shouldShowNoResults();
          } finally {
            await testTable.delete(apiContext);
            await afterAction();
          }
        });

        test('Should show incidents tab content and verify incident details when a failed test case exists', async ({
          adminPage,
        }) => {
          test.slow();
          const testTable = new TableClass();
          const { apiContext, afterAction } = await performAdminLogin(
            adminPage.context().browser()!
          );
          try {
            await testTable.create(apiContext);
            await testTable.createTestSuiteAndPipelines(apiContext);

            const incidentCase = await testTable.createTestCase(apiContext, {
              name: `pw_incident_${uuid()}`,
              testDefinition: 'tableRowCountToBeBetween',
              parameterValues: [
                { name: 'minValue', value: 1 },
                { name: 'maxValue', value: 10 },
              ],
            });
            await testTable.addTestCaseResult(
              apiContext,
              incidentCase.fullyQualifiedName,
              {
                testCaseStatus: 'Failed',
                result: 'Row count 15 exceeded maximum 10',
                timestamp: getCurrentMillis(),
              }
            );

            const fqn = getEntityFqn(testTable);
            await navigateToExploreAndSelectEntity(
              adminPage,
              testTable.entity.name,
              testTable.endpoint,
              fqn
            );
            const rightPanel = new RightPanelPageObject(adminPage);
            const localDQ = new DataQualityPageObject(rightPanel);
            await rightPanel.waitForPanelLoaded();

            await localDQ.navigateToDataQualityTab();
            await localDQ.shouldBeVisible();
            await localDQ.navigateToIncidentsTab();
            await localDQ.shouldShowIncidentsTab();

            const tabContent = adminPage.locator('.data-quality-tab-container');
            const incidentsTabContent = tabContent.locator(
              '.incidents-tab-content'
            );
            await expect(incidentsTabContent).toBeVisible();
            await expect(
              incidentsTabContent.locator('.incidents-stats-container')
            ).toBeVisible();

            await localDQ.verifyIncidentCard({
              status: 'Failed',
              hasAssignee: false,
            });
          } finally {
            await testTable.delete(apiContext);
            await afterAction();
          }
        });
      });

      test.describe('CustomProperties - Comprehensive Testing', () => {
        Object.entries(entityMap).forEach(([entityType, entityInstance]) => {
          test(`Should navigate to custom properties and show interface for ${entityType}`, async ({
            adminPage,
            rightPanel,
            customProperties,
          }) => {
            rightPanel.setEntityConfig(entityInstance);
            test.skip(
              !rightPanel.isTabAvailable('custom property'),
              `Custom Property tab not available for ${entityType}`
            );

            const fqn = getEntityFqn(entityInstance);
            await navigateToExploreAndSelectEntity(
              adminPage,
              entityInstance.entity.name,
              entityInstance.endpoint,
              fqn
            );
            await rightPanel.waitForPanelVisible();
            await customProperties.navigateToCustomPropertiesTab();
            await customProperties.shouldShowCustomPropertiesContainer();
          });

          test(`Should display custom properties for ${entityType}`, async ({
            adminPage,
            rightPanel,
            customProperties,
          }) => {
            rightPanel.setEntityConfig(entityInstance);
            test.skip(
              !rightPanel.isTabAvailable('custom property'),
              `Custom Property tab not available for ${entityType}`
            );

            const fqn = getEntityFqn(entityInstance);
            await navigateToExploreAndSelectEntity(
              adminPage,
              entityInstance.entity.name,
              entityInstance.endpoint,
              fqn
            );
            await rightPanel.waitForPanelVisible();
            await customProperties.navigateToCustomPropertiesTab();
            await customProperties.shouldShowCustomPropertiesContainer();

            const propertyName = customPropertyData[entityType]?.property?.name;
            if (propertyName) {
              await customProperties.shouldShowCustomProperty(propertyName);
            }
          });

          test(`Should search custom properties for ${entityType}`, async ({
            adminPage,
            rightPanel,
            customProperties,
          }) => {
            rightPanel.setEntityConfig(entityInstance);
            test.skip(
              !rightPanel.isTabAvailable('custom property'),
              `Custom Property tab not available for ${entityType}`
            );

            const fqn = getEntityFqn(entityInstance);
            await navigateToExploreAndSelectEntity(
              adminPage,
              entityInstance.entity.name,
              entityInstance.endpoint,
              fqn
            );
            await rightPanel.waitForPanelVisible();
            await customProperties.navigateToCustomPropertiesTab();
            await customProperties.shouldShowCustomPropertiesContainer();

            const propertyName = customPropertyData[entityType]?.property?.name;
            if (propertyName) {
              await customProperties.searchCustomProperties(propertyName);
              await customProperties.shouldShowCustomProperty(propertyName);
            }
          });

          test(`Should clear search and show all properties for ${entityType}`, async ({
            adminPage,
            rightPanel,
            customProperties,
          }) => {
            rightPanel.setEntityConfig(entityInstance);
            test.skip(
              !rightPanel.isTabAvailable('custom property'),
              `Custom Property tab not available for ${entityType}`
            );

            const fqn = getEntityFqn(entityInstance);
            await navigateToExploreAndSelectEntity(
              adminPage,
              entityInstance.entity.name,
              entityInstance.endpoint,
              fqn
            );
            await rightPanel.waitForPanelVisible();
            await customProperties.navigateToCustomPropertiesTab();
            await customProperties.shouldShowCustomPropertiesContainer();

            const propertyName = customPropertyData[entityType]?.property?.name;
            if (propertyName) {
              await customProperties.searchCustomProperties(propertyName);
              await customProperties.shouldShowCustomProperty(propertyName);

              await customProperties.clearSearch();
              await customProperties.shouldShowCustomPropertiesContainer();
            }
          });
          // TODO: Remove skip once the we have search support for custom properties to avoid flakiness
          test.skip(`Should show no results for invalid search for ${entityType}`, async ({
            adminPage,
            rightPanel,
            customProperties,
          }) => {
            const fqn = getEntityFqn(entityInstance);
            await navigateToExploreAndSelectEntity(
              adminPage,
              entityInstance.entity.name,
              entityInstance.endpoint,
              fqn
            );
            await rightPanel.waitForPanelVisible();
            rightPanel.setEntityConfig(entityInstance);

            if (rightPanel.isTabAvailable('custom property')) {
              await customProperties.navigateToCustomPropertiesTab();
              await customProperties.shouldShowCustomPropertiesContainer();

              await customProperties.searchCustomProperties(
                'nonexistent_property_xyz123'
              );
              await customProperties.shouldShowEmptyCustomPropertiesContainer();
            }
          });

          test(`Should verify property name is visible for ${entityType}`, async ({
            adminPage,
            rightPanel,
            customProperties,
          }) => {
            rightPanel.setEntityConfig(entityInstance);
            test.skip(
              !rightPanel.isTabAvailable('custom property'),
              `Custom Property tab not available for ${entityType}`
            );

            const fqn = getEntityFqn(entityInstance);
            await navigateToExploreAndSelectEntity(
              adminPage,
              entityInstance.entity.name,
              entityInstance.endpoint,
              fqn
            );
            await rightPanel.waitForPanelVisible();
            await customProperties.navigateToCustomPropertiesTab();
            await customProperties.shouldShowCustomPropertiesContainer();

            const propertyName = customPropertyData[entityType]?.property?.name;
            if (propertyName) {
              await customProperties.verifyPropertyType(propertyName);
            }
          });
        });
      });
    }); // end: Entity validation with shared read-only entities

    test.describe('Overview panel - Deleted entity verification', () => {
      const deletedEntityVerificationEntityMap = {
        table: new TableClass(),
        dashboard: new DashboardClass(),
        pipeline: new PipelineClass(),
        topic: new TopicClass(),
        database: new DatabaseClass(),
        databaseSchema: new DatabaseSchemaClass(),
        dashboardDataModel: new DashboardDataModelClass(),
        mlmodel: new MlModelClass(),
        container: new ContainerClass(),
        searchIndex: new SearchIndexClass(),
      };

      test.beforeAll(async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        try {
          await Promise.all(
            Object.values(deletedEntityVerificationEntityMap).map((e) =>
              e.create(apiContext)
            )
          );
        } finally {
          await afterAction();
        }
      });

      test.afterAll(async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        try {
          await Promise.all(
            Object.values(deletedEntityVerificationEntityMap).map((e) =>
              e.delete(apiContext)
            )
          );
        } finally {
          await afterAction();
        }
      });

      Object.entries(deletedEntityVerificationEntityMap).forEach(
        ([entityType, entityInstance]) => {
          test(`Should verify deleted user not visible in owner selection for ${entityType}`, async ({
            adminPage,
            rightPanel,
            overview,
            browser,
          }) => {
            const deletedUser = new UserClass();
            const { apiContext, afterAction } = await performAdminLogin(
              browser
            );

            try {
              await deletedUser.create(apiContext);

              const fqn = getEntityFqn(entityInstance);
              await navigateToExploreAndSelectEntity(
                adminPage,
                entityInstance.entity.name,
                entityInstance.endpoint,
                fqn
              );
              await rightPanel.waitForPanelVisible();
              rightPanel.setEntityConfig(entityInstance);

              await overview.addOwnerWithoutValidation(
                deletedUser.getUserDisplayName()
              );
              await overview.shouldShowOwner(deletedUser.getUserDisplayName());

              await deletedUser.delete(apiContext);
              await adminPage.reload();
              await rightPanel.waitForPanelVisible();

              const deletedOwnerLocator =
                await overview.verifyDeletedOwnerNotVisible(
                  deletedUser.getUserDisplayName(),
                  'Users'
                );
              await expect(deletedOwnerLocator).not.toBeVisible();
            } finally {
              await afterAction();
            }
          });

          test(`Should verify deleted tag not visible in tag selection for ${entityType}`, async ({
            adminPage,
            rightPanel,
            overview,
            browser,
          }) => {
            const deletedClassification = new ClassificationClass();
            const deletedTag = new TagClass({
              classification: deletedClassification.data.name,
            });
            const { apiContext, afterAction } = await performAdminLogin(
              browser
            );

            try {
              await deletedClassification.create(apiContext);
              await deletedTag.create(apiContext);

              const deletedTagDisplayName =
                deletedTag.responseData?.displayName ??
                deletedTag.data.displayName;

              const fqn = getEntityFqn(entityInstance);
              await navigateToExploreAndSelectEntity(
                adminPage,
                entityInstance.entity.name,
                entityInstance.endpoint,
                fqn
              );
              await rightPanel.waitForPanelVisible();
              rightPanel.setEntityConfig(entityInstance);

              await overview.editTags(deletedTagDisplayName);
              await overview.shouldShowTag(deletedTagDisplayName);

              await deletedTag.delete(apiContext);
              await deletedClassification.delete(apiContext);
              await adminPage.reload();
              await rightPanel.waitForPanelVisible();

              const deletedTagLocator =
                await overview.verifyDeletedTagNotVisible(
                  deletedTagDisplayName
                );
              await expect(deletedTagLocator).not.toBeVisible();
            } finally {
              await afterAction();
            }
          });

          test(`Should verify deleted glossary term not visible in selection for ${entityType}`, async ({
            adminPage,
            rightPanel,
            overview,
            browser,
          }) => {
            const deletedGlossary = new Glossary();
            const deletedGlossaryTerm = new GlossaryTerm(deletedGlossary);
            const { apiContext, afterAction } = await performAdminLogin(
              browser
            );

            try {
              await deletedGlossary.create(apiContext);
              await deletedGlossaryTerm.create(apiContext);

              const deletedTermDisplayName =
                deletedGlossaryTerm.responseData?.displayName ??
                deletedGlossaryTerm.data.displayName;

              const fqn = getEntityFqn(entityInstance);
              await navigateToExploreAndSelectEntity(
                adminPage,
                entityInstance.entity.name,
                entityInstance.endpoint,
                fqn
              );
              await rightPanel.waitForPanelVisible();
              rightPanel.setEntityConfig(entityInstance);

              await overview.editGlossaryTerms(deletedTermDisplayName);
              await overview.shouldShowGlossaryTermsSection();

              await deletedGlossaryTerm.delete(apiContext);
              await deletedGlossary.delete(apiContext);
              await adminPage.reload();
              await rightPanel.waitForPanelVisible();

              const deletedTermLocator =
                await overview.verifyDeletedGlossaryTermNotVisible(
                  deletedTermDisplayName
                );
              await expect(deletedTermLocator).not.toBeVisible();
            } finally {
              await afterAction();
            }
          });
        }
      );
    });

    test.describe('Data Steward User - Permission Verification', () => {
      const dataStewardEntityMap = {
        table: new TableClass(),
        dashboard: new DashboardClass(),
        pipeline: new PipelineClass(),
        topic: new TopicClass(),
        database: new DatabaseClass(),
        databaseSchema: new DatabaseSchemaClass(),
        dashboardDataModel: new DashboardDataModelClass(),
        mlmodel: new MlModelClass(),
        container: new ContainerClass(),
        searchIndex: new SearchIndexClass(),
      };

      test.beforeAll(async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        try {
          await Promise.all(
            Object.values(dataStewardEntityMap).map((e) => e.create(apiContext))
          );
        } finally {
          await afterAction();
        }
      });

      test.afterAll(async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        try {
          await Promise.all(
            Object.values(dataStewardEntityMap).map((e) => e.delete(apiContext))
          );
        } finally {
          await afterAction();
        }
      });

      Object.entries(dataStewardEntityMap).forEach(
        ([entityType, entityInstance]) => {
          test(`Should allow Data Steward to edit description for ${entityType}`, async ({
            dataStewardPage,
          }) => {
            const fqn = getEntityFqn(entityInstance);
            await navigateToExploreAndSelectEntity(
              dataStewardPage,
              entityInstance.entity.name,
              entityInstance.endpoint,
              fqn
            );
            await dataStewardPage.waitForSelector(
              '[data-testid="entity-summary-panel-container"]',
              {
                state: 'visible',
              }
            );

            const rightPanelDS = new RightPanelPageObject(dataStewardPage);
            rightPanelDS.setEntityConfig(entityInstance);
            rightPanelDS.setRolePermissions('DataSteward');

            const overviewDS = new OverviewPageObject(rightPanelDS);
            await overviewDS.navigateToOverviewTab();

            const descriptionToUpdate = `DataSteward description - ${uuid()}`;
            await overviewDS.editDescription(descriptionToUpdate);
            await overviewDS.shouldShowDescriptionWithText(descriptionToUpdate);
          });

          test(`Should allow Data Steward to edit owners for ${entityType}`, async ({
            dataStewardPage,
          }) => {
            const fqn = getEntityFqn(entityInstance);
            await navigateToExploreAndSelectEntity(
              dataStewardPage,
              entityInstance.entity.name,
              entityInstance.endpoint,
              fqn
            );
            await dataStewardPage.waitForSelector(
              '[data-testid="entity-summary-panel-container"]',
              {
                state: 'visible',
              }
            );

            const rightPanelDS = new RightPanelPageObject(dataStewardPage);
            rightPanelDS.setEntityConfig(entityInstance);
            rightPanelDS.setRolePermissions('DataSteward');

            const overviewDS = new OverviewPageObject(rightPanelDS);
            await overviewDS.addOwnerWithoutValidation(
              user1.getUserDisplayName()
            );
            await overviewDS.shouldShowOwner(user1.getUserDisplayName());
          });

          test(`Should allow Data Steward to edit tags for ${entityType}`, async ({
            dataStewardPage,
          }) => {
            const fqn = getEntityFqn(entityInstance);
            await navigateToExploreAndSelectEntity(
              dataStewardPage,
              entityInstance.entity.name,
              entityInstance.endpoint,
              fqn
            );
            await dataStewardPage.waitForSelector(
              '[data-testid="entity-summary-panel-container"]',
              {
                state: 'visible',
              }
            );

            const rightPanelDS = new RightPanelPageObject(dataStewardPage);
            rightPanelDS.setEntityConfig(entityInstance);
            rightPanelDS.setRolePermissions('DataSteward');

            const overviewDS = new OverviewPageObject(rightPanelDS);
            await overviewDS.editTags(tagToUpdate);
            await overviewDS.shouldShowTag(tagToUpdate);
          });

          test(`Should allow Data Steward to edit glossary terms for ${entityType}`, async ({
            dataStewardPage,
          }) => {
            const fqn = getEntityFqn(entityInstance);
            await navigateToExploreAndSelectEntity(
              dataStewardPage,
              entityInstance.entity.name,
              entityInstance.endpoint,
              fqn
            );
            await dataStewardPage.waitForSelector(
              '[data-testid="entity-summary-panel-container"]',
              {
                state: 'visible',
              }
            );

            const rightPanelDS = new RightPanelPageObject(dataStewardPage);
            rightPanelDS.setEntityConfig(entityInstance);
            rightPanelDS.setRolePermissions('DataSteward');

            const overviewDS = new OverviewPageObject(rightPanelDS);
            await overviewDS.editGlossaryTerms(glossaryTermToUpdate);
            await overviewDS.shouldShowGlossaryTermsSection();
          });

          test(`Should allow Data Steward to edit tier for ${entityType}`, async ({
            dataStewardPage,
          }) => {
            const fqn = getEntityFqn(entityInstance);
            await navigateToExploreAndSelectEntity(
              dataStewardPage,
              entityInstance.entity.name,
              entityInstance.endpoint,
              fqn
            );
            await dataStewardPage.waitForSelector(
              '[data-testid="entity-summary-panel-container"]',
              {
                state: 'visible',
              }
            );

            const rightPanelDS = new RightPanelPageObject(dataStewardPage);
            rightPanelDS.setEntityConfig(entityInstance);
            rightPanelDS.setRolePermissions('DataSteward');

            const overviewDS = new OverviewPageObject(rightPanelDS);
            await overviewDS.assignTier(testTier);
            await overviewDS.shouldShowTier(testTier);
          });

          test(`Should allow Data Steward to view all tabs for ${entityType}`, async ({
            dataStewardPage,
          }) => {
            const fqn = getEntityFqn(entityInstance);
            await navigateToExploreAndSelectEntity(
              dataStewardPage,
              entityInstance.entity.name,
              entityInstance.endpoint,
              fqn
            );
            await dataStewardPage.waitForSelector(
              '[data-testid="entity-summary-panel-container"]',
              {
                state: 'visible',
              }
            );

            const rightPanelDS = new RightPanelPageObject(dataStewardPage);
            rightPanelDS.setEntityConfig(entityInstance);
            rightPanelDS.setRolePermissions('DataSteward');

            if (rightPanelDS.isTabAvailable('schema')) {
              const schemaDS = new SchemaPageObject(rightPanelDS);
              await schemaDS.navigateToSchemaTab();
              await schemaDS.shouldBeVisible();
            }

            if (rightPanelDS.isTabAvailable('lineage')) {
              const lineageDS = new LineagePageObject(rightPanelDS);
              await lineageDS.navigateToLineageTab();
              await lineageDS.shouldBeVisible();
            }

            if (rightPanelDS.isTabAvailable('data quality')) {
              const dataQualityDS = new DataQualityPageObject(rightPanelDS);
              await dataQualityDS.navigateToDataQualityTab();
              await dataQualityDS.shouldBeVisible();
            }

            if (rightPanelDS.isTabAvailable('custom property')) {
              const customPropertiesDS = new CustomPropertiesPageObject(
                rightPanelDS
              );
              await customPropertiesDS.navigateToCustomPropertiesTab();
              await customPropertiesDS.shouldShowCustomPropertiesContainer();
            }
          });

          test(`Should NOT show restricted edit buttons for Data Steward for ${entityType}`, async ({
            dataStewardPage,
          }) => {
            const fqn = getEntityFqn(entityInstance);
            await navigateToExploreAndSelectEntity(
              dataStewardPage,
              entityInstance.entity.name,
              entityInstance.endpoint,
              fqn
            );
            await dataStewardPage.waitForSelector(
              '[data-testid="entity-summary-panel-container"]',
              { state: 'visible' }
            );

            const rightPanelDS = new RightPanelPageObject(dataStewardPage);
            rightPanelDS.setEntityConfig(entityInstance);
            rightPanelDS.setRolePermissions('DataSteward');

            const overviewDS = new OverviewPageObject(rightPanelDS);
            await overviewDS.navigateToOverviewTab();

            // DataSteward: canEditDomains=false, canEditDataProducts=false
            await rightPanelDS.verifyPermissions();
          });
        }
      );
    });

    test.describe('Data Consumer User - Permission Verification', () => {
      const dataConsumerEntityMap = {
        table: new TableClass(),
        dashboard: new DashboardClass(),
        pipeline: new PipelineClass(),
        topic: new TopicClass(),
        database: new DatabaseClass(),
        databaseSchema: new DatabaseSchemaClass(),
        dashboardDataModel: new DashboardDataModelClass(),
        mlmodel: new MlModelClass(),
        container: new ContainerClass(),
        searchIndex: new SearchIndexClass(),
      };

      test.beforeAll(async ({ browser }) => {
        test.slow(true);
        const { apiContext, afterAction } = await performAdminLogin(browser);
        try {
          await Promise.all(
            Object.values(dataConsumerEntityMap).map((e) =>
              e.create(apiContext)
            )
          );
          for (const entityInstance of Object.values(dataConsumerEntityMap)) {
            try {
              await entityInstance.prepareCustomProperty(apiContext);
            } catch {
              // Custom property type may already exist from another describe block;
              // continue so remaining entity types still get registered.
            }
          }
        } finally {
          await afterAction();
        }
      });

      test.afterAll(async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        try {
          await Promise.all(
            Object.values(dataConsumerEntityMap).map((e) =>
              e.delete(apiContext)
            )
          );
        } finally {
          await afterAction();
        }
      });

      Object.entries(dataConsumerEntityMap).forEach(
        ([entityType, entityInstance]) => {
          test(`Should allow Data Consumer to edit description for ${entityType}`, async ({
            dataConsumerPage,
          }) => {
            const fqn = getEntityFqn(entityInstance);
            await navigateToExploreAndSelectEntity(
              dataConsumerPage,
              entityInstance.entity.name,
              entityInstance.endpoint,
              fqn
            );
            await dataConsumerPage.waitForSelector(
              '[data-testid="entity-summary-panel-container"]',
              {
                state: 'visible',
              }
            );

            const rightPanelDC = new RightPanelPageObject(dataConsumerPage);
            rightPanelDC.setEntityConfig(entityInstance);
            rightPanelDC.setRolePermissions('DataConsumer');

            const overviewDC = new OverviewPageObject(rightPanelDC);
            await overviewDC.navigateToOverviewTab();

            const descriptionToUpdate = `DataConsumer description - ${uuid()}`;
            await overviewDC.editDescription(descriptionToUpdate);
            await overviewDC.shouldShowDescriptionWithText(descriptionToUpdate);
          });

          test(`Should allow Data Consumer to edit tags for ${entityType}`, async ({
            dataConsumerPage,
          }) => {
            const fqn = getEntityFqn(entityInstance);
            await navigateToExploreAndSelectEntity(
              dataConsumerPage,
              entityInstance.entity.name,
              entityInstance.endpoint,
              fqn
            );
            await dataConsumerPage.waitForSelector(
              '[data-testid="entity-summary-panel-container"]',
              {
                state: 'visible',
              }
            );

            const rightPanelDC = new RightPanelPageObject(dataConsumerPage);
            rightPanelDC.setEntityConfig(entityInstance);
            rightPanelDC.setRolePermissions('DataConsumer');

            const overviewDC = new OverviewPageObject(rightPanelDC);
            await overviewDC.editTags(tagToUpdate);
            await overviewDC.shouldShowTag(tagToUpdate);
          });

          test(`Should allow Data Consumer to edit glossary terms for ${entityType}`, async ({
            dataConsumerPage,
          }) => {
            const fqn = getEntityFqn(entityInstance);
            await navigateToExploreAndSelectEntity(
              dataConsumerPage,
              entityInstance.entity.name,
              entityInstance.endpoint,
              fqn
            );
            await dataConsumerPage.waitForSelector(
              '[data-testid="entity-summary-panel-container"]',
              {
                state: 'visible',
              }
            );

            const rightPanelDC = new RightPanelPageObject(dataConsumerPage);
            rightPanelDC.setEntityConfig(entityInstance);
            rightPanelDC.setRolePermissions('DataConsumer');

            const overviewDC = new OverviewPageObject(rightPanelDC);
            await overviewDC.editGlossaryTerms(glossaryTermToUpdate);
            await overviewDC.shouldShowGlossaryTermsSection();
          });

          test(`Should allow Data Consumer to edit tier for ${entityType}`, async ({
            dataConsumerPage,
          }) => {
            const fqn = getEntityFqn(entityInstance);
            await navigateToExploreAndSelectEntity(
              dataConsumerPage,
              entityInstance.entity.name,
              entityInstance.endpoint,
              fqn
            );
            await dataConsumerPage.waitForSelector(
              '[data-testid="entity-summary-panel-container"]',
              {
                state: 'visible',
              }
            );

            const rightPanelDC = new RightPanelPageObject(dataConsumerPage);
            rightPanelDC.setEntityConfig(entityInstance);
            rightPanelDC.setRolePermissions('DataConsumer');

            const overviewDC = new OverviewPageObject(rightPanelDC);
            await overviewDC.assignTier(testTier);
            await overviewDC.shouldShowTier(testTier);
          });

          test(`Should allow Data Consumer to view all tabs for ${entityType}`, async ({
            dataConsumerPage,
          }) => {
            const fqn = getEntityFqn(entityInstance);
            await navigateToExploreAndSelectEntity(
              dataConsumerPage,
              entityInstance.entity.name,
              entityInstance.endpoint,
              fqn
            );
            await dataConsumerPage.waitForSelector(
              '[data-testid="entity-summary-panel-container"]',
              {
                state: 'visible',
              }
            );

            const rightPanelDC = new RightPanelPageObject(dataConsumerPage);
            rightPanelDC.setEntityConfig(entityInstance);
            rightPanelDC.setRolePermissions('DataConsumer');

            if (rightPanelDC.isTabAvailable('schema')) {
              const schemaDC = new SchemaPageObject(rightPanelDC);
              await schemaDC.navigateToSchemaTab();
              await schemaDC.shouldBeVisible();
            }

            if (rightPanelDC.isTabAvailable('lineage')) {
              const lineageDC = new LineagePageObject(rightPanelDC);
              await lineageDC.navigateToLineageTab();
              await lineageDC.shouldBeVisible();
            }

            if (rightPanelDC.isTabAvailable('data quality')) {
              const dataQualityDC = new DataQualityPageObject(rightPanelDC);
              await dataQualityDC.navigateToDataQualityTab();
              await dataQualityDC.shouldBeVisible();
            }

            if (rightPanelDC.isTabAvailable('custom property')) {
              const customPropertiesDC = new CustomPropertiesPageObject(
                rightPanelDC
              );
              await customPropertiesDC.navigateToCustomPropertiesTab();
              await customPropertiesDC.shouldShowCustomPropertiesContainer();
            }
          });

          test(`Should follow Data Consumer role policies for ownerless ${entityType}`, async ({
            dataConsumerPage,
          }) => {
            // Use the pre-configured DataConsumer fixture user (NOT user1).
            // user1 is assigned as owner by the parallel "remove owner" tests,
            // which would grant elevated permissions and make domain buttons
            // visible unexpectedly. The fixture user is never set as owner.
            const fqn = getEntityFqn(entityInstance);
            await navigateToExploreAndSelectEntity(
              dataConsumerPage,
              entityInstance.entity.name,
              entityInstance.endpoint,
              fqn
            );
            await dataConsumerPage.waitForSelector(
              '[data-testid="entity-summary-panel-container"]',
              { state: 'visible' }
            );

            const rightPanelDC = new RightPanelPageObject(dataConsumerPage);
            rightPanelDC.setEntityConfig(entityInstance);
            rightPanelDC.setRolePermissions('DataConsumer');

            const overviewDC = new OverviewPageObject(rightPanelDC);
            await overviewDC.navigateToOverviewTab();

            // DataConsumer: canEditDomains=false, canEditDataProducts=false
            await rightPanelDC.verifyPermissions();
          });
        }
      );
    });

    // Standalone test using a dedicated entity (dcOwnerTestTable) that no other
    // parallel test touches. This prevents the race condition where a parallel
    // "remove owner" test strips the owner between admin assignment and the
    // DataConsumer navigation, making the entity ownerless and granting
    // EditOwners to all users again.
    test.describe('Data Consumer User - Owner Restriction', () => {
      test('Should NOT allow Data Consumer to edit owners when entity has owner', async ({
        adminPage,
        dataConsumerPage,
      }) => {
        const fqn = getEntityFqn(dcOwnerTestTable);

        // Admin assigns user1 as owner so the entity is no longer ownerless.
        // When an entity has an owner, EditOwners is no longer granted to all
        // users — DataConsumer (which lacks EditOwners / EditAll) cannot see
        // the edit-owners button.
        await navigateToExploreAndSelectEntity(
          adminPage,
          dcOwnerTestTable.entity.name,
          dcOwnerTestTable.endpoint,
          fqn
        );
        await adminPage.waitForSelector(
          '[data-testid="entity-summary-panel-container"]',
          { state: 'visible' }
        );
        const adminRightPanel = new RightPanelPageObject(adminPage);
        adminRightPanel.setEntityConfig(dcOwnerTestTable);
        const adminOverview = new OverviewPageObject(adminRightPanel);
        await adminOverview.addOwnerWithoutValidation(
          user1.getUserDisplayName()
        );
        await adminOverview.shouldShowOwner(user1.getUserDisplayName());

        // The pre-configured DataConsumer fixture user (NOT user1, NOT the owner)
        // navigates to the same entity and verifies that edit-owners is NOT
        // visible (restricted by role when the entity already has an owner).
        await navigateToExploreAndSelectEntity(
          dataConsumerPage,
          dcOwnerTestTable.entity.name,
          dcOwnerTestTable.endpoint,
          fqn
        );
        await dataConsumerPage.waitForSelector(
          '[data-testid="entity-summary-panel-container"]',
          { state: 'visible' }
        );
        const dcSummaryPanel = dataConsumerPage.locator(
          '.entity-summary-panel-container'
        );
        await expect(
          dcSummaryPanel.getByTestId('edit-owners')
        ).not.toBeVisible();
      });
    });

    test.describe('Empty State Scenarios - Comprehensive Coverage', () => {
      test('Should show appropriate message when no owners assigned', async ({
        adminPage,
        rightPanel,
        overview,
      }) => {
        const testEntity = new TableClass();
        const { apiContext, afterAction } = await performAdminLogin(
          adminPage.context().browser()!
        );

        try {
          await testEntity.create(apiContext);

          const fqn = getEntityFqn(testEntity);
          await navigateToExploreAndSelectEntity(
            adminPage,
            testEntity.entity.name,
            testEntity.endpoint,
            fqn
          );
          await rightPanel.waitForPanelVisible();
          rightPanel.setEntityConfig(testEntity);

          await overview.navigateToOverviewTab();
          const ownersSection = adminPage.locator('.owners-section');
          await expect(ownersSection).toBeVisible();
          // No owner chips should be present for a freshly-created entity
          await expect(adminPage.getByTestId('user-tag')).not.toBeVisible();
        } finally {
          await testEntity.delete(apiContext);
          await afterAction();
        }
      });

      test('Should show appropriate message when no tags assigned', async ({
        adminPage,
        rightPanel,
        overview,
      }) => {
        const testEntity = new TableClass();
        const { apiContext, afterAction } = await performAdminLogin(
          adminPage.context().browser()!
        );

        try {
          await testEntity.create(apiContext);

          const fqn = getEntityFqn(testEntity);
          await navigateToExploreAndSelectEntity(
            adminPage,
            testEntity.entity.name,
            testEntity.endpoint,
            fqn
          );
          await rightPanel.waitForPanelVisible();
          rightPanel.setEntityConfig(testEntity);

          await overview.navigateToOverviewTab();
          const tagsSection = adminPage.locator('.tags-section');
          await expect(tagsSection).toBeVisible();
          // Verified from test output: empty tags section shows this placeholder text
          await expect(tagsSection).toContainText('No Tags assigned');
        } finally {
          await testEntity.delete(apiContext);
          await afterAction();
        }
      });

      test('Should show appropriate message when no tier assigned', async ({
        adminPage,
        rightPanel,
        overview,
      }) => {
        const testEntity = new TableClass();
        const { apiContext, afterAction } = await performAdminLogin(
          adminPage.context().browser()!
        );

        try {
          await testEntity.create(apiContext);

          const fqn = getEntityFqn(testEntity);
          await navigateToExploreAndSelectEntity(
            adminPage,
            testEntity.entity.name,
            testEntity.endpoint,
            fqn
          );
          await rightPanel.waitForPanelVisible();
          rightPanel.setEntityConfig(testEntity);

          await overview.navigateToOverviewTab();
          const tierSection = adminPage.locator('.tier-section');
          await expect(tierSection).toBeVisible();
          // The tier chip only renders when a tier is assigned — verify it is absent
          await expect(
            adminPage
              .locator('[data-testid="entity-summary-panel-container"]')
              .getByTestId('Tier')
              .locator('.ant-tag')
          ).not.toBeVisible();
        } finally {
          await testEntity.delete(apiContext);
          await afterAction();
        }
      });

      test('Should show appropriate message when no domain assigned', async ({
        adminPage,
        rightPanel,
        overview,
      }) => {
        const testEntity = new TableClass();
        const { apiContext, afterAction } = await performAdminLogin(
          adminPage.context().browser()!
        );

        try {
          await testEntity.create(apiContext);

          const fqn = getEntityFqn(testEntity);
          await navigateToExploreAndSelectEntity(
            adminPage,
            testEntity.entity.name,
            testEntity.endpoint,
            fqn
          );
          await rightPanel.waitForPanelVisible();
          rightPanel.setEntityConfig(testEntity);

          await overview.navigateToOverviewTab();
          const domainSection = adminPage.locator('.domains-section');
          await expect(domainSection).toBeVisible();
          // Verified from test output: empty domains section shows this placeholder text
          await expect(adminPage.locator('.domains-content')).toContainText(
            'No Domains assigned'
          );
        } finally {
          await testEntity.delete(apiContext);
          await afterAction();
        }
      });

      test('Should show appropriate message when no glossary terms assigned', async ({
        adminPage,
        rightPanel,
        overview,
      }) => {
        const testEntity = new TableClass();
        const { apiContext, afterAction } = await performAdminLogin(
          adminPage.context().browser()!
        );

        try {
          await testEntity.create(apiContext);

          const fqn = getEntityFqn(testEntity);
          await navigateToExploreAndSelectEntity(
            adminPage,
            testEntity.entity.name,
            testEntity.endpoint,
            fqn
          );
          await rightPanel.waitForPanelVisible();
          rightPanel.setEntityConfig(testEntity);

          await overview.navigateToOverviewTab();
          const glossarySection = adminPage.locator('.glossary-terms-section');
          await expect(glossarySection).toBeVisible();
          // No glossary term chips should be present; the container holds only the empty state
          await expect(
            adminPage
              .getByTestId('glossary-container')
              .locator('.no-data-placeholder')
          ).toBeVisible();
        } finally {
          await testEntity.delete(apiContext);
          await afterAction();
        }
      });

      test('Should show lineage not found when no lineage exists', async ({
        adminPage,
        rightPanel,
        lineage,
      }) => {
        const testEntity = new TableClass();
        const { apiContext, afterAction } = await performAdminLogin(
          adminPage.context().browser()!
        );

        try {
          await testEntity.create(apiContext);

          const fqn = getEntityFqn(testEntity);
          await navigateToExploreAndSelectEntity(
            adminPage,
            testEntity.entity.name,
            testEntity.endpoint,
            fqn
          );
          await rightPanel.waitForPanelVisible();
          rightPanel.setEntityConfig(testEntity);

          await lineage.navigateToLineageTab();
          await lineage.shouldBeVisible();
        } finally {
          await testEntity.delete(apiContext);
          await afterAction();
        }
      });

      test('Should show no test cases message when data quality tab is empty', async ({
        adminPage,
        rightPanel,
        dataQuality,
      }) => {
        const testEntity = new TableClass();
        const { apiContext, afterAction } = await performAdminLogin(
          adminPage.context().browser()!
        );

        try {
          await testEntity.create(apiContext);

          const fqn = getEntityFqn(testEntity);
          await navigateToExploreAndSelectEntity(
            adminPage,
            testEntity.entity.name,
            testEntity.endpoint,
            fqn
          );
          await rightPanel.waitForPanelVisible();
          rightPanel.setEntityConfig(testEntity);

          await dataQuality.navigateToDataQualityTab();
          await dataQuality.shouldBeVisible();
          await dataQuality.shouldShowTestCaseCardsCount(0);
        } finally {
          await testEntity.delete(apiContext);
          await afterAction();
        }
      });
    });

    test.describe('Overview panel - Description removal', () => {
      const descriptionRemovalEntityMap = {
        table: new TableClass(),
        dashboard: new DashboardClass(),
        pipeline: new PipelineClass(),
        topic: new TopicClass(),
        database: new DatabaseClass(),
        databaseSchema: new DatabaseSchemaClass(),
        dashboardDataModel: new DashboardDataModelClass(),
        mlmodel: new MlModelClass(),
        container: new ContainerClass(),
        searchIndex: new SearchIndexClass(),
      };

      test.beforeAll(async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        try {
          await Promise.all(
            Object.values(descriptionRemovalEntityMap).map((e) =>
              e.create(apiContext)
            )
          );
        } finally {
          await afterAction();
        }
      });

      test.afterAll(async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        try {
          await Promise.all(
            Object.values(descriptionRemovalEntityMap).map((e) =>
              e.delete(apiContext)
            )
          );
        } finally {
          await afterAction();
        }
      });

      Object.entries(descriptionRemovalEntityMap).forEach(
        ([entityType, entityInstance]) => {
          test(`Should clear description for ${entityType}`, async ({
            adminPage,
          }) => {
            const { page: authenticatedPage, afterAction } =
              await performAdminLogin(adminPage.context().browser()!);
            const rightPanel = new RightPanelPageObject(authenticatedPage);
            const localOverview = new OverviewPageObject(rightPanel);

            // Use the shared entity instance from entityMap which is already created in beforeAll
            try {
              const fqn = getEntityFqn(entityInstance);
              await navigateToExploreAndSelectEntity(
                authenticatedPage,
                entityInstance.entity.name,
                entityInstance.endpoint,
                fqn
              );
              await rightPanel.waitForPanelVisible();
              rightPanel.setEntityConfig(entityInstance);

              // First, ensure there is a description
              const descriptionText = `Description to remove - ${uuid()}`;
              await localOverview.editDescription(descriptionText);
              await localOverview.shouldShowDescriptionWithText(
                descriptionText
              );

              // Clear the description
              await localOverview.editDescription('');

              // Reload the entity panel and verify description is gone.
              // waitForPanelLoaded waits for panel loaders to finish, ensuring the
              // entity data (description) has been fetched from the server before asserting.
              await navigateToExploreAndSelectEntity(
                authenticatedPage,
                entityInstance.entity.name,
                entityInstance.endpoint,
                fqn
              );
              await rightPanel.waitForPanelLoaded();

              // The description text should no longer be present
              const descElement = authenticatedPage
                .locator('.description-section')
                .getByText(descriptionText);
              await expect(descElement).not.toBeVisible();
            } finally {
              await afterAction();
            }
          });
        }
      );
    });

    test.describe('Entity switch - Panel content reload', () => {
      const entitySwitchTable = new TableClass();
      const entitySwitchDashboard = new DashboardClass();

      test.beforeAll(async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        try {
          await entitySwitchTable.create(apiContext);
          await entitySwitchDashboard.create(apiContext);
        } finally {
          await afterAction();
        }
      });

      test.afterAll(async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        try {
          await entitySwitchTable.delete(apiContext);
          await entitySwitchDashboard.delete(apiContext);
        } finally {
          await afterAction();
        }
      });

      test('Should update panel content when switching between entities', async ({
        adminPage,
      }) => {
        const { page: authenticatedPage, afterAction } =
          await performAdminLogin(adminPage.context().browser()!);
        const rightPanel = new RightPanelPageObject(authenticatedPage);
        const localOverview = new OverviewPageObject(rightPanel);

        try {
          const tableFqn = getEntityFqn(entitySwitchTable);
          await navigateToExploreAndSelectEntity(
            authenticatedPage,
            entitySwitchTable.entity.displayName,
            entitySwitchTable.endpoint,
            tableFqn
          );
          await rightPanel.waitForPanelVisible();
          rightPanel.setEntityConfig(entitySwitchTable);
          await localOverview.navigateToOverviewTab();
          await localOverview.shouldBeVisible();

          const panelContainer = authenticatedPage.locator(
            '[data-testid="entity-summary-panel-container"]'
          );
          await expect(panelContainer).toBeVisible();
          const tableNameInPanel = panelContainer
            .getByTestId('entity-link')
            .getByText(entitySwitchTable.entity.displayName);
          await expect(tableNameInPanel).toBeVisible();

          const dashboardFqn = getEntityFqn(entitySwitchDashboard);
          await navigateToExploreAndSelectEntity(
            authenticatedPage,
            entitySwitchDashboard.entity.displayName,
            entitySwitchDashboard.endpoint,
            dashboardFqn
          );
          await rightPanel.waitForPanelLoaded();
          await rightPanel.waitForPanelVisible();
          rightPanel.setEntityConfig(entitySwitchDashboard);

          const updatedPanel = authenticatedPage.locator(
            '[data-testid="entity-summary-panel-container"]'
          );
          await expect(updatedPanel).toBeVisible();
          const dashboardNameInPanel = updatedPanel
            .getByTestId('entity-link')
            .getByText(entitySwitchDashboard.entity.displayName);
          await dashboardNameInPanel.waitFor({ state: 'visible' });
          await expect(dashboardNameInPanel).toBeVisible();

          const staleTableName = updatedPanel
            .getByTestId('entity-link')
            .getByText(entitySwitchTable.entity.displayName, { exact: true });
          await expect(staleTableName).not.toBeVisible();
        } finally {
          await afterAction();
        }
      });
    });

    test.describe('Overview panel - Multi-tag operations', () => {
      test('Should add multiple tags simultaneously', async ({ adminPage }) => {
        const testEntity = new TableClass();
        const {
          page: authenticatedPage,
          apiContext,
          afterAction,
        } = await performAdminLogin(adminPage.context().browser()!);
        const rightPanel = new RightPanelPageObject(authenticatedPage);
        const localOverview = new OverviewPageObject(rightPanel);

        try {
          await testEntity.create(apiContext);

          const fqn = getEntityFqn(testEntity);
          await navigateToExploreAndSelectEntity(
            authenticatedPage,
            testEntity.entity.name,
            testEntity.endpoint,
            fqn
          );
          await rightPanel.waitForPanelVisible();
          rightPanel.setEntityConfig(testEntity);

          // Add first tag
          await localOverview.editTags(tagToUpdate);
          await localOverview.shouldShowTag(tagToUpdate);

          // Add second tag (via edit)
          const secondTag =
            testTag2.responseData?.displayName ?? testTag2.data.displayName;
          await localOverview.editTags(secondTag);
          await localOverview.shouldShowTag(secondTag);

          // Both tags should be visible
          await localOverview.shouldShowTag(tagToUpdate);
          await localOverview.shouldShowTag(secondTag);

          // Cleanup: remove both tags
          await localOverview.removeTag([secondTag]);
          await localOverview.removeTag([tagToUpdate]);
        } finally {
          await testEntity.delete(apiContext);
          await afterAction();
        }
      });
    });

    test.describe(
      'ViewBasic User - Column Detail Panel Permission Guard',
      () => {
        let viewBasicPolicy: PolicyClass;
        let viewBasicRole: RolesClass;

        test.beforeAll(async ({ browser }) => {
          const { apiContext, afterAction } = await performAdminLogin(browser);
          try {
            await viewBasicTable.create(apiContext);

            viewBasicPolicy = new PolicyClass();
            await viewBasicPolicy.create(apiContext, [
              {
                name: 'ViewBasicOnly-Rule',
                resources: ['All'],
                operations: ['ViewBasic'],
                effect: 'allow',
              },
            ]);

            viewBasicRole = new RolesClass();
            await viewBasicRole.create(apiContext, [
              viewBasicPolicy.responseData.name,
            ]);

            // Create user WITHOUT the default DataConsumer role
            await viewBasicUser.create(apiContext, false);

            await viewBasicUser.patch({
              apiContext,
              patchData: [
                {
                  op: 'replace',
                  path: '/roles',
                  value: [
                    {
                      id: viewBasicRole.responseData.id,
                      type: 'role',
                      name: viewBasicRole.responseData.name,
                    },
                  ],
                },
              ],
            });
          } finally {
            await afterAction();
          }
        });

        test.afterAll(async ({ browser }) => {
          const { apiContext, afterAction } = await performAdminLogin(browser);
          try {
            await viewBasicTable.delete(apiContext);
            await viewBasicUser.delete(apiContext);
            await viewBasicRole.delete(apiContext);
            await viewBasicPolicy.delete(apiContext);
          } finally {
            await afterAction();
          }
        });

        test('Data Quality tab should show permission placeholder for ViewBasic-only user in column detail panel', async ({
          browser,
        }) => {
          const context = await browser.newContext();
          const page = await context.newPage();

          try {
            await viewBasicUser.login(page);
            await viewBasicTable.visitEntityPage(page);

            const panelContainer = await openColumnDetailPanel({
              page,
              rowSelector: 'data-row-key',
              columnId: viewBasicTable.childrenSelectorId ?? '',
              columnNameTestId: 'column-name',
              entityType: 'table',
            });

            await panelContainer.getByTestId('data-quality-tab').click();
            await page.waitForLoadState('networkidle');

            await expect(
              panelContainer.locator(
                '[data-testid="permission-error-placeholder"]'
              )
            ).toBeVisible();
          } finally {
            await context.close();
          }
        });

        test('Should not make forbidden API calls when ViewBasic-only user opens column detail panel', async ({
          browser,
        }) => {
          const context = await browser.newContext();
          const page = await context.newPage();
          const forbiddenUrls: string[] = [];

          page.on('response', (response) => {
            if (
              response.status() === 403 &&
              (response.url().includes('metadata/types/name/tableColumn') ||
                response.url().includes('/testCases'))
            ) {
              forbiddenUrls.push(response.url());
            }
          });

          try {
            await viewBasicUser.login(page);
            await viewBasicTable.visitEntityPage(page);

            await openColumnDetailPanel({
              page,
              rowSelector: 'data-row-key',
              columnId: viewBasicTable.childrenSelectorId ?? '',
              columnNameTestId: 'column-name',
              entityType: 'table',
            });

            await page.waitForLoadState('networkidle');

            expect(forbiddenUrls).toHaveLength(0);
          } finally {
            await context.close();
          }
        });
      }
    );
  });
});
