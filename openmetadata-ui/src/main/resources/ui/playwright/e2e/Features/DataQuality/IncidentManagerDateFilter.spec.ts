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
import { expect, Page } from '@playwright/test';
import { DOMAIN_TAGS } from '../../../constant/config';
import { SidebarItem } from '../../../constant/sidebar';
import { TableClass } from '../../../support/entity/TableClass';
import { performAdminLogin } from '../../../utils/admin';
import {
  clickIgnoringToasts,
  redirectToHomePage,
  scrollIntoViewAndSettle,
  selectOptionWithRetry,
} from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { sidebarClick } from '../../../utils/sidebar';
import {
  waitForAriaOverlayToSettle,
  waitForResponseWithStatus,
} from '../../../utils/waitHelpers';
import { test } from '../../fixtures/pages';
import {
  disableAiAppMode,
  stubUserPreferencesAppMode,
} from '../../Utils/appMode';

const dateRangeTrigger = (page: Page) =>
  page
    .getByRole('group', { name: 'Date Range', exact: true })
    .getByRole('button');

const waitForIncidentList = (
  page: Page,
  matchesParams: (params: URLSearchParams) => boolean = () => true
) =>
  waitForResponseWithStatus(
    page,
    (response) => {
      const url = new URL(response.url());
      return (
        response.request().method() === 'GET' &&
        url.pathname ===
          '/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list' &&
        matchesParams(url.searchParams)
      );
    },
    200
  );

const expectEmptyDateRange = async (page: Page) => {
  await expect(dateRangeTrigger(page)).toHaveText('Select dates');
  await expect(page).toHaveURL(
    (url) => !url.searchParams.has('startTs') && !url.searchParams.has('endTs')
  );
  await expect(page.getByTestId('incident-clear-filters')).not.toBeVisible();
};

const applyTodayRange = async (page: Page) => {
  const trigger = dateRangeTrigger(page);
  await expect(trigger).toHaveText('Select dates');
  await scrollIntoViewAndSettle(trigger);
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await waitForAriaOverlayToSettle(page);

  const range = await page.evaluate(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return {
      startTs: String(start.getTime()),
      endTs: String(end.getTime() - 1),
    };
  });
  await dialog.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(trigger).not.toHaveText('Select dates');
  await expect(page).toHaveURL(
    (url) => !url.searchParams.has('startTs') && !url.searchParams.has('endTs')
  );

  const responsePromise = waitForIncidentList(
    page,
    (params) =>
      params.get('startTs') === range.startTs &&
      params.get('endTs') === range.endTs
  );
  await clickIgnoringToasts(
    dialog.getByRole('button', { name: 'Apply', exact: true })
  );
  await responsePromise;
  await expect(dialog).not.toBeVisible();
  await expect(trigger).not.toHaveText('Select dates');
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get('startTs') === range.startTs &&
      url.searchParams.get('endTs') === range.endTs
  );
  return range;
};

const clearDateRange = async (page: Page) => {
  const clearButton = page.getByTestId('incident-clear-filters');
  await expect(clearButton).toBeVisible();
  const responsePromise = waitForIncidentList(
    page,
    (params) => !params.has('startTs') && !params.has('endTs')
  );
  await clearButton.click();
  await responsePromise;
  await expectEmptyDateRange(page);
};

const selectDateField = async (
  page: Page,
  field: 'updatedAt' | 'timestamp'
) => {
  const responsePromise = waitForIncidentList(
    page,
    (params) => params.get('dateField') === field
  );
  await selectOptionWithRetry(
    page.getByTestId('sort-field-dropdown-trigger'),
    page.getByTestId('drop-down-menu').getByTestId(field)
  );
  await responsePromise;
  await expect(page.getByTestId('sort-field-dropdown-trigger')).toContainText(
    field === 'updatedAt' ? 'Updated at' : 'Created at'
  );
  await expect(page).toHaveURL(
    (url) => url.searchParams.get('dateField') === field
  );
};

test.beforeEach(async ({ page }) => {
  await disableAiAppMode(page);
  await stubUserPreferencesAppMode(page, 'classic');
});

