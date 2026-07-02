/*
 *  Copyright 2026 Collate.
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
import { Page, test as base } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { ApiCollectionClass } from '../../support/entity/ApiCollectionClass';
import { ApiEndpointClass } from '../../support/entity/ApiEndpointClass';
import { ChartClass } from '../../support/entity/ChartClass';
import { ContainerClass } from '../../support/entity/ContainerClass';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../../support/entity/DashboardDataModelClass';
import { DatabaseClass } from '../../support/entity/DatabaseClass';
import { DatabaseSchemaClass } from '../../support/entity/DatabaseSchemaClass';
import { DirectoryClass } from '../../support/entity/DirectoryClass';
import { FileClass } from '../../support/entity/FileClass';
import { MetricClass } from '../../support/entity/MetricClass';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../support/entity/SearchIndexClass';
import { SpreadsheetClass } from '../../support/entity/SpreadsheetClass';
import { StoredProcedureClass } from '../../support/entity/StoredProcedureClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { WorksheetClass } from '../../support/entity/WorksheetClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { expectBreadcrumbCrumbsUnique } from '../../utils/headerBreadcrumbUtils';

const entities = {
  Database: DatabaseClass,
  'Database Schema': DatabaseSchemaClass,
  Metric: MetricClass,
  Table: TableClass,
  'Stored Procedure': StoredProcedureClass,
  Dashboard: DashboardClass,
  Pipeline: PipelineClass,
  Topic: TopicClass,
  'Ml Model': MlModelClass,
  Container: ContainerClass,
  'Search Index': SearchIndexClass,
  'Dashboard Data Model': DashboardDataModelClass,
  Chart: ChartClass,
  'Api Collection': ApiCollectionClass,
  'Api Endpoint': ApiEndpointClass,
  Directory: DirectoryClass,
  File: FileClass,
  Spreadsheet: SpreadsheetClass,
  Worksheet: WorksheetClass,
} as const;

const adminUser = new UserClass();

const test = base.extend<{ page: Page }>({
  page: async ({ browser }, use) => {
    const adminPage = await browser.newPage();
    await adminUser.login(adminPage);
    await use(adminPage);
    await adminPage.close();
  },
});

test.beforeAll('Setup admin', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await adminUser.create(apiContext);
  await adminUser.setAdminRole(apiContext);
  await afterAction();
});

test.afterAll('Cleanup admin', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await adminUser.delete(apiContext);
  await afterAction();
});

Object.entries(entities).forEach(([label, EntityClass]) => {
  const entity = new EntityClass();

  test.describe(
    `Entity header breadcrumb - ${label}`,
    PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
    () => {
      test.slow(true);

      test.beforeAll('Create entity', async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        await entity.create(apiContext);
        await afterAction();
      });

      test.afterAll('Delete entity', async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        await entity.delete(apiContext);
        await afterAction();
      });

      test.beforeEach('Visit entity page', async ({ page }) => {
        await redirectToHomePage(page);
        await entity.visitEntityPage(page);
      });

      test('should render every breadcrumb crumb exactly once', async ({
        page,
      }) => {
        await expectBreadcrumbCrumbsUnique(page);
      });
    }
  );
});
