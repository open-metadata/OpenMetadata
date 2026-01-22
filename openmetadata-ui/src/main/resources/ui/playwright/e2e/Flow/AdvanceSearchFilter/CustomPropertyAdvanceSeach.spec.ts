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
  CP_NEGATIVE_TEST_VALUES,
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
        CP_NEGATIVE_TEST_VALUES.string
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false,
        CP_NEGATIVE_TEST_VALUES.string
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
        CP_NEGATIVE_TEST_VALUES.partialString
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        false,
        CP_NEGATIVE_TEST_VALUES.partialString
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
        CP_NEGATIVE_TEST_VALUES.email
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
        CP_NEGATIVE_TEST_VALUES.partialString
      );
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
        CP_NEGATIVE_TEST_VALUES.integer
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
      await applyCustomPropertyFilter(
        page,
        propertyName,
        'not_between',
        CP_NEGATIVE_TEST_VALUES.integerRange
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
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
        CP_NEGATIVE_TEST_VALUES.number
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
        CP_NEGATIVE_TEST_VALUES.timestamp
      );
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
      const propertyName = propertyNames['entityReference'];

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
      await applyCustomPropertyFilter(page, propertyName, 'is_not_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);
    });

    test('Entity Reference List CP with all operators', async ({ page }) => {
      const propertyName = propertyNames['entityReferenceList'];

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
      await applyCustomPropertyFilter(page, propertyName, 'is_not_null', '');
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
      );
      await clearAdvancedSearchFilters(page);
    });
  });

  test.describe('Date/Time Custom Properties', () => {
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
        CP_NEGATIVE_TEST_VALUES.dateCp
      );
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
        'between',
        CP_RANGE_VALUES.dateTimeCp
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
        CP_NEGATIVE_TEST_VALUES.dateTimeCp
      );
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
        'between',
        CP_RANGE_VALUES.timeCp
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
        CP_NEGATIVE_TEST_VALUES.timeCp
      );
      await verifySearchResults(
        page,
        dashboard.entityResponseData.fullyQualifiedName,
        true
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
        CP_NEGATIVE_TEST_VALUES.enum
      );
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
      const propertyName = propertyNames['timeInterval'];

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
});
