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

import { test } from '../../support/fixtures/userPages';
import { RightPanelPageObject } from '../PageObject/Explore/RightPanelPageObject';
import { OverviewPageObject } from '../PageObject/Explore/OverviewPageObject';
import { SchemaPageObject } from '../PageObject/Explore/SchemaPageObject';
import { LineagePageObject } from '../PageObject/Explore/LineagePageObject';
import { DataQualityPageObject } from '../PageObject/Explore/DataQualityPageObject';
import { CustomPropertiesPageObject } from '../PageObject/Explore/CustomPropertiesPageObject';
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

// Test data setup
const tableEntity = new TableClass();
const dashboardEntity = new DashboardClass();
const pipelineEntity = new PipelineClass();
const topicEntity = new TopicClass();
const databaseEntity = new DatabaseClass();
const databaseSchemaEntity = new DatabaseSchemaClass();
const dashboardDataModelEntity = new DashboardDataModelClass();
const mlmodelEntity = new MlModelClass();
const containerEntity = new ContainerClass();
const searchIndexEntity = new SearchIndexClass();
const domainEntity = new Domain();
const user1 = new UserClass();

const testClassification = new ClassificationClass();
const testTag = new TagClass({
  classification: testClassification.data.name,
});
const testGlossary = new Glossary();
const testGlossaryTerm = new GlossaryTerm(testGlossary);

// Entity mapping for tests
const entityMap = {
  table: tableEntity,
  dashboard: dashboardEntity,
  pipeline: pipelineEntity,
  topic: topicEntity,
  database: databaseEntity,
  databaseSchema: databaseSchemaEntity,
  dashboardDataModel: dashboardDataModelEntity,
  mlmodel: mlmodelEntity,
  container: containerEntity,
  searchIndex: searchIndexEntity,
};

