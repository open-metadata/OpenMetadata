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
import { expect } from '@playwright/test';
import { DOMAIN_TAGS } from '../../../constant/config';
import { SidebarItem } from '../../../constant/sidebar';
import { TableClass } from '../../../support/entity/TableClass';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage } from '../../../utils/common';
import { sidebarClick } from '../../../utils/sidebar';
import { test } from '../../fixtures/pages';

const table = new TableClass();

test.describe(
  'Incident Manager Date Filter',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Incident_Manager` },
  () => {
    test.beforeAll(async ({ browser }) => {
      test.slow();
      const { apiContext, afterAction } = await performAdminLogin(browser);

      // Create table and test cases
      await table.createTestCase(apiContext, {
        parameterValues: [
          { name: 'minColValue', value: 12 },
          { name: 'maxColValue', value: 24 },
        ],
        testDefinition: 'tableColumnCountToBeBetween',
      });

      const testCase = table.testCasesResponseData[0];

      // Create a failed result to generate an incident
      await table.addTestCaseResult(apiContext, testCase.fullyQualifiedName, {
        testCaseStatus: 'Failed',
        result: 'Column count was 10, expected between 12 and 24',
        timestamp: Date.now(),
        testResultValue: [{ name: 'columnCount', value: '10' }],
      });

      // Add another failure from 5 days ago for range testing
      const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000;
      await table.addTestCaseResult(apiContext, testCase.fullyQualifiedName, {
        testCaseStatus: 'Failed',
        result: 'Column count was 10, expected between 12 and 24',
        timestamp: fiveDaysAgo,
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
      const incidentListResponse = page.waitForResponse((response) =>
        response
          .url()
          .includes(
            '/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list'
          )
      );
      await page.getByRole('tab', { name: 'Incidents' }).click();
      const response = await incidentListResponse;
      expect(response.status()).toBe(200);
    });

    test('Date picker shows placeholder when no date is selected', async ({
      page,
    }) => {
      const datePicker = page.getByTestId('mui-date-picker-menu');
      await expect(datePicker).toBeVisible();
      await expect(datePicker).toContainText('Select Date');

      // Verify URL does not have date params
      const url = new URL(page.url());
      expect(url.searchParams.has('startTs')).toBeFalsy();
      expect(url.searchParams.has('endTs')).toBeFalsy();
    });

    test('Select preset date range', async ({ page }) => {
      const datePicker = page.getByTestId('mui-date-picker-menu');
      await datePicker.click();

      const last7DaysOption = page.getByTestId('date-range-option-last7days');

      // Wait for API call that happens on selection change.
      // We strictly wait for a request that has searchParams to avoid catching the initial load or others.
      const incidentListResponse = page.waitForResponse(
        (response) =>
          response
            .url()
            .includes(
              '/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list'
            ) && response.url().includes('startTs')
      );

      await last7DaysOption.click();

      const response = await incidentListResponse;
      expect(response.status()).toBe(200);
      const url = new URL(response.url());

      // Validate API params
      expect(url.searchParams.has('startTs')).toBeTruthy();
      expect(url.searchParams.has('endTs')).toBeTruthy();

      const startTs = parseInt(url.searchParams.get('startTs') || '0');
      const endTs = parseInt(url.searchParams.get('endTs') || '0');

      expect(startTs).toBeLessThan(endTs);

      // Verify button text
      await expect(datePicker).toContainText('Last 7 days');

      // Verify URL params
      const pageUrl = new URL(page.url());
      expect(pageUrl.searchParams.get('key')).toBe('last7days');
    });

    test('Clear selected date range', async ({ page }) => {
      // First select a range to ensure we can clear it
      const datePicker = page.getByTestId('mui-date-picker-menu');
      await datePicker.click();

      // Wait for request with startTs to ensure selection is applied
      const selectionResponse = page.waitForResponse(
        (response) =>
          response
            .url()
            .includes(
              '/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list'
            ) && response.url().includes('startTs')
      );
      await page.getByTestId('date-range-option-last7days').click();
      const afterSelectResponse = await selectionResponse;
      expect(afterSelectResponse.status()).toBe(200);

      await expect(datePicker).toContainText('Last 7 days');

      // Now clear it
      const clearButton = page.getByTestId('clear-date-picker');
      await expect(clearButton).toBeVisible();

      // Intercept response to verify params are GONE
      const incidentListResponse = page.waitForResponse(
        (response) =>
          response
            .url()
            .includes(
              '/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list'
            ) && !response.url().includes('startTs')
      );

      await clearButton.click();

      const response = await incidentListResponse;
      expect(response.status()).toBe(200);
      const url = new URL(response.url());

      // Validate API params do NOT exist
      expect(url.searchParams.has('startTs')).toBeFalsy();
      expect(url.searchParams.has('endTs')).toBeFalsy();

      // Verify UI reset
      await expect(datePicker).toContainText('Select Date');
      await expect(clearButton).not.toBeVisible();

      // Verify Page URL params removed
      const pageUrl = new URL(page.url());
      expect(pageUrl.searchParams.has('startTs')).toBeFalsy();
      expect(pageUrl.searchParams.has('endTs')).toBeFalsy();
      expect(pageUrl.searchParams.has('key')).toBeFalsy();
    });

    test('Date filter persists on page reload', async ({ page }) => {
      const datePicker = page.getByTestId('mui-date-picker-menu');
      await datePicker.click();
      await page.getByTestId('date-range-option-last7days').click();
      await expect(datePicker).toContainText('Last 7 days');

      const incidentListResponse = page.waitForResponse((response) =>
        response
          .url()
          .includes(
            '/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list'
          )
      );

      // Verify URL has the key BEFORE reloading
      await expect(page).toHaveURL(/key=last7days/);

      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      const response = await incidentListResponse;
      expect(response.status()).toBe(200);

      const datePickerReloaded = page.getByTestId('mui-date-picker-menu');
      await expect(datePickerReloaded).toBeVisible({ timeout: 15000 });
      await expect(datePickerReloaded).toContainText('Last 7 days');

      const url = new URL(page.url());
      expect(url.searchParams.get('key')).toBe('last7days');
    });
  }
);

/**
 * Incident Manager Date Filter - Sidebar Navigation
 * @description Tests the date filter functionality when accessing Incident Manager from the sidebar.
 */
test.describe(
  'Incident Manager Date Filter - Sidebar',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Incident_Manager` },
  () => {
    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
      const incidentListResponse = page.waitForResponse((response) =>
        response
          .url()
          .includes(
            '/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list'
          )
      );
      await sidebarClick(page, SidebarItem.INCIDENT_MANAGER);
      const response = await incidentListResponse;
      expect(response.status()).toBe(200);
    });

    test('Date picker shows placeholder by default on Incident Manager page', async ({
      page,
    }) => {
      const datePicker = page.getByTestId('mui-date-picker-menu');
      await expect(datePicker).toBeVisible();
      await expect(datePicker).toContainText('Select Date');

      // Clear button should not be visible when no date is selected
      await expect(page.getByTestId('clear-date-picker')).not.toBeVisible();
    });

    test('Select and clear date range on Incident Manager page', async ({
      page,
    }) => {
      const datePicker = page.getByTestId('mui-date-picker-menu');
      await datePicker.click();

      // Select Last 7 days
      const dateFilterRes = page.waitForResponse(
        (response) =>
          response
            .url()
            .includes(
              '/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list'
            ) && response.url().includes('startTs')
      );
      await page.getByTestId('date-range-option-last7days').click();
      await dateFilterRes;

      await expect(datePicker).toContainText('Last 7 days');
      await expect(page).toHaveURL(/key=last7days/);

      // Clear button should be visible
      const clearButton = page.getByTestId('clear-date-picker');
      await expect(clearButton).toBeVisible();

      // Clear the selection
      const clearRes = page.waitForResponse(
        (response) =>
          response
            .url()
            .includes(
              '/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list'
            ) && !response.url().includes('startTs')
      );
      await clearButton.click();
      await clearRes;

      // Verify reset to placeholder
      await expect(datePicker).toContainText('Select Date');
      await expect(clearButton).not.toBeVisible();

      // Verify URL params removed
      const pageUrl = new URL(page.url());
      expect(pageUrl.searchParams.has('startTs')).toBeFalsy();
      expect(pageUrl.searchParams.has('key')).toBeFalsy();
    });
  }
);
