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
import { EntityTypeEndpoint } from '../support/entity/Entity.interface';
import { MetricClass } from '../support/entity/MetricClass';
import { uuid } from './common';
import { hardDeleteEntity } from './entity';

const openMetricDefinitionEditor = async (page: Page) => {
  await page.getByTestId('metric-definition-edit').click();

  const dialog = page.getByTestId('metric-definition-edit-dialog');
  await expect(dialog).toBeVisible();

  return dialog;
};

const selectDefinitionOption = async (
  page: Page,
  fieldTestId: string,
  option: string
) => {
  const field = page.getByTestId(fieldTestId);
  await field.getByRole('button').click();
  await page.getByRole('option', { exact: true, name: option }).click();
  await expect(field).toContainText(option);
};

const saveMetricDefinition = async (page: Page) => {
  const patchPromise = page.waitForResponse((response) => {
    const url = new URL(response.url());

    return (
      response.request().method() === 'PATCH' &&
      url.pathname.startsWith('/api/v1/metrics/')
    );
  });

  await page.getByTestId('metric-definition-save').click();

  expect((await patchPromise).ok()).toBeTruthy();
  await expect(page.getByTestId('metric-definition-edit-dialog')).toBeHidden();
};

const updateDefinitionField = async (
  page: Page,
  fieldTestId: string,
  value: string,
  resultTestId: string
) => {
  await openMetricDefinitionEditor(page);
  await selectDefinitionOption(page, fieldTestId, value);
  await saveMetricDefinition(page);
  await expect(page.getByTestId(resultTestId)).toContainText(value);
};

const clearDefinitionField = async (
  page: Page,
  fieldTestId: string,
  resultTestId: string
) => {
  await openMetricDefinitionEditor(page);
  await selectDefinitionOption(page, fieldTestId, 'None');
  await saveMetricDefinition(page);
  await expect(page.getByTestId(resultTestId)).toContainText('- -');
};

export const updateMetricType = (page: Page, metric: string) =>
  updateDefinitionField(
    page,
    'metric-definition-type-select',
    metric,
    'metric-definition-type'
  );

export const removeMetricType = (page: Page) =>
  clearDefinitionField(
    page,
    'metric-definition-type-select',
    'metric-definition-type'
  );

export const updateUnitOfMeasurement = (
  page: Page,
  unitOfMeasurement: string
) =>
  updateDefinitionField(
    page,
    'metric-definition-unit-select',
    unitOfMeasurement,
    'metric-definition-unit'
  );

export const removeUnitOfMeasurement = (page: Page) =>
  clearDefinitionField(
    page,
    'metric-definition-unit-select',
    'metric-definition-unit'
  );

export const updateGranularity = (page: Page, granularity: string) =>
  updateDefinitionField(
    page,
    'metric-definition-granularity-select',
    granularity,
    'metric-definition-granularity'
  );

export const removeGranularity = (page: Page) =>
  clearDefinitionField(
    page,
    'metric-definition-granularity-select',
    'metric-definition-granularity'
  );

export const updateExpression = async (
  page: Page,
  language: string,
  code: string
) => {
  const dialog = await openMetricDefinitionEditor(page);
  await selectDefinitionOption(
    page,
    'metric-definition-language-select',
    language
  );
  await dialog.getByRole('textbox', { name: 'Code' }).fill(code);
  await saveMetricDefinition(page);

  await expect(page.getByTestId('metric-expression-panel')).toContainText(
    language
  );
  await expect(page.getByTestId('metric-expression-code')).toContainText(code);
};

export const updateRelatedMetric = async (
  page: Page,
  dataAsset: MetricClass,
  type: 'add' | 'update'
) => {
  const dialog = await openMetricDefinitionEditor(page);
  const relatedMetricForm = dialog.getByTestId('related-metric-form');
  const searchPromise = page.waitForResponse((response) => {
    const url = new URL(response.url());

    return (
      response.request().method() === 'GET' &&
      url.pathname.endsWith('/api/v1/search/query') &&
      url.searchParams.get('index') === 'metric' &&
      url.searchParams.get('q') === dataAsset.entity.name
    );
  });

  await relatedMetricForm
    .getByPlaceholder('Search Related Metrics')
    .fill(dataAsset.entity.name);
  expect((await searchPromise).ok()).toBeTruthy();

  const target = relatedMetricForm.getByRole('checkbox', {
    exact: true,
    name: dataAsset.entity.name,
  });
  await expect(target).toBeVisible();

  if (type === 'update') {
    const checkboxes = await relatedMetricForm.getByRole('checkbox').all();
    for (const checkbox of checkboxes) {
      if (await checkbox.isChecked()) {
        await checkbox.press('Space');
      }
    }
  }
  if (!(await target.isChecked())) {
    await target.press('Space');
  }

  await saveMetricDefinition(page);

  await expect(
    page
      .getByTestId('metric-definition-related-metrics')
      .getByRole('link', { exact: true, name: dataAsset.entity.name })
  ).toBeVisible();
};

export const addMetric = async (page: Page) => {
  const metricName = `pw-metric-${uuid()}`;

  const metricData = {
    name: metricName,
    description: `Total sales over the last quarter ${metricName}`,
    metricExpression: {
      code: 'SUM(sales)',
      language: 'SQL',
    },
    granularity: 'Quarter',
    metricType: 'Sum',
    displayName: metricName,
    unitOfMeasurement: 'Dollars',
  };

  const selectFormOption = async (fieldTestId: string, title: string) => {
    const field = page.getByTestId(fieldTestId);
    const optionName = new RegExp(
      `^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
      'i'
    );

    const trigger = field.getByRole('button');

    await trigger.click();
    await page.getByRole('option', { name: optionName }).click();
    await expect(trigger).toContainText(optionName);
  };

  await page.getByTestId('create-button').click();

  await expect(page.getByText('Name is required')).toBeVisible();

  await page.getByTestId('name').fill(metricData.name);
  await page.getByTestId('display-name').fill(metricData.name);

  await page
    .getByRole('textbox', { exact: true, name: 'Description' })
    .fill(metricData.description);

  await selectFormOption('granularity-select', metricData.granularity);

  await selectFormOption('metric-type-select', metricData.metricType);

  await selectFormOption(
    'unit-of-measurement-select',
    metricData.unitOfMeasurement
  );

  await selectFormOption(
    'language-select',
    metricData.metricExpression.language
  );

  await page
    .getByTestId('metric-code')
    .getByRole('textbox')
    .fill(metricData.metricExpression.code);

  const postPromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname.endsWith('/api/v1/metrics')
  );

  const getPromise = page.waitForResponse(
    `/api/v1/metrics/name/${metricName}?*`
  );

  await page.getByTestId('create-button').click();

  await postPromise;

  await getPromise;

  await expect(page.getByTestId('metric-definition-type')).toContainText(
    metricData.metricType
  );
  await expect(page.getByTestId('metric-definition-unit')).toContainText(
    metricData.unitOfMeasurement
  );
  await expect(page.getByTestId('metric-definition-granularity')).toContainText(
    metricData.granularity
  );

  await hardDeleteEntity(
    page,
    metricData.displayName,
    EntityTypeEndpoint.METRIC
  );
};
