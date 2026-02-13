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

import { expect, Page, test } from '@playwright/test';
import { DOMAIN_TAGS } from '../../../constant/config';
import { redirectToHomePage } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';

test.use({ storageState: 'playwright/.auth/admin.json' });

const FILTER_LABELS = {
  ENTITY_TYPE: 'Entity Type',
  TEST_PLATFORMS: 'Test Platforms',
};

// Entity Type enum values are uppercase
const ENTITY_TYPE_OPTIONS = {
  TABLE: 'TABLE',
  COLUMN: 'COLUMN',
};

// Test Platform enum values use specific casing
const TEST_PLATFORM_OPTIONS = {
  OPENMETADATA: 'OpenMetadata',
  DBT: 'dbt',
};

const navigateToRulesLibrary = async (page: Page) => {
  await redirectToHomePage(page);
  const testDefinitionResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/dataQuality/testDefinitions') &&
      response.request().method() === 'GET'
  );
  await page.goto('/rules-library');
  await testDefinitionResponse;
  await waitForAllLoadersToDisappear(page);
};

const toggleFilter = async (
  page: Page,
  filterLabel: string,
  optionKey: string
) => {
  await page.click(`[data-testid="search-dropdown-${filterLabel}"]`);
  await page.waitForSelector('[data-testid="drop-down-menu"]', {
    state: 'visible',
  });

  const option = page.getByTestId(optionKey);
  await expect(option).toBeVisible();
  await option.click();

  const updateResponse = page.waitForResponse((response) =>
    response.url().includes('/api/v1/dataQuality/testDefinitions')
  );

  const updateBtn = page.getByTestId('update-btn');
  await expect(updateBtn).toBeVisible();
  await expect(updateBtn).toBeEnabled();
  await updateBtn.click();

  await updateResponse;
  await waitForAllLoadersToDisappear(page);
};

