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

import { expect, test } from '@playwright/test';
import { DOMAIN_TAGS } from '../../../constant/config';
import {
  ENTITY_TYPE_OPTIONS,
  FILTER_LABELS,
  TEST_PLATFORM_OPTIONS,
} from '../../../constant/testDefinitionFilter';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import {
  closeFilterDropdown,
  navigateToRulesLibrary,
  openFilterDropdown,
  toggleFilter,
} from '../../../utils/testDefinitionFilter';

test.use({ storageState: 'playwright/.auth/admin.json' });

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
        await openFilterDropdown(page, FILTER_LABELS.ENTITY_TYPE);

        const tableRadio = page.getByTestId('TABLE-radio');
        await expect(tableRadio).toBeChecked();

        await closeFilterDropdown(page);
      });

      await test.step('Change filter selection', async () => {
        await openFilterDropdown(page, FILTER_LABELS.ENTITY_TYPE);

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
        await openFilterDropdown(page, FILTER_LABELS.ENTITY_TYPE);

        const tableRadioAfterChange = page.getByTestId('TABLE-radio');
        await expect(tableRadioAfterChange).not.toBeChecked();

        const columnRadio = page.getByTestId('COLUMN-radio');
        await expect(columnRadio).toBeChecked();

        await closeFilterDropdown(page);
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
        await openFilterDropdown(page, FILTER_LABELS.ENTITY_TYPE);

        const tableRadio = page.getByTestId('TABLE-radio');
        await expect(tableRadio).toBeChecked();

        await closeFilterDropdown(page);

        await openFilterDropdown(page, FILTER_LABELS.TEST_PLATFORMS);

        const openMetadataRadio = page.getByTestId('OpenMetadata-radio');
        await expect(openMetadataRadio).toBeChecked();

        await closeFilterDropdown(page);
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
        await openFilterDropdown(page, FILTER_LABELS.ENTITY_TYPE);

        const tableRadio = page.getByTestId('TABLE-radio');
        await expect(tableRadio).toBeVisible();
        await expect(tableRadio).toHaveAttribute('type', 'radio');

        const tableCheckbox = page.getByTestId('TABLE-checkbox');
        await expect(tableCheckbox).not.toBeVisible();

        await closeFilterDropdown(page);
      });

      await test.step('Test toggle selection behavior', async () => {
        await openFilterDropdown(page, FILTER_LABELS.ENTITY_TYPE);

        const tableOption = page.getByTestId(ENTITY_TYPE_OPTIONS.TABLE);
        await expect(tableOption).toBeVisible();
        await tableOption.click();

        const tableRadioAfterClick = page.getByTestId('TABLE-radio');
        await expect(tableRadioAfterClick).toBeChecked();

        await tableOption.click();

        const tableRadioAfterDeselect = page.getByTestId('TABLE-radio');
        await expect(tableRadioAfterDeselect).not.toBeChecked();

        await closeFilterDropdown(page);
      });

      await test.step('Verify update button and dropdown closing', async () => {
        await openFilterDropdown(page, FILTER_LABELS.ENTITY_TYPE);

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

        await expect(page.getByTestId('drop-down-menu')).not.toBeVisible();

        expect(page.url()).toContain('entityType=TABLE');
      });

      await test.step(
        'Verify no clear all button in single-select mode',
        async () => {
          await openFilterDropdown(page, FILTER_LABELS.ENTITY_TYPE);

          const clearButton = page.getByTestId('clear-button');
          await expect(clearButton).not.toBeVisible();

          await closeFilterDropdown(page);
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
          ENTITY_TYPE_OPTIONS.COLUMN
        );
      });

      await test.step(
        'Navigate to page 2 and verify pagination resets on filter change',
        async () => {
          await expect(page.getByTestId('pagination')).toBeVisible();

          const nextButton = page.getByTestId('next');
          await expect(nextButton).toBeEnabled();
          await nextButton.click();
          await waitForAllLoadersToDisappear(page);

          expect(page.url()).toMatch(/currentPage=2/);

          await toggleFilter(
            page,
            FILTER_LABELS.ENTITY_TYPE,
            ENTITY_TYPE_OPTIONS.TABLE
          );

          expect(page.url()).not.toContain('currentPage=2');
          expect(page.url()).toContain('entityType=TABLE');
        }
      );
    });

    test('should not revert to previous value when changing filter selection', async ({
      page,
    }) => {
      test.slow();

      await test.step('Select initial testPlatform filter (dbt)', async () => {
        const response = await toggleFilter(
          page,
          FILTER_LABELS.TEST_PLATFORMS,
          TEST_PLATFORM_OPTIONS.DBT
        );

        const responseData = await response.json();

        expect(page.url()).toContain('testPlatforms=dbt');
        expect(responseData.data).toBeDefined();
      });

      await test.step(
        'Change to a different testPlatform filter (OpenMetadata)',
        async () => {
          await toggleFilter(
            page,
            FILTER_LABELS.TEST_PLATFORMS,
            TEST_PLATFORM_OPTIONS.OPENMETADATA
          );

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

          await openFilterDropdown(page, FILTER_LABELS.TEST_PLATFORMS);

          const openMetadataRadio = page.getByTestId('OpenMetadata-radio');

          await expect(openMetadataRadio).toBeChecked();

          await closeFilterDropdown(page);
        }
      );

      await test.step(
        'Change back to previous testPlatform filter (dbt)',
        async () => {
          await toggleFilter(
            page,
            FILTER_LABELS.TEST_PLATFORMS,
            TEST_PLATFORM_OPTIONS.DBT
          );

          expect(page.url()).toContain('testPlatforms=dbt');
          expect(page.url()).not.toContain('testPlatforms=OpenMetadata');
        }
      );

      await test.step('Verify final selection persists', async () => {
        await openFilterDropdown(page, FILTER_LABELS.TEST_PLATFORMS);

        const dbtRadio = page.getByTestId('dbt-radio');

        await expect(dbtRadio).toBeChecked();
        expect(page.url()).toContain('testPlatforms=dbt');

        await closeFilterDropdown(page);
      });
    });
  }
);
