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
  testAdvancedSearchForCustomProperties,
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

      testAdvancedSearchForCustomProperties({
        testData,
        entity,
        topic1,
        topic2,
      });
    }
  );
}
