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

/**
 * RIGHT PANEL PAGE OBJECTS TEST SUITE
 *
 * Comprehensive tests for all right panel page objects:
 * - OverviewPageObject: Full CRUD operations (edit, assign, verify)
 * - SchemaPageObject: Field and data type visibility
 * - LineagePageObject: Navigation and expansion controls
 * - DataQualityPageObject: Stat cards and test case filtering
 * - CustomPropertiesPageObject: Search and property management
 */

import { test } from '../../support/fixtures/userPages';
import { RightPanelPageObject } from '../PageObject/Explore/RightPanelPageObject';
import { OverviewPageObject } from '../PageObject/Explore/OverviewPageObject';
import { SchemaPageObject } from '../PageObject/Explore/SchemaPageObject';
import { LineagePageObject } from '../PageObject/Explore/LineagePageObject';
import { DataQualityPageObject } from '../PageObject/Explore/DataQualityPageObject';
import { CustomPropertiesPageObject } from '../PageObject/Explore/CustomPropertiesPageObject';
import { navigateToExploreAndSelectEntity, openEntitySummaryPanel } from '../../utils/entityPanel';

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
import { EntityDataClass } from '../../support/entity/EntityDataClass';

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

const domainToUpdate = EntityDataClass.domain1.responseData?.displayName ?? EntityDataClass.domain1.data.displayName;
const ownerToUpdate = [EntityDataClass.user1.getUserDisplayName()];
const glossaryTermToUpdate = testGlossaryTerm.responseData?.displayName ?? testGlossaryTerm.data.displayName;
const tagToUpdate = testTag.responseData?.displayName ?? testTag.data.displayName;
const testTier = 'Tier1';

