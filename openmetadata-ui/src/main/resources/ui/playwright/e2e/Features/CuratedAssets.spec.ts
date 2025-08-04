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
import { selectOption } from '../../utils/advancedSearch';
import { redirectToHomePage } from '../../utils/common';
import {
  addCuratedAssetPlaceholder,
  saveCustomizeLayoutPage,
  setUserDefaultPersona,
} from '../../utils/customizeLandingPage';

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

base.beforeAll('Setup pre-requests', async ({ browser }) => {
  test.slow(true);

  const { afterAction, apiContext } = await performAdminLogin(browser);
  await adminUser.create(apiContext);
  await adminUser.setAdminRole(apiContext);
  await persona.create(apiContext, [adminUser.responseData.id]);
  await afterAction();
});

base.afterAll('Cleanup', async ({ browser }) => {
  test.slow(true);

  const { afterAction, apiContext } = await performAdminLogin(browser);
  await adminUser.delete(apiContext);
  await persona.delete(apiContext);
  await afterAction();
});

test.describe('Curated Assets', () => {
  test.beforeAll(async ({ page }) => {
    test.slow(true);

    await redirectToHomePage(page);
    await page.getByTestId('sidebar-toggle').click();
    await setUserDefaultPersona(page, persona.responseData.displayName);
  });

  test('Create Curated Asset', async ({ page }) => {
    test.slow(true);

    await addCuratedAssetPlaceholder({
      page,
      personaName: persona.responseData.name,
    });

    await page
      .getByTestId('KnowledgePanel.CuratedAssets')
      .getByText('Create')
      .click();

    await page.waitForTimeout(1000);

    await expect(page.locator('[role="dialog"].ant-modal')).toBeVisible();

    await page.waitForSelector('[data-testid="title-input"]');

    await page.locator('[data-testid="title-input"]').fill('Popular Charts');

    await page.locator('[data-testid="asset-type-select"]').click();

    await page.locator('[data-testid="chart-option"]').click();

    const ruleLocator = page.locator('.rule').nth(0);
    await selectOption(
      page,
      ruleLocator.locator('.rule--field .ant-select'),
      'Owners'
    );

    await selectOption(
      page,
      ruleLocator.locator('.rule--operator .ant-select'),
      '!='
    );

    await selectOption(
      page,
      ruleLocator.locator('.rule--value .ant-select'),
      'admin'
    );

    await page.getByRole('button', { name: 'Add Condition' }).click();

    const ruleLocator2 = page.locator('.rule').nth(1);
    await selectOption(
      page,
      ruleLocator2.locator('.rule--field .ant-select'),
      'Description'
    );

    await selectOption(
      page,
      ruleLocator2.locator('.rule--operator .ant-select'),
      '=='
    );

    await selectOption(
      page,
      ruleLocator2.locator('.rule--value .ant-select'),
      'Complete'
    );

    await expect(page.locator('[data-testid="saveButton"]')).toBeEnabled();

    const queryResponse = page.waitForResponse(
      '/api/v1/search/query?q=&index=chart&*'
    );

    await page.locator('[data-testid="saveButton"]').click();
    await queryResponse;

    await expect(
      page.locator('[data-testid="KnowledgePanel.CuratedAssets"]')
    ).toBeVisible();

    await expect(
      page
        .getByTestId('KnowledgePanel.CuratedAssets')
        .getByText('Popular Charts')
    ).toBeVisible();

    await saveCustomizeLayoutPage(page);

    const chartResponsePromise = page.waitForResponse((response) => {
      const url = response.url();

      return (
        url.includes('/api/v1/search/query') &&
        url.includes('index=chart') &&
        response.status() === 200
      );
    });

    await redirectToHomePage(page);

    const chartResponse = await chartResponsePromise;

    expect(chartResponse.status()).toBe(200);

    const chartResponseJson = await chartResponse.json();
    const chartHits = chartResponseJson.hits.hits;

    if (chartHits.length > 0) {
      const firstSource = chartHits[0]._source;
      const displayName = firstSource.displayName;
      const name = firstSource.name;

      await expect(
        page.locator(`[data-testid="Curated Assets-${displayName ?? name}"]`)
      ).toBeVisible();
    }

    await expect(
      page
        .getByTestId('KnowledgePanel.CuratedAssets')
        .getByText('Popular Charts')
    ).toBeVisible();
  });

  test('Curated Asset placeholder is not available in home page', async ({
    page,
  }) => {
    test.slow(true);

    await addCuratedAssetPlaceholder({
      page,
      personaName: persona.responseData.name,
    });

    await page.locator('[data-testid="save-button"]').click();
    await page.waitForLoadState('networkidle');

    await redirectToHomePage(page);

    await expect(
      page.locator('[data-testid="KnowledgePanel.CuratedAssets"]')
    ).not.toBeVisible();
  });
});
