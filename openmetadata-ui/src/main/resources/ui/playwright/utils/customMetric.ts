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
import { clickCodeEditor, fillCodeEditor } from './codeEditor';
import { toastNotification } from './common';
import {
  ObservabilityFeature,
  selectAddObservabilityFeature,
} from './dataQuality';

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
  await expect(
    page
      .getByTestId('custom-metric-form')
      .getByText('Name is required', { exact: true })
  ).toHaveText('Name is required');

  await expect(
    page
      .getByTestId('custom-metric-form')
      .getByText('SQL Query is required.', { exact: true })
  ).toHaveText('SQL Query is required.');

  if (isColumnMetric) {
    await expect(
      page
        .getByTestId('custom-metric-form')
        .getByText('Column is required.', { exact: true })
    ).toHaveText('Column is required.');
  }

  // max length validation
  await page.getByTestId('custom-metric-name').fill(INVALID_NAMES.MAX_LENGTH);

  await expect(
    page
      .getByTestId('custom-metric-form')
      .getByText(NAME_MAX_LENGTH_VALIDATION_ERROR, { exact: true })
  ).toBeVisible();

  // with special char validation
  await page
    .getByTestId('custom-metric-name')
    .fill(INVALID_NAMES.WITH_SPECIAL_CHARS);

  await expect(
    page
      .getByTestId('custom-metric-form')
      .getByText(NAME_VALIDATION_ERROR, { exact: true })
  ).toBeVisible();

  await page.getByTestId('custom-metric-name').clear();
};

export const openCustomMetricDrawer = async (
  page: Page,
  isColumnMetric = false
) => {
  await page
    .getByRole('tab', {
      name: isColumnMetric ? 'Column Profile' : 'Table Profile',
    })
    .click();
  await page.getByTestId('profiler-add-table-test-btn').click();
  await selectAddObservabilityFeature(page, ObservabilityFeature.CUSTOM_METRIC);

  const drawer = page.getByTestId('custom-metric-form-drawer');

  await expect(drawer).toBeVisible();

  return drawer;
};

export const createCustomMetric = async ({
  page,
  isColumnMetric = false,
  metric,
}: CustomMetricDetails) => {
  const drawer = await openCustomMetricDrawer(page, isColumnMetric);

  // the drawer keeps the profile preview beside the form
  await expect(
    drawer.getByText(
      isColumnMetric ? 'Add Column metric' : 'Add Table metric',
      { exact: true }
    )
  ).toBeVisible();
  await expect(
    drawer.getByTestId(
      isColumnMetric
        ? 'profiler-tab-container'
        : 'table-profiler-chart-container'
    )
  ).toBeVisible();

  await drawer.getByTestId('cancel-button').click();

  await expect(drawer).toBeHidden();
  await expect(page).toHaveURL(/profiler/);

  await openCustomMetricDrawer(page, isColumnMetric);
  await drawer.getByTestId('submit-button').click();

  await validateForm(page, isColumnMetric);

  // fill form and submit
  await page.getByTestId('custom-metric-name').fill(metric.name);
  if (isColumnMetric) {
    await page.getByTestId('custom-metric-column').getByRole('button').click();
    await page
      .getByRole('option', { name: metric.column, exact: true })
      .click();
  }
  if (metric.expression) {
    await clickCodeEditor(page);
    await page.keyboard.type(metric.expression);
  }
  const createMetricResponse = page.waitForResponse(
    '/api/v1/tables/*/customMetric'
  );
  await drawer.getByTestId('submit-button').click();
  await createMetricResponse;

  await toastNotification(
    page,
    new RegExp(`${metric.name} created successfully.`)
  );

  await expect(drawer).toBeHidden();
  await expect(page.getByTestId(`${metric.name}-title`)).toBeVisible();
};

export const editCustomMetric = async ({
  page,
  metric,
}: CustomMetricDetails) => {
  await page.getByTestId(`${metric.name}-title`).scrollIntoViewIfNeeded();
  await page.getByTestId(`${metric.name}-custom-metrics-menu`).click();
  await page.getByRole('menuitemradio', { name: 'Edit' }).click();

  const drawer = page.getByTestId('custom-metric-form-drawer');

  await expect(drawer).toBeVisible();
  await expect(drawer.getByTestId('custom-metric-name')).toHaveValue(
    metric.name
  );
  await expect(drawer.getByTestId('custom-metric-name')).toBeDisabled();

  await fillCodeEditor(page, drawer, metric.expression);

  const updateMetricResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/customMetric') &&
      response.request().method() === 'PUT'
  );
  await drawer.getByTestId('submit-button').click();
  const response = await updateMetricResponse;
  const { customMetrics = [], columns = [] } = await response.json();
  const savedMetric = [
    ...customMetrics,
    ...columns.flatMap(
      (column: { customMetrics?: unknown[] }) => column.customMetrics ?? []
    ),
  ].find((saved: { name: string }) => saved.name === metric.name);

  expect(savedMetric.expression).toBe(metric.expression);

  await toastNotification(
    page,
    new RegExp(`${metric.name} updated successfully.`)
  );

  await expect(drawer).toBeHidden();
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
  await page.getByTestId(`${metric.name}-title`).scrollIntoViewIfNeeded();

  await expect(page.getByTestId(`${metric.name}-title`)).toBeVisible();

  await page.click(`[data-testid="${metric.name}-custom-metrics-menu"]`);
  await page.getByRole('menuitemradio', { name: 'Delete' }).click();

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