// Page object instances
let rightPanel: RightPanelPageObject;
let overview: OverviewPageObject;
let schema: SchemaPageObject;
let lineage: LineagePageObject;
let dataQuality: DataQualityPageObject;
let customProperties: CustomPropertiesPageObject;

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
      // Create all entities in parallel for better performance
      await Promise.all(
        Object.values(entityMap).map((entityInstance) =>
          entityInstance.create(apiContext)
        )
      );

      // Create custom properties sequentially to avoid timeout (each call creates 4 users + multiple properties)
      // Only create for entities that support custom properties
      for (const [entityType, entityInstance] of Object.entries(entityMap)) {
        try {
          await entityInstance.prepareCustomProperty(apiContext);

          // Populate customPropertyData from entity's customPropertyValue
          // Get the first property from customPropertyValue (which is keyed by property type names like 'string', 'integer', etc.)
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
          // Continue with other entities even if one fails
        }
      }

      await testClassification.create(apiContext);
      await testTag.create(apiContext);
      await testGlossary.create(apiContext);
      await testGlossaryTerm.create(apiContext);
      await domainEntity.create(apiContext);
      await user1.create(apiContext);
    } finally {
      await afterAction();
    }
  });

  // Setup page objects before each test
  test.beforeEach(async ({ adminPage }) => {
    test.slow(true);
    rightPanel = new RightPanelPageObject(adminPage);
    overview = new OverviewPageObject(rightPanel);
    schema = new SchemaPageObject(rightPanel);
    lineage = new LineagePageObject(rightPanel);
    dataQuality = new DataQualityPageObject(rightPanel);
    customProperties = new CustomPropertiesPageObject(rightPanel);
  });

  // Cleanup test data
  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await Promise.all(
        Object.values(entityMap).map((entityInstance) =>
          entityInstance.delete(apiContext)
        )
      );
      await testTag.delete(apiContext);
      await testClassification.delete(apiContext);
      await testGlossaryTerm.delete(apiContext);
      await user1.delete(apiContext);
      await domainEntity.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.describe('Explore page right panel tests', () => {
    test.describe('Overview panel CRUD operations', () => {
      Object.entries(entityMap).forEach(([entityType, entityInstance]) => {
        test(`Should update description for ${entityType}`, async ({
          adminPage,
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

          await overview.navigateToOverviewTab();
          await overview.shouldBeVisible();
          await overview.shouldShowDescriptionSection();

          const descriptionToUpdate = `${entityType} Test description - ${uuid()}`;
          await overview.editDescription(descriptionToUpdate);
          await overview.shouldShowDescriptionWithText(descriptionToUpdate);
        });

        test(`Should update/edit tags for ${entityType}`, async ({
          adminPage,
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

          await overview.editTags(tagToUpdate);
          await overview.shouldShowTagsSection();
          await overview.shouldShowTag(tagToUpdate);
        });

        test(`Should update/edit tier for ${entityType}`, async ({
          adminPage,
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

          await overview.assignTier(testTier);
          await overview.shouldShowTierSection();
          await overview.shouldShowTier(testTier);
        });

        test(`Should update/edit glossary terms for ${entityType}`, async ({
          adminPage,
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

          await overview.editGlossaryTerms(glossaryTermToUpdate);
          await overview.shouldShowGlossaryTermsSection();
        });

        test(`Should update owners for ${entityType}`, async ({
          adminPage,
        }) => {
          const fqn = getEntityFqn(entityInstance);
          await navigateToExploreAndSelectEntity(
            adminPage,
            entityInstance.entity.name,
            entityInstance.endpoint,
            fqn
          );
          await rightPanel.waitForPanelLoaded();
          await rightPanel.waitForPanelVisible();
          rightPanel.setEntityConfig(entityInstance);

          await overview.addOwnerWithoutValidation(user1.getUserDisplayName());
          await overview.shouldShowOwner(user1.getUserDisplayName());
        });

        test(`Should update domain for ${entityType}`, async ({
          adminPage,
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

          await overview.editDomain(domainToUpdate);
          await overview.shouldShowDomainsSection();
          await overview.shouldShowDomain(domainToUpdate);
        });
      });
    });

    test.describe('Schema panel tests', () => {
      Object.entries(entityMap).forEach(([entityType, entityInstance]) => {
        test(`Should display and verify schema fields for ${entityType}`, async ({
          adminPage,
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

          if (rightPanel.isTabAvailable('schema')) {
            await schema.navigateToSchemaTab();
            await schema.shouldBeVisible();
          }
        });
      });
    });

    test.describe('Right panel validation by asset type', () => {
      Object.entries(entityMap).forEach(([entityType, entityInstance]) => {
        test(`validates visible/hidden tabs and tab content for ${entityType}`, async ({
          adminPage,
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

          if (rightPanel.isTabAvailable('lineage')) {
            await lineage.navigateToLineageTab();
            await lineage.shouldBeVisible();
            await lineage.shouldShowLineageControls();
          }
        });

        test(`Should handle lineage expansion buttons for ${entityType}`, async ({
          adminPage,
        }) => {
          const fqn = getEntityFqn(entityInstance);
          await navigateToExploreAndSelectEntity(
            adminPage,
            entityInstance.entity.name,
            entityInstance.endpoint,
            fqn
          );
          await rightPanel.waitForPanelLoaded();
          await rightPanel.waitForPanelVisible();
          rightPanel.setEntityConfig(entityInstance);

          if (rightPanel.isTabAvailable('lineage')) {
            await lineage.navigateToLineageTab();
            const hasUpstreamButton = await lineage.hasUpstreamButton();
            if (hasUpstreamButton) {
              await lineage.clickUpstreamButton();
            }

            const hasDownstreamButton = await lineage.hasDownstreamButton();
            if (hasDownstreamButton) {
              await lineage.clickDownstreamButton();
            }
          }
        });
      });
    });

    test.describe('DataQuality - Stat Cards and Filtering', () => {
      Object.entries(entityMap).forEach(([entityType, entityInstance]) => {
        test(`Should navigate to data quality and show stat cards for ${entityType}`, async ({
          adminPage,
        }) => {
          const fqn = getEntityFqn(entityInstance);
          await navigateToExploreAndSelectEntity(
            adminPage,
            entityInstance.entity.name,
            entityInstance.endpoint,
            fqn
          );
          await rightPanel.waitForPanelLoaded();
          await rightPanel.waitForPanelVisible();
          rightPanel.setEntityConfig(entityInstance);

          if (rightPanel.isTabAvailable('data quality')) {
            await dataQuality.navigateToDataQualityTab();
            await dataQuality.shouldBeVisible();
            await dataQuality.navigateToIncidentsTab();
            await dataQuality.shouldShowIncidentsTab();
          }
        });

        //Skipping since no stats are available for the entities
        test.skip(`Should handle stat card interactions for ${entityType}`, async ({
          adminPage,
        }) => {
          const fqn = getEntityFqn(entityInstance);
          await navigateToExploreAndSelectEntity(
            adminPage,
            entityInstance.entity.name,
            entityInstance.endpoint,
            fqn
          );
          await rightPanel.waitForPanelLoaded();
          await rightPanel.waitForPanelVisible();
          rightPanel.setEntityConfig(entityInstance);

          if (rightPanel.isTabAvailable('data quality')) {
            await dataQuality.navigateToDataQualityTab();
            await dataQuality.shouldBeVisible();
            await dataQuality.shouldShowAllStatCards();
            await dataQuality.clickStatCard('success');
            await dataQuality.shouldShowTestCaseCardsCount(0);
          }
        });
      });
    });

    test.describe('CustomProperties - Search and Management', () => {
      Object.entries(entityMap).forEach(([entityType, entityInstance]) => {
        test(`Should navigate to custom properties and show interface for ${entityType}`, async ({
          adminPage,
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
          }
        });

        //Skipping since no custom properties are available for the entities
        test(`Should handle search functionality for ${entityType}`, async ({
          adminPage,
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

            const propertyName = customPropertyData[entityType]?.property?.name;
            if (propertyName) {
              await customProperties.searchCustomProperties(propertyName);
              await customProperties.shouldShowCustomProperty(propertyName);
            }
          }
        });
      });
    });
  });
});