test.describe(
  'Incident Manager Date Filter',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Incident_Manager` },
  () => {
    let table: TableClass;

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      table = new TableClass();
      await table.create(apiContext);
      await table.createTestCase(apiContext, {
        parameterValues: [
          { name: 'minColValue', value: 12 },
          { name: 'maxColValue', value: 24 },
        ],
        testDefinition: 'tableColumnCountToBeBetween',
      });

      const testCase = table.testCasesResponseData[0];
      await table.addTestCaseResult(apiContext, testCase.fullyQualifiedName, {
        testCaseStatus: 'Failed',
        result: 'Column count was 10, expected between 12 and 24',
        timestamp: Date.now(),
        testResultValue: [{ name: 'columnCount', value: '10' }],
      });
      await table.addTestCaseResult(apiContext, testCase.fullyQualifiedName, {
        testCaseStatus: 'Failed',
        result: 'Column count was 10, expected between 12 and 24',
        timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000,
        testResultValue: [{ name: 'columnCount', value: '10' }],
      });
      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.delete(apiContext);
      await afterAction();
    });

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
      await table.visitEntityPage(page);
      await page.getByTestId('profiler').click();
      const responsePromise = waitForIncidentList(page);
      await page.getByRole('tab', { name: 'Incidents' }).click();
      await responsePromise;
    });

    test('Date picker shows placeholder when no date is selected', async ({
      page,
    }) => {
      await expectEmptyDateRange(page);
    });

    test('Select preset date range', async ({ page }) => {
      await applyTodayRange(page);
    });

    test('Clear selected date range', async ({ page }) => {
      await applyTodayRange(page);
      await clearDateRange(page);
    });

    test('Date filter persists on page reload', async ({ page }) => {
      const range = await applyTodayRange(page);
      const label = await dateRangeTrigger(page).innerText();
      const responsePromise = waitForIncidentList(
        page,
        (params) =>
          params.get('startTs') === range.startTs &&
          params.get('endTs') === range.endTs
      );
      await page.reload({ waitUntil: 'domcontentloaded' });
      await responsePromise;
      await waitForAllLoadersToDisappear(page);
      await expect(dateRangeTrigger(page)).toHaveText(label);
      await expect(page).toHaveURL(
        (url) =>
          url.searchParams.get('startTs') === range.startTs &&
          url.searchParams.get('endTs') === range.endTs
      );
    });
  }
);

test.describe(
  'Incident Manager - Date Field Sort Dropdown',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Incident_Manager` },
  () => {
    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
      const responsePromise = waitForIncidentList(page);
      await sidebarClick(page, SidebarItem.INCIDENT_MANAGER);
      await responsePromise;
    });

    test('should show "Created At" as the default sort field label', async ({
      page,
    }) => {
      await expect(
        page.getByTestId('sort-field-dropdown-trigger')
      ).toContainText('Created at');
    });

    test('should open sort field dropdown on click', async ({ page }) => {
      const trigger = page.getByTestId('sort-field-dropdown-trigger');
      await scrollIntoViewAndSettle(trigger);
      await trigger.click();
      const menu = page.getByTestId('drop-down-menu');
      await expect(menu.getByTestId('timestamp')).toHaveText('Created at');
      await expect(menu.getByTestId('updatedAt')).toHaveText('Updated at');
    });

    test('should switch to "Updated At" and call API with dateField=updatedAt', async ({
      page,
    }) => {
      await selectDateField(page, 'updatedAt');
    });

    test('should switch back to "Created at" and call API with dateField=timestamp', async ({
      page,
    }) => {
      await selectDateField(page, 'updatedAt');
      await selectDateField(page, 'timestamp');
    });

    test('should close sort dropdown after selecting an option', async ({
      page,
    }) => {
      await selectDateField(page, 'updatedAt');
      await expect(page.getByTestId('drop-down-menu')).not.toBeVisible();
    });
  }
);

test.describe(
  'Incident Manager Date Filter - Sidebar',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Incident_Manager` },
  () => {
    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
      const responsePromise = waitForIncidentList(page);
      await sidebarClick(page, SidebarItem.INCIDENT_MANAGER);
      await responsePromise;
    });

    test('Date picker shows placeholder by default on Incident Manager page', async ({
      page,
    }) => {
      await expectEmptyDateRange(page);
    });

    test('Select and clear date range on Incident Manager page', async ({
      page,
    }) => {
      await applyTodayRange(page);
      await clearDateRange(page);
    });
  }
);
