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

export const mockEntitySearchConfig = {
  assetType: 'table',
  searchFields: [
    { field: 'displayName.keyword', boost: 20, matchType: 'exact' },
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
    { field: 'columns.children.name.keyword', boost: 1, matchType: 'exact' },
    { field: 'columnNamesFuzzy', boost: 1.5, matchType: 'standard' },
  ],
  highlightFields: ['name', 'description', 'displayName'],
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
    },
    {
      name: 'databaseSchema.displayName.keyword',
      type: 'terms',
      field: 'databaseSchema.displayName.keyword',
    },
  ],
  termBoosts: [],
  fieldValueBoosts: [
    {
      field: 'usageSummary.monthlyStats.count',
      factor: 3.0,
      modifier: 'log1p',
      missing: 0.0,
    },
    {
      field: 'usageSummary.monthlyStats.percentileRank',
      factor: 0.1,
      modifier: 'none',
      missing: 0.0,
    },
  ],
  scoreMode: 'sum',
  boostMode: 'sum',
};

export async function setSliderValue(
  page: Page,
  testId: string,
  value: number,
  min = 0,
  max = 100
) {
  const sliderHandle = page.getByTestId(testId).locator('.ant-slider-handle');
  const sliderTrack = page.getByTestId(testId).locator('.ant-slider-track');

  // Get slider track dimensions
  const box = await sliderTrack.boundingBox();
  if (!box) {
    throw new Error('Slider track not found');
  }

  const { x, width } = box;

  // Calculate the exact x-position for the value
  const valuePosition = x + ((value - min) / (max - min)) * width;

  // Move the slider handle to the calculated position
  await sliderHandle.hover(); // Ensure visibility
  await page.mouse.down();
  await page.mouse.move(valuePosition, box.y);
  await page.mouse.up();
}

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
