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
import { MetricClass } from '../support/entity/MetricClass';

export const updateMetricType = async (page: Page, metric: string) => {
  await page.click(`[data-testid="edit-metric-type-button"]`);
  const patchPromise = page.waitForResponse(
    (response) => response.request().method() === 'PATCH'
  );
  await page.getByRole('listitem', { name: metric, exact: true }).click();

  await patchPromise;

  // verify the metric type is updated
  await expect(
    page.getByText(`Metric Type: ${metric.toUpperCase()}`)
  ).toBeVisible();
};

export const removeMetricType = async (page: Page) => {
  await page.click(`[data-testid="edit-metric-type-button"]`);
  const patchPromise = page.waitForResponse(
    (response) => response.request().method() === 'PATCH'
  );
  await page.getByTestId('remove-metric-type-button').click();

  await patchPromise;

  // verify the metric type is updated
  await expect(page.getByText('Metric Type: --')).toBeVisible();
};

export const updateUnitOfMeasurement = async (
  page: Page,
  unitOfMeasurement: string
) => {
  await page.click(`[data-testid="edit-unit-of-measurement-button"]`);
  const patchPromise = page.waitForResponse(
    (response) => response.request().method() === 'PATCH'
  );
  await page
    .getByRole('listitem', { name: unitOfMeasurement, exact: true })
    .click();

  await patchPromise;

  // verify the unit of measurement is updated
  await expect(
    page.getByText(`Unit of Measurement: ${unitOfMeasurement.toUpperCase()}`)
  ).toBeVisible();
};

export const removeUnitOfMeasurement = async (page: Page) => {
  await page.click(`[data-testid="edit-unit-of-measurement-button"]`);
  const patchPromise = page.waitForResponse(
    (response) => response.request().method() === 'PATCH'
  );
  await page.getByTestId('remove-unit-of-measurement-button').click();

  await patchPromise;

  // verify the unit of measurement is updated
  await expect(page.getByText('Unit of Measurement: --')).toBeVisible();
};

export const updateGranularity = async (page: Page, granularity: string) => {
  await page.click(`[data-testid="edit-granularity-button"]`);
  const patchPromise = page.waitForResponse(
    (response) => response.request().method() === 'PATCH'
  );
  await page.getByRole('listitem', { name: granularity, exact: true }).click();

  await patchPromise;

  // verify the granularity is updated
  await expect(
    page.getByText(`Granularity: ${granularity.toUpperCase()}`)
  ).toBeVisible();
};

export const removeGranularity = async (page: Page) => {
  await page.click(`[data-testid="edit-granularity-button"]`);
  const patchPromise = page.waitForResponse(
    (response) => response.request().method() === 'PATCH'
  );
  await page.getByTestId('remove-granularity-button').click();

  await patchPromise;

  // verify the granularity is updated
  await expect(page.getByText('Granularity: --')).toBeVisible();
};

export const updateExpression = async (
  page: Page,
  language: string,
  code: string
) => {
  await page.click(`[data-testid="edit-expression-button"]`);

  // Select the language
  await page.locator('[id="root\\/language"]').fill(language);
  await page.getByTitle(`${language}`, { exact: true }).click();

  await page.locator("pre[role='presentation']").last().click();
  await page.keyboard.type(code);

  const patchPromise = page.waitForResponse(
    (response) => response.request().method() === 'PATCH'
  );

  await page.getByTestId('update-button').click();

  await patchPromise;

  await expect(
    page.getByLabel('Overview').locator('.CodeMirror-scroll')
  ).toContainText(code);
};

export const updateRelatedMetric = async (
  page: Page,
  dataAsset: MetricClass,
  title: string,
  type: 'add' | 'update'
) => {
  const patchPromise = page.waitForResponse(
    (response) => response.request().method() === 'PATCH'
  );
  if (type === 'add') {
    await page
      .getByTestId('add-related-metrics-container')
      .locator('span')
      .first()
      .click();
  } else {
    await page.getByTestId('edit-related-metrics').locator('svg').click();
  }

  await page.waitForSelector(
    '[data-testid="asset-select-list"] > .ant-select-selector input',
    { state: 'visible' }
  );

  const apiPromise = page.waitForResponse(
    '/api/v1/search/query?q=*&index=metric_search_index&*'
  );

  await page.fill(
    '[data-testid="asset-select-list"] > .ant-select-selector input',
    dataAsset.entity.name
  );

  await apiPromise;

  await page
    .locator('.ant-select-item-option-content', {
      hasText: dataAsset.entity.name,
    })
    .click();
  await page.locator('[data-testid="saveRelatedMetrics"]').click();

  await patchPromise;

  await page.waitForSelector(`[data-testid="${dataAsset.entity.name}"]`, {
    state: 'visible',
  });

  await page
    .getByRole('link', { name: dataAsset.entity.name, exact: true })
    .click();

  await page.getByRole('link', { name: title }).click();
};
