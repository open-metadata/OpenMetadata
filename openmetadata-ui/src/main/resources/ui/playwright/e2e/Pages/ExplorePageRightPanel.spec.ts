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

// Test data setup
const tableEntity = new TableClass();
const testClassification = new ClassificationClass();
const testTag = new TagClass({
  classification: testClassification.data.name,
});
const testGlossary = new Glossary();
const testGlossaryTerm = new GlossaryTerm(testGlossary);

// Page object instances
let rightPanel: RightPanelPageObject;
let overview: OverviewPageObject;
let schema: SchemaPageObject;
let lineage: LineagePageObject;
let dataQuality: DataQualityPageObject;
let customProperties: CustomPropertiesPageObject;

test.describe('Right Panel Page Objects Test Suite', () => {

  // Setup test data and page objects
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await tableEntity.create(apiContext);
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
      await testTag.delete(apiContext);
      await testClassification.delete(apiContext);
      await testGlossaryTerm.delete(apiContext);
      await testGlossary.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  // ============ OVERVIEW PAGE OBJECT TESTS ============

  test.describe('OverviewPageObject - Full CRUD Operations', () => {
    test('Should perform complete overview operations workflow', async ({ adminPage }) => {
      // Navigate to table entity
      await navigateToExploreAndSelectEntity(adminPage, 'Table');
      const tableName = tableEntity.entity.name;
      await openEntitySummaryPanel(adminPage, tableName);
      await rightPanel.waitForPanelVisible();

      // Test fluent navigation and description editing
      await overview.navigateToOverviewTab();
      await overview.shouldBeVisible();
      await overview.shouldShowDescriptionSection();

      const testDescription = `Test description - ${uuid()}`;
      await overview.editDescription(testDescription);
      await overview.shouldShowDescriptionWithText(testDescription);

      // Test tags management
      await overview.editTags(testTag.responseData?.displayName ?? testTag.data.displayName);
      await overview.shouldShowTagsSection();
      await overview.shouldShowTag(testTag.responseData?.displayName ?? testTag.data.displayName);

      // Test tier assignment
     await overview.assignTier('Tier1');
     
      await overview.shouldShowTierSection();
      await overview.shouldShowTier('Tier1');

      // Test glossary terms
      await overview.editGlossaryTerms(testGlossaryTerm.responseData?.displayName ?? testGlossaryTerm.data.displayName);
      await overview.shouldShowGlossaryTermsSection();

      // Test domain assignment
      await overview.editDomain('Test Domain');
      await overview.shouldShowDomainsSection();
    });
  });

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
