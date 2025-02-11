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
import {
  INVALID_NAMES,
  NAME_MAX_LENGTH_VALIDATION_ERROR,
  NAME_VALIDATION_ERROR,
} from '../constant/common';
import { toastNotification } from './common';

type CustomMetricDetails = {
  page: Page;
  isColumnMetric?: boolean;
  metric: {
    name: string;
    column?: string;
    expression: string;
  };
};

const validateForm = async (page: Page, isColumnMetric = false) => {
  // error messages
  await expect(page.locator('#name_help')).toHaveText('Name is required');

  await expect(page.locator('#expression_help')).toHaveText(
    'SQL Query is required.'
  );

  if (isColumnMetric) {
    await expect(page.locator('#columnName_help')).toHaveText(
      'Column is required.'
    );
  }

  // max length validation
  await page.locator('#name').fill(INVALID_NAMES.MAX_LENGTH);

  await expect(page.locator('#name_help')).toHaveText(
    NAME_MAX_LENGTH_VALIDATION_ERROR
  );

  // with special char validation
  await page.locator('#name').fill(INVALID_NAMES.WITH_SPECIAL_CHARS);

  await expect(page.locator('#name_help')).toHaveText(NAME_VALIDATION_ERROR);

  await page.locator('#name').clear();
};

export const createCustomMetric = async ({
  page,
  isColumnMetric = false,
  metric,
}: CustomMetricDetails) => {
  await page
    .getByRole('menuitem', {
      name: isColumnMetric ? 'Column Profile' : 'Table Profile',
    })
    .click();
  await page.locator('[data-testid="profiler-add-table-test-btn"]').click();
  await page.locator('[data-testid="custom-metric"]').click();

  const customMetricResponse = page.waitForResponse(
    '/api/v1/tables/name/*?fields=customMetrics%2Ccolumns&include=all'
  );

  // validate redirection and cancel button
  await expect(page.locator('[data-testid="heading"]')).toBeVisible();
  await expect(
    page.locator(
      `[data-testid="${
        isColumnMetric
          ? 'profiler-tab-container'
          : 'table-profiler-chart-container'
      }"]`
    )
  ).toBeVisible();

  await page.locator('[data-testid="cancel-button"]').click();
  await customMetricResponse;

  await expect(page).toHaveURL(/profiler/);
  await expect(
    page.getByRole('heading', {
      name: isColumnMetric ? 'Column Profile' : 'Table Profile',
    })
  ).toBeVisible();

  // Click on create custom metric button
  await page.click('[data-testid="profiler-add-table-test-btn"]');
  await page.click('[data-testid="custom-metric"]');
  await page.click('[data-testid="submit-button"]');

  await validateForm(page, isColumnMetric);

  // fill form and submit
  await page.fill('#name', metric.name);
  if (isColumnMetric) {
    await page.click('#columnName');
    await page.click(`[title="${metric.column}"]`);
  }
  if (metric.expression) {
    await page.click('.CodeMirror-scroll');
    await page.keyboard.type(metric.expression);
  }
  const createMetricResponse = page.waitForResponse(
    '/api/v1/tables/*/customMetric'
  );
  await page.click('[data-testid="submit-button"]');
  await createMetricResponse;

  await toastNotification(
    page,
    new RegExp(`${metric.name} created successfully.`)
  );

  // verify the created custom metric
  await expect(page).toHaveURL(/profiler/);
  await expect(
    page.getByRole('heading', {
      name: isColumnMetric ? 'Column Profile' : 'Table Profile',
    })
  ).toBeVisible();

  await expect(
    page.locator(`[data-testid="${metric.name}-custom-metrics"]`)
  ).toBeVisible();
};

export const deleteCustomMetric = async ({
  page,
  metric,
  isColumnMetric = false,
}: {
  page: Page;
  metric: CustomMetricDetails['metric'];
  isColumnMetric?: boolean;
}) => {
  await page
    .locator(`[data-testid="${metric.name}-custom-metrics"]`)
    .scrollIntoViewIfNeeded();

  await expect(
    page.locator(`[data-testid="${metric.name}-custom-metrics"]`)
  ).toBeVisible();

  await page.click(`[data-testid="${metric.name}-custom-metrics-menu"]`);
  await page.click(`[data-menu-id*="delete"]`);

  await expect(page.locator('.ant-modal-header')).toContainText(metric.name);

  await page.fill('[data-testid="confirmation-text-input"]', 'DELETE');
  const deleteMetricResponse = page.waitForResponse(
    isColumnMetric
      ? `/api/v1/tables/*/customMetric/${metric.column}/${metric.name}*`
      : `/api/v1/tables/*/customMetric/${metric.name}*`
  );
  await page.click('[data-testid="confirm-button"]');
  await deleteMetricResponse;

  // Verifying the deletion
  await toastNotification(page, `"${metric.name}" deleted successfully!`);
};
