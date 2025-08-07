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
  verifyDomainsFilters,
  verifyTaskFilters,
  verifyTotalDataAssetsFilters,
} from '../../utils/widgetFilters';

const adminUser = new UserClass();
const persona = new PersonaClass();

const test = base.extend<{ page: Page }>({
  page: async ({ browser }, use) => {
    const page = await browser.newPage();
    await adminUser.login(page);
    await use(page);
    await page.close();
  },
});

base.beforeAll('Setup pre-requests', async ({ browser, page }) => {
  const { afterAction, apiContext } = await performAdminLogin(browser);
  await adminUser.create(apiContext);
  await adminUser.setAdminRole(apiContext);
  await persona.create(apiContext, [adminUser.responseData.id]);
  await afterAction();
});

base.afterAll('Cleanup', async ({ browser }) => {
  const { afterAction, apiContext } = await performAdminLogin(browser);
  await adminUser.delete(apiContext);
  await persona.delete(apiContext);
  await afterAction();
});

test.describe('Widgets', () => {
  test.beforeAll(async ({ page }) => {
    test.slow(true);

    await redirectToHomePage(page);
    await page.getByTestId('sidebar-toggle').click();
    await setUserDefaultPersona(page, persona.responseData.displayName);
  });

  test('Activity Feed', async ({ page }) => {
    test.slow(true);

    await redirectToHomePage(page);
    await page.getByTestId('welcome-screen-close-btn').click();

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

    await redirectToHomePage(page);
    await page.getByTestId('welcome-screen-close-btn').click();

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

    await redirectToHomePage(page);
    await page.getByTestId('welcome-screen-close-btn').click();

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

    await redirectToHomePage(page);
    await page.getByTestId('welcome-screen-close-btn').click();

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

    await redirectToHomePage(page);
    await page.getByTestId('welcome-screen-close-btn').click();

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

    await redirectToHomePage(page);
    await page.getByTestId('welcome-screen-close-btn').click();

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

    await redirectToHomePage(page);
    await page.getByTestId('welcome-screen-close-btn').click();

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

    await redirectToHomePage(page);
    await page.getByTestId('welcome-screen-close-btn').click();

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
});
