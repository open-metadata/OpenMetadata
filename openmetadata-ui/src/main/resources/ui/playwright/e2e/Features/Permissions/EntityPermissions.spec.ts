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

import { Page, test as base } from '@playwright/test';
import { ApiEndpointClass } from '../../../support/entity/ApiEndpointClass';
import { ContainerClass } from '../../../support/entity/ContainerClass';
import { DashboardClass } from '../../../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../../../support/entity/DashboardDataModelClass';
import { EntityDataClass } from '../../../support/entity/EntityDataClass';
import { MetricClass } from '../../../support/entity/MetricClass';
import { MlModelClass } from '../../../support/entity/MlModelClass';
import { PipelineClass } from '../../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../../support/entity/SearchIndexClass';
import { StoredProcedureClass } from '../../../support/entity/StoredProcedureClass';
import { TableClass } from '../../../support/entity/TableClass';
import { TopicClass } from '../../../support/entity/TopicClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import {
  testApiEndpointSpecificOperations,
  testCommonOperations,
  testContainerSpecificOperations,
  testDashboardDataModelSpecificOperations,
  testDashboardSpecificOperations,
  testMetricSpecificOperations,
  testMlModelSpecificOperations,
  testPipelineSpecificOperations,
  testSearchIndexSpecificOperations,
  testStoredProcedureSpecificOperations,
  testTableSpecificOperations,
  testTopicSpecificOperations,
} from '../../../utils/entityPermissionUtils';
import {
  getEntityClass,
  getEntityResources,
  hasEntityClass,
} from '../../../utils/resourcePermissionConfig';

const entities = [
  ApiEndpointClass,
  TableClass,
  StoredProcedureClass,
  DashboardClass,
  PipelineClass,
  TopicClass,
  MlModelClass,
  ContainerClass,
  SearchIndexClass,
  DashboardDataModelClass,
  MetricClass,
] as const;

const adminUser = new UserClass();
const testUser = new UserClass();
const dataConsumerUser = new UserClass();

const createdEntities: any[] = [];

const test = base.extend<{
  page: Page;
  testUserPage: Page;
  dataConsumerPage: Page;
}>({
  page: async ({ browser }, use) => {
    const adminPage = await browser.newPage();
    await adminUser.login(adminPage);
    await use(adminPage);
    await adminPage.close();
  },
  testUserPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await testUser.login(page);
    await use(page);
    await page.close();
  },
  dataConsumerPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await dataConsumerUser.login(page);
    await use(page);
    await page.close();
  },
});

test.beforeAll('Setup pre-requests', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await adminUser.create(apiContext);
  await adminUser.setAdminRole(apiContext);
  await testUser.create(apiContext);
  await dataConsumerUser.create(apiContext);

  // Create entities for all entity resources
  const entityResources = getEntityResources();
  for (const resourceName of entityResources) {
    if (hasEntityClass(resourceName)) {
      const entityClass = getEntityClass(resourceName);
      const entity = new entityClass();
      await entity.create(apiContext);
      createdEntities.push({ name: resourceName, entity });
    }
  }

  await afterAction();
});

