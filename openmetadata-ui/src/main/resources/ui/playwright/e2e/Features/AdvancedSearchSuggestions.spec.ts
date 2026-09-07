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

import { expect } from '@playwright/test';
import { toLower } from 'lodash';
import { ADVANCED_SEARCH_SUGGESTION_FIELDS } from '../../constant/advancedSearch';
import { SidebarItem } from '../../constant/sidebar';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import {
  getFieldsSuggestionSearchText,
  selectOption,
  showAdvancedSearchDialog,
} from '../../utils/advancedSearch';
import { redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { waitForAggregation } from '../../utils/searchAggregation';
import { sidebarClick } from '../../utils/sidebar';
import { test } from '../fixtures/pages';

test.describe('Advanced Search Suggestions', () => {
  const testData = { fieldSearchData: {} as Record<string, string> };

  test.beforeAll('Setup pre-requests', async () => {
    testData.fieldSearchData = {
      database: EntityDataClass.database.entityResponseData.name,
      databaseSchema: EntityDataClass.databaseSchema.entityResponseData.name,
      apiCollection: EntityDataClass.apiCollection1.entityResponseData.name,
      glossary: EntityDataClass.glossary1.responseData.displayName,
      domains: EntityDataClass.domain1.responseData.displayName,
      dataProduct: EntityDataClass.dataProduct1.responseData.displayName,
      tag: EntityDataClass.tag1.responseData.fullyQualifiedName,
      certification:
        EntityDataClass.certificationTag1.responseData.fullyQualifiedName,
      tier: EntityDataClass.tierTag1.responseData.fullyQualifiedName,
    };
  });

  ADVANCED_SEARCH_SUGGESTION_FIELDS.forEach((field) => {
    test(`Verify suggestions for ${field.label} field`, async ({ page }) => {
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.EXPLORE);
      await waitForAllLoadersToDisappear(page);
      await showAdvancedSearchDialog(page);

      const ruleLocator = page.locator('.rule').nth(0);

      await selectOption(
        page,
        ruleLocator.locator('.rule--field'),
        field.label,
        true
      );

      await selectOption(page, ruleLocator.locator('.rule--operator'), '==');

      const dropdownInput = ruleLocator.locator(
        '.widget--widget input[role="combobox"]'
      );

      const searchText = toLower(
        getFieldsSuggestionSearchText(field.label, testData.fieldSearchData)
      );

      const suggestionOption = page
        .locator('[role="listbox"]:visible [role="option"]')
        .filter({ hasText: searchText });

      // The ComboBox popover re-mounts under load and the isMounting gate can
      // drop the aggregate request — the listbox then opens empty. Retry the
      // fill until at least one matching option renders; each attempt re-arms
      // waitForAggregation so we don't block forever on a dropped request, and
      // the helper matches the typed-value aggregate specifically so the wait
      // cannot resolve early on the dropdown-open request.
      await expect(async () => {
        // .catch at construction: the exact dropped-aggregate case this fix
        // targets leaves the underlying waitForResponse pending, so it will
        // reject with a Playwright timeout ~30s later once the 5s fallback
        // timer has already won the race. Without the catch, every toPass
        // attempt orphans a fresh promise and Playwright surfaces them as
        // unhandled rejections that can fail the test.
        const aggregateResponse = waitForAggregation(page, {
          field: field.fieldName,
          value: searchText,
        }).catch(() => undefined);
        await dropdownInput.fill('');
        await dropdownInput.fill(searchText);
        await Promise.race([
          aggregateResponse,
          new Promise((resolve) => setTimeout(resolve, 5_000)),
        ]);
        await expect(suggestionOption).not.toHaveCount(0, { timeout: 5_000 });
      }).toPass({ timeout: 30_000, intervals: [500, 1_000, 2_000] });
    });
  });
});
