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
import { expect, Page, test as base } from '@playwright/test';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import {
  addAndVerifyWidget,
  removeAndVerifyWidget,
  setUserDefaultPersona,
} from '../../utils/customizeLandingPage';
import {
  verifyActivityFeedFilters,
  verifyDataFilters,
  verifyDataProductsFilters,
  verifyDomainsFilters,
  verifyTaskFilters,
  verifyTotalDataAssetsFilters,
} from '../../utils/widgetFilters';

const adminUser = new UserClass();
const persona = new PersonaClass();

// Test domain and data products for comprehensive testing
const testDomain = new Domain();
const testDataProducts = [
  new DataProduct([testDomain], 'pw-data-product-customer'),
  new DataProduct([testDomain], 'pw-data-product-sales'),
  new DataProduct([testDomain], 'pw-data-product-marketing'),
];

const createdDataProducts: DataProduct[] = [];

const test = base.extend<{ page: Page }>({
  page: async ({ browser }, use) => {
    const page = await browser.newPage();
    await adminUser.login(page);
    await use(page);
    await page.close();
  },
});

base.beforeAll('Setup pre-requests', async ({ browser }) => {
  const { afterAction, apiContext } = await performAdminLogin(browser);
  await adminUser.create(apiContext);
  await adminUser.setAdminRole(apiContext);
  await persona.create(apiContext, [adminUser.responseData.id]);

  // Create test domain first
  await testDomain.create(apiContext);

  // Create test data products
  for (const dp of testDataProducts) {
    await dp.create(apiContext);
    createdDataProducts.push(dp);
  }

  await afterAction();
});

base.afterAll('Cleanup', async ({ browser }) => {
  const { afterAction, apiContext } = await performAdminLogin(browser);
  await adminUser.delete(apiContext);
  await persona.delete(apiContext);

  // Delete test data products
  for (const dp of createdDataProducts) {
    await dp.delete(apiContext);
  }

  // Delete test domain
  await testDomain.delete(apiContext);

  await afterAction();
});

test.describe('Widgets', () => {
  test.beforeAll(async ({ page }) => {
    test.slow(true);

    await redirectToHomePage(page);
    await setUserDefaultPersona(page, persona.responseData.displayName);
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Activity Feed', async ({ page }) => {
    test.slow(true);

    await expect(page.getByTestId('KnowledgePanel.ActivityFeed')).toBeVisible();

    await verifyActivityFeedFilters(page, 'KnowledgePanel.ActivityFeed');

    await removeAndVerifyWidget(
      page,
      'KnowledgePanel.ActivityFeed',
      persona.responseData.name
    );

    await addAndVerifyWidget(
      page,
      'KnowledgePanel.ActivityFeed',
      persona.responseData.name
    );
  });

  test('Data Assets', async ({ page }) => {
    test.slow(true);

    await expect(page.getByTestId('KnowledgePanel.DataAssets')).toBeVisible();

    await removeAndVerifyWidget(
      page,
      'KnowledgePanel.DataAssets',
      persona.responseData.name
    );

    await addAndVerifyWidget(
      page,
      'KnowledgePanel.DataAssets',
      persona.responseData.name
    );
  });

  test('My Data', async ({ page }) => {
    test.slow(true);

    await expect(page.getByTestId('KnowledgePanel.MyData')).toBeVisible();

    await verifyDataFilters(page, 'KnowledgePanel.MyData');

    await removeAndVerifyWidget(
      page,
      'KnowledgePanel.MyData',
      persona.responseData.name
    );

    await addAndVerifyWidget(
      page,
      'KnowledgePanel.MyData',
      persona.responseData.name
    );
  });

  test('KPI', async ({ page }) => {
    test.slow(true);

    await expect(page.getByTestId('KnowledgePanel.KPI')).toBeVisible();

    await removeAndVerifyWidget(
      page,
      'KnowledgePanel.KPI',
      persona.responseData.name
    );

    await addAndVerifyWidget(
      page,
      'KnowledgePanel.KPI',
      persona.responseData.name
    );
  });

  test('Total Data Assets', async ({ page }) => {
    test.slow(true);

    await expect(page.getByTestId('KnowledgePanel.TotalAssets')).toBeVisible();

    await verifyTotalDataAssetsFilters(page, 'KnowledgePanel.TotalAssets');

    await removeAndVerifyWidget(
      page,
      'KnowledgePanel.TotalAssets',
      persona.responseData.name
    );

    await addAndVerifyWidget(
      page,
      'KnowledgePanel.TotalAssets',
      persona.responseData.name
    );
  });

  test('Following Assets', async ({ page }) => {
    test.slow(true);

    await expect(page.getByTestId('KnowledgePanel.Following')).toBeVisible();

    await verifyDataFilters(page, 'KnowledgePanel.Following');

    await removeAndVerifyWidget(
      page,
      'KnowledgePanel.Following',
      persona.responseData.name
    );

    await addAndVerifyWidget(
      page,
      'KnowledgePanel.Following',
      persona.responseData.name
    );
  });

  test('Domains', async ({ page }) => {
    test.slow(true);

    await expect(page.getByTestId('KnowledgePanel.Domains')).not.toBeVisible();

    await addAndVerifyWidget(
      page,
      'KnowledgePanel.Domains',
      persona.responseData.name
    );

    await verifyDomainsFilters(page, 'KnowledgePanel.Domains');

    await removeAndVerifyWidget(
      page,
      'KnowledgePanel.Domains',
      persona.responseData.name
    );
  });

  test('My Tasks', async ({ page }) => {
    test.slow(true);

    await expect(page.getByTestId('KnowledgePanel.MyTask')).not.toBeVisible();

    await addAndVerifyWidget(
      page,
      'KnowledgePanel.MyTask',
      persona.responseData.name
    );

    await verifyTaskFilters(page, 'KnowledgePanel.MyTask');

    await removeAndVerifyWidget(
      page,
      'KnowledgePanel.MyTask',
      persona.responseData.name
    );
  });

  test('Data Products', async ({ page }) => {
    test.slow(true);

    await expect(
      page.getByTestId('KnowledgePanel.DataProducts')
    ).not.toBeVisible();

    await addAndVerifyWidget(
      page,
      'KnowledgePanel.DataProducts',
      persona.responseData.name
    );

    await verifyDataProductsFilters(page, 'KnowledgePanel.DataProducts');

    await removeAndVerifyWidget(
      page,
      'KnowledgePanel.DataProducts',
      persona.responseData.name
    );
  });
});
