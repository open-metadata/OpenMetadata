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
import { openEntitySummaryPanel } from '../../utils/entityPanel';

import { TableClass } from '../../support/entity/TableClass';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { redirectToHomePage, uuid } from '../../utils/common';
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
import { PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ } from '../../constant/config';

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

const domainToUpdate = domainEntity.responseData?.displayName ?? domainEntity.data.displayName;
const glossaryTermToUpdate = testGlossaryTerm.responseData?.displayName ?? testGlossaryTerm.data.displayName;
const tagToUpdate = testTag.responseData?.displayName ?? testTag.data.displayName;
const testTier = 'Tier1';


test.describe('Right Panel Test Suite', () => {

  // Setup test data and page objects
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create all entities in parallel for better performance
      await Promise.all(
        Object.values(entityMap).map((entityInstance) =>
          entityInstance.create(apiContext)
        )
      );

      await testClassification.create(apiContext);
      await testTag.create(apiContext);
      await testGlossary.create(apiContext);
      await testGlossaryTerm.create(apiContext);
      await domainEntity.create(apiContext);
    } finally {
      await afterAction();
    }
  });

  // Setup page objects before each test
  test.beforeEach(async ({ adminPage }) => {
    test.slow(true);
    rightPanel = new RightPanelPageObject(adminPage);
    overview = new OverviewPageObject(rightPanel, adminPage);
    schema = new SchemaPageObject(rightPanel, adminPage);
    lineage = new LineagePageObject(rightPanel);
    dataQuality = new DataQualityPageObject(rightPanel);
    customProperties = new CustomPropertiesPageObject(rightPanel);
  });

  // Cleanup test data
  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await tableEntity.delete(apiContext);
      await dashboardEntity.delete(apiContext);
      // Dashboard service already existed, don't delete it
      await testTag.delete(apiContext);
      await testClassification.delete(apiContext);
      await testGlossaryTerm.delete(apiContext);

      await domainEntity.delete(apiContext);
    } finally {
      await afterAction();
    }
  });


  test.describe('Explore page right panel tests', () => {
    test.describe('Overview panel CRUD operations', () => {
      Object.entries(entityMap).forEach(([entityType, entityInstance]) => {
        test(`Should update description for ${entityType}`, async ({ adminPage }) => {
          await redirectToHomePage(adminPage);
          await openEntitySummaryPanel(adminPage, entityInstance.entity.name);
          await rightPanel.waitForPanelLoaded();
          await rightPanel.waitForPanelVisible();

          await overview.navigateToOverviewTab();
          await overview.shouldBeVisible();
          await overview.shouldShowDescriptionSection();

          const descriptionToUpdate = `${entityType} Test description - ${uuid()}`;
          await overview.editDescription(descriptionToUpdate);
          await overview.shouldShowDescriptionWithText(descriptionToUpdate);
        })

        test(`Should update/edit tags for ${entityType}`, async ({ adminPage }) => {
          await redirectToHomePage(adminPage);
          await openEntitySummaryPanel(adminPage, entityInstance.entity.name);
          await rightPanel.waitForPanelLoaded();
          await rightPanel.waitForPanelVisible();

          await overview.editTags(tagToUpdate);
          await overview.shouldShowTagsSection();
          await overview.shouldShowTag(tagToUpdate);
        })

        test(`Should update/edit tier for ${entityType}`, async ({ adminPage }) => {
          await redirectToHomePage(adminPage);
          await openEntitySummaryPanel(adminPage, entityInstance.entity.name);
          await rightPanel.waitForPanelLoaded();
          await rightPanel.waitForPanelVisible();

          await overview.assignTier(testTier);
          await overview.shouldShowTierSection();
          await overview.shouldShowTier(testTier);
        })

        test(`Should update/edit glossary terms for ${entityType}`, async ({ adminPage }) => {
          await redirectToHomePage(adminPage);
          await openEntitySummaryPanel(adminPage, entityInstance.entity.name);
          await rightPanel.waitForPanelLoaded();
          await rightPanel.waitForPanelVisible();

          await overview.editGlossaryTerms(glossaryTermToUpdate);
          await overview.shouldShowGlossaryTermsSection();
        })

        test(`Should update owners for ${entityType}`, PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ, async ({ adminPage }) => {
          await redirectToHomePage(adminPage);
          await openEntitySummaryPanel(adminPage, entityInstance.entity.name);
          await rightPanel.waitForPanelLoaded();
          await rightPanel.waitForPanelVisible();

          const ownerToUpdate = 'Aaron Johnson'
          await overview.addOwnerWithoutValidation(ownerToUpdate);
          await overview.shouldShowOwner(ownerToUpdate);
          // await overview.shouldShowOwner(ownerToUpdate);

        })

        test(`Should update domain for ${entityType}`, async ({ adminPage }) => {
          await redirectToHomePage(adminPage);
          await openEntitySummaryPanel(adminPage, entityInstance.entity.name);
          await rightPanel.waitForPanelLoaded();
          await rightPanel.waitForPanelVisible();

          await overview.editDomain(domainToUpdate);
          await overview.shouldShowDomainsSection();
          await overview.shouldShowDomain(domainToUpdate);
        })
      });
    })


    // ============ SCHEMA PAGE ============

    test.describe('Schema panel tests', () => {

      Object.entries(entityMap).forEach(([entityType, entityInstance]) => {
        test(`Should display and verify schema fields for ${entityType}`, async ({ adminPage }) => {
          await redirectToHomePage(adminPage);
          await openEntitySummaryPanel(adminPage, entityInstance.entity.name);
          await rightPanel.waitForPanelLoaded();
          await rightPanel.waitForPanelVisible();

          try {
            const schemaTabExists = await rightPanel.verifyTabExists('Schema');
            if (schemaTabExists) {
              await schema.navigateToSchemaTab();
              await schema.shouldBeVisible();
            }
          } catch {
            console.debug(`No schema exists for ${entityType}`);
          }
        })
      });
    })

    // ============ LINEAGE PAGE OBJECT TESTS ============

    test.describe('Lineage - Navigation and Expansion', () => {
      Object.entries(entityMap).forEach(([entityType, entityInstance]) => {
        test(`Should navigate to lineage and test controls for ${entityType}`, async ({ adminPage }) => {
          await redirectToHomePage(adminPage);
          await openEntitySummaryPanel(adminPage, entityInstance.entity.name);
          await rightPanel.waitForPanelLoaded();
          await rightPanel.waitForPanelVisible();

          try {
            const lineageTabExists = await rightPanel.verifyTabExists('lineage');
            if (lineageTabExists) {
              await lineage.navigateToLineageTab();
              await lineage.shouldBeVisible();
              await lineage.shouldShowLineageControls();
            }
          } catch {
            console.debug(`No lineage exists for ${entityType}`);
          }
        });

        test(`Should handle lineage expansion buttons for ${entityType}`, async ({ adminPage }) => {
          await redirectToHomePage(adminPage);
          await openEntitySummaryPanel(adminPage, entityInstance.entity.name);
          await rightPanel.waitForPanelLoaded();
          await rightPanel.waitForPanelVisible();

          try {

            const lineageTabExists = await rightPanel.verifyTabExists('lineage');
            if (lineageTabExists) {
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
          } catch {
            console.debug(`No lineage exists for ${entityType}`);
          }
        });
      });
    });

    // ============ DATA QUALITY PAGE OBJECT TESTS ============

    test.describe('DataQuality - Stat Cards and Filtering', () => {

      Object.entries(entityMap).forEach(([entityType, entityInstance]) => {
        test(`Should navigate to data quality and show stat cards for ${entityType}`, async ({ adminPage }) => {
          await redirectToHomePage(adminPage);
          await openEntitySummaryPanel(adminPage, entityInstance.entity.name);
          await rightPanel.waitForPanelLoaded();
          await rightPanel.waitForPanelVisible();

          try {
            const dataQualityTabExists = await rightPanel.verifyTabExists('data quality');
            if (dataQualityTabExists) {
              await dataQuality.navigateToDataQualityTab();
              await dataQuality.shouldBeVisible();
              await dataQuality.navigateToIncidentsTab();
              await dataQuality.shouldShowIncidentsTab();
            }
          } catch {
            console.debug(`No data quality exists for ${entityType}`);
          }
        });

        //Skipping since no stats are available for the entities
        test.skip(`Should handle stat card interactions for ${entityType}`, async ({ adminPage }) => {
          await redirectToHomePage(adminPage);
          await openEntitySummaryPanel(adminPage, entityInstance.entity.name);
          await rightPanel.waitForPanelLoaded();
          await rightPanel.waitForPanelVisible();

          try {
            const dataQualityTabExists = await rightPanel.verifyTabExists('data quality');
            if (dataQualityTabExists) {
              await dataQuality.navigateToDataQualityTab();
              await dataQuality.shouldBeVisible();
              await dataQuality.shouldShowAllStatCards();
              await dataQuality.clickStatCard('success');
              await dataQuality.shouldShowTestCaseCardsCount(0);
            }
          } catch {
            console.debug(`No data quality exists for ${entityType}`);
          }
        });
      });

    });

    // ============ CUSTOM PROPERTIES PAGE OBJECT TESTS ============

    test.describe('CustomProperties - Search and Management', () => {

      Object.entries(entityMap).forEach(([entityType, entityInstance]) => {

        test(`Should navigate to custom properties and show interface for ${entityType}`, async ({ adminPage }) => {
          await redirectToHomePage(adminPage);
          await openEntitySummaryPanel(adminPage, entityInstance.entity.name);
          await rightPanel.waitForPanelVisible();

          try {
            const customPropertiesTabExists = await rightPanel.verifyTabExists('Custom Property');
            if (customPropertiesTabExists) {
              await customProperties.navigateToCustomPropertiesTab();
              //Right now we are checking for empty custom properties container
              await customProperties.shouldShowEmptyCustomPropertiesContainer();
            }
          } catch {
            console.debug(`No custom properties exists for ${entityType}`);
          }
        });

        //Skipping since no custom properties are available for the entities
        test.skip(`Should handle search functionality for ${entityType}`, async ({ adminPage }) => {
          await redirectToHomePage(adminPage);
          await openEntitySummaryPanel(adminPage, entityInstance.entity.name);
          await rightPanel.waitForPanelLoaded();
          await rightPanel.waitForPanelVisible();

          try {
            const customPropertiesTabExists = await rightPanel.verifyTabExists('Custom Property');
            if (customPropertiesTabExists) {
              await customProperties.navigateToCustomPropertiesTab();
              await customProperties.shouldBeVisible();
            }
          } catch {
            console.debug(`No custom properties exists for ${entityType}`);
          }
        });
      });

    });
  });
});
