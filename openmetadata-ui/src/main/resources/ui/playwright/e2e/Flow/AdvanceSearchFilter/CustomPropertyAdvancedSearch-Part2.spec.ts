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
import { DatabaseClass } from '../../../support/entity/DatabaseClass';
import { DatabaseSchemaClass } from '../../../support/entity/DatabaseSchemaClass';
import { DirectoryClass } from '../../../support/entity/DirectoryClass';
import { FileClass } from '../../../support/entity/FileClass';
import { TopicClass } from '../../../support/entity/TopicClass';
import { createNewPage, redirectToHomePage } from '../../../utils/common';
import {
  CPASTestData,
  setupCustomPropertyAdvancedSearchTest,
  testASForDateTypedCP,
  testASForEntityReferenceTypedCP,
  testASForEnumTypedCP,
  testASForNumberTypedCP,
  testASForTextTypedCP,
} from '../../../utils/customPropertyAdvancedSearchUtils';
import { sidebarClick } from '../../../utils/sidebar';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const entitiesList = {
  Dashboard: DashboardClass,
  Database: DatabaseClass,
  'Database Schema': DatabaseSchemaClass,
  Directory: DirectoryClass,
  File: FileClass,
};

for (const [name, EntityClass] of Object.entries(entitiesList)) {
  test.describe(
    `Custom Property Advanced Search Filter for ${name}`,
    async () => {
      const entity = new EntityClass();
      const topic1 = new TopicClass();
      const topic2 = new TopicClass();
      const testData: CPASTestData = {
        types: [],
        cpMetadataType: { name: '', id: '' },
        createdCPData: [],
        propertyNames: {},
      };

      test.beforeAll('Setup pre-requests', async ({ browser }) => {
        test.slow();
        const { page, apiContext, afterAction } = await createNewPage(browser);

        await entity.create(apiContext);
        await topic1.create(apiContext);
        await topic2.create(apiContext);
        await setupCustomPropertyAdvancedSearchTest(
          page,
          testData as unknown as CPASTestData,
          entity,
          topic1,
          topic2
        );

        testData.createdCPData.forEach((cp) => {
          testData.propertyNames[cp.propertyType.name] = cp.name;
        });

        await afterAction();
      });

      test.beforeEach(async ({ page }) => {
        await redirectToHomePage(page);
        await sidebarClick(page, SidebarItem.EXPLORE);
      });

      test.describe('Text Field Custom Properties', () => {
        test('String CP with all operators', async ({ page }) => {
          test.slow();
          const propertyName = testData.propertyNames['string'];

          await testASForTextTypedCP({
            page,
            entity,
            propertyName,
            equalValue: CP_BASE_VALUES.string,
            likeValue: CP_PARTIAL_SEARCH_VALUES.string,
          });
        });

        test('Email CP with all operators', async ({ page }) => {
          const propertyName = testData.propertyNames['email'];

          await testASForTextTypedCP({
            page,
            entity,
            propertyName,
            equalValue: CP_BASE_VALUES.email,
            likeValue: CP_PARTIAL_SEARCH_VALUES.email,
          });
        });

        test('Markdown CP with all operators', async ({ page }) => {
          const propertyName = testData.propertyNames['markdown'];

          await testASForTextTypedCP({
            page,
            entity,
            propertyName,
            equalValue: CP_BASE_VALUES.markdown,
            likeValue: CP_PARTIAL_SEARCH_VALUES.markdown,
          });
        });

        test('SQL Query CP with all operators', async ({ page }) => {
          const propertyName = testData.propertyNames['sqlQuery'];

          await testASForTextTypedCP({
            page,
            entity,
            propertyName,
            equalValue: CP_BASE_VALUES.sqlQuery,
            likeValue: CP_PARTIAL_SEARCH_VALUES.sqlQuery,
          });
        });

        test('Duration CP with all operators', async ({ page }) => {
          const propertyName = testData.propertyNames['duration'];

          await testASForTextTypedCP({
            page,
            entity,
            propertyName,
            equalValue: CP_BASE_VALUES.duration,
            likeValue: CP_PARTIAL_SEARCH_VALUES.duration,
          });
        });

        test('Time CP with all operators', async ({ page }) => {
          test.slow();
          const propertyName = testData.propertyNames['time-cp'];

          await testASForTextTypedCP({
            page,
            entity,
            propertyName,
            equalValue: CP_BASE_VALUES.timeCp,
            likeValue: CP_PARTIAL_SEARCH_VALUES.timeCp,
          });
        });
      });

      test.describe('Number Field Custom Properties', () => {
        test('Integer CP with all operators', async ({ page }) => {
          const propertyName = testData.propertyNames['integer'];

          await testASForNumberTypedCP({
            page,
            entity,
            propertyName,
            equalValue: CP_BASE_VALUES.integer,
            rangeValue: CP_RANGE_VALUES.integer,
          });
        });

        test('Number CP with all operators', async ({ page }) => {
          const propertyName = testData.propertyNames['number'];

          await testASForNumberTypedCP({
            page,
            entity,
            propertyName,
            equalValue: CP_BASE_VALUES.number,
            rangeValue: CP_RANGE_VALUES.number,
          });
        });

        test('Timestamp CP with all operators', async ({ page }) => {
          const propertyName = testData.propertyNames['timestamp'];

          await testASForNumberTypedCP({
            page,
            entity,
            propertyName,
            equalValue: CP_BASE_VALUES.timestamp,
            rangeValue: CP_RANGE_VALUES.timestamp,
          });
        });
      });

      test.describe('Entity Reference Custom Properties', () => {
        test('Entity Reference CP with all operators', async ({ page }) => {
          test.slow();
          const propertyName = testData.propertyNames['entityReference'];
          await testASForEntityReferenceTypedCP({
            page,
            entity,
            propertyName,
            topic1,
          });
        });

        test('Entity Reference List CP with all operators', async ({
          page,
        }) => {
          test.slow();
          const propertyName = testData.propertyNames['entityReferenceList'];

          await testASForEntityReferenceTypedCP({
            page,
            entity,
            propertyName,
            topic1,
            topic2,
          });
        });
      });

      test.describe('Date Custom Properties', () => {
        test('DateTime CP with all operators', async ({ page }) => {
          test.slow();
          const propertyName = testData.propertyNames['dateTime-cp'];

          await testASForDateTypedCP({
            page,
            entity,
            propertyName,
            equalValue: CP_BASE_VALUES.dateTimeCp,
            rangeValue: CP_RANGE_VALUES.dateTimeCp,
            propertyType: 'dateTime-cp',
          });
        });

        test('Date CP with all operators', async ({ page }) => {
          test.slow();
          const propertyName = testData.propertyNames['date-cp'];

          await testASForDateTypedCP({
            page,
            entity,
            propertyName,
            equalValue: CP_BASE_VALUES.dateCp,
            rangeValue: CP_RANGE_VALUES.dateCp,
            propertyType: 'date-cp',
          });
        });
      });

      test.describe('Enum Custom Properties', () => {
        test('Enum CP with all operators', async ({ page }) => {
          test.slow();
          const propertyName = testData.propertyNames['enum'];

          await testASForEnumTypedCP({
            page,
            entity,
            propertyName,
            equalValue: CP_BASE_VALUES.enum[0],
            likeValue: CP_PARTIAL_SEARCH_VALUES.enum,
          });
        });
      });

      test.describe('Special Custom Properties', () => {
        test('Time Interval CP with all operators', async ({ page }) => {
          test.slow();

          const propertyName = testData.propertyNames['timeInterval'];
          const startPropertyName = `${propertyName} (Start)`;
          const endPropertyName = `${propertyName} (End)`;

          // Start time checks
          await testASForNumberTypedCP({
            page,
            entity,
            propertyName: startPropertyName,
            equalValue: CP_BASE_VALUES.timeInterval.start,
            rangeValue: CP_RANGE_VALUES.timeInterval.start,
          });

          // End time checks
          await testASForNumberTypedCP({
            page,
            entity,
            propertyName: endPropertyName,
            equalValue: CP_BASE_VALUES.timeInterval.end,
            rangeValue: CP_RANGE_VALUES.timeInterval.end,
          });
        });

        test('Hyperlink CP with all operators', async ({ page }) => {
          test.slow();

          const propertyName = testData.propertyNames['hyperlink-cp'];
          const urlProperty = `${propertyName} URL`;
          const displayTextProperty = `${propertyName} Display Text`;

          // URL Field checks
          await testASForTextTypedCP({
            page,
            entity,
            propertyName: urlProperty,
            equalValue: CP_BASE_VALUES.hyperlinkCp.url,
            likeValue: CP_PARTIAL_SEARCH_VALUES.hyperlinkCp.url,
          });

          // Display Text Field checks
          await testASForTextTypedCP({
            page,
            entity,
            propertyName: displayTextProperty,
            equalValue: CP_BASE_VALUES.hyperlinkCp.displayText,
            likeValue: CP_PARTIAL_SEARCH_VALUES.hyperlinkCp.displayText,
          });
        });
      });

      test.describe('Table Custom Properties', () => {
        test('Table CP - Name column with all operators', async ({ page }) => {
          const value = CP_BASE_VALUES.tableCp.rows[0]['Name'];
          const partialValue = value.substring(1, 4);
          const basePropertyName = testData.propertyNames['table-cp'];
          const columnPropertyName = `${basePropertyName} - Name`;

          await testASForTextTypedCP({
            page,
            entity,
            propertyName: columnPropertyName,
            equalValue: value,
            likeValue: partialValue,
          });
        });

        test('Table CP - Role column with all operators', async ({ page }) => {
          const value = CP_BASE_VALUES.tableCp.rows[0]['Role'];
          const partialValue = value.substring(1, 4);
          const basePropertyName = testData.propertyNames['table-cp'];
          const columnPropertyName = `${basePropertyName} - Role`;

          await testASForTextTypedCP({
            page,
            entity,
            propertyName: columnPropertyName,
            equalValue: value,
            likeValue: partialValue,
          });
        });

        test('Table CP - Sr No column with all operators', async ({ page }) => {
          const value = CP_BASE_VALUES.tableCp.rows[1]['Sr No'];
          const basePropertyName = testData.propertyNames['table-cp'];
          const columnPropertyName = `${basePropertyName} - Sr No`;

          await testASForTextTypedCP({
            page,
            entity,
            propertyName: columnPropertyName,
            equalValue: value,
            likeValue: value,
          });
        });
      });
    }
  );
}