test.describe(
  'Test Definition Filters',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Rules_Library` },
  () => {
    test.beforeEach(async ({ page }) => {
      await navigateToRulesLibrary(page);
    });

    test('should filter test definitions with single-select filters', async ({
      page,
    }) => {
      test.slow();
      await test.step('Select entity type filter', async () => {
        const apiResponsePromise = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/dataQuality/testDefinitions') &&
            response.url().includes('entityType=TABLE')
        );

        await toggleFilter(
          page,
          FILTER_LABELS.ENTITY_TYPE,
          ENTITY_TYPE_OPTIONS.TABLE
        );

        const response = await apiResponsePromise;
        expect(response.status()).toBe(200);

        expect(page.url()).toContain('entityType=TABLE');

        await expect(page.getByTestId('test-definition-table')).toBeVisible();
      });

      await test.step('Verify radio button is checked', async () => {
        await page.click(
          `[data-testid="search-dropdown-${FILTER_LABELS.ENTITY_TYPE}"]`
        );
        await page.waitForSelector('[data-testid="drop-down-menu"]', {
          state: 'visible',
        });

        const tableRadio = page.getByTestId('TABLE-radio');
        await expect(tableRadio).toBeChecked();

        await page.keyboard.press('Escape');
      });

      await test.step('Change filter selection', async () => {
        await page.click(
          `[data-testid="search-dropdown-${FILTER_LABELS.ENTITY_TYPE}"]`
        );
        await page.waitForSelector('[data-testid="drop-down-menu"]', {
          state: 'visible',
        });

        const columnOption = page.getByTestId(ENTITY_TYPE_OPTIONS.COLUMN);
        await expect(columnOption).toBeVisible();

        const updateResponse = page.waitForResponse((response) =>
          response.url().includes('entityType=COLUMN')
        );

        await columnOption.click();

        const updateBtn = page.getByTestId('update-btn');
        await updateBtn.click();

        await updateResponse;
        await waitForAllLoadersToDisappear(page);

        expect(page.url()).toContain('entityType=COLUMN');
        expect(page.url()).not.toContain('entityType=TABLE');
      });

      await test.step('Verify previous selection is cleared', async () => {
        await page.click(
          `[data-testid="search-dropdown-${FILTER_LABELS.ENTITY_TYPE}"]`
        );
        await page.waitForSelector('[data-testid="drop-down-menu"]', {
          state: 'visible',
        });

        const tableRadioAfterChange = page.getByTestId('TABLE-radio');
        await expect(tableRadioAfterChange).not.toBeChecked();

        const columnRadio = page.getByTestId('COLUMN-radio');
        await expect(columnRadio).toBeChecked();

        await page.keyboard.press('Escape');
      });
    });

    test('should restore and persist filters from URL', async ({ page }) => {
      test.slow();
      await test.step('Load page with URL parameters', async () => {
        await page.goto(
          '/rules-library?entityType=TABLE&testPlatforms=OpenMetadata'
        );
        await waitForAllLoadersToDisappear(page);

        expect(page.url()).toContain('entityType=TABLE');
        expect(page.url()).toContain('testPlatforms=OpenMetadata');
      });

      await test.step('Verify filters are pre-selected', async () => {
        await page.click(
          `[data-testid="search-dropdown-${FILTER_LABELS.ENTITY_TYPE}"]`
        );
        await page.waitForSelector('[data-testid="drop-down-menu"]', {
          state: 'visible',
        });

        const tableRadio = page.getByTestId('TABLE-radio');
        await expect(tableRadio).toBeChecked();

        await page.keyboard.press('Escape');

        await page.click(
          `[data-testid="search-dropdown-${FILTER_LABELS.TEST_PLATFORMS}"]`
        );
        await page.waitForSelector('[data-testid="drop-down-menu"]', {
          state: 'visible',
        });

        const openMetadataRadio = page.getByTestId('OpenMetadata-radio');
        await expect(openMetadataRadio).toBeChecked();

        await page.keyboard.press('Escape');
      });

      await test.step(
        'Verify persistence through browser navigation',
        async () => {
          await page.goBack();
          await waitForAllLoadersToDisappear(page);

          expect(page.url()).not.toContain('entityType');
          expect(page.url()).not.toContain('testPlatforms');

          await page.goForward();
          await waitForAllLoadersToDisappear(page);

          expect(page.url()).toContain('entityType=TABLE');
          expect(page.url()).toContain('testPlatforms=OpenMetadata');
        }
      );
    });

    test('should handle filter UI interactions correctly', async ({ page }) => {
      await test.step('Verify radio button rendering', async () => {
        await page.click(
          `[data-testid="search-dropdown-${FILTER_LABELS.ENTITY_TYPE}"]`
        );
        await page.waitForSelector('[data-testid="drop-down-menu"]', {
          state: 'visible',
        });

        const tableRadio = page.getByTestId('TABLE-radio');
        await expect(tableRadio).toBeVisible();
        await expect(tableRadio).toHaveAttribute('type', 'radio');

        const tableCheckbox = page.getByTestId('TABLE-checkbox');
        await expect(tableCheckbox).not.toBeVisible();

        await page.keyboard.press('Escape');
      });

      await test.step('Test toggle selection behavior', async () => {
        await page.click(
          `[data-testid="search-dropdown-${FILTER_LABELS.ENTITY_TYPE}"]`
        );
        await page.waitForSelector('[data-testid="drop-down-menu"]', {
          state: 'visible',
        });

        const tableOption = page.getByTestId(ENTITY_TYPE_OPTIONS.TABLE);
        await expect(tableOption).toBeVisible();
        await tableOption.click();

        const tableRadioAfterClick = page.getByTestId('TABLE-radio');
        await expect(tableRadioAfterClick).toBeChecked();

        await tableOption.click();

        const tableRadioAfterDeselect = page.getByTestId('TABLE-radio');
        await expect(tableRadioAfterDeselect).not.toBeChecked();

        await page.keyboard.press('Escape');
      });

      await test.step('Verify update button and dropdown closing', async () => {
        await page.click(
          `[data-testid="search-dropdown-${FILTER_LABELS.ENTITY_TYPE}"]`
        );
        await page.waitForSelector('[data-testid="drop-down-menu"]', {
          state: 'visible',
        });

        const tableOption = page.getByTestId(ENTITY_TYPE_OPTIONS.TABLE);
        await tableOption.click();

        const updateBtn = page.getByTestId('update-btn');
        await expect(updateBtn).toBeVisible();
        await expect(updateBtn).toBeEnabled();

        const updateResponse = page.waitForResponse((response) =>
          response.url().includes('/api/v1/dataQuality/testDefinitions')
        );

        await updateBtn.click();

        await updateResponse;
        await waitForAllLoadersToDisappear(page);

        await expect(
          page.locator('[data-testid="drop-down-menu"]')
        ).not.toBeVisible();

        expect(page.url()).toContain('entityType=TABLE');
      });

      await test.step(
        'Verify no clear all button in single-select mode',
        async () => {
          await page.click(
            `[data-testid="search-dropdown-${FILTER_LABELS.ENTITY_TYPE}"]`
          );
          await page.waitForSelector('[data-testid="drop-down-menu"]', {
            state: 'visible',
          });

          const clearButton = page.getByTestId('clear-button');
          await expect(clearButton).not.toBeVisible();

          await page.keyboard.press('Escape');
        }
      );
    });

    test('should handle multiple filter operations', async ({ page }) => {
      await test.step('Apply first filter', async () => {
        await toggleFilter(
          page,
          FILTER_LABELS.ENTITY_TYPE,
          ENTITY_TYPE_OPTIONS.COLUMN
        );
        expect(page.url()).toContain('entityType=COLUMN');
      });

      await test.step('Apply second filter', async () => {
        await toggleFilter(
          page,
          FILTER_LABELS.TEST_PLATFORMS,
          TEST_PLATFORM_OPTIONS.OPENMETADATA
        );

        expect(page.url()).toContain('entityType=COLUMN');
        expect(page.url()).toContain('testPlatforms=OpenMetadata');
      });

      await test.step('Remove first filter', async () => {
        await toggleFilter(
          page,
          FILTER_LABELS.ENTITY_TYPE,
          ENTITY_TYPE_OPTIONS.COLUMN
        );

        expect(page.url()).not.toContain('entityType=COLUMN');
        expect(page.url()).toContain('testPlatforms=OpenMetadata');
      });

      await test.step('Remove second filter', async () => {
        await toggleFilter(
          page,
          FILTER_LABELS.TEST_PLATFORMS,
          TEST_PLATFORM_OPTIONS.OPENMETADATA
        );

        expect(page.url()).not.toContain('entityType');
        expect(page.url()).not.toContain('testPlatforms');
      });
    });

    test('should make correct API calls and show filtered results', async ({
      page,
    }) => {
      await test.step('Apply filter and validate API', async () => {
        const apiResponsePromise = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/dataQuality/testDefinitions') &&
            response.url().includes('entityType=TABLE')
        );

        await toggleFilter(
          page,
          FILTER_LABELS.ENTITY_TYPE,
          ENTITY_TYPE_OPTIONS.TABLE
        );

        const response = await apiResponsePromise;
        expect(response.status()).toBe(200);

        const responseData = await response.json();
        expect(responseData.data).toBeDefined();

        const tableTestDefinitions = responseData.data.filter(
          (def: { entityType: string }) =>
            def.entityType === ENTITY_TYPE_OPTIONS.TABLE
        );

        expect(tableTestDefinitions.length).toBeGreaterThan(0);
      });

      await test.step('Verify filtered results in UI', async () => {
        await expect(page.getByTestId('test-definition-table')).toBeVisible();

        const rows = await page.locator('table tbody tr').count();
        expect(rows).toBeGreaterThan(0);
      });
    });

    test('should reset pagination when filters change', async ({ page }) => {
      await test.step('Apply initial filter', async () => {
        await toggleFilter(
          page,
          FILTER_LABELS.ENTITY_TYPE,
          ENTITY_TYPE_OPTIONS.TABLE
        );
      });

      await test.step('Navigate to page 2 if pagination exists', async () => {
        const paginationExists = await page
          .locator('.ant-pagination')
          .isVisible();

        if (paginationExists) {
          const nextButton = page.locator('.ant-pagination-next');

          if (await nextButton.isEnabled()) {
            await nextButton.click();
            await waitForAllLoadersToDisappear(page);

            expect(page.url()).toMatch(/page=2/);

            await test.step(
              'Change filter and verify pagination reset',
              async () => {
                await toggleFilter(
                  page,
                  FILTER_LABELS.ENTITY_TYPE,
                  ENTITY_TYPE_OPTIONS.COLUMN
                );

                expect(page.url()).not.toContain('page=2');
                expect(page.url()).toContain('entityType=COLUMN');
              }
            );
          }
        }
      });
    });

    test('should not revert to previous value when changing filter selection', async ({
      page,
    }) => {
      test.slow();

      await test.step('Select initial testPlatform filter (dbt)', async () => {
        const testDefinitionResponse = page.waitForResponse((response) =>
          response.url().includes('/api/v1/dataQuality/testDefinitions')
        );

        await toggleFilter(
          page,
          FILTER_LABELS.TEST_PLATFORMS,
          TEST_PLATFORM_OPTIONS.DBT
        );

        const response = await testDefinitionResponse;
        const responseData = await response.json();

        expect(page.url()).toContain('testPlatforms=dbt');
        expect(responseData.data).toBeDefined();
      });

      await test.step(
        'Change to a different testPlatform filter (OpenMetadata)',
        async () => {
          const testDefinitionResponse = page.waitForResponse((response) =>
            response.url().includes('/api/v1/dataQuality/testDefinitions')
          );

          await toggleFilter(
            page,
            FILTER_LABELS.TEST_PLATFORMS,
            TEST_PLATFORM_OPTIONS.OPENMETADATA
          );

          await testDefinitionResponse;

          expect(page.url()).toContain('testPlatforms=OpenMetadata');
          expect(page.url()).not.toContain('testPlatforms=dbt');
        }
      );

      await test.step(
        'Verify the new filter persists after page reload',
        async () => {
          await page.reload();
          await waitForAllLoadersToDisappear(page);

          expect(page.url()).toContain('testPlatforms=OpenMetadata');
          expect(page.url()).not.toContain('testPlatforms=dbt');

          await page.click(
            `[data-testid="search-dropdown-${FILTER_LABELS.TEST_PLATFORMS}"]`
          );
          await page.waitForSelector('[data-testid="drop-down-menu"]', {
            state: 'visible',
          });

          const openMetadataRadio = page.getByTestId('OpenMetadata-radio');

          await expect(openMetadataRadio).toBeChecked();

          await page.keyboard.press('Escape');
        }
      );

      await test.step(
        'Change back to previous testPlatform filter (dbt)',
        async () => {
          const testDefinitionResponse = page.waitForResponse((response) =>
            response
              .url()
              .includes('/api/v1/dataQuality/testDefinitions?limit=15')
          );

          await toggleFilter(
            page,
            FILTER_LABELS.TEST_PLATFORMS,
            TEST_PLATFORM_OPTIONS.DBT
          );

          await testDefinitionResponse;

          expect(page.url()).toContain('testPlatforms=dbt');
          expect(page.url()).not.toContain('testPlatforms=OpenMetadata');
        }
      );

      await test.step('Verify final selection persists', async () => {
        await page.click(
          `[data-testid="search-dropdown-${FILTER_LABELS.TEST_PLATFORMS}"]`
        );
        await page.waitForSelector('[data-testid="drop-down-menu"]', {
          state: 'visible',
        });

        const dbtRadio = page.getByTestId('dbt-radio');

        await expect(dbtRadio).toBeChecked();
        expect(page.url()).toContain('testPlatforms=dbt');

        await page.keyboard.press('Escape');
      });
    });
  }
);