entities.forEach((EntityClass) => {
  const entity = new EntityClass();
  const entityName = entity.getType();

  test.describe(`${entityName} Permissions`, () => {
    test.beforeAll('Setup entity', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await EntityDataClass.preRequisitesForTests(apiContext);
      await entity.create(apiContext);
      await afterAction();
    });

    test('common operations permissions', async ({ page, testUserPage }) => {
      test.slow(true);

      // Test allow
      await testCommonOperations(page, testUserPage, entity, 'allow', testUser);

      // Test deny
      await testCommonOperations(page, testUserPage, entity, 'deny', testUser);
    });

    // Entity-specific tests
    if (entityName === 'Table') {
      test.slow(true);

      test('Table specific allow operations', async ({
        page,
        testUserPage,
      }) => {
        await testTableSpecificOperations(
          page,
          testUserPage,
          entity,
          'allow',
          testUser
        );
      });

      test('Table specific deny operations', async ({ page, testUserPage }) => {
        await testTableSpecificOperations(
          page,
          testUserPage,
          entity,
          'deny',
          testUser
        );
      });
    }

    if (entityName === 'Topic') {
      test('topic-specific allow operations', async ({
        page,
        testUserPage,
      }) => {
        await testTopicSpecificOperations(
          page,
          testUserPage,
          entity,
          'allow',
          testUser
        );
      });

      test('topic-specific deny operations', async ({ page, testUserPage }) => {
        await testTopicSpecificOperations(
          page,
          testUserPage,
          entity,
          'deny',
          testUser
        );
      });
    }

    if (entityName === 'Container') {
      test('container-specific allow operations', async ({
        page,
        testUserPage,
      }) => {
        await testContainerSpecificOperations(
          page,
          testUserPage,
          entity,
          'allow',
          testUser
        );
      });

      test('container-specific deny operations', async ({
        page,
        testUserPage,
      }) => {
        await testContainerSpecificOperations(
          page,
          testUserPage,
          entity,
          'deny',
          testUser
        );
      });
    }

    if (entityName === 'Dashboard') {
      test('dashboard-specific allow operations', async ({
        page,
        testUserPage,
      }) => {
        await testDashboardSpecificOperations(
          page,
          testUserPage,
          entity,
          'allow',
          testUser
        );
      });

      test('dashboard-specific deny operations', async ({
        page,
        testUserPage,
      }) => {
        await testDashboardSpecificOperations(
          page,
          testUserPage,
          entity,
          'deny',
          testUser
        );
      });
    }

    if (entityName === 'Pipeline') {
      test('pipeline-specific allow operations', async ({
        page,
        testUserPage,
      }) => {
        await testPipelineSpecificOperations(
          page,
          testUserPage,
          entity,
          'allow',
          testUser
        );
      });

      test('pipeline-specific deny operations', async ({
        page,
        testUserPage,
      }) => {
        await testPipelineSpecificOperations(
          page,
          testUserPage,
          entity,
          'deny',
          testUser
        );
      });
    }

    if (entityName === 'MlModel') {
      test('ML model-specific allow operations', async ({
        page,
        testUserPage,
      }) => {
        await testMlModelSpecificOperations(
          page,
          testUserPage,
          entity,
          'allow',
          testUser
        );
      });

      test('ML model-specific deny operations', async ({
        page,
        testUserPage,
      }) => {
        await testMlModelSpecificOperations(
          page,
          testUserPage,
          entity,
          'deny',
          testUser
        );
      });
    }

    if (entityName === 'SearchIndex') {
      test('search index-specific allow operations', async ({
        page,
        testUserPage,
      }) => {
        await testSearchIndexSpecificOperations(
          page,
          testUserPage,
          entity,
          'allow',
          testUser
        );
      });

      test('search index-specific deny operations', async ({
        page,
        testUserPage,
      }) => {
        await testSearchIndexSpecificOperations(
          page,
          testUserPage,
          entity,
          'deny',
          testUser
        );
      });
    }

    if (entityName === 'StoredProcedure') {
      test('stored procedure-specific allow operations', async ({
        page,
        testUserPage,
      }) => {
        await testStoredProcedureSpecificOperations(
          page,
          testUserPage,
          entity,
          'allow',
          testUser
        );
      });

      test('stored procedure-specific deny operations', async ({
        page,
        testUserPage,
      }) => {
        await testStoredProcedureSpecificOperations(
          page,
          testUserPage,
          entity,
          'deny',
          testUser
        );
      });
    }

    if (entityName === 'Metric') {
      test('metric-specific allow operations', async ({
        page,
        testUserPage,
      }) => {
        await testMetricSpecificOperations(
          page,
          testUserPage,
          entity,
          'allow',
          testUser
        );
      });

      test('metric-specific deny operations', async ({
        page,
        testUserPage,
      }) => {
        await testMetricSpecificOperations(
          page,
          testUserPage,
          entity,
          'deny',
          testUser
        );
      });
    }

    if (entityName === 'ApiEndpoint') {
      test('API endpoint-specific allow operations', async ({
        page,
        testUserPage,
      }) => {
        await testApiEndpointSpecificOperations(
          page,
          testUserPage,
          entity,
          'allow',
          testUser
        );
      });

      test('API endpoint-specific deny operations', async ({
        page,
        testUserPage,
      }) => {
        await testApiEndpointSpecificOperations(
          page,
          testUserPage,
          entity,
          'deny',
          testUser
        );
      });
    }

    if (entityName === 'DashboardDataModel') {
      test('dashboard data model-specific allow operations', async ({
        page,
        testUserPage,
      }) => {
        await testDashboardDataModelSpecificOperations(
          page,
          testUserPage,
          entity,
          'allow',
          testUser
        );
      });

      test('dashboard data model-specific deny operations', async ({
        page,
        testUserPage,
      }) => {
        await testDashboardDataModelSpecificOperations(
          page,
          testUserPage,
          entity,
          'deny',
          testUser
        );
      });
    }

    test.afterAll('Cleanup entity', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await entity.delete(apiContext);
      await EntityDataClass.postRequisitesForTests(apiContext);
      await afterAction();
    });
  });
});

test.afterAll('Cleanup', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await adminUser.delete(apiContext);
  await testUser.delete(apiContext);

  for (const { entity } of createdEntities) {
    await entity.delete(apiContext);
  }

  await afterAction();
});
