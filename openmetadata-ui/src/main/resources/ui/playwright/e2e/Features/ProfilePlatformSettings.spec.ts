/*
 *  Copyright 2026 Collate.
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
import { test } from '../../support/fixtures/base';
import {
  chooseSelectOption,
  getApiContext,
  redirectToHomePage,
  uuid,
} from '../../utils/common';
import { clickAndWaitFor } from '../../utils/waitHelpers';
import { enableAiAppMode } from '../Utils/appMode';

test.use({ storageState: 'playwright/.auth/admin.json' });

const openPlatformSettings = async (page: Page) => {
  await enableAiAppMode(page);
  // Only the user menu is needed; home-page widget loaders are irrelevant here.
  await redirectToHomePage(page, false);
  await page.getByTestId('ask-ai-user-menu-trigger').click();
  await page.getByTestId('ai-user-menu-profile').click();
  await expect(page.getByTestId('ai-profile-page')).toBeVisible();
  await page.getByTestId('profile-nav-platform-settings').click();
  await expect(page.getByTestId('platform-settings-landing')).toBeVisible();
};

const card = (page: Page, id: string) =>
  page.getByTestId(`platform-settings-card-${id}`);

// No global loader wait here: widgets on the page behind the modal keep their
// own loaders, so each test asserts on the page content instead.
const openCard = async (page: Page, id: string) => {
  await card(page, id).click();
};

const header = (page: Page) => page.getByTestId('profile-content-header');

const fillField = async (page: Page, testId: string, value: string) => {
  await page.getByTestId(testId).locator('input').fill(value);
};

test.describe(
  'Profile Platform Settings',
  { tag: ['@Platform', '@Features'] },
  () => {
    test('data quality: adds, edits and deletes a custom dimension', async ({
      page,
    }) => {
      // Create, edit and delete against the real API, behind a list load.
      test.slow();
      // Dimensions are entities with unique names, so this runs against the
      // real API and cleans up after itself.
      const name = `pw_dimension_${uuid()}`;
      await openPlatformSettings(page);

      try {
        await openCard(page, 'data-quality');
        await expect(page.getByTestId('dimensions-table')).toBeVisible({
          timeout: 30_000,
        });

        await header(page).getByTestId('add-dimension').click();
        await fillField(page, 'dimension-name', name);
        await fillField(page, 'dimension-display-name', 'PW Dimension');
        await page.getByTestId('dimension-color-2').click();
        await clickAndWaitFor(
          page,
          page.getByTestId('save-button'),
          '**/api/v1/dataQuality/dimensions',
          201
        );

        const row = page.getByTestId(`dimension-${name}`);
        await expect(row).toContainText('PW Dimension');
        await expect(row).toContainText('Custom');

        await clickAndWaitFor(
          page,
          page.getByTestId(`edit-${name}`),
          /\/api\/v1\/dataQuality\/dimensions\?/
        );
        await expect(
          page.getByTestId('dimension-name').locator('input')
        ).toBeDisabled();
        await fillField(page, 'dimension-display-name', 'PW Renamed');
        await clickAndWaitFor(
          page,
          page.getByTestId('save-button'),
          '**/api/v1/dataQuality/dimensions/*'
        );
        await expect(row).toContainText('PW Renamed');

        await page.getByTestId(`delete-${name}`).click();
        await expect(page.getByTestId('delete-dimension-dialog')).toBeVisible();
        await clickAndWaitFor(
          page,
          page.getByTestId('confirm-delete-dimension'),
          '**/api/v1/dataQuality/dimensions/*'
        );
        await expect(row).toHaveCount(0);
      } finally {
        const { apiContext, afterAction } = await getApiContext(page);
        const list = await apiContext.get(
          '/api/v1/dataQuality/dimensions?limit=1000'
        );
        const leftover = ((await list.json()).data ?? []).find(
          (dimension: { name: string }) => dimension.name === name
        );
        if (leftover) {
          await apiContext.delete(
            `/api/v1/dataQuality/dimensions/${leftover.id}?hardDelete=true`
          );
        }
        await afterAction();
      }
    });

    test('learning resources: adds, edits and deletes a resource', async ({
      page,
    }) => {
      // Create, edit and delete against the real API, behind a list load.
      test.slow();
      // Learning resources are entities with unique names, so this runs
      // against the real API and cleans up after itself.
      const name = `pw-resource-${uuid()}`;
      await openPlatformSettings(page);

      try {
        await openCard(page, 'learning-resources');
        await expect(page.getByTestId('learning-resources-table')).toBeVisible({
          timeout: 30_000,
        });

        await header(page).getByTestId('create-resource').click();
        await fillField(page, 'name-input', name);
        await page
          .getByTestId('description-input')
          .locator('textarea')
          .fill('Created by Playwright.');
        await chooseSelectOption(
          page.getByTestId('resource-type-select'),
          page.getByRole('option', { name: 'Video', exact: true })
        );
        // chooseSelectOption, not fill-then-click: the form panel scrolls, and
        // the scroll Playwright makes before clicking an option closes an open
        // react-aria popover, leaving the click waiting on a detached option.
        for (const [testId, option] of [
          ['categories-select', 'Discovery'],
          ['contexts-select', 'Glossary'],
        ]) {
          await chooseSelectOption(
            page.getByTestId(testId),
            page.getByRole('option', { name: option, exact: true })
          );
          await expect(page.getByTestId(testId)).toContainText(option);
        }
        await fillField(
          page,
          'source-url-input',
          'https://www.youtube.com/watch?v=pw-test'
        );
        await clickAndWaitFor(
          page,
          page.getByTestId('save-button'),
          '**/api/v1/learning/resources',
          201
        );

        await page.getByTestId('search-resources').locator('input').fill(name);
        const row = page.getByTestId(name);
        await expect(row).toBeVisible();

        await clickAndWaitFor(
          page,
          page.getByTestId(`edit-${name}`),
          '**/api/v1/learning/resources/*'
        );
        await expect(
          page.getByTestId('name-input').locator('input')
        ).toBeDisabled();
        await page
          .getByTestId('description-input')
          .locator('textarea')
          .fill('Edited by Playwright.');
        await clickAndWaitFor(
          page,
          page.getByTestId('save-button'),
          '**/api/v1/learning/resources'
        );

        await page.getByTestId('search-resources').locator('input').fill(name);
        await page.getByTestId(`delete-${name}`).click();
        await clickAndWaitFor(
          page,
          page.getByTestId('confirm-button'),
          '**/api/v1/learning/resources/*'
        );
        await expect(row).toHaveCount(0);
      } finally {
        const { apiContext, afterAction } = await getApiContext(page);
        const existing = await apiContext.get(
          `/api/v1/learning/resources/name/${encodeURIComponent(
            name
          )}?include=all`
        );
        if (existing.ok()) {
          const { id } = await existing.json();
          await apiContext.delete(
            `/api/v1/learning/resources/${id}?hardDelete=true`
          );
        }
        await afterAction();
      }
    });
  }
);
