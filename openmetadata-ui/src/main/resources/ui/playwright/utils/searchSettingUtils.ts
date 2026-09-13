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
import { expect, Page } from '@playwright/test';
import { getApiContext } from './common';

export const mockScoreMode = 'first';
export const mockBoostMode = 'replace';
export const mockEntitySearchSettings = {
  key: 'preferences.search-settings.tables',
  url: 'settings/preferences/search-settings/tables',
};

export const mockColumnSearchSettings = {
  key: 'preferences.search-settings.tableColumn',
  url: 'settings/preferences/search-settings/tableColumn',
};

export const mockEntitySearchConfig = {
  assetType: 'table',
  searchFields: [
    { field: 'displayName.keyword', boost: 20, matchType: 'exact' },
    { field: 'name.keyword', boost: 20, matchType: 'exact' },
    { field: 'name', boost: 10, matchType: 'phrase' },
    { field: 'name.ngram', boost: 1, matchType: 'fuzzy' },
    { field: 'name.compound', boost: 8, matchType: 'standard' },
    { field: 'displayName', boost: 10, matchType: 'phrase' },
    { field: 'displayName.ngram', boost: 1, matchType: 'fuzzy' },
    { field: 'description', boost: 2, matchType: 'standard' },
    { field: 'displayName.compound', boost: 8, matchType: 'standard' },
    { field: 'fullyQualifiedName', boost: 5, matchType: 'standard' },
    { field: 'fqnParts', boost: 5, matchType: 'standard' },
    { field: 'columns.name.keyword', boost: 2, matchType: 'exact' },
    { field: 'columns.displayName.keyword', boost: 2, matchType: 'exact' },
    { field: 'columnNamesFuzzy', boost: 1.5, matchType: 'standard' },
    { field: 'aliases', boost: 5, matchType: 'standard' },
    { field: 'aliases.keyword', boost: 10, matchType: 'exact' },
  ],
  highlightFields: ['name', 'description', 'displayName', 'aliases'],
  matchTypeBoostMultipliers: {
    exactMatchMultiplier: 2,
    fuzzyMatchMultiplier: 1,
    phraseMatchMultiplier: 1.5,
  },
  aggregations: [
    {
      name: 'database.displayName.keyword',
      type: 'terms',
      field: 'database.displayName.keyword',
      script: '',
    },
    {
      name: 'databaseSchema.displayName.keyword',
      type: 'terms',
      field: 'databaseSchema.displayName.keyword',
      script: '',
    },
  ],
  termBoosts: [],
  fieldValueBoosts: [
    {
      field: 'usageSummary.monthlyStats.count',
      factor: 0.000025,
      modifier: 'log1p',
      missing: 0,
    },
    {
      field: 'usageSummary.monthlyStats.percentileRank',
      factor: 0.0025,
      modifier: 'none',
      missing: 0,
    },
  ],
  scoreMode: 'sum',
  boostMode: 'multiply',
};

export async function setSliderValue(
  page: Page,
  testId: string,
  value: number,
  min = 0,
  max = 100
) {
  const step = 0.1;
  if (value < min || value > max || !Number.isFinite(value)) {
    throw new Error(`Slider value ${value} is outside [${min}, ${max}]`);
  }
  const slider = page.getByTestId(testId);
  const sliderHandle = slider.getByRole('slider');

  await expect(sliderHandle).toBeVisible();
  await expect(sliderHandle).toHaveAttribute('aria-valuemin', String(min));
  await expect(sliderHandle).toHaveAttribute('aria-valuemax', String(max));

  if (value === min || value === max) {
    await sliderHandle.press(value === min ? 'Home' : 'End');
    await expect(sliderHandle).toHaveAttribute('aria-valuenow', String(value));

    return;
  }

  await expect(
    page.locator('.ant-motion-collapse').filter({ has: slider })
  ).toHaveCount(0);
  const track = slider.locator('.ant-slider');
  await sliderHandle.hover();
  const box = await track.boundingBox();
  if (!box || box.width <= 0) {
    throw new Error('Slider track has no width');
  }
  await page.mouse.down();
  try {
    await page.mouse.move(
      box.x + ((value - min) / (max - min)) * box.width,
      box.y + box.height / 2
    );
  } finally {
    await page.mouse.up();
  }

  // A tenth of a unit is narrower than a pixel. One pointer selection gets
  // within a pixel, then keyboard fine adjustment reaches the exact value.
  // Stepping across the entire range would issue hundreds of preview requests.
  const pixelValue = (max - min) / box.width;
  await expect
    .poll(async () =>
      Math.abs(Number(await sliderHandle.getAttribute('aria-valuenow')) - value)
    )
    .toBeLessThanOrEqual(pixelValue);
  const selectedValue = Number(
    await sliderHandle.getAttribute('aria-valuenow')
  );
  const steps = Math.round((value - selectedValue) / step);
  for (let index = 0; index < Math.abs(steps); index++) {
    await sliderHandle.press(steps < 0 ? 'ArrowLeft' : 'ArrowRight');
  }

  await expect(sliderHandle).toHaveAttribute('aria-valuenow', String(value));
}

// The entity search settings page opens with the "Ranking Details" accordion
// panel expanded by default, so the "Matching Fields" panel (and its field
// configuration rows) is collapsed and not mounted. Expand it before
// interacting with any field-configuration control.
export const openMatchingFieldsPanel = async (page: Page) => {
  const panel = page.getByRole('tab', { name: /Matching Fields/ });
  await expect(panel).toBeVisible();
  if ((await panel.getAttribute('aria-expanded')) !== 'true') {
    await panel.click();
  }
  await expect(panel).toHaveAttribute('aria-expanded', 'true');
};

export const restoreDefaultSearchSettings = async (page: Page) => {
  const { apiContext } = await getApiContext(page);

  const response = await apiContext.put(
    '/api/v1/system/settings/reset/searchSettings'
  );
  const data = await response.json();

  const tableConfig = data?.assetTypeConfigurations?.find(
    (config: { assetType: string }) => config.assetType === 'table'
  );

  expect(tableConfig).toEqual(mockEntitySearchConfig);
};
