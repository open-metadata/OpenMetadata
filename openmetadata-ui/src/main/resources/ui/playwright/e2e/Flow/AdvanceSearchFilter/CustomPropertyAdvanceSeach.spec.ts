/*
 *  Copyright 2024 Collate.
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
import { test } from '@playwright/test';
import {
  CP_BASE_VALUES,
  CP_PARTIAL_SEARCH_VALUES,
  CP_RANGE_VALUES,
} from '../../../constant/customPropertyAdvancedSearch';
import { SidebarItem } from '../../../constant/sidebar';
import { DashboardClass } from '../../../support/entity/DashboardClass';
import { TopicClass } from '../../../support/entity/TopicClass';
import { showAdvancedSearchDialog } from '../../../utils/advancedSearch';
import { createNewPage, redirectToHomePage } from '../../../utils/common';
import {
  applyCustomPropertyFilter,
  clearAdvancedSearchFilters,
  CPASTestData,
  selectEntityReferenceValue,
  setupCustomPropertyAdvancedSearchTest,
  verifySearchResults,
} from '../../../utils/customPropertyAdvancedSearchUtils';
import { sidebarClick } from '../../../utils/sidebar';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const dashboard = new DashboardClass();
const topic1 = new TopicClass();
const topic2 = new TopicClass();

test.describe('Custom Property Advanced Search Filter for Dashboard', () => {
  const testData: CPASTestData = {
    types: [],
    cpMetadataType: { name: '', id: '' },
    createdCPData: [],
  };

  const propertyNames: Record<string, string> = {};

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { page, apiContext, afterAction } = await createNewPage(browser);

    await dashboard.create(apiContext);
    await topic1.create(apiContext);
    await topic2.create(apiContext);
    await setupCustomPropertyAdvancedSearchTest(
      page,
      testData as unknown as CPASTestData,
      dashboard,
      topic1,
      topic2
    );

    testData.createdCPData.forEach((cp) => {
      propertyNames[cp.propertyType.name] = cp.name;
    });

    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.EXPLORE);
  });

  test.describe('Text Field Custom Properties', () => {
    test('String CP with all operators', async ({ page }) => {
      const propertyName = propertyNames['string'];

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'equal',
        CP_BASE_VALUES.string
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true,
        CP_BASE_VALUES.string
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'not_equal',
        CP_BASE_VALUES.string
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false,
        CP_BASE_VALUES.string
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'like',
        CP_PARTIAL_SEARCH_VALUES.string
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true,
        CP_PARTIAL_SEARCH_VALUES.string
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'not_like',
        CP_BASE_VALUES.string
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false,
        CP_BASE_VALUES.string
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, propertyName, 'is_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, propertyName, 'is_not_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);
    });

    test('Email CP with all operators', async ({ page }) => {
      const propertyName = propertyNames['email'];

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'equal',
        CP_BASE_VALUES.email
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true,
        CP_BASE_VALUES.email
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'not_equal',
        CP_BASE_VALUES.email
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'like',
        CP_PARTIAL_SEARCH_VALUES.email
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, propertyName, 'is_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, propertyName, 'is_not_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);
    });

    test('Markdown CP with all operators', async ({ page }) => {
      const propertyName = propertyNames['markdown'];

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'like',
        CP_PARTIAL_SEARCH_VALUES.markdown
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'not_like',
        CP_BASE_VALUES.markdown
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, propertyName, 'is_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, propertyName, 'is_not_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);
    });

    test('SQL Query CP with all operators', async ({ page }) => {
      const propertyName = propertyNames['sqlQuery'];

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'like',
        CP_PARTIAL_SEARCH_VALUES.sqlQuery
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, propertyName, 'is_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, propertyName, 'is_not_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);
    });

    test('Duration CP with all operators', async ({ page }) => {
      const propertyName = propertyNames['duration'];

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'equal',
        CP_BASE_VALUES.duration
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'like',
        CP_PARTIAL_SEARCH_VALUES.duration
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, propertyName, 'is_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, propertyName, 'is_not_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);
    });

    test('DateTime CP with all operators', async ({ page }) => {
      const propertyName = propertyNames['dateTime-cp'];

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'equal',
        CP_BASE_VALUES.dateTimeCp
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'like',
        CP_PARTIAL_SEARCH_VALUES.dateTimeCp
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, propertyName, 'is_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, propertyName, 'is_not_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);
    });

    test('Time CP with all operators', async ({ page }) => {
      const propertyName = propertyNames['time-cp'];

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'equal',
        CP_BASE_VALUES.timeCp
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'like',
        CP_PARTIAL_SEARCH_VALUES.timeCp
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, propertyName, 'is_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, propertyName, 'is_not_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);
    });
  });

  test.describe('Number Field Custom Properties', () => {
    test('Integer CP with all operators', async ({ page }) => {
      const propertyName = propertyNames['integer'];

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'equal',
        CP_BASE_VALUES.integer
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'not_equal',
        CP_BASE_VALUES.integer
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'between',
        CP_RANGE_VALUES.integer
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, propertyName, 'not_between', {
        start: CP_BASE_VALUES.integer - 2,
        end: CP_BASE_VALUES.integer + 4,
      });
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, propertyName, 'is_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, propertyName, 'is_not_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);
    });

    test('Number CP with all operators', async ({ page }) => {
      const propertyName = propertyNames['number'];

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'equal',
        CP_BASE_VALUES.number
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'not_equal',
        CP_BASE_VALUES.number
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'between',
        CP_RANGE_VALUES.number
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, propertyName, 'is_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, propertyName, 'is_not_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);
    });

    test('Timestamp CP with all operators', async ({ page }) => {
      const propertyName = propertyNames['timestamp'];

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'equal',
        CP_BASE_VALUES.timestamp
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'not_equal',
        CP_BASE_VALUES.timestamp
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, propertyName, 'is_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, propertyName, 'is_not_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);
    });
  });

  test.describe('Entity Reference Custom Properties', () => {
    test('Entity Reference CP with all operators', async ({ page }) => {
      test.slow();
      const propertyName = propertyNames['entityReference'];
      const containsText = topic1.entityResponseData.displayName.substring(
        1,
        5
      );
      const regexpText = `${topic1.entityResponseData.displayName.substring(
        0,
        2
      )}.*${topic1.entityResponseData.displayName.substring(5, 7)}.*`;

      await showAdvancedSearchDialog(page);
      const ruleLocator = page.locator('.rule').nth(0);
      await applyCustomPropertyFilter(page, propertyName, 'select_equals', '');
      await selectEntityReferenceValue(
        page,
        ruleLocator,
        topic1.entityResponseData.name
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      const ruleLocator2 = page.locator('.rule').nth(0);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'select_not_equals',
        ''
      );
      await selectEntityReferenceValue(
        page,
        ruleLocator2,
        topic1.entityResponseData.name
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, propertyName, 'like', containsText);
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true,
        containsText
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'not_like',
        containsText
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false,
        containsText
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, propertyName, 'regexp', regexpText);
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true,
        regexpText
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, propertyName, 'is_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, propertyName, 'is_not_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);
    });

    test('Entity Reference List CP with all operators', async ({ page }) => {
      test.slow();
      const propertyName = propertyNames['entityReferenceList'];
      const containsText = topic1.entityResponseData.displayName.substring(
        1,
        5
      );
      const regexpText = `${topic1.entityResponseData.displayName.substring(
        0,
        2
      )}.*${topic1.entityResponseData.displayName.substring(5, 7)}.*`;

      await showAdvancedSearchDialog(page);
      const ruleLocator = page.locator('.rule').nth(0);
      await applyCustomPropertyFilter(page, propertyName, 'select_equals', '');
      await selectEntityReferenceValue(
        page,
        ruleLocator,
        topic1.entityResponseData.name
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      const ruleLocator2 = page.locator('.rule').nth(0);
      await applyCustomPropertyFilter(page, propertyName, 'select_equals', '');
      await selectEntityReferenceValue(
        page,
        ruleLocator2,
        topic2.entityResponseData.name
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      const ruleLocator3 = page.locator('.rule').nth(0);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'select_not_equals',
        ''
      );
      await selectEntityReferenceValue(
        page,
        ruleLocator3,
        topic2.entityResponseData.name
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, propertyName, 'like', containsText);
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true,
        containsText
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'not_like',
        containsText
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false,
        containsText
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, propertyName, 'regexp', regexpText);
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true,
        regexpText
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, propertyName, 'is_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, propertyName, 'is_not_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);
    });
  });

  test.describe('Date Custom Properties', () => {
    test('Date CP with all operators', async ({ page }) => {
      const propertyName = propertyNames['date-cp'];

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'between',
        CP_RANGE_VALUES.dateCp
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'not_between',
        CP_RANGE_VALUES.dateCp
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);
    });
  });

  test.describe('Enum Custom Properties', () => {
    test('Enum CP with all operators', async ({ page }) => {
      const propertyName = propertyNames['enum'];

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'multiselect_equals',
        CP_BASE_VALUES.enum[0]
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'multiselect_contains',
        CP_BASE_VALUES.enum[0]
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'multiselect_not_equals',
        CP_BASE_VALUES.enum[0]
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'multiselect_not_contains',
        CP_BASE_VALUES.enum[0]
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, propertyName, 'is_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, propertyName, 'is_not_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);
    });
  });

  test.describe('Special Custom Properties', () => {
    test('Time Interval CP with operators', async ({ page }) => {
      test.slow();

      const propertyName = propertyNames['timeInterval'];
      const startPropertyName = `${propertyName} (Start)`;
      const endPropertyName = `${propertyName} (End)`;

      // Start time checks
      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        startPropertyName,
        'equal',
        CP_BASE_VALUES.timeInterval.start
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true,
        String(CP_BASE_VALUES.timeInterval.start)
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        startPropertyName,
        'not_equal',
        CP_BASE_VALUES.timeInterval.start
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false,
        String(CP_BASE_VALUES.timeInterval.start)
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        startPropertyName,
        'like',
        CP_BASE_VALUES.timeInterval.start
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true,
        String(CP_BASE_VALUES.timeInterval.start)
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        startPropertyName,
        'not_like',
        CP_BASE_VALUES.timeInterval.start
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false,
        String(CP_BASE_VALUES.timeInterval.start)
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        startPropertyName,
        'is_not_null',
        ''
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, startPropertyName, 'is_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      // End time checks
      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        endPropertyName,
        'equal',
        CP_BASE_VALUES.timeInterval.end
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true,
        String(CP_BASE_VALUES.timeInterval.end)
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        endPropertyName,
        'not_equal',
        CP_BASE_VALUES.timeInterval.end
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false,
        String(CP_BASE_VALUES.timeInterval.end)
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        endPropertyName,
        'like',
        CP_BASE_VALUES.timeInterval.end
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true,
        String(CP_BASE_VALUES.timeInterval.end)
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        endPropertyName,
        'not_like',
        CP_BASE_VALUES.timeInterval.end
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false,
        String(CP_BASE_VALUES.timeInterval.end)
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, endPropertyName, 'is_not_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, endPropertyName, 'is_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);
    });
  });

  test.describe('Table Custom Properties', () => {
    test('Table CP - Name column with all operators', async ({ page }) => {
      const basePropertyName = propertyNames['table-cp'];
      const columnPropertyName = `${basePropertyName} - Name`;

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        columnPropertyName,
        'equal',
        'User1'
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true,
        'User1'
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        columnPropertyName,
        'not_equal',
        'User1'
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        columnPropertyName,
        'like',
        CP_PARTIAL_SEARCH_VALUES.tableCp
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true,
        CP_PARTIAL_SEARCH_VALUES.tableCp
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        columnPropertyName,
        'not_like',
        'User1'
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, columnPropertyName, 'is_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        columnPropertyName,
        'is_not_null',
        ''
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);
    });

    test('Table CP - Role column with all operators', async ({ page }) => {
      const basePropertyName = propertyNames['table-cp'];
      const columnPropertyName = `${basePropertyName} - Role`;

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        columnPropertyName,
        'equal',
        'Admin'
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true,
        'Admin'
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        columnPropertyName,
        'not_equal',
        'Admin'
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        columnPropertyName,
        'like',
        'Admin'
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true,
        'Admin'
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        columnPropertyName,
        'not_like',
        'Admin'
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, columnPropertyName, 'is_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        columnPropertyName,
        'is_not_null',
        ''
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);
    });

    test('Table CP - Sr No column with all operators', async ({ page }) => {
      const basePropertyName = propertyNames['table-cp'];
      const columnPropertyName = `${basePropertyName} - Sr No`;

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, columnPropertyName, 'equal', '1');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true,
        '1'
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        columnPropertyName,
        'not_equal',
        '1'
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, columnPropertyName, 'like', '1');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true,
        '1'
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        columnPropertyName,
        'not_like',
        '1'
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(page, columnPropertyName, 'is_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false
      );
      await clearAdvancedSearchFilters(page);

      await showAdvancedSearchDialog(page);
      await applyCustomPropertyFilter(
        page,
        columnPropertyName,
        'is_not_null',
        ''
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);
    });
  });
});
