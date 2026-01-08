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
import test from '@playwright/test';
import { AlertClass } from '../../support/entity/AlertClass';
import { MetricClass } from '../../support/entity/MetricClass';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import {
  createNewPage,
  testPaginationNavigation,
  uuid,
} from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.describe('Pagination tests for all pages', () => {
  test('should test pagination on Users page', async ({ page }) => {
    test.slow(true);

    await page.goto('/settings/members/users');
    await testPaginationNavigation(page, 'table');
  });

  test('should test pagination on Roles page', async ({ page }) => {
    test.slow(true);

    await page.goto('/settings/access/roles');
    await testPaginationNavigation(page, 'table');
  });

  test('should test pagination on Policies page', async ({ page }) => {
    test.slow(true);

    await page.goto('/settings/access/policies');
    await testPaginationNavigation(page, 'table');
  });

  test('should test pagination on Database Schema page', async ({ page }) => {
    test.slow(true);

    await page.goto(
      '/databaseSchema/sample_data.ecommerce_db.shopify?showDeletedTables=false'
    );
    await testPaginationNavigation(page, 'table');
  });

  test('should test pagination on Table columns', async ({ page }) => {
    test.slow(true);

    await page.goto(
      '/table/sample_data.ecommerce_db.shopify.customer_features?pageSize=3'
    );
    await testPaginationNavigation(page, 'table', 0, false);
  });

  test.describe('Service Databases page pagination', () => {
    const databases: Array<{ id: string; name: string }> = [];

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      for (let i = 1; i <= 5; i++) {
        const databaseName = `pw-test-db-${uuid()}-${i}`;
        const response = await apiContext.put('/api/v1/databases', {
          data: {
            name: databaseName,
            displayName: `PW Test Database ${i}`,
            description: `Test database ${i} for pagination testing`,
            service: 'sample_data',
          },
        });
        const data = await response.json();
        databases.push({ id: data.id, name: data.fullyQualifiedName });
      }

      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      for (const database of databases) {
        await apiContext.delete(
          `/api/v1/databases/name/${encodeURIComponent(database.name)}?hardDelete=true&recursive=true`
        );
      }

      await afterAction();
    });

    test('should test pagination on Service Databases page', async ({ page }) => {
      test.slow(true);

      await page.goto(
        '/service/databaseServices/sample_data/databases?currentPage=1&pageSize=3'
      );
      await testPaginationNavigation(page, 'table');
      await page.getByTestId('insights').click();
      await waitForAllLoadersToDisappear(page);
      await page.getByTestId('databases').click();
      await testPaginationNavigation(page, 'table');
    });
  });

  test('should test pagination on Bots page', async ({ page }) => {
    test.slow(true);

    await page.goto('/settings/bots');
    await testPaginationNavigation(page, 'table');
  });

  test('should test pagination on Service version page', async ({ page }) => {
    test.slow(true);

    await page.goto(`/service/dashboardServices/sample_superset/versions/0.1`);
    await testPaginationNavigation(page, 'table');
  });
});

test.describe('Pagination tests for Classification Tags page', () => {
  const classification = new ClassificationClass();
  const tags: TagClass[] = [];

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await classification.create(apiContext);

    for (let i = 1; i <= 20; i++) {
      const tag = new TagClass({
        classification: classification.responseData.name,
        name: `pw-tag-pagination-${uuid()}-${i}`,
        displayName: `PW Tag Pagination ${i}`,
        description: `Tag ${i} for pagination testing`,
      });
      await tag.create(apiContext);
      tags.push(tag);
    }

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    tags.reverse();
    for (const tag of tags) {
      await tag.delete(apiContext);
    }
    await classification.delete(apiContext);

    await afterAction();
  });

  test('should test pagination on Classification Tags page', async ({
    page,
  }) => {
    test.slow(true);

    await page.goto(`/tags/${classification.responseData.name}`);
    await testPaginationNavigation(page, 'table', 1);
  });
});

test.describe('Pagination tests for Metrics page', () => {
  const metrics: MetricClass[] = [];

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    for (let i = 1; i <= 20; i++) {
      const metric = new MetricClass();
      await metric.create(apiContext);
      metrics.push(metric);
    }

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    metrics.reverse();
    for (const metric of metrics) {
      await metric.delete(apiContext);
    }

    await afterAction();
  });

  test('should test pagination on Metrics page', async ({ page }) => {
    test.slow(true);

    await page.goto('/metrics');
    await testPaginationNavigation(page, 'table');
  });
});

test.describe('Pagination tests for Notification Alerts page', () => {
  const alerts: AlertClass[] = [];

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    for (let i = 1; i <= 20; i++) {
      const alert = new AlertClass({
        name: `pw-notification-alert-${uuid()}-${i}`,
        displayName: `PW Notification Alert ${i}`,
        description: `Notification alert ${i} for pagination testing`,
        alertType: 'Notification',
        resources: ['all'],
        destinations: [
          {
            type: 'Email',
            config: {
              sendToAdmins: true,
            },
            category: 'Admins',
          },
        ],
      });

      await alert.create(apiContext);
      alerts.push(alert);
    }

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    alerts.reverse();
    for (const alert of alerts) {
      await alert.delete(apiContext);
    }

    await afterAction();
  });

  test('should test pagination on Notification Alerts page', async ({
    page,
  }) => {
    test.slow(true);

    await page.goto('/settings/notifications/alerts');
    await testPaginationNavigation(page, 'table');
  });
});

test.describe('Pagination tests for Observability Alerts page', () => {
  const alerts: AlertClass[] = [];

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    for (let i = 1; i <= 20; i++) {
      const alert = new AlertClass({
        name: `pw-observability-alert-${uuid()}-${i}`,
        displayName: `PW Observability Alert ${i}`,
        description: `Observability alert ${i} for pagination testing`,
        alertType: 'Observability',
        resources: ['table'],
        destinations: [
          {
            type: 'Email',
            config: {
              sendToAdmins: true,
            },
            category: 'Admins',
          },
        ],
      });

      await alert.create(apiContext);
      alerts.push(alert);
    }

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    alerts.reverse();
    for (const alert of alerts) {
      await alert.delete(apiContext);
    }

    await afterAction();
  });

  test('should test pagination on Observability Alerts page', async ({
    page,
  }) => {
    test.slow(true);

    await page.goto('/observability/alerts');
    await testPaginationNavigation(page, 'table');
  });
});