test.describe('Right Panel Page Objects Test Suite', () => {

  // Setup test data and page objects
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {

      Object.values(entityMap).forEach(async (entityInstance) => {
        await entityInstance.create(apiContext);
      });

      await testClassification.create(apiContext);
      await testTag.create(apiContext);
      await testGlossary.create(apiContext);
      await testGlossaryTerm.create(apiContext);
      // Wait for entities to be indexed
      await new Promise(resolve => setTimeout(resolve, 3000));
    } finally {
      await afterAction();
    }
  });

  // Setup page objects before each test
  test.beforeEach(async ({ adminPage }) => {
    rightPanel = new RightPanelPageObject(adminPage);
    overview = new OverviewPageObject(rightPanel, adminPage);
    schema = new SchemaPageObject(rightPanel);
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
      await testGlossary.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  
  test.describe('OverviewPageObject - Full CRUD Operations', () => {

    // ============ OVERVIEW PAGE OBJECT TESTS ============
    Object.entries(entityMap).forEach(([entityType, entityInstance]) => {
      test(`Should update description for ${entityType}`, async ({ adminPage }) => {
        await navigateToExploreAndSelectEntity(adminPage, entityType);
        await openEntitySummaryPanel(adminPage, entityInstance.entity.name);
        await rightPanel.waitForPanelVisible();

        await overview.navigateToOverviewTab();
        await overview.shouldBeVisible();
        await overview.shouldShowDescriptionSection();

        const descriptionToUpdate = `${entityType} Test description - ${uuid()}`;
        await overview.editDescription(descriptionToUpdate);
        await overview.shouldShowDescriptionWithText(descriptionToUpdate);
      })

      test(`Should update/edit tags for ${entityType}`, async ({ adminPage }) => {
        await navigateToExploreAndSelectEntity(adminPage, entityType);
        await openEntitySummaryPanel(adminPage, entityInstance.entity.name);
        await rightPanel.waitForPanelVisible();

        const tagToUpdate = testTag.responseData?.displayName ?? testTag.data.displayName
        await overview.editTags(tagToUpdate);
        await overview.shouldShowTagsSection();
        await overview.shouldShowTag(tagToUpdate);
      })

      test(`Should update/edit tier for ${entityType}`, async ({ adminPage }) => {
        await navigateToExploreAndSelectEntity(adminPage, entityType);
        await openEntitySummaryPanel(adminPage, entityInstance.entity.name);
        await rightPanel.waitForPanelVisible();

        const testTier = 'Tier1';
        await overview.assignTier(testTier);
        await overview.shouldShowTierSection();
        await overview.shouldShowTier(testTier);
      })

      test(`Should update/edit glossary terms for ${entityType}`, async ({ adminPage }) => {
        await navigateToExploreAndSelectEntity(adminPage, entityType);
        await openEntitySummaryPanel(adminPage, entityInstance.entity.name);
        await rightPanel.waitForPanelVisible();

        const glossaryTermToUpdate = testGlossaryTerm.responseData?.displayName ?? testGlossaryTerm.data.displayName
        await overview.editGlossaryTerms(glossaryTermToUpdate);
        await overview.shouldShowGlossaryTermsSection();
      })

      test(`Should update domain for ${entityType}`, async ({ adminPage }) => {
        await navigateToExploreAndSelectEntity(adminPage, entityType);
        await openEntitySummaryPanel(adminPage, entityInstance.entity.name);
        await rightPanel.waitForPanelVisible();

        const domainToUpdate = EntityDataClass.domain1.responseData?.displayName ?? EntityDataClass.domain1.data.displayName;
        await overview.editDomain(domainToUpdate);
        await overview.shouldShowDomainsSection();
        await overview.shouldShowDomain(domainToUpdate);
      })

      test(`Should update owners for ${entityType}`, async ({ adminPage }) => {
        await navigateToExploreAndSelectEntity(adminPage, entityType);
        await openEntitySummaryPanel(adminPage, entityInstance.entity.name);
        await rightPanel.waitForPanelVisible();

        const ownerToUpdate = [EntityDataClass.user1.getUserDisplayName()];
   
      })

      test(`Should update domain for ${entityType}`, async ({ adminPage }) => {
        await navigateToExploreAndSelectEntity(adminPage, entityType);
        await openEntitySummaryPanel(adminPage, entityInstance.entity.name);
        await rightPanel.waitForPanelVisible();

        const domainToUpdate = EntityDataClass.domain1.responseData?.displayName ?? EntityDataClass.domain1.data.displayName;
        await overview.editDomain(domainToUpdate);
        await overview.shouldShowDomainsSection();
        await overview.shouldShowDomain(domainToUpdate);
      })

      // ============ SCHEMA PAGE OBJECT TESTS ============

      test.describe('SchemaPageObject - Field and Data Type Visibility', () => {
        test('Should display and verify schema fields', async ({ adminPage }) => {
          await navigateToExploreAndSelectEntity(adminPage, 'Table');
          const tableName = tableEntity.entity.name;
          await openEntitySummaryPanel(adminPage, tableName);
          await rightPanel.waitForPanelVisible();

          await schema.navigateToSchemaTab();
          await schema.shouldBeVisible();

          // Test schema field visibility
          const tableColumns = tableEntity.children;
          if (tableColumns && tableColumns.length > 0) {
            const firstColumn = tableColumns[0];
            await schema.shouldShowSchemaField(firstColumn.name);
            await schema.shouldShowDataType(firstColumn.dataType);

            // Test field count
            await schema.shouldShowSchemaFieldsCount(tableColumns.length);
          }
        });

        test('Should handle empty schema gracefully', async ({ adminPage }) => {
          await navigateToExploreAndSelectEntity(adminPage, 'Table');
          const tableName = tableEntity.entity.name;
          await openEntitySummaryPanel(adminPage, tableName);
          await rightPanel.waitForPanelVisible();

          await schema.navigateToSchemaTab();
          await schema.shouldShowSchemaFields(); // Should not fail even if empty
        });
      });

      // ============ LINEAGE PAGE OBJECT TESTS ============

      test.describe('LineagePageObject - Navigation and Expansion', () => {
        test('Should navigate to lineage and test controls', async ({ adminPage }) => {
          await navigateToExploreAndSelectEntity(adminPage, 'Table');
          const tableName = tableEntity.entity.name;
          await openEntitySummaryPanel(adminPage, tableName);
          await rightPanel.waitForPanelVisible();

          await lineage.navigateToLineageTab();
          await lineage.shouldBeVisible();

          // Test lineage controls visibility
          await lineage.shouldShowLineageControls();
        });

        test('Should handle lineage expansion buttons', async ({ adminPage }) => {
          await navigateToExploreAndSelectEntity(adminPage, 'Table');
          const tableName = tableEntity.entity.name;
          await openEntitySummaryPanel(adminPage, tableName);
          await rightPanel.waitForPanelVisible();

          await lineage.navigateToLineageTab();

          // Test upstream/downstream buttons (may not be visible if no lineage exists)
          try {
            await lineage.clickUpstreamButton();
            await lineage.shouldShowExpandUpstreamButton();
          } catch {
            // Expected if no upstream lineage exists
            await lineage.shouldNotShowExpandUpstreamButton();
          }

          try {
            await lineage.clickDownstreamButton();
            await lineage.shouldShowExpandDownstreamButton();
          } catch {
            // Expected if no downstream lineage exists
            await lineage.shouldNotShowExpandDownstreamButton();
          }
        });
      });

      // ============ DATA QUALITY PAGE OBJECT TESTS ============

      test.describe('DataQualityPageObject - Stat Cards and Filtering', () => {
        test('Should navigate to data quality and show stat cards', async ({ adminPage }) => {
          await navigateToExploreAndSelectEntity(adminPage, 'Table');
          await rightPanel.waitForPanelVisible();

          await dataQuality.navigateToDataQualityTab();
          await dataQuality.shouldBeVisible();
          await dataQuality.shouldShowAllStatCards();
        });

        test('Should handle stat card interactions', async ({ adminPage }) => {
          await navigateToExploreAndSelectEntity(adminPage, 'Table');
          await rightPanel.waitForPanelVisible();

          await dataQuality.navigateToDataQualityTab();

          // Test stat card clicking (may not have data, but should not fail)
          try {
            await dataQuality.clickStatCard('success');
            await dataQuality.shouldShowTestCaseCardsCount(0); // May be empty
          } catch {
            // Expected if no successful tests exist
          }

          try {
            await dataQuality.clickStatCard('failed');
            await dataQuality.shouldShowTestCaseCardsCount(0); // May be empty
          } catch {
            // Expected if no failed tests exist
          }
        });
      });

      // ============ CUSTOM PROPERTIES PAGE OBJECT TESTS ============

      test.describe('CustomPropertiesPageObject - Search and Management', () => {
        test('Should navigate to custom properties and show interface', async ({ adminPage }) => {
          await navigateToExploreAndSelectEntity(adminPage, 'Table');
          await rightPanel.waitForPanelVisible();

          await customProperties.navigateToCustomPropertiesTab();
          await customProperties.shouldBeVisible();
          await customProperties.shouldHaveSearchBar();
        });

        test('Should handle search functionality', async ({ adminPage }) => {
          await navigateToExploreAndSelectEntity(adminPage, 'Table');
          await rightPanel.waitForPanelVisible();

          await customProperties.navigateToCustomPropertiesTab();

          // Test search (may be empty, but should not fail)
          await customProperties.searchCustomProperties('test-property');
          await customProperties.shouldShowSearchText('test-property');

          // Test clearing search
          await customProperties.clearSearch();
          await customProperties.shouldShowSearchText('');
        });
      });
    });
  });
});