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

// A rail click farther than this from the handle cannot land on the handle
// itself (which would start a drag instead of setting a value).
const SLIDER_HANDLE_CLEARANCE_PX = 12;

/**
 * Sets an antd Slider to exactly `value`, then asserts it landed there.
 *
 * Pointer input alone cannot do this: a mouse drag often fires no onChange at
 * all, and a rail click lands within about a pixel of the target, which is
 * several steps off. So a rail click only closes a large gap, and the arrow
 * keys, which move the handle exactly one `step` per press, finish the job.
 * Every attempt re-reads `aria-valuenow`, so a missed click or a dropped key
 * is retried from the slider's real state.
 */
export async function setSliderValue(
  page: Page,
  testId: string,
  value: number,
  min = 0,
  max = 100,
  valueDisplayTestId?: string,
  step = 0.1
) {
  const slider = page.getByTestId(testId).filter({ visible: true });
  const rail = slider.locator('.ant-slider');
  const handle = slider.getByRole('slider');

  const toSteps = (v: number) => Math.round((v - min) / step);
  const target = toSteps(value);
  const currentSteps = async () =>
    toSteps(Number(await handle.getAttribute('aria-valuenow')));

  await expect(async () => {
    const box = await rail.boundingBox();
    if (!box) {
      throw new Error(`Slider ${testId} not found`);
    }
    const pxPerStep = (box.width * step) / (max - min);
    const gapPx = async () =>
      Math.abs(target - (await currentSteps())) * pxPerStep;

    if ((await gapPx()) > SLIDER_HANDLE_CLEARANCE_PX) {
      await rail.click({
        position: {
          x: ((value - min) / (max - min)) * box.width,
          y: box.height / 2,
        },
      });
      // Only key-step from a settled, nearby value; a missed click retries.
      await expect
        .poll(gapPx, { timeout: 2_000 })
        .toBeLessThanOrEqual(SLIDER_HANDLE_CLEARANCE_PX);
    }

    const delta = target - (await currentSteps());
    await handle.focus();
    for (let i = 0; i < Math.abs(delta); i++) {
      await page.keyboard.press(delta > 0 ? 'ArrowRight' : 'ArrowLeft');
    }

    await expect.poll(currentSteps, { timeout: 2_000 }).toBe(target);
  }).toPass({ timeout: 15_000 });

  if (valueDisplayTestId) {
    await expect(
      page.getByTestId(valueDisplayTestId).filter({ visible: true })
    ).toHaveText(String(value));
  }
}

// The entity search settings page opens with the "Ranking Details" accordion
// panel expanded by default, so the "Matching Fields" panel (and its field
// configuration rows) is collapsed and not mounted. Expand it before
// interacting with any field-configuration control.
export const openMatchingFieldsPanel = async (page: Page) => {
  const firstFieldHeader = page.getByTestId('field-container-header').first();

  const isMatchingFieldsPanelOpen = await firstFieldHeader
    .isVisible()
    .catch(() => false);

  if (!isMatchingFieldsPanelOpen) {
    await page
      .locator('.ant-collapse-header')
      .filter({ hasText: 'Matching Fields' })
      .getByText('Matching Fields')
      .click();

    await firstFieldHeader.waitFor({ state: 'visible' });
  }
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
